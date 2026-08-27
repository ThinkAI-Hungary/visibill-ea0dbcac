-- =============================================================================
-- Migration: 20260826_fix_monthly_trend_timezone.sql
-- Description: Align timezone in get_monthly_trend_stats by casting m.created_at to Europe/Budapest
-- =============================================================================

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
