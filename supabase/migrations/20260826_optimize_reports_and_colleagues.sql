-- =============================================================================
-- Migration: 20260826_optimize_reports_and_colleagues.sql
-- Description: RPC functions to batch fetch monthly trends and colleague efficiency stats in single queries
-- =============================================================================

-- 1. Monthly trend stats RPC
CREATE OR REPLACE FUNCTION public.get_monthly_trend_stats(
  p_company_ids uuid[],
  p_months_count int DEFAULT 6
)
RETURNS TABLE (
  month_start date,
  invoice_count bigint,
  nav_invoice_count bigint,
  missing_item_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_company_ids uuid[];
BEGIN
  -- Filter to allowed companies (Access Control)
  SELECT array_agg(c.id) INTO v_allowed_company_ids
  FROM unnest(p_company_ids) AS c(id)
  WHERE 
    public.user_is_company_member(c.id)
    OR EXISTS (
      SELECT 1 FROM public.accounty_assignments
      WHERE company_id = c.id
        AND accountant_user_id = auth.uid()
    );

  IF v_allowed_company_ids IS NULL OR array_length(v_allowed_company_ids, 1) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH date_series AS (
    SELECT 
      (date_trunc('month', CURRENT_DATE) - (s.idx || ' month')::interval)::date AS m_start
    FROM generate_series(0, p_months_count - 1) AS s(idx)
  ),
  inv_counts AS (
    SELECT 
      ds.m_start,
      count(i.id) AS cnt
    FROM date_series ds
    LEFT JOIN public.invoices i ON i.company_id = ANY(v_allowed_company_ids)
      AND i.kibocsatas_datuma >= ds.m_start
      AND i.kibocsatas_datuma < (ds.m_start + '1 month'::interval)::date
    GROUP BY ds.m_start
  ),
  nav_counts AS (
    SELECT 
      ds.m_start,
      count(n.id) AS cnt
    FROM date_series ds
    LEFT JOIN public.nav_invoices n ON n.company_id = ANY(v_allowed_company_ids)
      AND n.invoice_issue_date >= ds.m_start
      AND n.invoice_issue_date < (ds.m_start + '1 month'::interval)::date
    GROUP BY ds.m_start
  ),
  missing_counts AS (
    SELECT 
      ds.m_start,
      count(m.id) AS cnt
    FROM date_series ds
    LEFT JOIN public.accounty_missing_items m ON m.company_id = ANY(v_allowed_company_ids)
      AND m.created_at AT TIME ZONE 'Europe/Budapest' >= ds.m_start
      AND m.created_at AT TIME ZONE 'Europe/Budapest' < (ds.m_start + '1 month'::interval)
    GROUP BY ds.m_start
  )
  SELECT 
    ds.m_start AS month_start,
    COALESCE(i.cnt, 0) AS invoice_count,
    COALESCE(n.cnt, 0) AS nav_invoice_count,
    COALESCE(m.cnt, 0) AS missing_item_count
  FROM date_series ds
  LEFT JOIN inv_counts i ON i.m_start = ds.m_start
  LEFT JOIN nav_counts n ON n.m_start = ds.m_start
  LEFT JOIN missing_counts m ON m.m_start = ds.m_start
  ORDER BY ds.m_start ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_trend_stats(uuid[], int) TO anon, authenticated;


-- 2. Colleague stats RPC
CREATE OR REPLACE FUNCTION public.get_colleague_efficiency_stats(
  p_accounting_firm_id uuid
)
RETURNS TABLE (
  accountant_id uuid,
  accountant_name text,
  assigned_companies_count bigint,
  missing_count bigint,
  resolved_count bigint,
  closed_deadlines_count bigint,
  in_progress_deadlines_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Access control: check if current user belongs to the same accounting firm
  IF NOT EXISTS (
    SELECT 1 FROM public.accounty_assignments
    WHERE accounting_firm_id = p_accounting_firm_id
      AND accountant_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  RETURN QUERY
  WITH firm_accountants AS (
    -- Distinct accountants in the firm
    SELECT DISTINCT a.accountant_user_id
    FROM public.accounty_assignments a
    WHERE a.accounting_firm_id = p_accounting_firm_id
  ),
  accountant_companies AS (
    -- Companies assigned to each accountant, excluding SANDBOX company
    SELECT 
      a.accountant_user_id,
      a.company_id
    FROM public.accounty_assignments a
    JOIN public.companies c ON c.id = a.company_id
    WHERE a.accounting_firm_id = p_accounting_firm_id
      AND c.name <> 'SANDBOX'
  ),
  missing_stats AS (
    -- Count open/notified and resolved missing items per accountant
    SELECT 
      ac.accountant_user_id,
      count(mi.id) FILTER (WHERE mi.status IN ('open', 'notified')) AS missing_open,
      count(mi.id) FILTER (WHERE mi.status = 'resolved') AS missing_resolved
    FROM accountant_companies ac
    LEFT JOIN public.accounty_missing_items mi ON mi.company_id = ac.company_id
    GROUP BY ac.accountant_user_id
  ),
  deadline_stats AS (
    -- Count completed and in_progress deadlines per accountant
    SELECT 
      ac.accountant_user_id,
      count(d.id) FILTER (WHERE d.status = 'completed') AS dl_completed,
      count(d.id) FILTER (WHERE d.status = 'in_progress') AS dl_in_progress
    FROM accountant_companies ac
    LEFT JOIN public.accounty_deadlines d ON d.company_id = ac.company_id
    GROUP BY ac.accountant_user_id
  ),
  companies_count AS (
    SELECT 
      ac.accountant_user_id,
      count(DISTINCT ac.company_id) AS co_count
    FROM accountant_companies ac
    GROUP BY ac.accountant_user_id
  )
  SELECT 
    fa.accountant_user_id AS accountant_id,
    COALESCE(p.name, 'Névtelen')::text AS accountant_name,
    COALESCE(cc.co_count, 0)::bigint AS assigned_companies_count,
    COALESCE(ms.missing_open, 0)::bigint AS missing_count,
    COALESCE(ms.missing_resolved, 0)::bigint AS resolved_count,
    COALESCE(ds.dl_completed, 0)::bigint AS closed_deadlines_count,
    COALESCE(ds.dl_in_progress, 0)::bigint AS in_progress_deadlines_count
  FROM firm_accountants fa
  LEFT JOIN public.profiles p ON p.user_id = fa.accountant_user_id
  LEFT JOIN companies_count cc ON cc.accountant_user_id = fa.accountant_user_id
  LEFT JOIN missing_stats ms ON ms.accountant_user_id = fa.accountant_user_id
  LEFT JOIN deadline_stats ds ON ds.accountant_user_id = fa.accountant_user_id
  WHERE p.name <> 'Sandbox' AND p.name IS NOT NULL -- filter out Sandbox user
  ORDER BY 
    CASE 
      WHEN COALESCE(ms.missing_resolved, 0) + COALESCE(ms.missing_open, 0) > 0 
      THEN (COALESCE(ms.missing_resolved, 0)::double precision / (COALESCE(ms.missing_resolved, 0) + COALESCE(ms.missing_open, 0))) * 100 
      ELSE 0 
    END DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_colleague_efficiency_stats(uuid) TO anon, authenticated;
