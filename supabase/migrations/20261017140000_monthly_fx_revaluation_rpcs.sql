-- Migration: 20261017140000_monthly_fx_revaluation_rpcs.sql
-- Description: RPCs for calculating and posting monthly unrealized FX revaluation (8763 / 9763)
--              with optional next-month 1st auto-reversal storno.

-- 1. Calculation RPC
CREATE OR REPLACE FUNCTION public.calculate_monthly_fx_revaluation(
  p_company_id uuid,
  p_reval_date date
)
RETURNS TABLE(
  gl_account_id uuid,
  gl_number character varying,
  short_name character varying,
  currency text,
  foreign_balance numeric,
  book_balance_huf numeric,
  reval_rate numeric,
  revalued_huf numeric,
  diff_huf numeric,
  is_gain boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate_accounts AS (
    SELECT 
      a.id AS acc_id,
      a.gl_number AS acc_num,
      a.short_name AS acc_name,
      COALESCE(NULLIF(a.currency, 'HUF'), NULLIF(a.currency, 'ANY'), 'EUR') AS acc_curr
    FROM public.gl_accounts a
    WHERE (a.company_id = p_company_id OR a.company_id IS NULL)
      AND a.is_monthly_fx_reval = true
  ),
  acc_totals AS (
    SELECT 
      ca.acc_id,
      ca.acc_num,
      ca.acc_name,
      ca.acc_curr,
      COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END), 0) AS total_huf,
      COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN COALESCE(l.foreign_amount, 0) ELSE -COALESCE(l.foreign_amount, 0) END), 0) AS total_foreign
    FROM candidate_accounts ca
    JOIN public.acc_journal_lines l ON l.gl_account_id = ca.acc_id
    JOIN public.acc_journal_headers h ON h.id = l.header_id
    WHERE h.company_id = p_company_id
      AND h.posting_date <= p_reval_date
      AND h.status IN ('KONYVELT', 'SZTORNOZOTT')
    GROUP BY ca.acc_id, ca.acc_num, ca.acc_name, ca.acc_curr
    HAVING COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN COALESCE(l.foreign_amount, 0) ELSE -COALESCE(l.foreign_amount, 0) END), 0) <> 0
  ),
  with_rates AS (
    SELECT 
      t.*,
      COALESCE(
        (
          SELECT r.rate 
          FROM public.daily_exchange_rates r
          WHERE r.currency = t.acc_curr
            AND r.rate_date <= p_reval_date
          ORDER BY r.rate_date DESC
          LIMIT 1
        ),
        -- Fallback rate if date not synced
        CASE WHEN t.acc_curr = 'EUR' THEN 400.0 WHEN t.acc_curr = 'USD' THEN 380.0 ELSE 1.0 END
      ) AS eff_rate
    FROM acc_totals t
  )
  SELECT 
    w.acc_id AS gl_account_id,
    w.acc_num AS gl_number,
    w.acc_name AS short_name,
    w.acc_curr AS currency,
    w.total_foreign AS foreign_balance,
    w.total_huf AS book_balance_huf,
    w.eff_rate AS reval_rate,
    ROUND(w.total_foreign * w.eff_rate) AS revalued_huf,
    ROUND(w.total_foreign * w.eff_rate) - w.total_huf AS diff_huf,
    (ROUND(w.total_foreign * w.eff_rate) - w.total_huf) > 0 AS is_gain
  FROM with_rates w
  WHERE (ROUND(w.total_foreign * w.eff_rate) - w.total_huf) <> 0
  ORDER BY w.acc_num;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_monthly_fx_revaluation(uuid, date) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_monthly_fx_revaluation(uuid, date) TO authenticated, service_role;
ALTER FUNCTION public.calculate_monthly_fx_revaluation STABLE;

