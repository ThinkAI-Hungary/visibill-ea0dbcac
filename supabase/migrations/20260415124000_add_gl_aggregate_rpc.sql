-- Migration to add RPC for General Ledger balance aggregation
CREATE OR REPLACE FUNCTION public.get_gl_balances(p_company_id uuid, p_preset_id uuid)
RETURNS TABLE (
  gl_account_id uuid,
  gl_number text,
  short_name text,
  total_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH raw_data AS (
    -- Get transaction amounts
    SELECT
      t.gl_account_id,
      t.amount AS amount
    FROM public.transactions t
    WHERE t.company_id = p_company_id
      AND t.gl_account_id IS NOT NULL

    UNION ALL

    -- Get invoice amounts
    SELECT
      i.gl_account_id,
      CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(i.brutto_vegosszeg, 0))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(i.brutto_vegosszeg, 0)
        ELSE 0
      END AS amount
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.gl_account_id IS NOT NULL

    UNION ALL

    -- Get NAV invoice amounts
    SELECT
      n.gl_account_id,
      CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(n.invoice_gross_amount, 0))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(n.invoice_gross_amount, 0)
        ELSE 0
      END AS amount
    FROM public.nav_invoices n
    WHERE n.company_id = p_company_id
      AND n.gl_account_id IS NOT NULL
  ),
  aggregated AS (
    SELECT
      r.gl_account_id,
      SUM(r.amount) AS total_balance
    FROM raw_data r
    GROUP BY r.gl_account_id
  )
  SELECT
    g.id AS gl_account_id,
    g.gl_number,
    g.short_name,
    COALESCE(a.total_balance, 0)::numeric AS total_balance
  FROM public.gl_accounts g
  LEFT JOIN aggregated a ON g.id = a.gl_account_id
  WHERE g.preset_id = p_preset_id
  ORDER BY g.gl_number;
END;
$$;
