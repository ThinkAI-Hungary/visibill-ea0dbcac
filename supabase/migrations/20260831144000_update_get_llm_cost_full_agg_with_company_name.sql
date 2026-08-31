-- =============================================================================
-- Migration: Update get_llm_cost_full_agg RPC with company names
-- Description: Joins companies table in by_company aggregation to include
--              real company names directly from the respective tenant DB.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_llm_cost_full_agg(since_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH filtered AS (
  SELECT pipeline, model_name, company_id, input_tokens, output_tokens, total_tokens, estimated_cost_usd, created_at
  FROM llm_koltsegek
  WHERE (since_date IS NULL OR created_at >= since_date)
),
totals AS (
  SELECT SUM(estimated_cost_usd) AS total_cost, COUNT(*) AS total_jobs, SUM(input_tokens) AS total_input, SUM(output_tokens) AS total_output
  FROM filtered
),
by_pipeline AS (
  SELECT pipeline, SUM(estimated_cost_usd) AS cost, COUNT(*) AS jobs
  FROM filtered
  GROUP BY pipeline
),
by_model AS (
  SELECT model_name, SUM(estimated_cost_usd) AS cost, COUNT(*) AS jobs, SUM(total_tokens) AS tokens
  FROM filtered
  GROUP BY model_name
),
by_company AS (
  SELECT f.company_id, COALESCE(c.name, f.company_id::text) AS company_name, SUM(f.estimated_cost_usd) AS cost, COUNT(*) AS jobs
  FROM filtered f
  LEFT JOIN companies c ON c.id = f.company_id
  WHERE f.company_id IS NOT NULL
  GROUP BY f.company_id, c.name
  ORDER BY cost DESC
  LIMIT 10
),
by_day AS (
  SELECT DATE_TRUNC('day', created_at)::DATE::TEXT AS day, SUM(estimated_cost_usd) AS cost, COUNT(*) AS jobs
  FROM filtered
  GROUP BY 1
  ORDER BY 1
)
SELECT jsonb_build_object(
  'total_cost', (SELECT total_cost FROM totals),
  'total_jobs', (SELECT total_jobs FROM totals),
  'total_input_tokens', (SELECT total_input FROM totals),
  'total_output_tokens', (SELECT total_output FROM totals),
  'by_pipeline', (SELECT COALESCE(jsonb_object_agg(pipeline, jsonb_build_object('cost', cost, 'jobs', jobs)), '{}') FROM by_pipeline),
  'by_model', (SELECT COALESCE(jsonb_object_agg(model_name, jsonb_build_object('cost', cost, 'jobs', jobs, 'tokens', tokens)), '{}') FROM by_model),
  'top_companies', (SELECT COALESCE(jsonb_agg(jsonb_build_object('company_id', company_id, 'company_name', company_name, 'cost', cost, 'jobs', jobs)), '[]') FROM by_company),
  'daily_trend', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', day, 'cost', cost, 'jobs', jobs) ORDER BY day), '[]') FROM by_day)
);
$function$;
