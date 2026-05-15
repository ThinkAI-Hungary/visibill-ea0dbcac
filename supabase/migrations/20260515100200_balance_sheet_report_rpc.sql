-- =============================================
-- BALANCE SHEET - Report RPC (with P&L Bridge)
-- =============================================

CREATE OR REPLACE FUNCTION public.get_bs_report(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_to date DEFAULT NULL,
  p_fiscal_year integer DEFAULT NULL
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
  -- 1. Get cumulative GL balances (no date_from = from beginning of time)
  gl_data AS (
    SELECT * FROM public.get_gl_balances(p_company_id, p_preset_id, NULL, p_date_to)
  ),

  -- 2. Map GL accounts to BS rows using prefix inheritance (same logic as P&L)
  all_mappings AS (
    SELECT m.gl_account_id, m.bs_structure_id, a.gl_number,
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
        SELECT am.bs_structure_id
        FROM all_mappings am
        WHERE REPLACE(g.gl_number, '.', '') LIKE am.clean_gl_number || '%'
        ORDER BY LENGTH(am.clean_gl_number) DESC
        LIMIT 1
      ) AS bs_structure_id
    FROM gl_data g
  ),

  -- 3. P&L Bridge: calculate net income from P&L mapped GL accounts
  pnl_bridge_calc AS (
    SELECT COALESCE(SUM(pnl_bal.total_balance), 0) AS pnl_result
    FROM public.get_gl_balances(p_company_id, p_preset_id, NULL, p_date_to) pnl_bal
    JOIN (
      -- Find accounts mapped to P&L (5-9 class accounts)
      SELECT DISTINCT pm2.gl_account_id
      FROM public.pnl_mapping pm2
      WHERE pm2.company_id = p_company_id AND pm2.preset_id = p_preset_id
    ) pnl_mapped ON pnl_bal.gl_account_id = pnl_mapped.gl_account_id
  ),

  -- 4. Prior year data
  prior_data AS (
    SELECT bs_structure_id, prior_year_balance, prior_year_adjustment
    FROM public.bs_prior_year
    WHERE company_id = p_company_id
      AND fiscal_year = COALESCE(p_fiscal_year, EXTRACT(YEAR FROM COALESCE(p_date_to, CURRENT_DATE))::integer)
  ),

  -- 5. Aggregate balances per BS structure row
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
      END AS current_balance,
      COALESCE(pd.prior_year_balance, 0)::numeric AS prior_year_balance,
      COALESCE(pd.prior_year_adjustment, 0)::numeric AS prior_year_adjustment,
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
    LEFT JOIN mapped_data md ON s.id = md.bs_structure_id AND NOT s.is_pnl_bridge
    LEFT JOIN prior_data pd ON s.id = pd.bs_structure_id
    GROUP BY s.id, s.row_code, s.name, s.section, s.type, s.order_num,
             s.parent_id, s.is_pnl_bridge, pd.prior_year_balance, pd.prior_year_adjustment
  )
  SELECT * FROM aggregated
  ORDER BY order_num;
END;
$$;
