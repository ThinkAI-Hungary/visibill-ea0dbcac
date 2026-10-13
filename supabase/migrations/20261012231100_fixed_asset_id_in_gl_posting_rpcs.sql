-- =============================================================================
-- TENY M1.1b – fixed_asset_id kitöltése a tárgyi eszköz könyvelő RPC-kben
-- Terv: implementation-plans/TENY_implementacios_terv.md (D-1)
--
-- A 20261012231000 migráció bevezette az acc_journal_lines.fixed_asset_id oszlopot.
-- Ez a migráció gondoskodik róla, hogy az új tételek a keletkezésükkor
-- megkapják az analitikai kapcsolatot:
--   * post_asset_activation_to_gl        (T eszköz / K 161)
--   * post_depreciation_run_to_gl        (T 5711 / K 1x9)
--   * post_development_reserve_to_gl     (T 414 / K 413 – nyomon követhetőség)
--   * acc_storno_journal_entry           (a sztornó- és javító sorok öröklik a címkét,
--                                         különben a sztornózott eszköztétel "árva" maradna)
--
-- Az eszköz-azonosító feloldása cégre szűrve történik; ha az eszköz nem létezik
-- (pl. az RPC az eszközsor beszúrása előtt hívódik), a sor címke nélkül jön létre,
-- így a meglévő működés nem törik el.
-- A függvénytörzsek az Dev adatbázis élő definíciójából származnak; Prodra
-- élesítés előtt a Prod definíciót össze kell vetni (drift-ellenőrzés).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tárgyi eszköz aktiválás feladása
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
  p_currency text DEFAULT 'HUF'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_clean_inv text;
  v_doc_id text;
  v_existing RECORD;
  v_journal_id uuid;
  v_header_id uuid;
  v_journal_number integer;
  v_asset_id uuid;
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

  -- Analitikai kapcsolat feloldása (cégre szűrve; hiányzó eszköz esetén NULL)
  SELECT fa.id INTO v_asset_id
    FROM public.fixed_assets fa
   WHERE fa.id = p_asset_id
     AND fa.company_id = p_company_id;

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
    header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id
  ) VALUES (
    v_header_id, 1, p_gl_account_id, 'T', p_acquisition_value, 'Tárgyi eszköz aktiválás — ' || p_asset_name, v_asset_id
  );

  -- 2. K 161 (Befejezetlen beruházás)
  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id
  ) VALUES (
    v_header_id, 2, p_cip_gl_account_id, 'K', p_acquisition_value, 'Befejezetlen beruházás átvezetése (161) — ' || p_asset_name, v_asset_id
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
$function$;

REVOKE EXECUTE ON FUNCTION public.post_asset_activation_to_gl(uuid, uuid, text, text, numeric, date, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_asset_activation_to_gl(uuid, uuid, text, text, numeric, date, uuid, uuid, text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Időszaki értékcsökkenés feladása
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_depreciation_run_to_gl(
  p_company_id uuid,
  p_period_type text,
  p_date_from date,
  p_date_to date,
  p_posting_date date,
  p_document_id text,
  p_description text,
  p_currency text DEFAULT 'HUF'::text,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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
  v_item_asset_id uuid;
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
      -- Analitikai kapcsolat feloldása (cégre szűrve; ismeretlen eszköz esetén NULL)
      v_item_asset_id := NULL;
      IF (v_item->>'asset_id') IS NOT NULL THEN
        SELECT fa.id INTO v_item_asset_id
          FROM public.fixed_assets fa
         WHERE fa.id = (v_item->>'asset_id')::uuid
           AND fa.company_id = p_company_id;
      END IF;

      -- Tartozik: 5711 ÉCS költség
      INSERT INTO public.acc_journal_lines (
        header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id
      ) VALUES (
        v_header_id,
        v_seq,
        v_debit_gl,
        'T',
        v_item_amount,
        'Terv szerinti ÉCS (' || COALESCE(v_item->>'active_months', '1') || ' hó) — ' || COALESCE(v_item->>'asset_name', '') || ' (' || COALESCE(v_item->>'inventory_number', '') || ')',
        v_item_asset_id
      );
      v_seq := v_seq + 1;

      -- Követel: 139xx Halmozott ÉCS
      INSERT INTO public.acc_journal_lines (
        header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id
      ) VALUES (
        v_header_id,
        v_seq,
        v_credit_gl,
        'K',
        v_item_amount,
        'Halmozott ÉCS elszámolása — ' || COALESCE(v_item->>'asset_name', '') || ' (' || COALESCE(v_item->>'inventory_number', '') || ')',
        v_item_asset_id
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
$function$;

REVOKE EXECUTE ON FUNCTION public.post_depreciation_run_to_gl(uuid, text, date, date, date, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_depreciation_run_to_gl(uuid, text, date, date, date, text, text, text, jsonb) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fejlesztési tartalék feloldás feladása (T 414 / K 413)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_development_reserve_to_gl(
  p_company_id uuid,
  p_asset_id uuid,
  p_asset_name text,
  p_inventory_number text,
  p_reserve_amount numeric,
  p_activation_date date,
  p_reserve_year integer DEFAULT NULL::integer,
  p_gl_414_id uuid DEFAULT NULL::uuid,
  p_gl_413_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_clean_inv text;
  v_doc_id text;
  v_existing_id uuid;
  v_journal_id uuid;
  v_header_id uuid;
  v_journal_number integer;
  v_asset_id uuid;
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

  -- Analitikai kapcsolat feloldása (cégre szűrve; hiányzó eszköz esetén NULL)
  SELECT fa.id INTO v_asset_id
    FROM public.fixed_assets fa
   WHERE fa.id = p_asset_id
     AND fa.company_id = p_company_id;

  v_clean_inv := regexp_replace(p_inventory_number, '[^a-zA-Z0-9_-]', '_', 'g');
  v_doc_id := 'FT-FELOLD-' || v_clean_inv;

  SELECT id INTO v_existing_id
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = v_doc_id
     AND status <> 'SZTORNOZOTT'
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    PERFORM public.acc_unpost_journal_entry(v_existing_id, v_uid, 'Fejlesztési tartalék újrakönyvelése');
    DELETE FROM public.acc_journal_lines WHERE header_id = v_existing_id;
    v_header_id := v_existing_id;
  ELSE
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
    header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id
  ) VALUES (
    v_header_id, 1, p_gl_414_id, 'T', p_reserve_amount, 'Lekötött tartalék feloldása (414) — ' || p_asset_name, v_asset_id
  );

  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id
  ) VALUES (
    v_header_id, 2, p_gl_413_id, 'K', p_reserve_amount, 'Eredménytartalékba visszavezetés (413) — ' || p_asset_name, v_asset_id
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
$function$;

REVOKE EXECUTE ON FUNCTION public.post_development_reserve_to_gl(uuid, uuid, text, text, numeric, date, integer, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_development_reserve_to_gl(uuid, uuid, text, text, numeric, date, integer, uuid, uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Sztornó: a fordított és a javító sorok öröklik a fixed_asset_id címkét
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.acc_storno_journal_entry(
  p_header_id uuid,
  p_user_id uuid,
  p_reason text,
  p_create_correction boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orig_header RECORD;
  v_storno_header_id UUID;
  v_corr_header_id UUID := NULL;
  v_next_num INTEGER;
  v_period_closed BOOLEAN;
  v_storno_date DATE;
  v_storno_year SMALLINT;
  v_actor_user_id UUID;
BEGIN
  SELECT * INTO v_orig_header FROM public.acc_journal_headers WHERE id = p_header_id FOR UPDATE;
  
  IF v_orig_header IS NULL THEN
    RAISE EXCEPTION 'Original journal entry header not found: %', p_header_id;
  END IF;

  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(v_orig_header.company_id, 'ledger_write');

  IF v_orig_header.status <> 'KONYVELT' THEN
    RAISE EXCEPTION 'Only posted (KONYVELT) entries can be stornoed.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.acc_accounting_periods
     WHERE company_id = v_orig_header.company_id
       AND year = EXTRACT(YEAR FROM v_orig_header.posting_date)::SMALLINT
       AND month = EXTRACT(MONTH FROM v_orig_header.posting_date)::SMALLINT
       AND is_closed = TRUE
  ) INTO v_period_closed;

  IF v_period_closed THEN
    v_storno_date := CURRENT_DATE;
    v_storno_year := EXTRACT(YEAR FROM v_storno_date)::SMALLINT;
  ELSE
    v_storno_date := v_orig_header.posting_date;
    v_storno_year := v_orig_header.accounting_year;
  END IF;

  v_actor_user_id := COALESCE(auth.uid(), p_user_id);

  UPDATE public.acc_journal_headers
     SET status = 'SZTORNOZOTT'
   WHERE id = p_header_id;

  v_next_num := public.acc_get_next_journal_number(v_orig_header.journal_id, v_storno_year);

  INSERT INTO public.acc_journal_headers (
    company_id, journal_id, accounting_year, status, entry_type, source,
    posting_date, document_date, posting_timestamp, document_id, partner_id,
    description, justification, currency, exchange_rate, exchange_rate_date,
    stornoed_entry_id, original_entry_id, journal_number, created_by, posted_by, posted_at
  ) VALUES (
    v_orig_header.company_id, v_orig_header.journal_id, v_storno_year, 'KONYVELT', 'SZTORNO', 'KEZI_MODOSITAS',
    v_storno_date, v_orig_header.document_date, now(), v_orig_header.document_id, v_orig_header.partner_id,
    'Sztornó: ' || v_orig_header.description, p_reason, v_orig_header.currency, v_orig_header.exchange_rate, v_orig_header.exchange_rate_date,
    p_header_id, p_header_id, v_next_num, v_actor_user_id, v_actor_user_id, now()
  ) RETURNING id INTO v_storno_header_id;

  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount,
    vat_code, vat_role, project_id, cost_center_id, description, fixed_asset_id
  )
  SELECT
    v_storno_header_id, sequence_number, gl_account_id,
    CASE WHEN dc_type = 'T' THEN 'K' ELSE 'T' END,
    amount, foreign_amount, vat_code, vat_role, project_id, cost_center_id,
    'Sztornó: ' || COALESCE(description, ''),
    fixed_asset_id
  FROM public.acc_journal_lines
  WHERE header_id = p_header_id;

  IF p_create_correction THEN
    INSERT INTO public.acc_journal_headers (
      company_id, journal_id, accounting_year, status, entry_type, source,
      posting_date, document_date, document_id, partner_id,
      description, justification, currency, exchange_rate, exchange_rate_date,
      original_entry_id, import_key, created_by
    ) VALUES (
      v_orig_header.company_id, v_orig_header.journal_id, v_storno_year, 'KEZI_PISZKOZAT', 'NORMAL', 'KEZI_MODOSITAS',
      v_storno_date, v_orig_header.document_date, v_orig_header.document_id, v_orig_header.partner_id,
      v_orig_header.description || ' (Javítás)', 'Helyesbítés az eredeti ' || COALESCE(v_orig_header.description, '') || ' tétel helyett.',
      v_orig_header.currency, v_orig_header.exchange_rate, v_orig_header.exchange_rate_date,
      p_header_id, v_orig_header.import_key, v_actor_user_id
    ) RETURNING id INTO v_corr_header_id;

    INSERT INTO public.acc_journal_lines (
      header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount,
      vat_code, vat_role, project_id, cost_center_id, description, fixed_asset_id
    )
    SELECT
      v_corr_header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount,
      vat_code, vat_role, project_id, cost_center_id, description, fixed_asset_id
    FROM public.acc_journal_lines
    WHERE header_id = p_header_id;
  END IF;

  RETURN COALESCE(v_corr_header_id, v_storno_header_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_storno_journal_entry(uuid, uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acc_storno_journal_entry(uuid, uuid, text, boolean) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
