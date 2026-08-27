-- Migration: Fix Journals Storno Immutability Bug
-- Date: 2026-08-27

CREATE OR REPLACE FUNCTION public.acc_storno_journal_entry(
  p_header_id UUID,
  p_user_id UUID,
  p_reason TEXT,
  p_create_correction BOOLEAN DEFAULT TRUE
) RETURNS UUID AS $$
DECLARE
  v_orig_header RECORD;
  v_storno_header_id UUID;
  v_corr_header_id UUID := NULL;
  v_next_num INTEGER;
  v_period_closed BOOLEAN;
  v_storno_date DATE;
  v_storno_year SMALLINT;
BEGIN
  -- Fetch original header
  SELECT * INTO v_orig_header FROM public.acc_journal_headers WHERE id = p_header_id FOR UPDATE;
  
  IF v_orig_header IS NULL THEN
    RAISE EXCEPTION 'Original journal entry header not found: %', p_header_id;
  END IF;

  IF v_orig_header.status <> 'KONYVELT' THEN
    RAISE EXCEPTION 'Only posted (KONYVELT) entries can be stornoed.';
  END IF;

  -- Check closed periods
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

  -- 1. Mark original as SZTORNOZOTT (This update is allowed by trigger because it transitions KONYVELT -> SZTORNOZOTT with unchanged other fields)
  UPDATE public.acc_journal_headers
     SET status = 'SZTORNOZOTT'
   WHERE id = p_header_id;

  -- Get next sequential number BEFORE inserting to avoid updating posted entry afterward
  v_next_num := public.acc_get_next_journal_number(v_orig_header.journal_id, v_storno_year);

  -- 2. Create storno header (posted immediately with correct journal number)
  INSERT INTO public.acc_journal_headers (
    company_id, journal_id, accounting_year, status, entry_type, source,
    posting_date, document_date, posting_timestamp, document_id, partner_id,
    description, justification, currency, exchange_rate, exchange_rate_date,
    stornoed_entry_id, original_entry_id, journal_number, created_by, posted_by, posted_at
  ) VALUES (
    v_orig_header.company_id, v_orig_header.journal_id, v_storno_year, 'KONYVELT', 'SZTORNO', 'KEZI_MODOSITAS',
    v_storno_date, v_orig_header.document_date, now(), v_orig_header.document_id, v_orig_header.partner_id,
    'Sztornó: ' || v_orig_header.description, p_reason, v_orig_header.currency, v_orig_header.exchange_rate, v_orig_header.exchange_rate_date,
    p_header_id, p_header_id, v_next_num, p_user_id, p_user_id, now()
  ) RETURNING id INTO v_storno_header_id;

  -- 3. Copy lines with inverted Debits/Credits
  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount,
    vat_code, vat_role, project_id, cost_center_id, description
  )
  SELECT
    v_storno_header_id, sequence_number, gl_account_id,
    CASE WHEN dc_type = 'T' THEN 'K' ELSE 'T' END,
    amount, foreign_amount, vat_code, vat_role, project_id, cost_center_id,
    'Sztornó: ' || COALESCE(description, '')
  FROM public.acc_journal_lines
  WHERE header_id = p_header_id;

  -- 4. Create correction copy in draft state (optional)
  IF p_create_correction THEN
    INSERT INTO public.acc_journal_headers (
      company_id, journal_id, accounting_year, status, entry_type, source,
      posting_date, document_date, document_id, partner_id,
      description, justification, currency, exchange_rate, exchange_rate_date,
      original_entry_id, created_by
    ) VALUES (
      v_orig_header.company_id, v_orig_header.journal_id, v_storno_year, 'KEZI_PISZKOZAT', 'NORMAL', 'KEZI_MODOSITAS',
      v_storno_date, v_orig_header.document_date, v_orig_header.document_id, v_orig_header.partner_id,
      v_orig_header.description || ' (Javítás)', 'Helyesbítés az eredeti ' || COALESCE(v_orig_header.description, '') || ' tétel helyett.',
      v_orig_header.currency, v_orig_header.exchange_rate, v_orig_header.exchange_rate_date,
      p_header_id, p_user_id
    ) RETURNING id INTO v_corr_header_id;

    -- Copy lines exactly
    INSERT INTO public.acc_journal_lines (
      header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount,
      vat_code, vat_role, project_id, cost_center_id, description
    )
    SELECT
      v_corr_header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount,
      vat_code, vat_role, project_id, cost_center_id, description
    FROM public.acc_journal_lines
    WHERE header_id = p_header_id;
  END IF;

  RETURN COALESCE(v_corr_header_id, v_storno_header_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
