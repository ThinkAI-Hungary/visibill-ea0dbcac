-- Drop and recreate to force PostgREST schema cache invalidation
DROP FUNCTION IF EXISTS public.get_missing_counts_by_company(UUID[]);

CREATE OR REPLACE FUNCTION public.get_missing_counts_by_company(p_company_ids UUID[])
RETURNS TABLE(company_id UUID, missing_count BIGINT) AS $$
  SELECT mi.company_id, COUNT(*)
  FROM accounty_missing_items mi
  JOIN companies c ON c.id = mi.company_id
  WHERE mi.company_id = ANY(p_company_ids)
    AND mi.status IN ('open', 'notified')
    AND c.name != 'SANDBOX'
  GROUP BY mi.company_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_missing_counts_by_company(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_missing_counts_by_company(UUID[]) TO anon;

-- Force PostgREST to reload its schema cache
SELECT pg_notify('pgrst', 'reload schema');
