-- ==============================================================================
-- Migration: 20260928121000_cash_report_workflow_rpcs.sql
-- Description: Tranzakciós RPC eljárások az Időszaki Pénztárjelentéshez:
--              1. create_cash_receipt_with_seq (BPB/KPB szigorú sorszámozás)
--              2. finalize_cash_report_closing (zárás, címletjegyzék, jegyzőkönyv, sorszám, hash)
--              3. reopen_cash_report (lezárt jelentés újranyitása jegyzőkönyvvel)
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. create_cash_receipt_with_seq
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_cash_receipt_with_seq(
  p_company_id uuid,
  p_cash_register_id uuid,
  p_cash_entry_id uuid,
  p_receipt_type text,
  p_issued_at date,
  p_payer_or_payee_name text,
  p_payer_or_payee_address text,
  p_amount numeric,
  p_currency text,
  p_amount_in_words text,
  p_legal_title text,
  p_description text,
  p_partner_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_year text;
  v_seq_no integer;
  v_prefix text;
  v_receipt_number text;
  v_receipt_id uuid;
  v_result jsonb;
BEGIN
  -- Multi-tenancy membership check
  IF NOT (
    public.is_company_member_or_above(p_company_id)
    OR EXISTS (
      SELECT 1 FROM public.company_members cm 
       WHERE cm.company_id = p_company_id 
         AND cm.user_id = (SELECT auth.uid())
    )
    OR auth.uid() IS NULL
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég pénztárbizonylatainak kiállítására.';
  END IF;

  IF p_receipt_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Érvénytelen bizonylat típus: % (csak in vagy out megengedett)', p_receipt_type;
  END IF;

  v_year := to_char(COALESCE(p_issued_at, CURRENT_DATE), 'YYYY');
  v_prefix := CASE WHEN p_receipt_type = 'in' THEN 'BPB-' ELSE 'KPB-' END;

  -- Advisory lock a céges és pénztári bizonylatsorszám hézagmentesség biztosítására
  PERFORM pg_advisory_xact_lock(hashtext('cash_receipt_' || p_company_id::text || '_' || p_cash_register_id::text || '_' || p_receipt_type || '_' || v_year));

  SELECT COALESCE(MAX(seq_no), 0) + 1
    INTO v_seq_no
    FROM public.cash_receipts
   WHERE company_id = p_company_id
     AND cash_register_id = p_cash_register_id
     AND receipt_type = p_receipt_type
     AND to_char(issued_at, 'YYYY') = v_year;

  v_receipt_number := v_prefix || v_year || '-' || lpad(v_seq_no::text, 5, '0');

  INSERT INTO public.cash_receipts (
    company_id,
    cash_register_id,
    cash_entry_id,
    receipt_type,
    seq_no,
    receipt_number,
    issued_at,
    partner_id,
    payer_or_payee_name,
    payer_or_payee_address,
    amount,
    currency,
    amount_in_words,
    legal_title,
    description,
    created_by
  ) VALUES (
    p_company_id,
    p_cash_register_id,
    p_cash_entry_id,
    p_receipt_type,
    v_seq_no,
    v_receipt_number,
    COALESCE(p_issued_at, CURRENT_DATE),
    p_partner_id,
    p_payer_or_payee_name,
    p_payer_or_payee_address,
    p_amount,
    COALESCE(p_currency, 'HUF'),
    p_amount_in_words,
    p_legal_title,
    p_description,
    (SELECT auth.uid())
  )
  RETURNING id INTO v_receipt_id;

  -- Ha van csatolt petty_cash_entry, kössük vissza a receipt_id-t
  IF p_cash_entry_id IS NOT NULL THEN
    UPDATE public.petty_cash_entries
       SET receipt_id = v_receipt_id
     WHERE id = p_cash_entry_id
       AND company_id = p_company_id;
  END IF;

  SELECT to_jsonb(r) INTO v_result
    FROM public.cash_receipts r
   WHERE r.id = v_receipt_id;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_cash_receipt_with_seq FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_cash_receipt_with_seq TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. finalize_cash_report_closing
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finalize_cash_report_closing(
  p_company_id uuid,
  p_cash_report_id uuid,
  p_closing_balance_actual numeric,
  p_denomination_rows jsonb DEFAULT '[]'::jsonb,
  p_difference_reason text DEFAULT NULL,
  p_difference_action text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_expected_book_balance numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_report RECORD;
  v_year text;
  v_seq_no integer;
  v_report_number text;
  v_total_in numeric := 0;
  v_total_out numeric := 0;
  v_closing_book numeric := 0;
  v_diff numeric := 0;
  v_balancing_entry_id uuid := NULL;
  v_row RECORD;
  v_line_no integer := 1;
  v_hash_text text;
  v_content_hash text;
  v_result jsonb;
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE((SELECT auth.uid()), (SELECT user_id FROM public.company_members WHERE company_id = p_company_id LIMIT 1));

  -- Multi-tenancy ellenőrzés
  IF NOT (
    public.is_company_member_or_above(p_company_id)
    OR EXISTS (
      SELECT 1 FROM public.company_members cm 
       WHERE cm.company_id = p_company_id 
         AND cm.user_id = v_user_id
    )
    OR auth.uid() IS NULL
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a pénztárjelentés lezárására.';
  END IF;

  -- Jelentés lekérdezése és zárolása
  SELECT * INTO v_report
    FROM public.cash_reports
   WHERE id = p_cash_report_id
     AND company_id = p_company_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A pénztárjelentés nem található (ID: %).', p_cash_report_id;
  END IF;

  IF v_report.status IN ('closed', 'posted') THEN
    RAISE EXCEPTION 'A pénztárjelentés már lezárt állapotban van (státusz: %).', v_report.status;
  END IF;

  -- 0. Adott pénztár és időszak nyitott tételeinek összekapcsolása a pénztárjelentéssel
  UPDATE public.petty_cash_entries
     SET cash_report_id = p_cash_report_id
   WHERE company_id = p_company_id
     AND register_id = v_report.cash_register_id
     AND currency = v_report.currency
     AND entry_date >= v_report.period_start
     AND entry_date <= v_report.period_end
     AND (
       cash_report_id IS NULL 
       OR cash_report_id = p_cash_report_id
       OR cash_report_id IN (
         SELECT cr.id FROM public.cash_reports cr 
          WHERE cr.id = petty_cash_entries.cash_report_id 
            AND cr.status IN ('open', 'closing', 'reopened')
       )
     )
     AND status <> 'cancelled';

  -- 1. Bevételek és kiadások kalkulálása a csatolt tételekből
  SELECT 
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)
  INTO v_total_in, v_total_out
  FROM public.petty_cash_entries
  WHERE cash_report_id = p_cash_report_id
    AND status <> 'cancelled';

  v_closing_book := v_report.opening_balance + v_total_in - v_total_out;

  -- Optimista konkurencia ellenőrzés (ha a kliens beküldte az általa látott könyv szerinti egyenleget)
  IF p_expected_book_balance IS NOT NULL AND ABS(v_closing_book - p_expected_book_balance) > 0.01 THEN
    RAISE EXCEPTION 'A könyv szerinti záró egyenleg a számlálás közben megváltozott (eredeti: %, aktuális: %)! Kérjük, nyisd meg újra a varázslót és ellenőrizd az időközben érkezett tételeket.', p_expected_book_balance, v_closing_book;
  END IF;

  v_diff := p_closing_balance_actual - v_closing_book;

  -- 2. Eltérés esetén kiegyenlítő tétel rögzítése
  IF v_diff <> 0 THEN
    IF p_difference_reason IS NULL OR trim(p_difference_reason) = '' THEN
      RAISE EXCEPTION 'Az eltéréshez (% Ft) indoklás megadása kötelező!', v_diff;
    END IF;

    IF v_diff > 0 THEN
      -- Többlet: bevétel (4791 ellenszámla)
      INSERT INTO public.petty_cash_entries (
        company_id,
        register_id,
        cash_report_id,
        entry_date,
        description,
        amount,
        currency,
        source_type,
        direction,
        legal_title,
        gl_contra_account,
        status,
        created_by
      ) VALUES (
        p_company_id,
        v_report.cash_register_id,
        p_cash_report_id,
        v_report.period_end,
        'Pénztári többlet elszámolása: ' || p_difference_reason,
        v_diff,
        v_report.currency,
        'manual',
        'in',
        'Pénztári többlet',
        '4791',
        'posted',
        v_user_id
      ) RETURNING id INTO v_balancing_entry_id;

      v_total_in := v_total_in + v_diff;
    ELSE
      -- Hiány: kiadás (3681 ellenszámla)
      INSERT INTO public.petty_cash_entries (
        company_id,
        register_id,
        cash_report_id,
        entry_date,
        description,
        amount,
        currency,
        source_type,
        direction,
        legal_title,
        gl_contra_account,
        status,
        created_by
      ) VALUES (
        p_company_id,
        v_report.cash_register_id,
        p_cash_report_id,
        v_report.period_end,
        'Pénztári hiány elszámolása: ' || p_difference_reason,
        v_diff, -- negatív összeg kiadásként
        v_report.currency,
        'manual',
        'out',
        'Pénztári hiány',
        '3681',
        'posted',
        v_user_id
      ) RETURNING id INTO v_balancing_entry_id;

      v_total_out := v_total_out + ABS(v_diff);
    END IF;

    -- Újraszámolt könyv szerinti egyezik a ténylegessel
    v_closing_book := p_closing_balance_actual;
  END IF;

  -- 3. Sorfolytonos line_no kiosztása időrendben
  v_line_no := 1;
  FOR v_row IN 
    SELECT id 
      FROM public.petty_cash_entries
     WHERE cash_report_id = p_cash_report_id
     ORDER BY entry_date ASC, created_at ASC
  LOOP
    UPDATE public.petty_cash_entries
       SET line_no = v_line_no
     WHERE id = v_row.id;
    v_line_no := v_line_no + 1;
  END LOOP;

  -- 4. Pénztárjelentés sorszámának kiosztása (ha még nincs)
  v_year := to_char(v_report.period_end, 'YYYY');
  IF v_report.seq_no IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('cash_report_seq_' || p_company_id::text || '_' || v_report.cash_register_id::text || '_' || v_year));

    SELECT COALESCE(MAX(seq_no), 0) + 1
      INTO v_seq_no
      FROM public.cash_reports
     WHERE company_id = p_company_id
       AND cash_register_id = v_report.cash_register_id
       AND to_char(period_end, 'YYYY') = v_year;

    v_report_number := 'PJ-' || v_year || '/' || lpad(v_seq_no::text, 3, '0');
  ELSE
    v_seq_no := v_report.seq_no;
    v_report_number := v_report.report_number;
  END IF;

  -- 5. SHA-256 tartalom hash képzése
  v_hash_text := p_cash_report_id::text || '|' ||
                 v_seq_no::text || '|' ||
                 v_report.period_start::text || '|' ||
                 v_report.period_end::text || '|' ||
                 v_report.opening_balance::text || '|' ||
                 v_total_in::text || '|' ||
                 v_total_out::text || '|' ||
                 p_closing_balance_actual::text;

  BEGIN
    v_content_hash := encode(digest(v_hash_text, 'sha256'), 'hex');
  EXCEPTION WHEN OTHERS THEN
    v_content_hash := md5(v_hash_text);
  END;

  -- 6. Címletjegyzék mentése
  DELETE FROM public.denomination_sheets 
   WHERE cash_report_id = p_cash_report_id;

  INSERT INTO public.denomination_sheets (
    company_id,
    cash_report_id,
    currency,
    rows,
    total_amount,
    version,
    created_by
  ) VALUES (
    p_company_id,
    p_cash_report_id,
    v_report.currency,
    p_denomination_rows,
    p_closing_balance_actual,
    v_report.version,
    v_user_id
  );

  -- 7. Zárási jegyzőkönyv mentése
  INSERT INTO public.cash_closing_protocols (
    company_id,
    cash_report_id,
    version,
    book_balance,
    actual_balance,
    difference,
    difference_reason,
    action,
    balancing_entry_id,
    cashier_user_id,
    cashier_signed_at,
    controller_user_id,
    controller_signed_at,
    notes
  ) VALUES (
    p_company_id,
    p_cash_report_id,
    v_report.version,
    v_report.opening_balance + v_total_in - v_total_out - (CASE WHEN v_diff > 0 THEN v_diff ELSE 0 END) + (CASE WHEN v_diff < 0 THEN ABS(v_diff) ELSE 0 END),
    p_closing_balance_actual,
    v_diff,
    p_difference_reason,
    p_difference_action,
    v_balancing_entry_id,
    v_user_id,
    now(),
    v_user_id,
    now(),
    p_notes
  );

  -- 8. Pénztárjelentés státusz frissítése
  UPDATE public.cash_reports
     SET seq_no = v_seq_no,
         report_number = v_report_number,
         status = 'closed',
         total_in = v_total_in,
         total_out = v_total_out,
         closing_balance_book = v_closing_book,
         closing_balance_actual = p_closing_balance_actual,
         difference = v_diff,
         closed_by = v_user_id,
         closed_at = now(),
         approved_by = v_user_id,
         approved_at = now(),
         content_hash = v_content_hash,
         notes = p_notes,
         updated_at = now()
   WHERE id = p_cash_report_id;

  SELECT to_jsonb(r) INTO v_result
    FROM public.cash_reports r
   WHERE r.id = p_cash_report_id;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_cash_report_closing FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_cash_report_closing TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. reopen_cash_report
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reopen_cash_report(
  p_company_id uuid,
  p_cash_report_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_report RECORD;
  v_result jsonb;
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE((SELECT auth.uid()), (SELECT user_id FROM public.company_members WHERE company_id = p_company_id LIMIT 1));

  -- Multi-tenancy ellenőrzés
  IF NOT (
    public.is_company_member_or_above(p_company_id)
    OR EXISTS (
      SELECT 1 FROM public.company_members cm 
       WHERE cm.company_id = p_company_id 
         AND cm.user_id = v_user_id
    )
    OR auth.uid() IS NULL
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a pénztárjelentés újranyitására.';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Az újranyitáshoz érdemi indoklás megadása kötelező (legalább 5 karakter)!';
  END IF;

  SELECT * INTO v_report
    FROM public.cash_reports
   WHERE id = p_cash_report_id
     AND company_id = p_company_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A pénztárjelentés nem található.';
  END IF;

  IF v_report.status = 'posted' THEN
    RAISE EXCEPTION 'A pénztárjelentés már feladásra került a főkönyvbe! Előbb a feladást kell visszavonni.';
  END IF;

  IF v_report.status <> 'closed' THEN
    RAISE EXCEPTION 'Csak lezárt pénztárjelentés nyitható újra (jelenlegi státusz: %).', v_report.status;
  END IF;

  -- Ellenőrzés: csak a legutolsó lezárt jelentés nyitható újra az adott pénztárban
  IF EXISTS (
    SELECT 1 FROM public.cash_reports
     WHERE cash_register_id = v_report.cash_register_id
       AND period_start > v_report.period_start
       AND status IN ('closed', 'posted')
  ) THEN
    RAISE EXCEPTION 'Csak a legutolsó lezárt pénztárjelentés nyitható újra! A korábbi időszak hibája helyesbítő tétellel javítandó a nyitott időszakban.';
  END IF;

  UPDATE public.cash_reports
     SET status = 'reopened',
         version = version + 1,
         notes = COALESCE(notes || E'\n', '') || '[Újranyitva: ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || '] Indok: ' || p_reason,
         updated_at = now()
   WHERE id = p_cash_report_id;

  SELECT to_jsonb(r) INTO v_result
    FROM public.cash_reports r
   WHERE r.id = p_cash_report_id;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reopen_cash_report FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_cash_report TO authenticated, service_role;
