-- Migration: update get_monthly_llm_by_company RPC to include total_all_time_cost
CREATE OR REPLACE FUNCTION get_monthly_llm_by_company(month_start timestamptz)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT jsonb_build_object(
  'rows', COALESCE(jsonb_agg(row_to_json(t)), '[]'),
  'total_cost', COALESCE(SUM(t.cost), 0),
  'total_input', COALESCE(SUM(t.input_tokens), 0),
  'total_output', COALESCE(SUM(t.output_tokens), 0)
) FROM (
  SELECT 
    company_id, 
    SUM(CASE WHEN created_at >= month_start THEN estimated_cost_usd ELSE 0 END) as cost,
    SUM(estimated_cost_usd) as total_all_time_cost,
    SUM(CASE WHEN created_at >= month_start THEN input_tokens ELSE 0 END) as input_tokens,
    SUM(CASE WHEN created_at >= month_start THEN output_tokens ELSE 0 END) as output_tokens
  FROM llm_koltsegek
  WHERE company_id IS NOT NULL
  GROUP BY company_id
) t;
$$;
