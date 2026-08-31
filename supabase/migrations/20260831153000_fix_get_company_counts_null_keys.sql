-- Migration: 20260831153000_fix_get_company_counts_null_keys.sql
-- Description: Fix get_company_counts() RPC to ignore rows with NULL company_id to prevent PostgreSQL 22004 "null value not allowed for object key" error in json_object_agg.

CREATE OR REPLACE FUNCTION public.get_company_counts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'invoices',     (SELECT COALESCE(json_object_agg(company_id::text, cnt), '{}') FROM (SELECT company_id, COUNT(*) AS cnt FROM invoices WHERE company_id IS NOT NULL GROUP BY company_id) x),
    'nav_invoices', (SELECT COALESCE(json_object_agg(company_id::text, cnt), '{}') FROM (SELECT company_id, COUNT(*) AS cnt FROM nav_invoices WHERE company_id IS NOT NULL GROUP BY company_id) x),
    'transactions', (SELECT COALESCE(json_object_agg(company_id::text, cnt), '{}') FROM (SELECT company_id, COUNT(*) AS cnt FROM transactions WHERE company_id IS NOT NULL GROUP BY company_id) x),
    'salary',       (SELECT COALESCE(json_object_agg(company_id::text, cnt), '{}') FROM (SELECT company_id, COUNT(*) AS cnt FROM salary WHERE company_id IS NOT NULL GROUP BY company_id) x)
  ) INTO result;
  RETURN result;
END;
$$;
