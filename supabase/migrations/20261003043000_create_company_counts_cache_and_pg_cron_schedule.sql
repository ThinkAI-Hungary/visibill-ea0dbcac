-- Migration: 20261003043000_create_company_counts_cache_and_pg_cron_schedule.sql
-- Description: Create company_counts_cache table, refresh function, and pg_cron schedule
-- to replace live 4-table aggregations in get_company_counts() with a sub-millisecond cached lookup.

-- 1. Create company_counts_cache table
CREATE TABLE IF NOT EXISTS public.company_counts_cache (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_count integer NOT NULL DEFAULT 0,
  nav_invoice_count integer NOT NULL DEFAULT 0,
  transaction_count integer NOT NULL DEFAULT 0,
  salary_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index on updated_at for cache freshness monitoring
CREATE INDEX IF NOT EXISTS idx_company_counts_cache_updated_at 
  ON public.company_counts_cache (updated_at);

-- 2. Row Level Security
ALTER TABLE public.company_counts_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to authenticated" ON public.company_counts_cache;
CREATE POLICY "Allow read access to authenticated"
  ON public.company_counts_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Cache refresh function
CREATE OR REPLACE FUNCTION public.refresh_company_counts_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.company_counts_cache (
    company_id,
    invoice_count,
    nav_invoice_count,
    transaction_count,
    salary_count,
    updated_at
  )
  SELECT
    c.id AS company_id,
    COALESCE(inv.cnt, 0) AS invoice_count,
    COALESCE(nav.cnt, 0) AS nav_invoice_count,
    COALESCE(tx.cnt, 0) AS transaction_count,
    COALESCE(sal.cnt, 0) AS salary_count,
    now() AS updated_at
  FROM public.companies c
  LEFT JOIN (
    SELECT company_id, COUNT(*) AS cnt 
    FROM public.invoices 
    WHERE company_id IS NOT NULL 
    GROUP BY company_id
  ) inv ON inv.company_id = c.id
  LEFT JOIN (
    SELECT company_id, COUNT(*) AS cnt 
    FROM public.nav_invoices 
    WHERE company_id IS NOT NULL 
    GROUP BY company_id
  ) nav ON nav.company_id = c.id
  LEFT JOIN (
    SELECT company_id, COUNT(*) AS cnt 
    FROM public.transactions 
    WHERE company_id IS NOT NULL 
    GROUP BY company_id
  ) tx ON tx.company_id = c.id
  LEFT JOIN (
    SELECT company_id, COUNT(*) AS cnt 
    FROM public.salary 
    WHERE company_id IS NOT NULL 
    GROUP BY company_id
  ) sal ON sal.company_id = c.id
  ON CONFLICT (company_id) DO UPDATE SET
    invoice_count = EXCLUDED.invoice_count,
    nav_invoice_count = EXCLUDED.nav_invoice_count,
    transaction_count = EXCLUDED.transaction_count,
    salary_count = EXCLUDED.salary_count,
    updated_at = EXCLUDED.updated_at;

  -- Cleanup deleted companies
  DELETE FROM public.company_counts_cache
  WHERE company_id NOT IN (SELECT id FROM public.companies);
END;
$$;

-- Secure permissions
REVOKE EXECUTE ON FUNCTION public.refresh_company_counts_cache() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_company_counts_cache() TO authenticated, service_role;

-- 4. Ultra-fast get_company_counts() RPC reading directly from cache
CREATE OR REPLACE FUNCTION public.get_company_counts()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result json;
BEGIN
  -- Self-healing fallback: populate cache immediately if empty
  IF NOT EXISTS (SELECT 1 FROM public.company_counts_cache LIMIT 1) THEN
    PERFORM public.refresh_company_counts_cache();
  END IF;

  SELECT json_build_object(
    'invoices',     COALESCE(json_object_agg(company_id::text, invoice_count), '{}'::json),
    'nav_invoices', COALESCE(json_object_agg(company_id::text, nav_invoice_count), '{}'::json),
    'transactions', COALESCE(json_object_agg(company_id::text, transaction_count), '{}'::json),
    'salary',       COALESCE(json_object_agg(company_id::text, salary_count), '{}'::json)
  ) INTO result
  FROM public.company_counts_cache;

  RETURN COALESCE(
    result,
    json_build_object('invoices', '{}'::json, 'nav_invoices', '{}'::json, 'transactions', '{}'::json, 'salary', '{}'::json)
  );
END;
$$;

-- Secure permissions
REVOKE EXECUTE ON FUNCTION public.get_company_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_company_counts() TO authenticated, service_role;

-- 5. Seed initial cache data
SELECT public.refresh_company_counts_cache();

-- 6. Schedule background refresh via pg_cron (every 10 minutes)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-company-counts-cache') THEN
    PERFORM cron.unschedule('refresh-company-counts-cache');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-company-counts-cache',
  '*/10 * * * *',
  'SELECT public.refresh_company_counts_cache();'
);
