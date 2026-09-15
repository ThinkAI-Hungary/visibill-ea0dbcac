-- Migration: Opening Entries Module (Nyitó tételek metodikája)
-- Date: 2026-09-01

-- 1. Function to validate and post opening entries with strict 491 balance check (sum T = sum K = 0)
CREATE OR REPLACE FUNCTION public.acc_validate_and_post_opening_entry(
  p_header_id UUID,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_header RECORD;
  v_next_num INTEGER;
  v_imbalance NUMERIC;
  v_491_balance NUMERIC;
  v_invalid_class_count INTEGER;
BEGIN
  -- Lock header for update
  SELECT h.*, j.code AS journal_code 
    INTO v_header 
    FROM public.acc_journal_headers h
    JOIN public.acc_journals j ON h.journal_id = j.id
   WHERE h.id = p_header_id FOR UPDATE;
  
  IF v_header IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nyitó bizonylat nem található.');
  END IF;
  
  IF v_header.status = 'KONYVELT' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Már lekönyvelt bizonylat.');
  END IF;

  -- 1. Dátum ellenőrzés: nyitó tétel csak az üzleti év 1. napja lehet
  IF EXTRACT(MONTH FROM v_header.posting_date) <> 1 OR EXTRACT(DAY FROM v_header.posting_date) <> 1 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'A nyitó tételek könyvelési dátuma kizárólag az üzleti év első napja (január 1.) lehet.'
    );
  END IF;

  -- 2. Számlaosztály ellenőrzés: csak az 1-4. számlaosztály nyitható egyenleggel (5-9. eredményszámlák nem)
  SELECT COUNT(*) INTO v_invalid_class_count
    FROM public.acc_journal_lines l
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
   WHERE l.header_id = p_header_id
     AND LEFT(REPLACE(g.gl_number, '.', ''), 1) IN ('5', '6', '7', '8', '9');

  IF v_invalid_class_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Az eredményszámlák (5-9. számlaosztály) nem nyithatók egyenleggel! Az előző évi eredmény a 419. Adózott eredmény számlán nyílik meg.'
    );
  END IF;

  -- 3. Kettős könyvvitel egyensúly ellenőrzés (SUM T = SUM K)
  SELECT COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE -amount END), 0)
    INTO v_imbalance
    FROM public.acc_journal_lines
   WHERE header_id = p_header_id;

  IF v_imbalance <> 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', FORMAT('A nyitó bizonylat nem egyensúlyos! Eltérés: %s Ft.', v_imbalance)
    );
  END IF;

  -- 4. 491-es Technikai Nyitómérleg számla egyenlegének ellenőrzése (0-ra kell futnia)
  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END), 0)
    INTO v_491_balance
    FROM public.acc_journal_lines l
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
   WHERE l.header_id = p_header_id
     AND REPLACE(split_part(g.gl_number, '-', 1), '.', '') LIKE '491%';

  IF v_491_balance <> 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', FORMAT('A 491. Nyitómérleg technikai számla egyenlege nem 0 Ft! Jelenlegi egyenleg: %s Ft (Σ Eszköz nyitó = Σ Forrás nyitó kötelező).', v_491_balance)
    );
  END IF;

  -- Get next sequential number in NY journal
  v_next_num := public.acc_get_next_journal_number(v_header.journal_id, v_header.accounting_year);

  -- Update header to KONYVELT
  UPDATE public.acc_journal_headers
     SET status = 'KONYVELT',
         journal_number = v_next_num,
         posting_timestamp = now(),
         posted_by = p_user_id,
         posted_at = now()
   WHERE id = p_header_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'A nyitó bizonylat sikeresen ellenőrizve és lekönyvelve!',
    'journal_number', v_next_num
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Function to generate post-opening reconciliation entries (Nyitás utáni rendező tételek)
CREATE OR REPLACE FUNCTION public.acc_generate_post_opening_reconciliations(
  p_company_id UUID,
  p_user_id UUID,
  p_year SMALLINT
) RETURNS JSONB AS $$
DECLARE
  v_ve_journal_id UUID;
  v_posted_ny_header_id UUID;
  v_posting_date DATE;
  v_header_id UUID;
  v_line_seq SMALLINT := 1;
  v_419_account_id UUID;
  v_413_account_id UUID;
  v_466_account_id UUID;
  v_467_account_id UUID;
  v_468_account_id UUID;
  
  v_419_balance NUMERIC := 0;
  v_419_dc CHAR(1);
  v_466_balance NUMERIC := 0;
  v_467_balance NUMERIC := 0;
  v_created_entries INTEGER := 0;
