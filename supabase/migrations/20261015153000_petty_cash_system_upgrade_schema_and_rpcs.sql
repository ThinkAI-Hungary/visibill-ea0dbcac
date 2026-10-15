-- ==============================================================================
-- Migration: 20261015153000_petty_cash_system_upgrade_schema_and_rpcs.sql
-- Description: Házipénztár Revise & Upgrade (4.1 & 4.2):
--              1. petty_cash_registers: authorizer_user_id, receipt_prefix, attachment_required, valuation_method
--              2. cash_receipts: payer_signature, recipient_signature, source_doc_type, source_doc_id, printed_copy_count
--              3. create_cash_receipt_with_seq: kibővített paraméterek és pénztári prefix maszk támogatás
--              4. check_petty_cash_timeline_integrity: negatív egyenleg hard-stop és első hibát okozó bizonylat detektor
--              5. reconcile_petty_cash_with_gl: valós idejű Főkönyv (381/382) ↔ Analitika rekonciliációs motor
--              6. calculate_fx_cash_revaluation: Sztv. 60. § dec. 31-i MNB fordulónapi valutapénztár átértékelés
--              7. get_cash_partner_monthly_limits: Art. 114. § havi 1,5M Ft-os partner készpénzlimit és szankciófigyelő
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. petty_cash_registers tábla bővítése
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.petty_cash_registers
  ADD COLUMN IF NOT EXISTS authorizer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receipt_prefix text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attachment_required text NOT NULL DEFAULT 'when_no_document'
    CHECK (attachment_required IN ('mandatory', 'when_no_document', 'optional')),
  ADD COLUMN IF NOT EXISTS valuation_method text NOT NULL DEFAULT 'average'
    CHECK (valuation_method IN ('average', 'fifo'));

COMMENT ON COLUMN public.petty_cash_registers.authorizer_user_id IS 'Utalványozásra jogosult személy (authorizer)';
COMMENT ON COLUMN public.petty_cash_registers.receipt_prefix IS 'Telephelyi vagy egyedi bizonylatszám prefix (pl. GYOR-)';
COMMENT ON COLUMN public.petty_cash_registers.attachment_required IS 'Kötelező bizonylati fedezet szabály: mandatory, when_no_document, optional';
COMMENT ON COLUMN public.petty_cash_registers.valuation_method IS 'Valutakészlet értékelési módja: average (átlagárfolyam) vagy fifo';

CREATE INDEX IF NOT EXISTS idx_petty_cash_registers_authorizer
  ON public.petty_cash_registers(authorizer_user_id) WHERE authorizer_user_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. cash_receipts tábla bővítése (digitális aláírások és forrásbizonylat)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.cash_receipts
  ADD COLUMN IF NOT EXISTS payer_signature text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recipient_signature text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_doc_type text DEFAULT NULL
    CHECK (source_doc_type IS NULL OR source_doc_type IN ('invoice', 'payroll', 'travel_order', 'bank_withdrawal', 'owner_loan', 'other')),
  ADD COLUMN IF NOT EXISTS source_doc_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS printed_copy_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_printed_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.cash_receipts.payer_signature IS 'Befizető / Kiadó digitális aláírása (PNG DataURL)';
COMMENT ON COLUMN public.cash_receipts.recipient_signature IS 'Átvevő digitális aláírása (PNG DataURL)';
COMMENT ON COLUMN public.cash_receipts.source_doc_type IS 'Kötelező forrásdokumentum típusa (invoice, payroll, travel_order, bank_withdrawal, owner_loan, other)';
COMMENT ON COLUMN public.cash_receipts.source_doc_id IS 'Forrásdokumentum azonosítója vagy sorszáma';
COMMENT ON COLUMN public.cash_receipts.printed_copy_count IS 'Kinyomtatott példányok száma';

