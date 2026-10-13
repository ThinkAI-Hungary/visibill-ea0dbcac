-- =============================================================================
-- TENY M3.3 – ÉCS-arányos támogatási passzív időbeli elhatárolás (PIE) feloldó RPC
-- Terv: implementation-plans/TENY_implementacios_terv.md (M3.3)
--
--  Sztv. 45. § (2) és 77. § (3) szerinti időbeli elhatárolás feloldása:
--  Tartozik: 483 (Támogatások passzív időbeli elhatárolása)
--  Követel:  964 (Költségek, ráfordítások ellentételezésére kapott támogatások feloldása)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.post_grant_deferral_release_to_gl(
  p_company_id uuid,
  p_asset_id uuid,
  p_grant_project_id uuid,
  p_period_date date,
  p_depreciation_amount numeric,
  p_release_amount numeric,
  p_gl_483_id uuid,
  p_gl_964_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_uid uuid;
  v_inv_number text;
  v_asset_name text;
  v_clean_inv text;
  v_doc_id text;
  v_existing_id uuid;
  v_journal_id uuid;
  v_header_id uuid;
  v_journal_number integer;
  v_project_code text;
BEGIN
  v_uid := auth.uid();

  -- Jogosultság ellenőrzése
  IF NOT public.check_user_can_auto_post_gl(p_company_id, false) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a támogatási elhatárolás könyveléséhez (cég: %)', p_company_id
      USING ERRCODE = '42501';
  END IF;

  IF p_release_amount <= 0 THEN
    RAISE EXCEPTION 'A feloldandó elhatárolás összegének pozitívnak kell lennie.'
      USING ERRCODE = '23514';
  END IF;

  IF p_gl_483_id IS NULL OR p_gl_964_id IS NULL THEN
    RAISE EXCEPTION 'Hiányzó 483 (Passzív időbeli elhatárolás) vagy 964 (Egyéb támogatási bevétel) főkönyvi számla.'
      USING ERRCODE = '23514';
  END IF;

  -- Eszköz adatok lekérdezése
  SELECT fa.inventory_number, fa.name
    INTO v_inv_number, v_asset_name
    FROM public.fixed_assets fa
   WHERE fa.id = p_asset_id
     AND fa.company_id = p_company_id;

  IF v_inv_number IS NULL THEN
    RAISE EXCEPTION 'A megadott tárgyi eszköz (%) nem található a cégnél.', p_asset_id
      USING ERRCODE = '23503';
  END IF;

  -- Pályázati projekt kód
  IF p_grant_project_id IS NOT NULL THEN
    SELECT gp.code INTO v_project_code
      FROM public.grant_projects gp
     WHERE gp.id = p_grant_project_id
       AND gp.company_id = p_company_id;
  END IF;

  v_clean_inv := regexp_replace(v_inv_number, '[^a-zA-Z0-9_-]', '_', 'g');
  v_doc_id := 'PIE-FELOLD-' || v_clean_inv || '-' || to_char(p_period_date, 'YYYYMM');

  -- Meglévő tétel ellenőrzése (idempotencia)
  SELECT id INTO v_existing_id
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = v_doc_id
     AND status <> 'SZTORNOZOTT'
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    PERFORM public.acc_unpost_journal_entry(v_existing_id, v_uid, 'Támogatási PIE feloldás újrakönyvelése');
    DELETE FROM public.acc_journal_lines WHERE header_id = v_existing_id;
    v_header_id := v_existing_id;
  ELSE
    -- Aktív Vegyes napló keresése
    SELECT id INTO v_journal_id
      FROM public.acc_journals
     WHERE company_id = p_company_id
       AND is_active = true
       AND (code IN ('VE', 'VEG') OR type = 'MIXED' OR name ILIKE '%vegyes%')
     ORDER BY CASE WHEN code = 'VE' THEN 1 WHEN type = 'MIXED' THEN 2 ELSE 3 END
     LIMIT 1;

    IF v_journal_id IS NULL THEN
      SELECT id INTO v_journal_id
        FROM public.acc_journals
       WHERE company_id = p_company_id
         AND is_active = true
       LIMIT 1;
    END IF;

    IF v_journal_id IS NULL THEN
      RAISE EXCEPTION 'Nem található aktív Vegyes könyvelési napló a cégnél.'
        USING ERRCODE = 'P0002';
    END IF;

    -- Fejléc beszúrása
    INSERT INTO public.acc_journal_headers (
      company_id,
      journal_id,
      accounting_year,
      status,
      entry_type,
      source,
      currency,
      posting_date,
      document_date,
      document_id,
      description,
      justification,
      created_by,
      posted_by
    ) VALUES (
      p_company_id,
      v_journal_id,
      EXTRACT(YEAR FROM p_period_date)::smallint,
      'PISZKOZAT',
      'NORMAL',
      'AUTOMATIKUS',
      'HUF',
      p_period_date,
      p_period_date,
      v_doc_id,
      'Támogatási PIE feloldása: ' || v_asset_name || ' (' || v_inv_number || ')' ||
        CASE WHEN v_project_code IS NOT NULL THEN ' [' || v_project_code || ']' ELSE '' END,
      'ÉCS-arányos passzív elhatárolás feloldás (Sztv. 45. § (2)). ÉCS: ' || p_depreciation_amount::text || ' Ft, Feloldás: ' || p_release_amount::text || ' Ft' ||
        CASE WHEN p_notes IS NOT NULL THEN ' — ' || p_notes ELSE '' END,
      v_uid,
      v_uid
    ) RETURNING id INTO v_header_id;
  END IF;

  -- 1. Tétel: T 483 (Passzív időbeli elhatárolás csökkenés)
  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id
  ) VALUES (
    v_header_id, 1, p_gl_483_id, 'T', p_release_amount,
    'Támogatás PIE feloldása (483) — ' || v_asset_name, p_asset_id
  );

  -- 2. Tétel: K 964 (Egyéb támogatási bevétel növekedés)
  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id
  ) VALUES (
    v_header_id, 2, p_gl_964_id, 'K', p_release_amount,
    'Támogatás egyéb bevétele (964) — ' || v_asset_name, p_asset_id
  );

  -- Véglegesítés könyveléssel
  PERFORM public.acc_post_journal_entry(v_header_id, v_uid);

  SELECT journal_number INTO v_journal_number
    FROM public.acc_journal_headers
   WHERE id = v_header_id;

  RETURN jsonb_build_object(
    'success', true,
    'header_id', v_header_id,
    'journal_number', v_journal_number,
    'document_id', v_doc_id,
    'release_amount', p_release_amount,
    'message', 'Támogatási passzív időbeli elhatárolás feloldása sikeresen lekönyvelve (' || v_doc_id || ')!'
  );
END;
$$;

-- Jogosultságok: anon és PUBLIC megvonása
REVOKE EXECUTE ON FUNCTION public.post_grant_deferral_release_to_gl FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_grant_deferral_release_to_gl TO authenticated;

NOTIFY pgrst, 'reload schema';
