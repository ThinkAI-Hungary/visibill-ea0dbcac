-- Drop existing functions to avoid signature conflicts
DROP FUNCTION IF EXISTS public.get_pnl_report(uuid, uuid, date, date);
DROP FUNCTION IF EXISTS public.get_bs_report(uuid, uuid, date, integer);
DROP FUNCTION IF EXISTS public.freeze_annual_data(uuid, uuid, uuid, integer);

-- 1. Create updated public.get_pnl_report
CREATE OR REPLACE FUNCTION public.get_pnl_report(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  pnl_structure_id uuid,
  row_code text,
  name text,
  type text,
  order_num integer,
  multiplier integer,
  balance numeric,
  gl_accounts jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH gl_data AS (
    -- Get base balances using the get_gl_balances function with exchange rates passed
    SELECT * FROM public.get_gl_balances(p_company_id, p_preset_id, p_date_from, p_date_to, p_exchange_rates)
  ),
  all_mappings AS (
    -- Get all explicit mappings for this company and preset
    SELECT m.gl_account_id, m.pnl_structure_id, a.gl_number, REPLACE(a.gl_number, '.', '') as clean_gl_number
    FROM public.pnl_mapping m
    JOIN public.gl_accounts a ON m.gl_account_id = a.id
    WHERE m.company_id = p_company_id AND m.preset_id = p_preset_id
  ),
  mapped_data AS (
    -- Find the longest matching prefix for each gl_account to support inheritance
    SELECT 
      g.gl_account_id,
      g.gl_number,
      g.short_name,
      g.total_balance,
      (
        SELECT am.pnl_structure_id 
        FROM all_mappings am 
        WHERE REPLACE(g.gl_number, '.', '') LIKE am.clean_gl_number || '%' 
        ORDER BY LENGTH(am.clean_gl_number) DESC 
        LIMIT 1
      ) AS pnl_structure_id
    FROM gl_data g
  ),
  aggregated_pnl AS (
    SELECT
      s.id AS pnl_structure_id,
      s.row_code::text,
      s.name::text,
      s.type::text,
      s.order_num,
      s.multiplier,
      COALESCE(SUM(md.total_balance), 0)::numeric AS balance,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'gl_account_id', md.gl_account_id,
            'gl_number', md.gl_number,
            'short_name', md.short_name,
            'balance', md.total_balance
          )
        ) FILTER (WHERE md.gl_account_id IS NOT NULL),
        '[]'::jsonb
      ) AS gl_accounts
    FROM public.pnl_structure s
    LEFT JOIN mapped_data md ON s.id = md.pnl_structure_id
    GROUP BY s.id, s.row_code, s.name, s.type, s.order_num, s.multiplier
  )
  SELECT * FROM aggregated_pnl
  ORDER BY order_num;
END;
$$;


-- 2. Create updated public.get_bs_report
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
  -- 1. Get cumulative GL balances (no date_from = from beginning of time)
  gl_data AS (
    SELECT * FROM public.get_gl_balances(p_company_id, p_preset_id, NULL, p_date_to, p_exchange_rates)
  ),

  -- 2. Map GL accounts to BS rows using prefix inheritance (same logic as P&L)
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

  -- 3. P&L Bridge: calculate net income from P&L mapped GL accounts
  pnl_bridge_calc AS (
    SELECT COALESCE(SUM(pnl_bal.total_balance), 0) AS pnl_result
    FROM public.get_gl_balances(p_company_id, p_preset_id, NULL, p_date_to, p_exchange_rates) pnl_bal
    JOIN (
      SELECT DISTINCT pm2.gl_account_id
      FROM public.pnl_mapping pm2
      WHERE pm2.company_id = p_company_id AND pm2.preset_id = p_preset_id
    ) pnl_mapped ON pnl_bal.gl_account_id = pnl_mapped.gl_account_id
  ),

  -- 4. Prior year data
  prior_data AS (
    SELECT py.bs_structure_id AS prior_bs_id, py.prior_year_balance AS py_balance, py.prior_year_adjustment AS py_adjustment
    FROM public.bs_prior_year py
    WHERE py.company_id = p_company_id
      AND py.fiscal_year = COALESCE(p_fiscal_year, EXTRACT(YEAR FROM COALESCE(p_date_to, CURRENT_DATE))::integer)
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


-- 3. Create updated public.freeze_annual_data
CREATE OR REPLACE FUNCTION public.freeze_annual_data(
  p_report_id uuid,
  p_company_id uuid,
  p_preset_id uuid,
  p_fiscal_year integer,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bs_data jsonb;
  v_pnl_data jsonb;
  v_date_from date;
  v_date_to date;
BEGIN
  -- Fiscal year boundaries
  v_date_from := make_date(p_fiscal_year, 1, 1);
  v_date_to   := make_date(p_fiscal_year, 12, 31);

  -- Fetch BS data — cumulative from beginning of time to fiscal year end
  SELECT jsonb_agg(row_to_json(bs))
  INTO v_bs_data
  FROM public.get_bs_report(p_company_id, p_preset_id, v_date_to, p_fiscal_year, p_exchange_rates) bs;

  -- Fetch PNL data — only the fiscal year period (Jan 1 to Dec 31)
  SELECT jsonb_agg(row_to_json(pnl))
  INTO v_pnl_data
  FROM public.get_pnl_report(p_company_id, p_preset_id, v_date_from, v_date_to, p_exchange_rates) pnl;

  -- Update the report
  UPDATE public.annual_reports
  SET
    frozen_bs_data = COALESCE(v_bs_data, '[]'::jsonb),
    frozen_pnl_data = COALESCE(v_pnl_data, '[]'::jsonb),
    frozen_at = now(),
    updated_at = now()
  WHERE id = p_report_id
    AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'success', true,
    'bs_row_count', COALESCE(jsonb_array_length(v_bs_data), 0),
    'pnl_row_count', COALESCE(jsonb_array_length(v_pnl_data), 0),
    'frozen_at', now()
  );
END;
$$;
