-- ============================================================
-- FX Rate Differences — Tables + RPC
-- ============================================================
-- Stores daily MNB exchange rates and computes FX differences
-- between invoice delivery date and transaction settlement date.
-- ============================================================

-- ─── 1. daily_exchange_rates ───────────────────────────────
-- Stores historical MNB (and future ECB) daily rates.
-- 1 currency unit = X HUF

CREATE TABLE IF NOT EXISTS public.daily_exchange_rates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date    date NOT NULL,
  currency     text NOT NULL,
  rate         numeric NOT NULL,          -- 1 EUR = 400.50 HUF
  source       text NOT NULL DEFAULT 'MNB',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rate_date, currency, source)
);

CREATE INDEX IF NOT EXISTS idx_der_date_currency
  ON public.daily_exchange_rates(rate_date, currency, source);

-- RLS: any authenticated user can read (rates are public data)
ALTER TABLE public.daily_exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read daily_exchange_rates"
  ON public.daily_exchange_rates FOR SELECT TO authenticated
  USING (true);

-- Only service_role / edge functions can insert/update
CREATE POLICY "Service role can manage daily_exchange_rates"
  ON public.daily_exchange_rates FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ─── 2. company_fx_settings ───────────────────────────────
-- Per-company configuration: which rate source to use

CREATE TABLE IF NOT EXISTS public.company_fx_settings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rate_source  text NOT NULL DEFAULT 'MNB',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.company_fx_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view company_fx_settings"
  ON public.company_fx_settings FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert company_fx_settings"
  ON public.company_fx_settings FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can update company_fx_settings"
  ON public.company_fx_settings FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));


-- ─── 3. get_fx_differences RPC ────────────────────────────
-- Returns FX gain/loss for every foreign-currency invoice
-- that has a matched transaction (settlement).
--
-- Logic:
--   delivery_huf  = foreign_amount × MNB rate on delivery_date
--   settlement_huf = foreign_amount × MNB rate on settlement_date
--                    OR actual bank rate if tx.currency = HUF (tx.amount / foreign_amount)
--   fx_difference = settlement_huf - delivery_huf
--   positive = gain, negative = loss

