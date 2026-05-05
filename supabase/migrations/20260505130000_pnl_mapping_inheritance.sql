CREATE OR REPLACE FUNCTION public.get_pnl_report(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
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
    -- Get base balances using the existing get_gl_balances function
    SELECT * FROM public.get_gl_balances(p_company_id, p_preset_id, p_date_from, p_date_to)
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