BEGIN
  v_posting_date := MAKE_DATE(p_year, 1, 1);

  -- 1. Find VE (Vegyes) journal
  SELECT id INTO v_ve_journal_id
    FROM public.acc_journals
   WHERE company_id = p_company_id AND code = 'VE'
   LIMIT 1;

  IF v_ve_journal_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A VE (Vegyes) napló nem található a cégnél.');
  END IF;

  -- 2. Find active preset for company to resolve GL account IDs
  -- Fetch 419, 413, 466, 467, 468 GL account IDs
  SELECT id INTO v_419_account_id FROM public.gl_accounts WHERE gl_number LIKE '419%' LIMIT 1;
  SELECT id INTO v_413_account_id FROM public.gl_accounts WHERE gl_number LIKE '413%' LIMIT 1;
  SELECT id INTO v_466_account_id FROM public.gl_accounts WHERE gl_number LIKE '466%' LIMIT 1;
  SELECT id INTO v_467_account_id FROM public.gl_accounts WHERE gl_number LIKE '467%' LIMIT 1;
  SELECT id INTO v_468_account_id FROM public.gl_accounts WHERE gl_number LIKE '468%' LIMIT 1;

  -- Check posted opening header (NY journal) for this year
  SELECT h.id INTO v_posted_ny_header_id
    FROM public.acc_journal_headers h
    JOIN public.acc_journals j ON h.journal_id = j.id
   WHERE h.company_id = p_company_id 
     AND j.code = 'NY' 
     AND h.accounting_year = p_year 
     AND h.status = 'KONYVELT'
   ORDER BY h.posted_at DESC LIMIT 1;

  IF v_posted_ny_header_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Még nincs lekönyvelt Nyitó bizonylat erre az évre. Először könyveld le a nyitó tételeket!');
  END IF;

  -- Check 419 (Adózott eredmény) opening balance
  SELECT COALESCE(SUM(CASE WHEN dc_type = 'K' THEN amount ELSE -amount END), 0)
    INTO v_419_balance
    FROM public.acc_journal_lines
   WHERE header_id = v_posted_ny_header_id
     AND gl_account_id = v_419_account_id;

  -- Check 466 (Előzetes ÁFA) & 467 (Fizetendő ÁFA) opening balance
  SELECT COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE -amount END), 0)
    INTO v_466_balance
    FROM public.acc_journal_lines
   WHERE header_id = v_posted_ny_header_id
     AND gl_account_id = v_466_account_id;

  SELECT COALESCE(SUM(CASE WHEN dc_type = 'K' THEN amount ELSE -amount END), 0)
    INTO v_467_balance
    FROM public.acc_journal_lines
   WHERE header_id = v_posted_ny_header_id
     AND gl_account_id = v_467_account_id;

  -- 3. Create Rendező Tételek Header in VE journal
  INSERT INTO public.acc_journal_headers (
    company_id, journal_id, accounting_year, status, entry_type, source,
    posting_date, document_date, document_id, description, justification, currency, created_by
  ) VALUES (
    p_company_id, v_ve_journal_id, p_year, 'KEZI_PISZKOZAT', 'NORMAL', 'KEZI',
    v_posting_date, v_posting_date, 'RENDEZO-' || p_year,
    'Nyitás utáni rendező tételek (419 átvezetés, ÁFA összevezetés)',
    'Nyitást követő kötelező számviteli rendező tételek az Sztv. alapján.',
    'HUF', p_user_id
  ) RETURNING id INTO v_header_id;

  -- 3a. Add 419 -> 413 transfer line
  IF v_419_balance <> 0 AND v_419_account_id IS NOT NULL AND v_413_account_id IS NOT NULL THEN
    IF v_419_balance > 0 THEN
      -- Nyereség: T 419 - K 413
      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
      VALUES (v_header_id, v_line_seq, v_419_account_id, 'T', ABS(v_419_balance), 'Nyitó nyereség átvezetése Eredménytartalékba');
      v_line_seq := v_line_seq + 1;

      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
      VALUES (v_header_id, v_line_seq, v_413_account_id, 'K', ABS(v_419_balance), 'Nyitó nyereség átvezetése Eredménytartalékba');
      v_line_seq := v_line_seq + 1;
    ELSE
      -- Veszteség: T 413 - K 419
      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
      VALUES (v_header_id, v_line_seq, v_413_account_id, 'T', ABS(v_419_balance), 'Nyitó veszteség átvezetése Eredménytartalékba');
      v_line_seq := v_line_seq + 1;

      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
      VALUES (v_header_id, v_line_seq, v_419_account_id, 'K', ABS(v_419_balance), 'Nyitó veszteség átvezetése Eredménytartalékba');
      v_line_seq := v_line_seq + 1;
    END IF;
    v_created_entries := v_created_entries + 1;
  END IF;

  -- 3b. Add ÁFA összevezetés lines (466 -> 468 and 467 -> 468)
  IF v_466_balance <> 0 AND v_466_account_id IS NOT NULL AND v_468_account_id IS NOT NULL THEN
    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_line_seq, v_468_account_id, 'T', ABS(v_466_balance), 'Nyitó Előzetes ÁFA összevezetése 468-ra');
    v_line_seq := v_line_seq + 1;

    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_line_seq, v_466_account_id, 'K', ABS(v_466_balance), 'Nyitó Előzetes ÁFA összevezetése 468-ra');
    v_line_seq := v_line_seq + 1;
    v_created_entries := v_created_entries + 1;
  END IF;

  IF v_467_balance <> 0 AND v_467_account_id IS NOT NULL AND v_468_account_id IS NOT NULL THEN
    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_line_seq, v_467_account_id, 'T', ABS(v_467_balance), 'Nyitó Fizetendő ÁFA összevezetése 468-ra');
    v_line_seq := v_line_seq + 1;

    INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
    VALUES (v_header_id, v_line_seq, v_468_account_id, 'K', ABS(v_467_balance), 'Nyitó Fizetendő ÁFA összevezetése 468-ra');
    v_line_seq := v_line_seq + 1;
    v_created_entries := v_created_entries + 1;
  END IF;

  IF v_created_entries = 0 THEN
    -- Delete empty header
    DELETE FROM public.acc_journal_headers WHERE id = v_header_id;
    RETURN jsonb_build_object('success', true, 'message', 'Nincs szükség rendező tételekre (419, 466, 467 egyenlegek nullák vagy nem szerepeltek a nyitásban).');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', FORMAT('Sikeresen létrejött %s db nyitás utáni rendező tétel a Vegyes naplóban!', v_created_entries),
    'header_id', v_header_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Function to check sub-ledger reconciliation vs GL opening balances
