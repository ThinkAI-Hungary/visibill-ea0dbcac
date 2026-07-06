-- ═══════════════════════════════════════════════════════════
-- Fix #3: BS auto-derived balances (bank + receivables + payables)
-- 
-- Includes BOTH submitted invoices AND NAV invoices in 
-- receivables/payables calculation.
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_bs_report(uuid, uuid, date, integer);
DROP FUNCTION IF EXISTS public.get_bs_report(uuid, uuid, date, integer, jsonb);

CREATE OR REPLACE FUNCTION public.get_bs_report(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_to date DEFAULT NULL,
  p_fiscal_year integer DEFAULT NULL,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  bs_structure_id uuid,
  row_code text,
  name text,
  section text,
  type text,
  order_num integer,
  parent_id uuid,
  is_pnl_bridge boolean,
  current_balance numeric,
  prior_year_balance numeric,
  prior_year_adjustment numeric,
  gl_accounts jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- 1. Get cumulative GL balances
  gl_data AS (
    SELECT * FROM public.get_gl_balances(p_company_id, p_preset_id, NULL, p_date_to, p_exchange_rates)
  ),

  -- 2. Map GL accounts to BS rows using prefix inheritance
  all_mappings AS (
    SELECT m.gl_account_id, m.bs_structure_id AS mapped_bs_id, a.gl_number,
           REPLACE(a.gl_number, '.', '') as clean_gl_number
    FROM public.bs_mapping m
    JOIN public.gl_accounts a ON m.gl_account_id = a.id
    WHERE m.company_id = p_company_id AND m.preset_id = p_preset_id
  ),
  mapped_data AS (
    SELECT
      g.gl_account_id,
      g.gl_number,
      g.short_name,
      g.total_balance,
      (
        SELECT am.mapped_bs_id
        FROM all_mappings am
        WHERE REPLACE(g.gl_number, '.', '') LIKE am.clean_gl_number || '%'
        ORDER BY LENGTH(am.clean_gl_number) DESC
        LIMIT 1
      ) AS mapped_bs_id
    FROM gl_data g
  ),

  -- 3. P&L Bridge: prefix matching (same as get_pnl_report)
  pnl_bridge_calc AS (
    SELECT COALESCE(SUM(pnl_bal.total_balance), 0) AS pnl_result
    FROM public.get_gl_balances(p_company_id, p_preset_id, NULL, p_date_to, p_exchange_rates) pnl_bal
    WHERE EXISTS (
      SELECT 1
      FROM public.pnl_mapping pm2
      JOIN public.gl_accounts a2 ON pm2.gl_account_id = a2.id
      WHERE pm2.company_id = p_company_id
        AND pm2.preset_id = p_preset_id
        AND REPLACE(pnl_bal.gl_number, '.', '') LIKE REPLACE(a2.gl_number, '.', '') || '%'
    )
  ),

  -- 4. Auto-derived BS balances
  -- 4a. Bank balance = SUM of ALL bank transactions
  auto_bank AS (
    SELECT COALESCE(SUM(
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1)
    ), 0) AS bank_total
    FROM public.transactions t
    WHERE t.company_id = p_company_id
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)
  ),
  bank_target AS (
    SELECT am.mapped_bs_id
    FROM all_mappings am
    WHERE am.clean_gl_number LIKE '38%'
    ORDER BY LENGTH(am.clean_gl_number) DESC
    LIMIT 1
  ),

  -- 4b. Receivables = outbound invoices (submitted + NAV)
  auto_receivables AS (
    SELECT COALESCE(SUM(amt), 0) AS receivables_total FROM (
      -- Submitted outbound invoices
      SELECT COALESCE(ii.net_amount, 0) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amt
      FROM public.invoice_items ii
      JOIN public.invoices i ON ii.invoice_id = i.id
      WHERE i.company_id = p_company_id
        AND i.invoice_direction = 'OUTBOUND'
        AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)
      UNION ALL
      -- NAV outbound invoices
      SELECT COALESCE(ni.net_amount, 0) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amt
      FROM public.nav_invoice_items ni
      JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
      WHERE n.company_id = p_company_id
        AND n.invoice_direction = 'OUTBOUND'
        AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
    ) all_receivables
  ),
  receivables_target AS (
    SELECT am.mapped_bs_id
    FROM all_mappings am
    WHERE am.clean_gl_number LIKE '31%'
    ORDER BY LENGTH(am.clean_gl_number) DESC
    LIMIT 1
  ),

  -- 4c. Payables = inbound invoices (submitted + NAV)
  auto_payables AS (
    SELECT COALESCE(SUM(amt), 0) AS payables_total FROM (
      -- Submitted inbound invoices
      SELECT COALESCE(ii.net_amount, 0) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amt
      FROM public.invoice_items ii
      JOIN public.invoices i ON ii.invoice_id = i.id
      WHERE i.company_id = p_company_id
        AND i.invoice_direction = 'INBOUND'
        AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)
      UNION ALL
      -- NAV inbound invoices
      SELECT COALESCE(ni.net_amount, 0) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amt
      FROM public.nav_invoice_items ni
      JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
      WHERE n.company_id = p_company_id
        AND n.invoice_direction = 'INBOUND'
        AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
    ) all_payables
  ),
  payables_target AS (
    SELECT am.mapped_bs_id
    FROM all_mappings am
    WHERE am.clean_gl_number LIKE '45%' OR am.clean_gl_number LIKE '44%'
    ORDER BY LENGTH(am.clean_gl_number) DESC
    LIMIT 1
  ),

  -- 5. Prior year data
  prior_data AS (
    SELECT py.bs_structure_id AS prior_bs_id, py.prior_year_balance AS py_balance, py.prior_year_adjustment AS py_adjustment
    FROM public.bs_prior_year py
    WHERE py.company_id = p_company_id
      AND py.fiscal_year = COALESCE(p_fiscal_year, EXTRACT(YEAR FROM COALESCE(p_date_to, CURRENT_DATE))::integer)
  ),

  -- 6. Aggregate with auto-derived amounts
  aggregated AS (
    SELECT
      s.id AS bs_structure_id,
      s.row_code::text,
      s.name::text,
      s.section::text,
      s.type::text,
      s.order_num,
      s.parent_id,
      s.is_pnl_bridge,
      CASE
        WHEN s.is_pnl_bridge THEN (SELECT pnl_result FROM pnl_bridge_calc)
        ELSE COALESCE(SUM(md.total_balance), 0)::numeric
          + CASE WHEN s.id = (SELECT mapped_bs_id FROM bank_target) THEN (SELECT bank_total FROM auto_bank) ELSE 0 END
          + CASE WHEN s.id = (SELECT mapped_bs_id FROM receivables_target) THEN (SELECT receivables_total FROM auto_receivables) ELSE 0 END
          + CASE WHEN s.id = (SELECT mapped_bs_id FROM payables_target) THEN (SELECT payables_total FROM auto_payables) ELSE 0 END
      END AS current_balance,
      COALESCE(pd.py_balance, 0)::numeric AS prior_year_balance,
      COALESCE(pd.py_adjustment, 0)::numeric AS prior_year_adjustment,
      CASE
        WHEN s.is_pnl_bridge THEN '[]'::jsonb
        ELSE COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'gl_account_id', md.gl_account_id,
              'gl_number', md.gl_number,
              'short_name', md.short_name,
              'balance', md.total_balance
            )
          ) FILTER (WHERE md.gl_account_id IS NOT NULL),
          '[]'::jsonb
        )
      END AS gl_accounts
    FROM public.bs_structure s
    LEFT JOIN mapped_data md ON s.id = md.mapped_bs_id AND NOT s.is_pnl_bridge
    LEFT JOIN prior_data pd ON s.id = pd.prior_bs_id
    GROUP BY s.id, s.row_code, s.name, s.section, s.type, s.order_num,
             s.parent_id, s.is_pnl_bridge, pd.py_balance, pd.py_adjustment
  )
  SELECT * FROM aggregated
  ORDER BY aggregated.order_num;
END;
$$;
