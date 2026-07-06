-- =============================================================================
-- EV YTD bevétel aggregáció RPC — Értékhatár-figyelőhöz
-- =============================================================================
-- Cégenként összesíti a pénztárkönyvi bevételi tételeket (bevetel_adokoteles)
-- egy adott adóévre. Stornó tételeket kiszűri.
--
-- Használja: EvThresholdMonitorPage (portfólió-szintű küszöbérték-figyelő)
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_ev_ytd_revenue_by_company(INT);

CREATE OR REPLACE FUNCTION public.get_ev_ytd_revenue_by_company(
  p_tax_year INT
)
RETURNS TABLE(
  company_id UUID,
  ytd_revenue BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.company_id,
    COALESCE(SUM(pt.amount), 0)::BIGINT AS ytd_revenue
  FROM public.accounty_penztarkonyv_tetel pt
  WHERE pt.tax_year = p_tax_year
    AND pt.entry_direction = 'bevetel'
    AND pt.main_category = 'bevetel_adokoteles'
    AND pt.is_storno = FALSE
  GROUP BY pt.company_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant access to authenticated users (RLS on the underlying table still applies
-- via SECURITY DEFINER context)
GRANT EXECUTE ON FUNCTION public.get_ev_ytd_revenue_by_company(INT) TO authenticated;

-- Force PostgREST schema cache reload
SELECT pg_notify('pgrst', 'reload schema');
