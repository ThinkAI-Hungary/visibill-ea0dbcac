-- ==============================================================================
-- Migration: 20260928122000_post_cash_report_to_gl.sql
-- Description: Főkönyvi feladás eljárások az Időszaki Pénztárjelentéshez:
--              1. validate_cash_report_for_posting (FR-66 ellenőrzőlista)
--              2. post_cash_report_to_gl (381 Pénztár T/K feladás könyvelésre)
--              3. unpost_cash_report_from_gl (feladás visszavonása)
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. validate_cash_report_for_posting
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_cash_report_for_posting(
  p_company_id uuid,
  p_cash_report_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_report RECORD;
  v_missing_contra integer := 0;
  v_pending_count integer := 0;
  v_items_count integer := 0;
  v_is_valid boolean := true;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_report
    FROM public.cash_reports
   WHERE id = p_cash_report_id
     AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'errors', jsonb_build_array('A pénztárjelentés nem található.'));
  END IF;

  IF v_report.status NOT IN ('closed', 'posted') THEN
    v_errors := v_errors || jsonb_build_array('Csak lezárt pénztárjelentés adható fel a főkönyvbe! (Jelenlegi státusz: ' || v_report.status || ')');
    v_is_valid := false;
  END IF;

  -- 1. Hiányzó ellenszámlák ellenőrzése
  SELECT COUNT(*) INTO v_missing_contra
    FROM public.petty_cash_entries
   WHERE cash_report_id = p_cash_report_id
     AND status <> 'cancelled'
     AND (gl_contra_account IS NULL OR trim(gl_contra_account) = '');

  IF v_missing_contra > 0 THEN
    v_errors := v_errors || jsonb_build_array(v_missing_contra::text || ' db tételhez hiányzik a főkönyvi ellenszámla!');
    v_is_valid := false;
  END IF;

  -- 2. Jóváhagyásra váró tételek ellenőrzése
  SELECT COUNT(*) INTO v_pending_count
    FROM public.petty_cash_entries
   WHERE cash_report_id = p_cash_report_id
     AND status = 'pending_approval';

  IF v_pending_count > 0 THEN
    v_errors := v_errors || jsonb_build_array(v_pending_count::text || ' db tétel még jóváhagyásra vár!');
    v_is_valid := false;
  END IF;

  -- 3. Tételek száma
  SELECT COUNT(*) INTO v_items_count
    FROM public.petty_cash_entries
   WHERE cash_report_id = p_cash_report_id
     AND status <> 'cancelled';

  RETURN jsonb_build_object(
    'valid', v_is_valid,
    'errors', v_errors,
    'report_number', v_report.report_number,
    'status', v_report.status,
    'items_count', v_items_count,
    'missing_contra_count', v_missing_contra,
    'closing_balance', COALESCE(v_report.closing_balance_actual, v_report.closing_balance_book)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_cash_report_for_posting FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_cash_report_for_posting TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. post_cash_report_to_gl
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_cash_report_to_gl(
  p_company_id uuid,
  p_cash_report_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_validation jsonb;
  v_report RECORD;
  v_user_id uuid;
  v_journal_id uuid;
  v_header_id uuid;
  v_entry RECORD;
  v_line_no smallint := 1;
  v_cash_gl text;
  v_contra_gl text;
  v_cash_gl_id uuid;
  v_contra_gl_id uuid;
  v_next_num integer;
  v_gl_table_exists boolean;
BEGIN
  v_user_id := (SELECT auth.uid());

  -- 1. Validáció
  v_validation := public.validate_cash_report_for_posting(p_company_id, p_cash_report_id);
  IF NOT (v_validation->>'valid')::boolean THEN
    RAISE EXCEPTION 'A feladás sikertelen az alábbi hibák miatt: %', v_validation->>'errors';
  END IF;

  SELECT * INTO v_report
    FROM public.cash_reports
   WHERE id = p_cash_report_id
     AND company_id = p_company_id
   FOR UPDATE;

  -- Pénztár főkönyvi számla lekérdezése a pénztárból (alapértelmezett 381)
  SELECT COALESCE(gl_account, '381') INTO v_cash_gl
    FROM public.petty_cash_registers
   WHERE id = v_report.cash_register_id;

  -- 2. Ellenőrizzük, hogy létezik-e az acc_journal_headers tábla
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
     WHERE table_schema = 'public' 
       AND table_name = 'acc_journal_headers'
  ) INTO v_gl_table_exists;

  IF v_gl_table_exists THEN
    -- Pénztár napló lekérdezése
    SELECT id INTO v_journal_id
      FROM public.acc_journals
     WHERE company_id = p_company_id
       AND (type = 'PETTY_CASH' OR code ILIKE '%PENZTAR%' OR name ILIKE '%pénztár%')
     LIMIT 1;

    -- Ha nincs még pénztár napló, megpróbáljuk létrehozni az alapértelmezett naplókat
    IF v_journal_id IS NULL THEN
      IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'acc_seed_default_journals') THEN
        PERFORM public.acc_seed_default_journals(p_company_id);
        SELECT id INTO v_journal_id
          FROM public.acc_journals
         WHERE company_id = p_company_id
           AND (type = 'PETTY_CASH' OR code ILIKE '%PENZTAR%' OR name ILIKE '%pénztár%')
         LIMIT 1;
      END IF;
    END IF;

    -- Ha továbbra sincs pénztár napló, szigorúan hibát dobunk
    IF v_journal_id IS NULL THEN
      RAISE EXCEPTION 'A céghez nem található Pénztár (PETTY_CASH) típusú napló a kettős könyvvitelben! Kérjük, hozz létre egy pénztár naplót a Főkönyv Beállításokban a feladás előtt.';
    END IF;

    -- Következő sorszám generálása a naplóhoz
    v_next_num := public.acc_get_next_journal_number(v_journal_id, EXTRACT(YEAR FROM v_report.period_end)::smallint);

    -- Pénztár főkönyvi számla ID feloldása a számlatükörből
    SELECT id INTO v_cash_gl_id
      FROM public.gl_accounts
     WHERE company_id = p_company_id
       AND gl_number = v_cash_gl
     LIMIT 1;

    IF v_cash_gl_id IS NULL THEN
      SELECT id INTO v_cash_gl_id
        FROM public.gl_accounts
       WHERE company_id = p_company_id
         AND gl_number LIKE (v_cash_gl || '%')
       ORDER BY gl_number ASC
       LIMIT 1;
    END IF;

    IF v_cash_gl_id IS NULL THEN
      RAISE EXCEPTION 'A pénztár főkönyvi számlája (%) nem található a cég számlatükrében (gl_accounts)!', v_cash_gl;
    END IF;

    -- Könyvelési naplófejléc létrehozása
    INSERT INTO public.acc_journal_headers (
      company_id,
      journal_id,
      accounting_year,
      journal_number,
      status,
      entry_type,
      source,
      posting_date,
      document_date,
      document_id,
      description,
      currency,
      import_key,
      created_by,
      posted_by,
      posted_at
    ) VALUES (
      p_company_id,
      v_journal_id,
      EXTRACT(YEAR FROM v_report.period_end)::smallint,
      v_next_num,
      'KONYVELT',
      'NORMAL',
      'CASH_REPORT',
      v_report.period_end,
      v_report.period_end,
      COALESCE(v_report.report_number, 'PJ'),
      'Pénztárjelentés feladása: ' || COALESCE(v_report.report_number, 'PJ'),
      COALESCE(v_report.currency, 'HUF'),
      p_cash_report_id::text,
      v_user_id,
      v_user_id,
      now()
    ) RETURNING id INTO v_header_id;

    -- Kettős könyvvitel szerinti sorok rögzítése
    v_line_no := 1;
    FOR v_entry IN
      SELECT * FROM public.petty_cash_entries
       WHERE cash_report_id = p_cash_report_id
         AND status <> 'cancelled'
       ORDER BY entry_date ASC, created_at ASC
    LOOP
      v_contra_gl := COALESCE(v_entry.gl_contra_account, '389');

      -- Ellenszámla ID feloldása
      SELECT id INTO v_contra_gl_id
        FROM public.gl_accounts
       WHERE company_id = p_company_id
         AND gl_number = v_contra_gl
       LIMIT 1;

      IF v_contra_gl_id IS NULL THEN
        SELECT id INTO v_contra_gl_id
          FROM public.gl_accounts
         WHERE company_id = p_company_id
           AND gl_number LIKE (v_contra_gl || '%')
         ORDER BY gl_number ASC
         LIMIT 1;
      END IF;

      IF v_contra_gl_id IS NULL THEN
        RAISE EXCEPTION 'A tétel ellenszámlája (%) nem található a cég számlatükrében (gl_accounts)!', v_contra_gl;
      END IF;

      IF v_entry.amount > 0 THEN
        -- Bevétel: T 381 Pénztár / K Ellenszámla
        INSERT INTO public.acc_journal_lines (
          header_id,
          sequence_number,
          gl_account_id,
          dc_type,
          amount,
          foreign_amount,
          description
        ) VALUES 
        (v_header_id, v_line_no, v_cash_gl_id, 'T', v_entry.amount, v_entry.amount, COALESCE(v_entry.description, 'Pénztári bevétel')),
        (v_header_id, (v_line_no + 1)::smallint, v_contra_gl_id, 'K', v_entry.amount, v_entry.amount, COALESCE(v_entry.description, 'Pénztári bevétel ellenszámla'));
      ELSE
        -- Kiadás: T Ellenszámla / K 381 Pénztár
        INSERT INTO public.acc_journal_lines (
          header_id,
          sequence_number,
          gl_account_id,
          dc_type,
          amount,
          foreign_amount,
          description
        ) VALUES 
        (v_header_id, v_line_no, v_contra_gl_id, 'T', ABS(v_entry.amount), ABS(v_entry.amount), COALESCE(v_entry.description, 'Pénztári kiadás ellenszámla')),
        (v_header_id, (v_line_no + 1)::smallint, v_cash_gl_id, 'K', ABS(v_entry.amount), ABS(v_entry.amount), COALESCE(v_entry.description, 'Pénztári kiadás'));
      END IF;

      v_line_no := (v_line_no + 2)::smallint;
    END LOOP;
  END IF;

  -- 3. Pénztárjelentés státusz frissítése: posted
  UPDATE public.cash_reports
     SET status = 'posted',
         notes = COALESCE(notes || E'\n', '') || '[Feladva könyvelésre: ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ']',
         updated_at = now()
   WHERE id = p_cash_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'cash_report_id', p_cash_report_id,
    'status', 'posted',
    'journal_header_id', v_header_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.post_cash_report_to_gl FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_cash_report_to_gl TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. unpost_cash_report_from_gl
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unpost_cash_report_from_gl(
  p_company_id uuid,
  p_cash_report_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_report RECORD;
  v_header_id uuid;
  v_user_id uuid;
  v_gl_table_exists boolean;
BEGIN
  v_user_id := (SELECT auth.uid());

  SELECT * INTO v_report
    FROM public.cash_reports
   WHERE id = p_cash_report_id
     AND company_id = p_company_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A pénztárjelentés nem található.';
  END IF;

  IF v_report.status <> 'posted' THEN
    RAISE EXCEPTION 'Csak feladott pénztárjelentés feladása vonható vissza (jelenlegi státusz: %).', v_report.status;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
     WHERE table_schema = 'public' 
       AND table_name = 'acc_journal_headers'
  ) INTO v_gl_table_exists;

  IF v_gl_table_exists THEN
    SELECT id INTO v_header_id
      FROM public.acc_journal_headers
     WHERE company_id = p_company_id
       AND source = 'CASH_REPORT'
       AND import_key = p_cash_report_id::text
     LIMIT 1;

    IF v_header_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'acc_unpost_journal_entry') THEN
        PERFORM public.acc_unpost_journal_entry(v_header_id, v_user_id, 'Pénztárjelentés feladás visszavonása');
      END IF;
    END IF;
  END IF;

  UPDATE public.cash_reports
     SET status = 'closed',
         notes = COALESCE(notes || E'\n', '') || '[Feladás visszavonva: ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ']',
         updated_at = now()
   WHERE id = p_cash_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'cash_report_id', p_cash_report_id,
    'status', 'closed'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unpost_cash_report_from_gl FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.unpost_cash_report_from_gl TO authenticated, service_role;