CREATE INDEX IF NOT EXISTS idx_cash_receipts_source_doc
  ON public.cash_receipts(company_id, source_doc_type, source_doc_id)
  WHERE source_doc_type IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. create_cash_receipt_with_seq RPC frissítése (Prefix maszk & Aláírások)
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
  p_partner_id uuid DEFAULT NULL,
  p_payer_signature text DEFAULT NULL,
  p_recipient_signature text DEFAULT NULL,
  p_source_doc_type text DEFAULT NULL,
  p_source_doc_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_year text;
  v_seq_no integer;
  v_base_prefix text;
  v_reg_prefix text;
  v_full_prefix text;
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

  -- Pénztár egyedi prefix kiolvasása (pl. 'GYOR-')
  SELECT COALESCE(trim(receipt_prefix), '')
    INTO v_reg_prefix
    FROM public.petty_cash_registers
   WHERE id = p_cash_register_id;

  v_year := to_char(COALESCE(p_issued_at, CURRENT_DATE), 'YYYY');
  v_base_prefix := CASE WHEN p_receipt_type = 'in' THEN 'BPB-' ELSE 'KPB-' END;

  IF v_reg_prefix <> '' THEN
    -- Ha van pénztár prefix (pl. GYOR), biztosítjuk a kötőjelet: BPB-GYOR-2026-
    IF NOT v_reg_prefix LIKE '%-' THEN
      v_reg_prefix := v_reg_prefix || '-';
    END IF;
    v_full_prefix := v_base_prefix || v_reg_prefix;
  ELSE
    v_full_prefix := v_base_prefix;
  END IF;

  -- Advisory lock a céges és pénztári bizonylatsorszám hézagmentességének biztosítására
  PERFORM pg_advisory_xact_lock(hashtext('cash_receipt_' || p_company_id::text || '_' || p_cash_register_id::text || '_' || p_receipt_type || '_' || v_year));

  SELECT COALESCE(MAX(seq_no), 0) + 1
    INTO v_seq_no
    FROM public.cash_receipts
   WHERE company_id = p_company_id
     AND cash_register_id = p_cash_register_id
     AND receipt_type = p_receipt_type
     AND to_char(issued_at, 'YYYY') = v_year;

  v_receipt_number := v_full_prefix || v_year || '-' || lpad(v_seq_no::text, 5, '0');

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
    payer_signature,
    recipient_signature,
    source_doc_type,
    source_doc_id,
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
    p_payer_signature,
    p_recipient_signature,
    p_source_doc_type,
    p_source_doc_id,
    (SELECT auth.uid())
  )
  RETURNING id INTO v_receipt_id;

  -- Ha van csatolt petty_cash_entry, kössük vissza a receipt_id-t és receipt_number-t
  IF p_cash_entry_id IS NOT NULL THEN
    UPDATE public.petty_cash_entries
       SET receipt_id = v_receipt_id,
           receipt_number = v_receipt_number,
           direction = p_receipt_type,
           legal_title = COALESCE(legal_title, p_legal_title)
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
-- 4. check_petty_cash_timeline_integrity RPC
--    Negatív egyenleg hard stop és idősoros első hibát okozó bizonylat detektor
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_petty_cash_timeline_integrity(
  p_company_id uuid,
  p_register_id uuid,
  p_currency text,
  p_candidate_date date DEFAULT NULL,
  p_candidate_amount numeric DEFAULT NULL,
  p_exclude_entry_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_opening_amount numeric := 0;
  v_running_balance numeric := 0;
  v_candidate_applied boolean := false;
  v_candidate_amt numeric;
  v_entry RECORD;
  v_min_projected numeric := 999999999999;
  v_failed boolean := false;
  v_failed_date date;
  v_failed_receipt text;
  v_failed_desc text;
  v_failed_balance numeric;
BEGIN
  -- Multi-tenancy ellenőrzés
  IF NOT (
    public.is_company_member_or_above(p_company_id)
    OR EXISTS (
      SELECT 1 FROM public.company_members cm 
       WHERE cm.company_id = p_company_id 
         AND cm.user_id = (SELECT auth.uid())
    )
    OR auth.uid() IS NULL
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a pénztáregyenleg vizsgálatára.';
  END IF;

  -- 1. Nyitó egyenleg kiolvasása
  SELECT COALESCE(amount, 0)
    INTO v_opening_amount
    FROM public.petty_cash_opening_balances
   WHERE register_id = p_register_id
     AND currency = p_currency;

  v_running_balance := v_opening_amount;
  v_min_projected := v_running_balance;
  v_candidate_amt := COALESCE(p_candidate_amount, 0);

  -- 2. Idősoros tételek beolvasása és göngyölése
  FOR v_entry IN
    SELECT 
      e.id,
      e.entry_date,
      e.amount,
      e.description,
      e.created_at,
      r.receipt_number
    FROM public.petty_cash_entries e
    LEFT JOIN public.cash_receipts r ON e.receipt_id = r.id
    WHERE e.company_id = p_company_id
      AND e.register_id = p_register_id
      AND e.currency = p_currency
      AND e.status <> 'cancelled'
      AND (p_exclude_entry_id IS NULL OR e.id <> p_exclude_entry_id)
    ORDER BY e.entry_date ASC, e.created_at ASC
  LOOP
    -- Ha van jelölt tétel, és elértük a dátumát időrendben, beillesztjük
    IF p_candidate_date IS NOT NULL AND NOT v_candidate_applied AND p_candidate_date <= v_entry.entry_date THEN
      v_running_balance := v_running_balance + v_candidate_amt;
      v_candidate_applied := true;

      IF v_running_balance < v_min_projected THEN
        v_min_projected := v_running_balance;
      END IF;

      IF v_running_balance < 0 THEN
        v_failed := true;
        v_failed_date := p_candidate_date;
        v_failed_receipt := 'ÚJ TÉTEL';
        v_failed_desc := 'Rögzítendő kiadási bizonylat';
        v_failed_balance := v_running_balance;
        EXIT;
      END IF;
    END IF;

    -- Tétel hozzáadása a göngyölthöz
    v_running_balance := v_running_balance + v_entry.amount;

    IF v_running_balance < v_min_projected THEN
      v_min_projected := v_running_balance;
    END IF;

    -- Ha a meglévő tétel miatt fordul negatívba az egyenleg
    IF v_running_balance < 0 THEN
      v_failed := true;
      v_failed_date := v_entry.entry_date;
      v_failed_receipt := COALESCE(v_entry.receipt_number, 'Bizonylat #' || substring(v_entry.id::text, 1, 8));
      v_failed_desc := COALESCE(v_entry.description, 'Kiadás');
      v_failed_balance := v_running_balance;
      EXIT;
    END IF;
  END LOOP;

  -- Ha a jelölt tétel az összes meglévő tétel utáni dátumra esik
  IF NOT v_failed AND p_candidate_date IS NOT NULL AND NOT v_candidate_applied THEN
    v_running_balance := v_running_balance + v_candidate_amt;
    IF v_running_balance < v_min_projected THEN
      v_min_projected := v_running_balance;
    END IF;

    IF v_running_balance < 0 THEN
      v_failed := true;
      v_failed_date := p_candidate_date;
      v_failed_receipt := 'ÚJ TÉTEL';
      v_failed_desc := 'Rögzítendő kiadási bizonylat';
      v_failed_balance := v_running_balance;
    END IF;
  END IF;

  IF v_failed THEN
    RETURN jsonb_build_object(
      'valid', false,
      'opening_balance', v_opening_amount,
      'current_balance', v_running_balance - v_candidate_amt,
      'failed_at_date', v_failed_date,
      'failed_at_receipt_number', v_failed_receipt,
      'failed_at_description', v_failed_desc,
      'failed_balance', v_failed_balance,
      'min_projected_balance', v_min_projected,
      'error_message', 'A módosítás miatt ' || to_char(v_failed_date, 'YYYY. MM. DD.') || '-án a(z) ' || 
                       v_failed_receipt || ' tételnél a kasszaegyenleg ' || 
                       trim(to_char(v_failed_balance, '999,999,999,990')) || ' ' || p_currency || '-ra csökkenne! A Számviteli törvény szerint a negatív készpénzegyenleg tilos.'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'opening_balance', v_opening_amount,
    'current_balance', v_running_balance,
    'min_projected_balance', v_min_projected
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_petty_cash_timeline_integrity FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_petty_cash_timeline_integrity TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. reconcile_petty_cash_with_gl RPC
--    Valós idejű Főkönyv (381/382) ↔ Házipénztár Analitika egyezőség-ellenőrzés
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reconcile_petty_cash_with_gl(
  p_company_id uuid,
  p_year integer,
  p_date_to date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_registers jsonb := '[]'::jsonb;
  v_reg RECORD;
  v_analytic_bal numeric := 0;
  v_gl_bal numeric := 0;
  v_gl_account text;
  v_reg_diff numeric := 0;
  v_unposted_entries jsonb := '[]'::jsonb;
  v_direct_gl_entries jsonb := '[]'::jsonb;
  v_total_analytic numeric := 0;
  v_total_gl numeric := 0;
  v_has_discrepancy boolean := false;
BEGIN
  -- Multi-tenancy ellenőrzés
  IF NOT (
    public.is_company_member_or_above(p_company_id)
    OR EXISTS (
      SELECT 1 FROM public.company_members cm 
       WHERE cm.company_id = p_company_id 
         AND cm.user_id = (SELECT auth.uid())
    )
    OR auth.uid() IS NULL
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a főkönyvi pénztár-egyeztetés megtekintésére.';
  END IF;

  -- 1. Pénztárankénti analitikus egyenleg és főkönyvi egyenleg összevetése
  FOR v_reg IN
    SELECT 
      r.id,
      r.name,
      r.location,
      r.currencies,
      COALESCE(r.gl_account, CASE WHEN 'HUF' = ANY(r.currencies) THEN '381' ELSE '382' END) as gl_num
    FROM public.petty_cash_registers r
    WHERE r.company_id = p_company_id
    ORDER BY r.is_default DESC, r.name ASC
  LOOP
    v_gl_account := v_reg.gl_num;

    -- Analitikus egyenleg (Nyitó + Időszaki tételek a p_date_to-ig)
    SELECT 
      COALESCE((
        SELECT SUM(amount) FROM public.petty_cash_opening_balances 
         WHERE register_id = v_reg.id
      ), 0) +
      COALESCE((
        SELECT SUM(amount) FROM public.petty_cash_entries 
         WHERE register_id = v_reg.id 
           AND status <> 'cancelled'
           AND entry_date <= p_date_to
           AND EXTRACT(YEAR FROM entry_date) = p_year
      ), 0)
    INTO v_analytic_bal;

    -- Főkönyvi egyenleg a számlatükörből és könyvelt naplósorokból
    SELECT COALESCE(SUM(
      CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END
    ), 0)
    INTO v_gl_bal
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.gl_accounts ga ON l.gl_account_id = ga.id
    WHERE h.company_id = p_company_id
      AND h.accounting_year = p_year
      AND h.status = 'KONYVELT'
      AND h.posting_date <= p_date_to
      AND (ga.gl_number = v_gl_account OR ga.gl_number LIKE (v_gl_account || '%'));

    v_reg_diff := v_analytic_bal - v_gl_bal;
    IF ABS(v_reg_diff) > 0.01 THEN
      v_has_discrepancy := true;
    END IF;

    v_total_analytic := v_total_analytic + v_analytic_bal;
    v_total_gl := v_total_gl + v_gl_bal;

    v_registers := v_registers || jsonb_build_object(
      'register_id', v_reg.id,
      'register_name', v_reg.name,
      'gl_account', v_gl_account,
      'currencies', v_reg.currencies,
      'analytic_balance', v_analytic_bal,
      'gl_balance', v_gl_bal,
      'difference', v_reg_diff,
      'is_matching', (ABS(v_reg_diff) <= 0.01)
    );
  END LOOP;

  -- 2. Analitikában létező, de még le nem könyvelt / jóváhagyásra váró tételek
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'entry_date', e.entry_date,
      'register_name', r.name,
      'amount', e.amount,
      'currency', e.currency,
      'description', e.description,
      'status', e.status,
      'receipt_number', cr.receipt_number,
      'cash_report_status', rep.status
    )
  ), '[]'::jsonb)
  INTO v_unposted_entries
  FROM public.petty_cash_entries e
  JOIN public.petty_cash_registers r ON e.register_id = r.id
  LEFT JOIN public.cash_receipts cr ON e.receipt_id = cr.id
  LEFT JOIN public.cash_reports rep ON e.cash_report_id = rep.id
  WHERE e.company_id = p_company_id
    AND e.status <> 'cancelled'
    AND e.entry_date <= p_date_to
    AND EXTRACT(YEAR FROM e.entry_date) = p_year
    AND (rep.id IS NULL OR rep.status <> 'posted');

  -- 3. Főkönyvbe könyvelt olyan 381/382 tételek, amelyek NEM pénztárjelentésből keletkeztek
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'journal_header_id', h.id,
      'journal_number', h.journal_number,
      'source', h.source,
      'posting_date', h.posting_date,
      'description', l.description,
      'dc_type', l.dc_type,
      'amount', l.amount,
      'gl_number', ga.gl_number
    )
  ), '[]'::jsonb)
  INTO v_direct_gl_entries
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON l.header_id = h.id
  JOIN public.gl_accounts ga ON l.gl_account_id = ga.id
  WHERE h.company_id = p_company_id
    AND h.accounting_year = p_year
    AND h.status = 'KONYVELT'
    AND h.posting_date <= p_date_to
    AND (ga.gl_number LIKE '381%' OR ga.gl_number LIKE '382%')
    AND (h.source IS NULL OR h.source <> 'CASH_REPORT');

  RETURN jsonb_build_object(
    'year', p_year,
    'date_to', p_date_to,
    'is_fully_reconciled', (NOT v_has_discrepancy),
    'total_analytic_balance', v_total_analytic,
    'total_gl_balance', v_total_gl,
    'total_difference', (v_total_analytic - v_total_gl),
    'registers', v_registers,
    'unposted_entries', v_unposted_entries,
    'direct_gl_entries', v_direct_gl_entries
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_petty_cash_with_gl FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_petty_cash_with_gl TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. calculate_fx_cash_revaluation RPC
--    Valutapénztár (382) Sztv. 60. § szerinti dec. 31-i MNB fordulónapi átértékelés
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_fx_cash_revaluation(
  p_company_id uuid,
  p_year integer,
  p_post_to_gl boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cutoff_date date;
  v_reg RECORD;
  v_cur text;
  v_fx_rate numeric;
  v_fx_balance numeric;
  v_book_huf numeric;
  v_market_huf numeric;
  v_diff_huf numeric;
  v_total_gain numeric := 0;
  v_total_loss numeric := 0;
  v_items jsonb := '[]'::jsonb;
  v_journal_id uuid;
  v_header_id uuid;
  v_user_id uuid;
  v_next_num integer;
  v_line_no smallint := 1;
  v_382_id uuid;
  v_976_id uuid;
  v_876_id uuid;
BEGIN
  -- Multi-tenancy ellenőrzés
  IF NOT (
    public.is_company_member_or_above(p_company_id)
    OR EXISTS (
      SELECT 1 FROM public.company_members cm 
       WHERE cm.company_id = p_company_id 
         AND cm.user_id = (SELECT auth.uid())
    )
    OR auth.uid() IS NULL
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a valutapénztár átértékelés számítására.';
  END IF;

  v_user_id := (SELECT auth.uid());
  v_cutoff_date := (p_year || '-12-31')::date;

  -- 1. Nem-HUF (valuta) pénztárak lekérdezése
  FOR v_reg IN
    SELECT id, name, currencies, COALESCE(gl_account, '382') as gl_num
      FROM public.petty_cash_registers
     WHERE company_id = p_company_id
       AND NOT ('HUF' = ANY(currencies))
  LOOP
    FOREACH v_cur IN ARRAY v_reg.currencies
    LOOP
      -- Valuta egyenleg dec. 31-én
      SELECT 
        COALESCE((SELECT SUM(amount) FROM public.petty_cash_opening_balances WHERE register_id = v_reg.id AND currency = v_cur), 0) +
        COALESCE((SELECT SUM(amount) FROM public.petty_cash_entries WHERE register_id = v_reg.id AND currency = v_cur AND status <> 'cancelled' AND entry_date <= v_cutoff_date), 0)
      INTO v_fx_balance;

      -- MNB dec. 31-i árfolyam kiolvasása
      SELECT rate INTO v_fx_rate
        FROM public.daily_exchange_rates
       WHERE currency = v_cur
         AND rate_date <= v_cutoff_date
       ORDER BY rate_date DESC
       LIMIT 1;

      IF v_fx_rate IS NULL THEN
        -- Fallback: legutolsó elérhető MNB árfolyam
        SELECT rate INTO v_fx_rate
          FROM public.daily_exchange_rates
         WHERE currency = v_cur
         ORDER BY rate_date DESC
         LIMIT 1;
      END IF;

      IF v_fx_rate IS NULL THEN
        v_fx_rate := 1.0; -- végső fallback
      END IF;

      -- Könyv szerinti HUF egyenleg feloldása (a meglévő forgalom alapján vagy bekerülési árfolyamon)
      v_market_huf := round(v_fx_balance * v_fx_rate);

      -- Becsült könyv szerinti HUF (ha nincs tételes FIFO, az évközi tranzakciókból származtatva)
      SELECT COALESCE(SUM(
        CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END
      ), v_market_huf)
      INTO v_book_huf
      FROM public.acc_journal_lines l
      JOIN public.acc_journal_headers h ON l.header_id = h.id
      JOIN public.gl_accounts ga ON l.gl_account_id = ga.id
      WHERE h.company_id = p_company_id
        AND h.accounting_year = p_year
        AND h.status = 'KONYVELT'
        AND h.posting_date <= v_cutoff_date
        AND ga.gl_number LIKE (v_reg.gl_num || '%');

      v_diff_huf := v_market_huf - v_book_huf;

      IF v_diff_huf > 0 THEN
        v_total_gain := v_total_gain + v_diff_huf;
      ELSIF v_diff_huf < 0 THEN
        v_total_loss := v_total_loss + ABS(v_diff_huf);
      END IF;

      v_items := v_items || jsonb_build_object(
        'register_id', v_reg.id,
        'register_name', v_reg.name,
        'currency', v_cur,
        'fx_balance', v_fx_balance,
        'mnb_rate', v_fx_rate,
        'book_huf', v_book_huf,
        'market_huf', v_market_huf,
        'difference_huf', v_diff_huf,
        'direction', CASE WHEN v_diff_huf >= 0 THEN 'GAIN' ELSE 'LOSS' END
      );
    END LOOP;
  END LOOP;

  -- 2. Opcionális lekönyvelés a VE (vegyes) naplóba
  IF p_post_to_gl AND (v_total_gain > 0 OR v_total_loss > 0) THEN
    -- Vegyes napló keresése
    SELECT id INTO v_journal_id
      FROM public.acc_journals
     WHERE company_id = p_company_id
       AND (type = 'GENERAL' OR code ILIKE '%VE%' OR name ILIKE '%vegyes%')
     LIMIT 1;

    IF v_journal_id IS NOT NULL THEN
      v_next_num := public.acc_get_next_journal_number(v_journal_id, p_year::smallint);

      -- Főkönyvi számlák feloldása
      SELECT id INTO v_382_id FROM public.gl_accounts WHERE company_id = p_company_id AND gl_number LIKE '382%' LIMIT 1;
      SELECT id INTO v_976_id FROM public.gl_accounts WHERE company_id = p_company_id AND gl_number LIKE '976%' LIMIT 1;
      SELECT id INTO v_876_id FROM public.gl_accounts WHERE company_id = p_company_id AND gl_number LIKE '876%' LIMIT 1;

      IF v_382_id IS NOT NULL AND (v_976_id IS NOT NULL OR v_876_id IS NOT NULL) THEN
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
          created_by,
          posted_by,
          posted_at
        ) VALUES (
          p_company_id,
          v_journal_id,
          p_year::smallint,
          v_next_num,
          'KONYVELT',
          'CLOSING',
          'FX_REVALUATION',
          v_cutoff_date,
          v_cutoff_date,
          'Sztv-60-Valuta-' || p_year,
          'Sztv. 60. § szerinti dec. 31-i valutapénztár MNB átértékelés',
          'HUF',
          v_user_id,
          v_user_id,
          now()
        ) RETURNING id INTO v_header_id;

        -- Nyereség: T 382 / K 976
        IF v_total_gain > 0 AND v_976_id IS NOT NULL THEN
          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
          VALUES 
          (v_header_id, v_line_no, v_382_id, 'T', v_total_gain, v_total_gain, 'Valutapénztár nem realizált árfolyamnyereség'),
          (v_header_id, (v_line_no + 1)::smallint, v_976_id, 'K', v_total_gain, v_total_gain, 'Valutapénztár nem realizált árfolyamnyereség');
          v_line_no := (v_line_no + 2)::smallint;
        END IF;

        -- Veszteség: T 876 / K 382
        IF v_total_loss > 0 AND v_876_id IS NOT NULL THEN
          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
          VALUES 
          (v_header_id, v_line_no, v_876_id, 'T', v_total_loss, v_total_loss, 'Valutapénztár nem realizált árfolyamveszteség'),
          (v_header_id, (v_line_no + 1)::smallint, v_382_id, 'K', v_total_loss, v_total_loss, 'Valutapénztár nem realizált árfolyamveszteség');
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'year', p_year,
    'cutoff_date', v_cutoff_date,
    'total_gain_huf', v_total_gain,
    'total_loss_huf', v_total_loss,
    'net_revaluation_huf', (v_total_gain - v_total_loss),
    'items', v_items,
    'journal_header_id', v_header_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_fx_cash_revaluation FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_fx_cash_revaluation TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. get_cash_partner_monthly_limits RPC
--    Art. 114. § partnerenkénti 1,5M Ft-os havi készpénzlimit figyelő
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_cash_partner_monthly_limits(
  p_company_id uuid,
  p_year integer,
  p_month integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_start_date date;
  v_end_date date;
  v_threshold numeric := 1500000; -- 1.5 millió Ft törvényi határ
  v_results jsonb := '[]'::jsonb;
  v_row RECORD;
BEGIN
  -- Multi-tenancy ellenőrzés
  IF NOT (
    public.is_company_member_or_above(p_company_id)
    OR EXISTS (
      SELECT 1 FROM public.company_members cm 
       WHERE cm.company_id = p_company_id 
         AND cm.user_id = (SELECT auth.uid())
    )
    OR auth.uid() IS NULL
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a készpénzfizetési korlát kimutatás megtekintésére.';
  END IF;

  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (v_start_date + interval '1 month - 1 day')::date;

  FOR v_row IN
    WITH partner_entries AS (
      SELECT 
        e.partner_id,
        p.name AS partner_name,
        p.tax_number AS partner_tax_number,
        COUNT(e.id) AS tx_count,
        SUM(ABS(e.amount)) AS total_cash_huf
      FROM public.petty_cash_entries e
      JOIN public.partners p ON e.partner_id = p.id
      WHERE e.company_id = p_company_id
        AND e.status <> 'cancelled'
        AND e.entry_date >= v_start_date
        AND e.entry_date <= v_end_date
        -- Csak belföldi vagy adószámmal rendelkező vállalkozási partnerek
        AND p.tax_number IS NOT NULL AND trim(p.tax_number) <> ''
      GROUP BY e.partner_id, p.name, p.tax_number
    )
    SELECT 
      partner_id,
      partner_name,
      partner_tax_number,
      tx_count,
      total_cash_huf,
      (total_cash_huf > v_threshold) AS is_exceeded,
      GREATEST(0, total_cash_huf - v_threshold) AS excess_amount,
      round(GREATEST(0, total_cash_huf - v_threshold) * 0.20) AS penalty_risk_huf
    FROM partner_entries
    ORDER BY total_cash_huf DESC
  LOOP
    v_results := v_results || jsonb_build_object(
      'partner_id', v_row.partner_id,
      'partner_name', v_row.partner_name,
      'partner_tax_number', v_row.partner_tax_number,
      'tx_count', v_row.tx_count,
      'total_cash_huf', v_row.total_cash_huf,
      'threshold_huf', v_threshold,
      'is_exceeded', v_row.is_exceeded,
      'excess_amount', v_row.excess_amount,
      'penalty_risk_huf', v_row.penalty_risk_huf
    );
  END LOOP;

  RETURN jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'start_date', v_start_date,
    'end_date', v_end_date,
    'threshold_huf', v_threshold,
    'partners', v_results
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_cash_partner_monthly_limits FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cash_partner_monthly_limits TO authenticated, service_role;
