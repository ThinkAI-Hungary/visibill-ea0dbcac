-- ============================================================
-- Fix: STABLE → VOLATILE for RPC functions called via PostgREST
-- ============================================================
-- Problem: PostgREST runs the check_request() pre-request hook
-- inside the SAME transaction as the RPC call. When an RPC function
-- is declared STABLE, PostgreSQL opens a READ-ONLY transaction.
-- The check_request() hook does INSERT INTO private.rate_limits,
-- which fails with: "cannot execute INSERT in a read-only transaction"
-- (SQLSTATE 25006), causing the entire RPC to return HTTP 405.
--
-- Fix: Change STABLE → VOLATILE for RPC functions exposed to
-- PostgREST via POST. The functions themselves only do SELECTs,
-- but the enclosing transaction must allow writes for the
-- pre-request hook to work.
-- ============================================================

-- 1. get_accounty_dashboard_kpis
DROP FUNCTION IF EXISTS public.get_accounty_dashboard_kpis(UUID[], DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_accounty_dashboard_kpis(
  p_company_ids UUID[],
  p_now_date DATE,
  p_week_date DATE
)
RETURNS TABLE(
  missing_items BIGINT,
  upcoming_deadlines BIGINT,
  critical_clients BIGINT,
  today_deadlines BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COALESCE(COUNT(*), 0)
     FROM public.accounty_missing_items
     WHERE company_id = ANY(p_company_ids)
       AND status IN ('open', 'notified'))::BIGINT AS missing_items,

    (SELECT COALESCE(COUNT(*), 0)
     FROM public.accounty_deadlines
     WHERE company_id = ANY(p_company_ids)
       AND status IN ('pending', 'in_progress')
       AND due_date >= p_now_date
       AND due_date <= p_week_date)::BIGINT AS upcoming_deadlines,

    (SELECT COALESCE(COUNT(*), 0)
     FROM public.accounty_missing_items
     WHERE company_id = ANY(p_company_ids)
       AND priority = 'urgent'
       AND status IN ('open', 'notified'))::BIGINT AS critical_clients,

    (SELECT COALESCE(COUNT(*), 0)
     FROM public.accounty_deadlines
     WHERE company_id = ANY(p_company_ids)
       AND status IN ('pending', 'in_progress')
       AND due_date = p_now_date)::BIGINT AS today_deadlines;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_accounty_dashboard_kpis(UUID[], DATE, DATE) TO authenticated;

-- Force PostgREST schema cache reload
SELECT pg_notify('pgrst', 'reload schema');