-- 2. Posting RPC
CREATE OR REPLACE FUNCTION public.post_monthly_fx_revaluation(
  p_company_id uuid,
  p_reval_date date,
  p_items jsonb,
  p_auto_reverse boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_reval_header_id uuid;
  v_reverse_header_id uuid := NULL;
  v_reverse_date date := p_reval_date + interval '1 day';
  v_seq integer := 0;
  v_rev_seq integer := 0;
  v_journal_id uuid;
  v_gl_9763_id uuid;
  v_gl_8763_id uuid;
  v_acc_id uuid;
  v_diff numeric;
  v_total_gain numeric := 0;
  v_total_loss numeric := 0;
  v_is_gain boolean;
  v_partner_id uuid;
BEGIN
  -- Permission check
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Nincs átértékelendő tétel kijelölve!';
  END IF;

  -- 1. Find or create vegyes journal
  SELECT id INTO v_journal_id FROM public.acc_journals 
  WHERE company_id = p_company_id AND (code IN ('VE', 'V1', 'ARF') OR sub_type = 'general')
  ORDER BY code LIMIT 1;

  IF v_journal_id IS NULL THEN
    SELECT id INTO v_journal_id FROM public.acc_journals 
    WHERE company_id = p_company_id LIMIT 1;
  END IF;

  -- 2. Find 9763 (Unrealized gain) and 8763 (Unrealized loss) accounts
  SELECT id INTO v_gl_9763_id FROM public.gl_accounts 
  WHERE (company_id = p_company_id OR company_id IS NULL)
    AND (gl_number LIKE '9763%' OR gl_number LIKE '976%')
  ORDER BY gl_number LIMIT 1;

  SELECT id INTO v_gl_8763_id FROM public.gl_accounts 
  WHERE (company_id = p_company_id OR company_id IS NULL)
    AND (gl_number LIKE '8763%' OR gl_number LIKE '876%')
  ORDER BY gl_number LIMIT 1;

  IF v_gl_9763_id IS NULL OR v_gl_8763_id IS NULL THEN
    RAISE EXCEPTION 'A 9763 (árfolyamnyereség) vagy 8763 (árfolyamveszteség) főkönyvi szám nem található!';
  END IF;

  -- 3. Create revaluation header on p_reval_date
  INSERT INTO public.acc_journal_headers (
    company_id,
    journal_id,
    accounting_year,
    status,
    entry_type,
    source,
    posting_date,
    document_date,
    document_id,
    description,
    currency,
    exchange_rate,
    created_by
  ) VALUES (
    p_company_id,
    v_journal_id,
    EXTRACT(YEAR FROM p_reval_date)::integer,
    'KONYVELT',
    'VEGYES',
    'AUTO_ARFOLYAM',
    p_reval_date,
    p_reval_date,
    'REVAL-' || to_char(p_reval_date, 'YYYYMMDD'),
    'Hó végi nem realizált devizaátértékelés (' || to_char(p_reval_date, 'YYYY.MM.DD') || ')',
    'HUF',
    1.0,
    auth.uid()
  ) RETURNING id INTO v_reval_header_id;

  -- 4. Create reverse header if auto-reverse is true
  IF p_auto_reverse THEN
    INSERT INTO public.acc_journal_headers (
      company_id,
      journal_id,
      accounting_year,
      status,
      entry_type,
      source,
      posting_date,
      document_date,
      document_id,
      description,
      currency,
      exchange_rate,
      original_entry_id,
      created_by
    ) VALUES (
      p_company_id,
      v_journal_id,
      EXTRACT(YEAR FROM v_reverse_date)::integer,
      'KONYVELT',
      'VEGYES',
      'AUTO_ARFOLYAM',
      v_reverse_date,
      v_reverse_date,
      'ST-REVAL-' || to_char(p_reval_date, 'YYYYMMDD'),
      'Hó végi devizaátértékelés visszavezetése (Stornó)',
      'HUF',
      1.0,
      v_reval_header_id,
      auth.uid()
    ) RETURNING id INTO v_reverse_header_id;
  END IF;

  -- 5. Post lines
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_acc_id := (v_item->>'gl_account_id')::uuid;
    v_diff := (v_item->>'diff_huf')::numeric;
    v_is_gain := v_diff > 0;

    IF v_diff <> 0 THEN
      IF v_is_gain THEN
        v_total_gain := v_total_gain + v_diff;

        -- Revaluation: T devizás számla / K 9763
        v_seq := v_seq + 1;
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
        VALUES (v_reval_header_id, v_seq, v_acc_id, 'T', v_diff, 'Nem realizált árfolyamnyereség');

        v_seq := v_seq + 1;
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
        VALUES (v_reval_header_id, v_seq, v_gl_9763_id, 'K', v_diff, 'Pénzügyi műveletek egyéb bevételei');

        -- Auto-reverse next month: T 9763 / K devizás számla
        IF p_auto_reverse AND v_reverse_header_id IS NOT NULL THEN
          v_rev_seq := v_rev_seq + 1;
          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
          VALUES (v_reverse_header_id, v_rev_seq, v_gl_9763_id, 'T', v_diff, 'Árfolyamnyereség visszavezetése');

          v_rev_seq := v_rev_seq + 1;
          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
          VALUES (v_reverse_header_id, v_rev_seq, v_acc_id, 'K', v_diff, 'Árfolyamnyereség visszavezetése');
        END IF;
      ELSE
        v_total_loss := v_total_loss + ABS(v_diff);

        -- Revaluation: T 8763 / K devizás számla
        v_seq := v_seq + 1;
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
        VALUES (v_reval_header_id, v_seq, v_gl_8763_id, 'T', ABS(v_diff), 'Pénzügyi műveletek egyéb ráfordításai');

        v_seq := v_seq + 1;
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
        VALUES (v_reval_header_id, v_seq, v_acc_id, 'K', ABS(v_diff), 'Nem realizált árfolyamveszteség');

        -- Auto-reverse next month: T devizás számla / K 8763
        IF p_auto_reverse AND v_reverse_header_id IS NOT NULL THEN
          v_rev_seq := v_rev_seq + 1;
          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
          VALUES (v_reverse_header_id, v_rev_seq, v_acc_id, 'T', ABS(v_diff), 'Árfolyamveszteség visszavezetése');

          v_rev_seq := v_rev_seq + 1;
          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
          VALUES (v_reverse_header_id, v_rev_seq, v_gl_8763_id, 'K', ABS(v_diff), 'Árfolyamveszteség visszavezetése');
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'reval_header_id', v_reval_header_id,
    'reverse_header_id', v_reverse_header_id,
    'total_gain_huf', v_total_gain,
    'total_loss_huf', v_total_loss
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.post_monthly_fx_revaluation(uuid, date, jsonb, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_monthly_fx_revaluation(uuid, date, jsonb, boolean) TO authenticated, service_role;