CREATE OR REPLACE FUNCTION public.get_fx_differences(
  p_company_id uuid,
  p_date_from  date DEFAULT NULL,
  p_date_to    date DEFAULT NULL
)
RETURNS TABLE (
  invoice_id        uuid,
  invoice_source    text,
  invoice_number    text,
  partner_name      text,
  invoice_direction text,
  currency          text,
  foreign_amount    numeric,
  delivery_date     date,
  delivery_rate     numeric,
  delivery_huf      numeric,
  settlement_date   date,
  settlement_rate   numeric,
  settlement_huf    numeric,
  fx_difference     numeric,
  settlement_month  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rate_source text;
BEGIN
  -- Get company rate source preference (default MNB)
  SELECT COALESCE(fs.rate_source, 'MNB') INTO v_rate_source
  FROM company_fx_settings fs
  WHERE fs.company_id = p_company_id;

  IF v_rate_source IS NULL THEN
    v_rate_source := 'MNB';
  END IF;

  RETURN QUERY

  -- ── NAV invoices matched to transactions ──
  WITH nav_matched AS (
    SELECT
      ni.id AS inv_id,
      'nav_invoices'::text AS inv_source,
      ni.invoice_number AS inv_number,
      CASE
        WHEN ni.invoice_direction = 'OUTBOUND' THEN ni.customer_name
        ELSE ni.supplier_name
      END AS inv_partner,
      ni.invoice_direction AS inv_direction,
      ni.currency AS inv_currency,
      ni.invoice_gross_amount AS inv_amount,
      COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date)::date AS inv_delivery_date,
      t.transaction_date::date AS inv_settlement_date,
      t.amount AS tx_amount,
      t.currency AS tx_currency
    FROM nav_invoices ni
    JOIN transactions t ON (
      t.matched_invoice_id = ni.id
      OR t.id IN (
        SELECT tim.transaction_id FROM transaction_invoice_matches tim
        WHERE tim.invoice_id = ni.id AND tim.invoice_source = 'nav_invoices'
      )
    )
    WHERE ni.company_id = p_company_id
      AND ni.currency IS NOT NULL
      AND ni.currency != 'HUF'
      AND ni.invoice_gross_amount IS NOT NULL
      AND ni.invoice_gross_amount != 0
      AND (ni.exclude_from_accounting IS NULL OR ni.exclude_from_accounting = false)
  ),

  -- ── Submitted invoices matched to transactions ──
  submitted_matched AS (
    SELECT
      i.id AS inv_id,
      'invoices'::text AS inv_source,
      COALESCE(i.bizonylatsorszam, 'N/A') AS inv_number,
      CASE
        WHEN i.invoice_direction = 'OUTBOUND' THEN i.vevo_nev
        ELSE i.elado_nev
      END AS inv_partner,
      i.invoice_direction AS inv_direction,
      i.penznem AS inv_currency,
      i.brutto_vegosszeg AS inv_amount,
      COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date AS inv_delivery_date,
      t.transaction_date::date AS inv_settlement_date,
      t.amount AS tx_amount,
      t.currency AS tx_currency
    FROM invoices i
    JOIN transactions t ON (
      t.matched_invoice_id = i.id
      OR t.id IN (
        SELECT tim.transaction_id FROM transaction_invoice_matches tim
        WHERE tim.invoice_id = i.id AND tim.invoice_source = 'invoices'
      )
    )
    WHERE i.company_id = p_company_id
      AND i.penznem IS NOT NULL
      AND i.penznem != 'HUF'
      AND i.brutto_vegosszeg IS NOT NULL
      AND i.brutto_vegosszeg != 0
      AND (i.exclude_from_accounting IS NULL OR i.exclude_from_accounting = false)
  ),

  -- ── Combine both sources ──
  all_matched AS (
    SELECT * FROM nav_matched
    UNION ALL
    SELECT * FROM submitted_matched
  ),

  -- ── Join with daily rates ──
  with_rates AS (
    SELECT
      am.*,
      -- Delivery rate from MNB
      dr_del.rate AS del_rate,
      -- Settlement rate: if tx is HUF (bank converted), use actual rate
      CASE
        WHEN am.tx_currency = 'HUF' AND am.inv_amount != 0
          THEN ABS(am.tx_amount) / ABS(am.inv_amount)
        ELSE dr_set.rate
      END AS set_rate
    FROM all_matched am
    -- Delivery rate: find the rate on delivery_date or the last available rate before it
    LEFT JOIN LATERAL (
      SELECT der.rate
      FROM daily_exchange_rates der
      WHERE der.currency = am.inv_currency
        AND der.source = v_rate_source
        AND der.rate_date <= am.inv_delivery_date
      ORDER BY der.rate_date DESC
      LIMIT 1
    ) dr_del ON true
    -- Settlement rate (only if tx is NOT HUF — otherwise we use actual bank rate)
    LEFT JOIN LATERAL (
      SELECT der.rate
      FROM daily_exchange_rates der
      WHERE der.currency = am.inv_currency
        AND der.source = v_rate_source
        AND der.rate_date <= am.inv_settlement_date
      ORDER BY der.rate_date DESC
      LIMIT 1
    ) dr_set ON am.tx_currency IS DISTINCT FROM 'HUF'
  )

  SELECT
    wr.inv_id,
    wr.inv_source,
    wr.inv_number,
    wr.inv_partner,
    wr.inv_direction,
    wr.inv_currency,
    wr.inv_amount,
    wr.inv_delivery_date,
    COALESCE(wr.del_rate, 0),
    COALESCE(wr.del_rate, 0) * ABS(wr.inv_amount),
    wr.inv_settlement_date,
    COALESCE(wr.set_rate, 0),
    COALESCE(wr.set_rate, 0) * ABS(wr.inv_amount),
    (COALESCE(wr.set_rate, 0) - COALESCE(wr.del_rate, 0)) * ABS(wr.inv_amount),
    TO_CHAR(wr.inv_settlement_date, 'YYYY-MM')
  FROM with_rates wr
  WHERE (p_date_from IS NULL OR wr.inv_settlement_date >= p_date_from)
    AND (p_date_to IS NULL OR wr.inv_settlement_date <= p_date_to)
    AND wr.del_rate IS NOT NULL  -- skip if no rate data available
  ORDER BY wr.inv_settlement_date DESC, wr.inv_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_fx_differences(uuid, date, date) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fx_differences(uuid, date, date) TO authenticated;
