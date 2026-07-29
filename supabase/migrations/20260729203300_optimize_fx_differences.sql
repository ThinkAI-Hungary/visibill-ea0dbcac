-- Migration: Optimize public.get_fx_differences performance and index daily exchange rates
-- Date: 2026-07-29
-- Author: Antigravity AI

-- 1. Create a composite index on daily_exchange_rates with optimal column ordering for lateral scans
CREATE INDEX IF NOT EXISTS idx_der_currency_source_date 
  ON public.daily_exchange_rates(currency, source, rate_date DESC);

-- 2. Drop and recreate public.get_fx_differences to resolve slow OR joins
DROP FUNCTION IF EXISTS public.get_fx_differences(uuid, date, date);

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

  -- ── NAV invoices matched directly to transactions ──
  WITH nav_matched_direct AS (
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
    JOIN transactions t ON t.matched_invoice_id = ni.id
    WHERE ni.company_id = p_company_id
      AND ni.currency IS NOT NULL
      AND ni.currency != 'HUF'
      AND ni.invoice_gross_amount IS NOT NULL
      AND ni.invoice_gross_amount != 0
      AND (ni.exclude_from_accounting IS NULL OR ni.exclude_from_accounting = false)
  ),

  -- ── NAV invoices matched via transaction_invoice_matches ──
  nav_matched_via_link AS (
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
    JOIN transaction_invoice_matches tim ON tim.invoice_id = ni.id AND tim.invoice_source = 'nav_invoices'
    JOIN transactions t ON t.id = tim.transaction_id
    WHERE ni.company_id = p_company_id
      AND ni.currency IS NOT NULL
      AND ni.currency != 'HUF'
      AND ni.invoice_gross_amount IS NOT NULL
      AND ni.invoice_gross_amount != 0
      AND (ni.exclude_from_accounting IS NULL OR ni.exclude_from_accounting = false)
  ),

  -- ── Combine NAV matched sources ──
  nav_matched AS (
    SELECT * FROM nav_matched_direct
    UNION
    SELECT * FROM nav_matched_via_link
  ),

  -- ── Submitted invoices matched directly to transactions ──
  submitted_matched_direct AS (
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
    JOIN transactions t ON t.matched_invoice_id = i.id
    WHERE i.company_id = p_company_id
      AND i.penznem IS NOT NULL
      AND i.penznem != 'HUF'
      AND i.brutto_vegosszeg IS NOT NULL
      AND i.brutto_vegosszeg != 0
      AND (i.exclude_from_accounting IS NULL OR i.exclude_from_accounting = false)
  ),

  -- ── Submitted invoices matched via transaction_invoice_matches ──
  submitted_matched_via_link AS (
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
    JOIN transaction_invoice_matches tim ON tim.invoice_id = i.id AND tim.invoice_source = 'invoices'
    JOIN transactions t ON t.id = tim.transaction_id
    WHERE i.company_id = p_company_id
      AND i.penznem IS NOT NULL
      AND i.penznem != 'HUF'
      AND i.brutto_vegosszeg IS NOT NULL
      AND i.brutto_vegosszeg != 0
      AND (i.exclude_from_accounting IS NULL OR i.exclude_from_accounting = false)
  ),

  -- ── Combine submitted matched sources ──
  submitted_matched AS (
    SELECT * FROM submitted_matched_direct
    UNION
    SELECT * FROM submitted_matched_via_link
  ),

  -- ── Combine both NAV and submitted matches ──
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
    CASE 
      WHEN wr.inv_direction = 'OUTBOUND' THEN (COALESCE(wr.set_rate, 0) - COALESCE(wr.del_rate, 0)) * ABS(wr.inv_amount)
      ELSE (COALESCE(wr.del_rate, 0) - COALESCE(wr.set_rate, 0)) * ABS(wr.inv_amount)
    END,
    TO_CHAR(wr.inv_settlement_date, 'YYYY-MM')
  FROM with_rates wr
  WHERE (p_date_from IS NULL OR wr.inv_settlement_date >= p_date_from)
    AND (p_date_to IS NULL OR wr.inv_settlement_date <= p_date_to)
    AND wr.del_rate IS NOT NULL  -- skip if no rate data available
  ORDER BY wr.inv_settlement_date DESC, wr.inv_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_fx_differences(uuid, date, date) TO authenticated;