CREATE OR REPLACE FUNCTION public.acc_check_opening_subledger_reconciliation(
  p_company_id UUID,
  p_year SMALLINT
) RETURNS JSONB AS $$
DECLARE
  v_open_ar_sum NUMERIC := 0;
  v_open_ap_sum NUMERIC := 0;
  v_gl_311_opening NUMERIC := 0;
  v_gl_454_opening NUMERIC := 0;
  v_ny_header_id UUID;
BEGIN
  -- Get posted NY header
  SELECT h.id INTO v_ny_header_id
    FROM public.acc_journal_headers h
    JOIN public.acc_journals j ON h.journal_id = j.id
   WHERE h.company_id = p_company_id 
     AND j.code = 'NY' 
     AND h.accounting_year = p_year 
     AND h.status = 'KONYVELT'
   ORDER BY h.posted_at DESC LIMIT 1;

  -- Open Invoices (AR - Vevő) sum
  SELECT COALESCE(SUM(COALESCE(net_amount, 0) + COALESCE(vat_amount, 0)), 0)
    INTO v_open_ar_sum
    FROM public.invoices
   WHERE company_id = p_company_id
     AND invoice_direction = 'OUTBOUND'
     AND payment_status IN ('unpaid', 'partially_paid');

  -- Open Invoices (AP - Szállító) sum
  SELECT COALESCE(SUM(COALESCE(net_amount, 0) + COALESCE(vat_amount, 0)), 0)
    INTO v_open_ap_sum
    FROM public.invoices
   WHERE company_id = p_company_id
     AND invoice_direction = 'INBOUND'
     AND payment_status IN ('unpaid', 'partially_paid');

  -- GL 311 opening
  IF v_ny_header_id IS NOT NULL THEN
    SELECT COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE -amount END), 0)
      INTO v_gl_311_opening
      FROM public.acc_journal_lines l
      JOIN public.gl_accounts g ON l.gl_account_id = g.id
     WHERE l.header_id = v_ny_header_id
       AND REPLACE(g.gl_number, '.', '') LIKE '311%';

    -- GL 454 opening
    SELECT COALESCE(SUM(CASE WHEN dc_type = 'K' THEN amount ELSE -amount END), 0)
      INTO v_gl_454_opening
      FROM public.acc_journal_lines l
      JOIN public.gl_accounts g ON l.gl_account_id = g.id
     WHERE l.header_id = v_ny_header_id
       AND REPLACE(g.gl_number, '.', '') LIKE '454%';
  END IF;

  RETURN jsonb_build_object(
    'open_ar_subledger', v_open_ar_sum,
    'gl_311_opening', v_gl_311_opening,
    'ar_diff', (v_open_ar_sum - v_gl_311_opening),
    'open_ap_subledger', v_open_ap_sum,
    'gl_454_opening', v_gl_454_opening,
    'ap_diff', (v_open_ap_sum - v_gl_454_opening),
    'is_reconciled', (v_open_ar_sum = v_gl_311_opening AND v_open_ap_sum = v_gl_454_opening)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
