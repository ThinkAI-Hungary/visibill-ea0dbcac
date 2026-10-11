-- ==============================================================================
-- Migration: 20261011060000_create_autoposter_rpc_functions.sql
-- Description: Discrepancy 2 — Domain-specifikus SECURITY DEFINER RPC-k létrehozása
--              az automatikus főkönyvi feladásokhoz (ÉCS, Aktiválás, Tartalék,
--              Osztalék, Bérfeladás), felváltva a közvetlen kliensoldali táblaírást.
--
-- Jogosultság (D-2):
--   - Cégvezető (owner, admin): ÉCS, Aktiválás, Tartalék, Bérfeladás, Osztalék
--   - Bérszámfejtő (payroll_specialist): Bérfeladás és Osztalék
--   - Hivatásos Könyvelők (iroda_admin, senior_könyvelő, könyvelő, asszisztens): Minden
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Segédfüggvény: Céges jogosultság-ellenőrzés a feladó RPC-khez
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_user_can_auto_post_gl(
  p_company_id uuid,
  p_allow_payroll boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_has_access boolean := false;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Cégvezetés ellenőrzése (owner, admin)
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id
      AND user_id = v_uid
      AND role IN ('owner', 'admin')
  ) INTO v_has_access;

  IF v_has_access THEN
    RETURN true;
  END IF;

  -- 2. Bérszámfejtő (ha az eljárás engedélyezi, pl. bér és osztalék)
  IF p_allow_payroll THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = p_company_id
        AND user_id = v_uid
        AND role = 'payroll_specialist'
    ) INTO v_has_access;

    IF v_has_access THEN
      RETURN true;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.accounty_assignments
      WHERE company_id = p_company_id
        AND accountant_user_id = v_uid
        AND role = 'payroll_specialist'
    ) INTO v_has_access;

    IF v_has_access THEN
      RETURN true;
    END IF;
  END IF;

  -- 3. Hivatásos könyvelői jogosultság ellenőrzése (iroda_admin, senior_könyvelő, könyvelő, asszisztens)
  SELECT EXISTS (
    SELECT 1 FROM public.accounty_assignments
    WHERE company_id = p_company_id
      AND accountant_user_id = v_uid
      AND role IN ('iroda_admin', 'senior_könyvelő', 'könyvelő', 'asszisztens')
  ) INTO v_has_access;

  RETURN v_has_access;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_user_can_auto_post_gl(uuid, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_user_can_auto_post_gl(uuid, boolean) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. post_depreciation_run_to_gl: Terv szerinti ÉCS időszaki feladása
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_depreciation_run_to_gl(
  p_company_id uuid,
  p_period_type text,
  p_date_from date,
  p_date_to date,
  p_posting_date date,
  p_document_id text,
  p_description text,
  p_currency text DEFAULT 'HUF',
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_existing_id uuid;
  v_journal_id uuid;
  v_header_id uuid;
  v_item jsonb;
  v_seq smallint := 1;
  v_total_amount numeric := 0;
  v_asset_count integer := 0;
  v_item_amount numeric;
  v_debit_gl uuid;
  v_credit_gl uuid;
  v_journal_number integer;
BEGIN
  v_uid := auth.uid();

  -- Jogosultság ellenőrzése (owner, admin, vagy könyvelők)
  IF NOT public.check_user_can_auto_post_gl(p_company_id, false) THEN
    RAISE EXCEPTION 'Nincs jogosultsága az értékcsökkenés főkönyvi feladásához a céghez (id: %)', p_company_id;
  END IF;

  -- Duplikáció ellenőrzés
  SELECT id INTO v_existing_id
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = p_document_id
     AND status <> 'SZTORNOZOTT'
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ezzel a bizonylatszámmal (%) már létezik lekönyvelt tétel a Vegyes naplóban!', p_document_id;
  END IF;

  -- Vegyes napló feloldása
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
     WHERE company_id = p_company_id AND is_active = true
     LIMIT 1;
  END IF;

  IF v_journal_id IS NULL THEN
    RAISE EXCEPTION 'Nem található aktív Vegyes könyvelési napló a cégnél.';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Nincs feladandó értékcsökkenési tétel a megadott listában.';
  END IF;

  -- Napló fejléc létrehozása
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
    EXTRACT(YEAR FROM p_posting_date)::smallint,
    'PISZKOZAT',
    'NORMAL',
    'AUTOMATIKUS',
    COALESCE(p_currency, 'HUF'),
    p_posting_date,
    p_date_to,
    p_document_id,
    p_description,
    'Tárgyi eszköz analitika szerinti időszaki értékcsökkenés (' || p_document_id || ')',
    v_uid,
    v_uid
  ) RETURNING id INTO v_header_id;

  -- Sorok beszúrása
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_amount := (v_item->>'period_amount')::numeric;
    v_debit_gl := (v_item->>'debit_gl_account_id')::uuid;
    v_credit_gl := (v_item->>'credit_gl_account_id')::uuid;

    IF v_item_amount > 0 AND v_debit_gl IS NOT NULL AND v_credit_gl IS NOT NULL THEN
      -- Tartozik: 5711 ÉCS költség
      INSERT INTO public.acc_journal_lines (
        header_id, sequence_number, gl_account_id, dc_type, amount, description
      ) VALUES (
        v_header_id,
        v_seq,
        v_debit_gl,
        'T',
        v_item_amount,
        'Terv szerinti ÉCS (' || COALESCE(v_item->>'active_months', '1') || ' hó) — ' || COALESCE(v_item->>'asset_name', '') || ' (' || COALESCE(v_item->>'inventory_number', '') || ')'
      );
      v_seq := v_seq + 1;

      -- Követel: 139xx Halmozott ÉCS
      INSERT INTO public.acc_journal_lines (
        header_id, sequence_number, gl_account_id, dc_type, amount, description
      ) VALUES (
        v_header_id,
        v_seq,
        v_credit_gl,
        'K',
        v_item_amount,
        'Halmozott ÉCS elszámolása — ' || COALESCE(v_item->>'asset_name', '') || ' (' || COALESCE(v_item->>'inventory_number', '') || ')'
      );
      v_seq := v_seq + 1;

      v_total_amount := v_total_amount + v_item_amount;
      v_asset_count := v_asset_count + 1;

      -- Esemény naplózása a tárgyi eszköz analitikában
      IF (v_item->>'asset_id') IS NOT NULL THEN
        INSERT INTO public.asset_events (
          asset_id,
          company_id,
          user_id,
          event_type,
          event_date,
          description,
          old_values,
          new_values
        ) VALUES (
          (v_item->>'asset_id')::uuid,
          p_company_id,
          v_uid,
          'value_change',
          p_posting_date,
          'ÉCS elszámolás (' || p_document_id || '): ' || v_item_amount::text || ' Ft',
          jsonb_build_object(
            'accumulated_before', COALESCE((v_item->>'accumulated_before')::numeric, 0),
            'book_value_before', COALESCE((v_item->>'acquisition_value')::numeric, 0) - COALESCE((v_item->>'accumulated_before')::numeric, 0)
          ),
          jsonb_build_object(
            'period_amount', v_item_amount,
            'accumulated_after', COALESCE((v_item->>'accumulated_before')::numeric, 0) + v_item_amount,
            'book_value_after', COALESCE((v_item->>'remaining_book_value')::numeric, 0),
            'document_id', p_document_id
          )
        );
      END IF;
    END IF;
  END LOOP;

  IF v_asset_count = 0 OR v_total_amount <= 0 THEN
    DELETE FROM public.acc_journal_headers WHERE id = v_header_id;
    RAISE EXCEPTION 'Nem sikerült érvényes könyvelési tételpárokat generálni a megadott adatokból.';
  END IF;

  -- Véglegesítés és sorszámozás
  PERFORM public.acc_post_journal_entry(v_header_id, v_uid);

  SELECT journal_number INTO v_journal_number
    FROM public.acc_journal_headers
   WHERE id = v_header_id;

  RETURN jsonb_build_object(
    'success', true,
    'header_id', v_header_id,
    'journal_number', v_journal_number,
    'total_amount', v_total_amount,
    'asset_count', v_asset_count,
    'message', 'Sikeres ÉCS könyvelés! Bizonylatszám: ' || p_document_id || ' (Naplósorszám: ' || COALESCE(v_journal_number::text, '-') || ')'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.post_depreciation_run_to_gl(uuid, text, date, date, date, text, text, text, jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_depreciation_run_to_gl(uuid, text, date, date, date, text, text, text, jsonb) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. post_asset_activation_to_gl: Tárgyi eszköz aktiválás könyvelése
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_asset_activation_to_gl(
  p_company_id uuid,
  p_asset_id uuid,
  p_asset_name text,
  p_inventory_number text,
  p_acquisition_value numeric,
  p_activation_date date,
  p_gl_account_id uuid,
  p_cip_gl_account_id uuid,
  p_currency text DEFAULT 'HUF'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_clean_inv text;
  v_doc_id text;
  v_existing RECORD;
  v_journal_id uuid;
  v_header_id uuid;
  v_journal_number integer;
BEGIN
  v_uid := auth.uid();

  IF NOT public.check_user_can_auto_post_gl(p_company_id, false) THEN
    RAISE EXCEPTION 'Nincs jogosultsága az eszközaktiválás feladásához a céghez (id: %)', p_company_id;
  END IF;

  IF p_acquisition_value <= 0 THEN
    RAISE EXCEPTION 'Az aktiválási bekerülési értéknek pozitívnak kell lennie.';
  END IF;

  IF p_gl_account_id IS NULL OR p_cip_gl_account_id IS NULL THEN
    RAISE EXCEPTION 'Hiányzó főkönyvi számlák az aktiváláshoz (Eszköz vagy 161 számla).';
  END IF;

  v_clean_inv := regexp_replace(p_inventory_number, '[^a-zA-Z0-9_-]', '_', 'g');
  v_doc_id := 'JK-' || v_clean_inv;

  -- Duplikáció ellenőrzés
  SELECT id, journal_number, status INTO v_existing
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = v_doc_id
     AND status <> 'SZTORNOZOTT'
   LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'header_id', v_existing.id,
      'journal_number', v_existing.journal_number,
      'is_already_posted', true,
      'message', 'Az eszköz aktiválása már korábban le lett könyvelve (' || v_doc_id || ').'
    );
  END IF;

  -- Vegyes napló
  SELECT id INTO v_journal_id
    FROM public.acc_journals
   WHERE company_id = p_company_id
     AND is_active = true
     AND (code IN ('VE', 'VEG') OR type = 'MIXED' OR name ILIKE '%vegyes%')
   ORDER BY CASE WHEN code = 'VE' THEN 1 WHEN type = 'MIXED' THEN 2 ELSE 3 END
   LIMIT 1;

  IF v_journal_id IS NULL THEN
    SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND is_active = true LIMIT 1;
  END IF;

  IF v_journal_id IS NULL THEN
    RAISE EXCEPTION 'Nem található aktív Vegyes könyvelési napló a cégnél.';
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
    EXTRACT(YEAR FROM p_activation_date)::smallint,
    'PISZKOZAT',
    'NORMAL',
    'AUTOMATIKUS',
    COALESCE(p_currency, 'HUF'),
    p_activation_date,
    p_activation_date,
    v_doc_id,
    'Tárgyi eszköz aktiválás: ' || p_asset_name || ' (' || p_inventory_number || ')',
    'Aktiválási jegyzőkönyv: ' || p_asset_name || ', összeg: ' || p_acquisition_value::text || ' ' || COALESCE(p_currency, 'HUF'),
    v_uid,
    v_uid
  ) RETURNING id INTO v_header_id;

  -- Sorok beszúrása:
  -- 1. T [Eszköz számla]
  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, description
  ) VALUES (
    v_header_id, 1, p_gl_account_id, 'T', p_acquisition_value, 'Tárgyi eszköz aktiválás — ' || p_asset_name
  );

  -- 2. K 161 (Befejezetlen beruházás)
  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, description
  ) VALUES (
    v_header_id, 2, p_cip_gl_account_id, 'K', p_acquisition_value, 'Befejezetlen beruházás átvezetése (161) — ' || p_asset_name
  );

  -- Véglegesítés
  PERFORM public.acc_post_journal_entry(v_header_id, v_uid);

  SELECT journal_number INTO v_journal_number FROM public.acc_journal_headers WHERE id = v_header_id;

  RETURN jsonb_build_object(
    'success', true,
    'header_id', v_header_id,
    'journal_number', v_journal_number,
    'message', 'Tárgyi eszköz aktiválás sikeresen lekönyvelve (' || v_doc_id || ')!'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.post_asset_activation_to_gl(uuid, uuid, text, text, numeric, date, uuid, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_asset_activation_to_gl(uuid, uuid, text, text, numeric, date, uuid, uuid, text) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2b. remove_asset_activation_from_gl: Aktiválási tétel törlése vagy sztornózása
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_asset_activation_from_gl(
  p_company_id uuid,
  p_inventory_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_doc_id text;
  v_header RECORD;
  v_was_stornoed boolean := false;
BEGIN
  v_uid := auth.uid();

  IF NOT public.check_user_can_auto_post_gl(p_company_id, false) THEN
    RAISE EXCEPTION 'Nincs jogosultsága az aktiválási könyvelés törléséhez a céghez (id: %)', p_company_id;
  END IF;

  v_doc_id := 'JK-' || regexp_replace(p_inventory_number, '[^a-zA-Z0-9_-]', '_', 'g');

  SELECT id, journal_number, status INTO v_header
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = v_doc_id
     AND status <> 'SZTORNOZOTT'
   LIMIT 1;

  IF v_header.id IS NOT NULL THEN
    IF v_header.journal_number IS NOT NULL AND v_header.status = 'KONYVELT' THEN
      -- Sztv. 166. §: Sorszámozott tételt kötelező sztornózni
      PERFORM public.acc_storno_journal_entry(
        v_header.id,
        v_uid,
        'Eszköz aktiválás törlése / visszavonása (' || p_inventory_number || ')',
        false
      );
      v_was_stornoed := true;
    ELSE
      DELETE FROM public.acc_journal_lines WHERE header_id = v_header.id;
      DELETE FROM public.acc_journal_headers WHERE id = v_header.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'was_stornoed', v_was_stornoed,
    'message', CASE WHEN v_was_stornoed THEN 'Aktiválási tétel sikeresen sztornózva.' ELSE 'Aktiválási tétel törölve.' END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_asset_activation_from_gl(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_asset_activation_from_gl(uuid, text) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. post_development_reserve_to_gl: Fejlesztési tartalék feloldásának könyvelése
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_development_reserve_to_gl(
  p_company_id uuid,
  p_asset_id uuid,
  p_asset_name text,
  p_inventory_number text,
  p_reserve_amount numeric,
  p_activation_date date,
  p_reserve_year integer DEFAULT NULL,
  p_gl_414_id uuid DEFAULT NULL,
  p_gl_413_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_clean_inv text;
  v_doc_id text;
  v_existing_id uuid;
  v_journal_id uuid;
  v_header_id uuid;
  v_journal_number integer;
BEGIN
  v_uid := auth.uid();

  IF NOT public.check_user_can_auto_post_gl(p_company_id, false) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a fejlesztési tartalék könyveléséhez (cég: %)', p_company_id;
  END IF;

  IF p_reserve_amount <= 0 THEN
    RAISE EXCEPTION 'A feloldandó tartalék összegének pozitívnak kell lennie.';
  END IF;

  IF p_gl_414_id IS NULL OR p_gl_413_id IS NULL THEN
    RAISE EXCEPTION 'Hiányzó 414 (Lekötött tartalék) vagy 413 (Eredménytartalék) főkönyvi számla.';
  END IF;

  v_clean_inv := regexp_replace(p_inventory_number, '[^a-zA-Z0-9_-]', '_', 'g');
  v_doc_id := 'FT-FELOLD-' || v_clean_inv;

  SELECT id INTO v_existing_id
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = v_doc_id
     AND status <> 'SZTORNOZOTT'
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Ha már létezik és módosítjuk, visszanyitjuk és töröljük a régi sorokat
    PERFORM public.acc_unpost_journal_entry(v_existing_id, v_uid, 'Fejlesztési tartalék újrakönyvelése');
    DELETE FROM public.acc_journal_lines WHERE header_id = v_existing_id;
    v_header_id := v_existing_id;
  ELSE
    -- Vegyes napló
    SELECT id INTO v_journal_id
      FROM public.acc_journals
     WHERE company_id = p_company_id
       AND is_active = true
       AND (code IN ('VE', 'VEG') OR type = 'MIXED' OR name ILIKE '%vegyes%')
     ORDER BY CASE WHEN code = 'VE' THEN 1 WHEN type = 'MIXED' THEN 2 ELSE 3 END
     LIMIT 1;

    IF v_journal_id IS NULL THEN
      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND is_active = true LIMIT 1;
    END IF;

    IF v_journal_id IS NULL THEN
      RAISE EXCEPTION 'Nem található aktív Vegyes könyvelési napló a cégnél.';
    END IF;

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
      EXTRACT(YEAR FROM p_activation_date)::smallint,
      'PISZKOZAT',
      'NORMAL',
      'AUTOMATIKUS',
      'HUF',
      p_activation_date,
      p_activation_date,
      v_doc_id,
      'Fejlesztési tartalék feloldása: ' || p_asset_name || ' (' || p_inventory_number || ')' || CASE WHEN p_reserve_year IS NOT NULL THEN ' — ' || p_reserve_year::text || '. évi keretből' ELSE '' END,
      'Tárgyi eszköz aktiválás (Tao. tv. 7. § (15)): ' || p_asset_name || ', összeg: ' || p_reserve_amount::text || ' Ft',
      v_uid,
      v_uid
    ) RETURNING id INTO v_header_id;
  END IF;

  -- Sorok: T 414 - K 413
  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, description
  ) VALUES (
    v_header_id, 1, p_gl_414_id, 'T', p_reserve_amount, 'Lekötött tartalék feloldása (414) — ' || p_asset_name
  );

  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, description
  ) VALUES (
    v_header_id, 2, p_gl_413_id, 'K', p_reserve_amount, 'Eredménytartalékba visszavezetés (413) — ' || p_asset_name
  );

  PERFORM public.acc_post_journal_entry(v_header_id, v_uid);

  SELECT journal_number INTO v_journal_number FROM public.acc_journal_headers WHERE id = v_header_id;

  RETURN jsonb_build_object(
    'success', true,
    'header_id', v_header_id,
    'journal_number', v_journal_number,
    'message', 'Fejlesztési tartalék feloldása sikeresen lekönyvelve (' || v_doc_id || ')!'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.post_development_reserve_to_gl(uuid, uuid, text, text, numeric, date, integer, uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_development_reserve_to_gl(uuid, uuid, text, text, numeric, date, integer, uuid, uuid) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3b. remove_development_reserve_from_gl: Tartalék feloldás törlése / sztornója
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_development_reserve_from_gl(
  p_company_id uuid,
  p_inventory_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_doc_id text;
  v_header RECORD;
  v_was_stornoed boolean := false;
BEGIN
  v_uid := auth.uid();

  IF NOT public.check_user_can_auto_post_gl(p_company_id, false) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a tartalék könyvelés törléséhez (cég: %)', p_company_id;
  END IF;

  v_doc_id := 'FT-FELOLD-' || regexp_replace(p_inventory_number, '[^a-zA-Z0-9_-]', '_', 'g');

  SELECT id, journal_number, status INTO v_header
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = v_doc_id
     AND status <> 'SZTORNOZOTT'
   LIMIT 1;

  IF v_header.id IS NOT NULL THEN
    IF v_header.journal_number IS NOT NULL AND v_header.status = 'KONYVELT' THEN
      PERFORM public.acc_storno_journal_entry(
        v_header.id,
        v_uid,
        'Fejlesztési tartalék feloldás visszavonása (' || p_inventory_number || ')',
        false
      );
      v_was_stornoed := true;
    ELSE
      DELETE FROM public.acc_journal_lines WHERE header_id = v_header.id;
      DELETE FROM public.acc_journal_headers WHERE id = v_header.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'was_stornoed', v_was_stornoed,
    'message', CASE WHEN v_was_stornoed THEN 'Tartalék feloldási tétel sikeresen sztornózva.' ELSE 'Tartalék feloldási tétel törölve.' END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_development_reserve_from_gl(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_development_reserve_from_gl(uuid, text) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. post_dividend_to_gl: Jóváhagyott tagi osztalék lekönyvelése
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_dividend_to_gl(
  p_company_id uuid,
  p_dividend_id uuid,
  p_gross_amount numeric,
  p_szja_amount numeric,
  p_szocho_amount numeric,
  p_member_name text,
  p_resolution_number text,
  p_posting_date date,
  p_document_date date,
  p_gl_413_id uuid,
  p_gl_4791_id uuid,
  p_gl_462_id uuid DEFAULT NULL,
  p_gl_463_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_clean_res text;
  v_year text;
  v_doc_id text;
  v_journal_id uuid;
  v_existing_id uuid;
  v_header_id uuid;
  v_seq smallint := 1;
  v_journal_number integer;
BEGIN
  v_uid := auth.uid();

  -- Cégvezetés, bérszámfejtő vagy könyvelő jogosultság (allow_payroll = true)
  IF NOT public.check_user_can_auto_post_gl(p_company_id, true) THEN
    RAISE EXCEPTION 'Nincs jogosultsága az osztalék könyveléséhez (cég: %)', p_company_id;
  END IF;

  IF p_gross_amount <= 0 THEN
    RAISE EXCEPTION 'A bruttó osztalék összegének pozitívnak kell lennie.';
  END IF;

  IF p_gl_413_id IS NULL OR p_gl_4791_id IS NULL THEN
    RAISE EXCEPTION 'Hiányzó Eredménytartalék (413/493) vagy Tagi kötelezettség (4791) főkönyvi számla.';
  END IF;

  v_clean_res := regexp_replace(COALESCE(p_resolution_number, '1'), '[^a-zA-Z0-9-]', '_', 'g');
  v_year := EXTRACT(YEAR FROM p_posting_date)::text;
  v_doc_id := 'OSZT-' || v_clean_res || '-' || v_year;

  -- Meglévő tétel ellenőrzése
  SELECT id INTO v_existing_id
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = v_doc_id
     AND status <> 'SZTORNOZOTT'
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    PERFORM public.acc_unpost_journal_entry(v_existing_id, v_uid, 'Osztalék újrakönyvelése');
    DELETE FROM public.acc_journal_lines WHERE header_id = v_existing_id;
    v_header_id := v_existing_id;
  ELSE
    SELECT id INTO v_journal_id
      FROM public.acc_journals
     WHERE company_id = p_company_id
       AND (code IN ('VE', 'BER') OR type = 'MIXED')
     LIMIT 1;

    IF v_journal_id IS NULL THEN
      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND is_active = true LIMIT 1;
    END IF;

    IF v_journal_id IS NULL THEN
      RAISE EXCEPTION 'Nem található aktív Vegyes könyvelési napló a cégnél.';
    END IF;

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
      v_year::smallint,
      'PISZKOZAT',
      'NORMAL',
      'AUTOMATIKUS',
      'HUF',
      p_posting_date,
      p_document_date,
      v_doc_id,
      'Osztalék előírása és levonásai — ' || p_member_name || ' (' || COALESCE(p_resolution_number, 'Határozat') || ')',
      'Osztalék elszámolás: ' || p_member_name || ', Bruttó: ' || p_gross_amount::text || ' Ft',
      v_uid,
      v_uid
    ) RETURNING id INTO v_header_id;
  END IF;

  -- 1. Sor: T 413 Bruttó osztalék (Eredménytartalék)
  INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
  VALUES (v_header_id, v_seq, p_gl_413_id, 'T', p_gross_amount, 'Bruttó jóváhagyott osztalék (' || p_member_name || ')');
  v_seq := v_seq + 1;

  -- 2. Sor: K 4791 Taggal szembeni kötelezettség
  INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
  VALUES (v_header_id, v_seq, p_gl_4791_id, 'K', p_gross_amount, 'Taggal szembeni kötelezettség előírása (' || p_member_name || ')');
  v_seq := v_seq + 1;

  -- 3 & 4. Sor: Levont SZJA (ha van és van számla)
  IF p_szja_amount > 0 AND p_gl_462_id IS NOT NULL THEN
    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_seq, p_gl_4791_id, 'T', p_szja_amount, 'Levont 15% SZJA elszámolása (' || p_member_name || ')');
    v_seq := v_seq + 1;

    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_seq, p_gl_462_id, 'K', p_szja_amount, 'Levont 15% SZJA fizetési kötelezettség');
    v_seq := v_seq + 1;
  END IF;

  -- 5 & 6. Sor: Levont SZOCHO (ha van és van számla)
  IF p_szocho_amount > 0 AND p_gl_463_id IS NOT NULL THEN
    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_seq, p_gl_4791_id, 'T', p_szocho_amount, 'Levont 13% SZOCHO elszámolása (' || p_member_name || ')');
    v_seq := v_seq + 1;

    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_seq, p_gl_463_id, 'K', p_szocho_amount, 'Levont 13% SZOCHO fizetési kötelezettség');
    v_seq := v_seq + 1;
  END IF;

  -- Véglegesítés
  PERFORM public.acc_post_journal_entry(v_header_id, v_uid);

  SELECT journal_number INTO v_journal_number FROM public.acc_journal_headers WHERE id = v_header_id;

  -- Osztalék rekord státuszának és bizonylat-kapcsolatának frissítése
  UPDATE public.accounty_dividends
     SET status = 'posted',
         journal_entry_id = v_header_id,
         updated_at = now()
   WHERE id = p_dividend_id
     AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'success', true,
    'header_id', v_header_id,
    'journal_number', v_journal_number,
    'message', 'Osztalék sikeresen lekönyvelve a Vegyes naplóba (' || v_doc_id || ')!'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.post_dividend_to_gl(uuid, uuid, numeric, numeric, numeric, text, text, date, date, uuid, uuid, uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_dividend_to_gl(uuid, uuid, numeric, numeric, numeric, text, text, date, date, uuid, uuid, uuid, uuid) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4b. delete_dividend_gl_entry: Osztalék törlése vagy sztornózása a főkönyvből
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_dividend_gl_entry(
  p_company_id uuid,
  p_dividend_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_dividend RECORD;
  v_header RECORD;
  v_was_stornoed boolean := false;
BEGIN
  v_uid := auth.uid();

  IF NOT public.check_user_can_auto_post_gl(p_company_id, true) THEN
    RAISE EXCEPTION 'Nincs jogosultsága az osztalék törléséhez (cég: %)', p_company_id;
  END IF;

  SELECT * INTO v_dividend
    FROM public.accounty_dividends
   WHERE id = p_dividend_id
     AND company_id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Az osztalék rekord nem található: %', p_dividend_id;
  END IF;

  IF v_dividend.journal_entry_id IS NOT NULL THEN
    SELECT id, journal_number, status INTO v_header
      FROM public.acc_journal_headers
     WHERE id = v_dividend.journal_entry_id;

    IF v_header.id IS NOT NULL THEN
      IF v_header.status = 'KONYVELT' THEN
        -- Sztv. 166. §: Lekönyvelt tétel csak sztornózható
        PERFORM public.acc_storno_journal_entry(
          v_header.id,
          v_uid,
          'Osztalék tétel törölve a bérszámfejtésből (' || COALESCE(v_dividend.member_name, '') || ')',
          false
        );
        v_was_stornoed := true;
      ELSE
        DELETE FROM public.acc_journal_lines WHERE header_id = v_header.id;
        DELETE FROM public.acc_journal_headers WHERE id = v_header.id;
      END IF;
    END IF;
  END IF;

  -- Osztalék rekord fizikai törlése
  DELETE FROM public.accounty_dividends
   WHERE id = p_dividend_id
     AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'success', true,
    'was_stornoed', v_was_stornoed,
    'message', CASE WHEN v_was_stornoed THEN 'Az osztalék törölve, a kapcsolódó főkönyvi tétel sikeresen sztornózva lett.' ELSE 'Osztalék tétel sikeresen törölve.' END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_dividend_gl_entry(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_dividend_gl_entry(uuid, uuid) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. post_payroll_cycle_to_gl: Havi bérfeladás lekönyvelése a kettős könyvvitelbe
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_payroll_cycle_to_gl(
  p_company_id uuid,
  p_cycle_id uuid,
  p_gl_mapping jsonb,
  p_summary jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_cycle RECORD;
  v_doc_id text;
  v_existing RECORD;
  v_journal_id uuid;
  v_header_id uuid;
  v_seq smallint := 1;
  v_last_day_of_month date;

  -- Kontírozási összegek
  v_gross numeric := 0;
  v_szocho numeric := 0;
  v_szja numeric := 0;
  v_tb numeric := 0;
  v_min_base_diff numeric := 0;
  v_deductions numeric := 0;
  v_commute numeric := 0;
  v_net numeric := 0;

  -- Számlaszám azonosítók
  v_gl_541 uuid;
  v_gl_551 uuid;
  v_gl_561 uuid;
  v_gl_463 uuid;
  v_gl_462 uuid;
  v_gl_464 uuid;
  v_gl_479 uuid;
  v_gl_471 uuid;

  v_total_debit numeric;
  v_total_credit numeric;
  v_journal_number integer;
BEGIN
  v_uid := auth.uid();

  -- Cégvezetés, bérszámfejtő vagy könyvelő jogosultság (allow_payroll = true)
  IF NOT public.check_user_can_auto_post_gl(p_company_id, true) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a bérfeladás elvégzéséhez (cég: %)', p_company_id;
  END IF;

  SELECT * INTO v_cycle
    FROM public.accounty_payroll_cycles
   WHERE id = p_cycle_id
     AND company_id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A bérszámfejtési ciklus nem található: %', p_cycle_id;
  END IF;

  v_doc_id := 'BER-' || v_cycle.year::text || '-' || lpad(v_cycle.month::text, 2, '0');
  v_last_day_of_month := (date_trunc('month', make_date(v_cycle.year, v_cycle.month, 1)) + interval '1 month - 1 day')::date;

  -- Idempotencia: Ha már korábban le lett könyvelve és nem sztornózott, nem duplikálunk
  SELECT id, journal_number, status INTO v_existing
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = v_doc_id
     AND status <> 'SZTORNOZOTT'
   LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.accounty_payroll_cycles
       SET status = 'closed',
           current_step = 8,
           notes = 'Bérfeladás lekönyvelve: ' || v_doc_id || ' (Bizonylat: ' || COALESCE(v_existing.journal_number::text, v_doc_id) || ')',
           updated_at = now()
     WHERE id = p_cycle_id;

    RETURN jsonb_build_object(
      'success', true,
      'header_id', v_existing.id,
      'journal_number', v_existing.journal_number,
      'is_already_posted', true,
      'message', 'A(z) ' || v_cycle.year::text || '. ' || lpad(v_cycle.month::text, 2, '0') || '. havi bérfeladás már korábban le lett könyvelve (' || v_doc_id || ').'
    );
  END IF;

  -- Főkönyvi számlák feloldása a kapott paraméterből
  v_gl_541 := (p_gl_mapping->>'gl541')::uuid;
  v_gl_551 := (p_gl_mapping->>'gl551')::uuid;
  v_gl_561 := (p_gl_mapping->>'gl561')::uuid;
  v_gl_463 := (p_gl_mapping->>'gl463')::uuid;
  v_gl_462 := (p_gl_mapping->>'gl462')::uuid;
  v_gl_464 := (p_gl_mapping->>'gl464')::uuid;
  v_gl_479 := (p_gl_mapping->>'gl479')::uuid;
  v_gl_471 := (p_gl_mapping->>'gl471')::uuid;

  IF v_gl_541 IS NULL OR v_gl_471 IS NULL THEN
    RAISE EXCEPTION 'A számlatükörből hiányzik a Bérköltség (541) vagy a Nettó bér (471) főkönyvi számla.';
  END IF;

  -- Összegek feloldása
  IF p_summary IS NOT NULL THEN
    v_gross := COALESCE((p_summary->>'totalGross')::numeric, (p_summary->>'total_gross')::numeric, 0);
    v_szocho := COALESCE((p_summary->>'totalSzocho')::numeric, (p_summary->>'total_szocho')::numeric, 0);
    v_szja := COALESCE((p_summary->>'totalSzja')::numeric, (p_summary->>'total_szja')::numeric, 0);
    v_tb := COALESCE((p_summary->>'totalTb')::numeric, (p_summary->>'total_tb')::numeric, 0);
    v_min_base_diff := COALESCE((p_summary->>'totalMinBaseDiff')::numeric, (p_summary->>'total_min_base_diff')::numeric, 0);
    v_deductions := COALESCE((p_summary->>'totalDeductions')::numeric, (p_summary->>'total_deductions')::numeric, 0);
    v_commute := COALESCE((p_summary->>'totalCommute')::numeric, (p_summary->>'total_commute')::numeric, 0);
    v_net := COALESCE((p_summary->>'totalNet')::numeric, (p_summary->>'total_net')::numeric, 0);
  ELSE
    -- Ha nem küldött összefoglalót, a bérszámfejtési kalkulációkból összesítünk
    SELECT
      COALESCE(SUM(gross_salary), 0),
      COALESCE(SUM(szocho_amount), 0),
      COALESCE(SUM(szja_amount), 0),
      COALESCE(SUM(tb_amount), 0),
      COALESCE(SUM(min_base_employer_contribution), 0),
      COALESCE(SUM(total_deductions), 0),
      COALESCE(SUM(net_salary), 0)
    INTO
      v_gross, v_szocho, v_szja, v_tb, v_min_base_diff, v_deductions, v_net
    FROM public.accounty_payroll_calculations
    WHERE cycle_id = p_cycle_id;
  END IF;

  IF v_gross <= 0 THEN
    RAISE EXCEPTION 'A bérciklusban nem található bruttó bérköltség az automatikus feladáshoz.';
  END IF;

  -- Kettős könyvviteli egyensúly (T = K) ellenőrzése
  v_total_debit := v_gross + v_commute + v_szocho + v_min_base_diff;
  v_total_credit := v_szocho + v_szja + (v_tb + v_min_base_diff) + v_deductions + v_net;

  IF abs(v_total_debit - v_total_credit) > 1 THEN
    RAISE EXCEPTION 'Kettős könyvviteli egyensúlytalanság a bérfeladásban! Tartozik: %, Követel: % (Különbözet: %)',
      v_total_debit, v_total_credit, abs(v_total_debit - v_total_credit);
  END IF;

  -- Vegyes napló
  SELECT id INTO v_journal_id
    FROM public.acc_journals
   WHERE company_id = p_company_id
     AND is_active = true
     AND (code IN ('VE', 'BER') OR type = 'MIXED')
   LIMIT 1;

  IF v_journal_id IS NULL THEN
    SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND is_active = true LIMIT 1;
  END IF;

  IF v_journal_id IS NULL THEN
    RAISE EXCEPTION 'Nem található aktív Vegyes könyvelési napló a cégnél.';
  END IF;

  -- Fejléc létrehozása
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
    v_cycle.year::smallint,
    'PISZKOZAT',
    'NORMAL',
    'AUTOMATIKUS',
    'HUF',
    v_last_day_of_month,
    v_last_day_of_month,
    v_doc_id,
    'Bérfeladás könyvelése — ' || v_cycle.year::text || '. ' || lpad(v_cycle.month::text, 2, '0') || '. hó',
    'Automatikus bérfeladás lezárt bérciklusból (' || v_doc_id || ')',
    v_uid,
    v_uid
  ) RETURNING id INTO v_header_id;

  -- 1. Sor: T 541 Bérköltség (Bruttó)
  INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
  VALUES (v_header_id, v_seq, v_gl_541, 'T', v_gross, 'Munkabér költség (bruttó bér)');
  v_seq := v_seq + 1;

  -- Sor: T 551 Utazási költségtérítés (ha van)
  IF v_commute > 0 THEN
    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_seq, COALESCE(v_gl_551, v_gl_541), 'T', v_commute, 'Munkába járás utazási költségtérítés (39/2010. Korm. rend.)');
    v_seq := v_seq + 1;
  END IF;

  -- 2. Sor: T 561 SZOCHO költség
  IF v_szocho > 0 AND v_gl_561 IS NOT NULL THEN
    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_seq, v_gl_561, 'T', v_szocho, 'Szociális hozzájárulási adó költség');
    v_seq := v_seq + 1;
  END IF;

  -- 3. Sor: K 463 SZOCHO kötelezettség
  IF v_szocho > 0 AND v_gl_463 IS NOT NULL THEN
    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_seq, v_gl_463, 'K', v_szocho, 'SZOCHO fizetési kötelezettség');
    v_seq := v_seq + 1;
  END IF;

  -- 4. Sor: K 462 SZJA kötelezettség
  IF v_szja > 0 AND v_gl_462 IS NOT NULL THEN
    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_seq, v_gl_462, 'K', v_szja, 'Levont SZJA kötelezettség');
    v_seq := v_seq + 1;
  END IF;

  -- 5. Sor: K 464 TB kötelezettség
  IF v_tb > 0 AND v_gl_464 IS NOT NULL THEN
    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_seq, v_gl_464, 'K', v_tb, 'Levont TB járulék kötelezettség');
    v_seq := v_seq + 1;
  END IF;

  -- 5b. Sor: Minimális járulékalap munkáltatói különbözet (ha van)
  IF v_min_base_diff > 0 AND v_gl_561 IS NOT NULL AND v_gl_464 IS NOT NULL THEN
    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_seq, v_gl_561, 'T', v_min_base_diff, 'Minimális járulékalap munkáltatói különbözet (Tbj. 27. §)');
    v_seq := v_seq + 1;

    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_seq, v_gl_464, 'K', v_min_base_diff, 'Minimális járulékalap munkáltatói TB kötelezettség (Tbj. 27. §)');
    v_seq := v_seq + 1;
  END IF;

  -- 6. Sor: K 479 Letiltások
  IF v_deductions > 0 AND v_gl_479 IS NOT NULL THEN
    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_seq, v_gl_479, 'K', v_deductions, 'Bérből levont letiltások és előlegek');
    v_seq := v_seq + 1;
  END IF;

  -- 7. Sor: K 471 Nettó bér kötelezettség
  IF v_net > 0 THEN
    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_seq, v_gl_471, 'K', v_net, 'Kifizetendő nettó munkabér és térítés kötelezettség');
    v_seq := v_seq + 1;
  END IF;

  -- Véglegesítés és sorszámozás
  PERFORM public.acc_post_journal_entry(v_header_id, v_uid);

  SELECT journal_number INTO v_journal_number FROM public.acc_journal_headers WHERE id = v_header_id;

  -- Ciklus lezárása
  UPDATE public.accounty_payroll_cycles
     SET status = 'closed',
         current_step = 8,
         notes = 'Bérfeladás lekönyvelve: ' || v_doc_id || ' (Bizonylat: ' || COALESCE(v_journal_number::text, v_doc_id) || ')',
         updated_at = now()
   WHERE id = p_cycle_id;

  RETURN jsonb_build_object(
    'success', true,
    'header_id', v_header_id,
    'journal_number', v_journal_number,
    'message', 'Bérfeladás sikeresen lekönyvelve a Vegyes naplóba (' || v_doc_id || ')!'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.post_payroll_cycle_to_gl(uuid, uuid, jsonb, jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_payroll_cycle_to_gl(uuid, uuid, jsonb, jsonb) TO authenticated, service_role;
