-- Fix: freeze_annual_data — properly use fiscal year end as cutoff
-- If fiscal_year = 2026, p_date_to = 2026-12-31 (includes all 2026 transactions)
-- If fiscal_year = 2025, p_date_to = 2025-12-31 (only 2025 and earlier)
CREATE OR REPLACE FUNCTION public.freeze_annual_data(
  p_report_id uuid,
  p_company_id uuid,
  p_preset_id uuid,
  p_fiscal_year integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bs_data jsonb;
  v_pnl_data jsonb;
  v_date_from date;
  v_date_to date;
BEGIN
  -- Fiscal year boundaries
  v_date_from := make_date(p_fiscal_year, 1, 1);
  v_date_to   := make_date(p_fiscal_year, 12, 31);

  -- Fetch BS data — cumulative from beginning of time to fiscal year end
  SELECT jsonb_agg(row_to_json(bs))
  INTO v_bs_data
  FROM public.get_bs_report(p_company_id, p_preset_id, v_date_to, p_fiscal_year) bs;

  -- Fetch PNL data — only the fiscal year period (Jan 1 to Dec 31)
  SELECT jsonb_agg(row_to_json(pnl))
  INTO v_pnl_data
  FROM public.get_pnl_report(p_company_id, p_preset_id, v_date_from, v_date_to) pnl;

  -- Update the report
  UPDATE public.annual_reports
  SET
    frozen_bs_data = COALESCE(v_bs_data, '[]'::jsonb),
    frozen_pnl_data = COALESCE(v_pnl_data, '[]'::jsonb),
    frozen_at = now(),
    updated_at = now()
  WHERE id = p_report_id
    AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'success', true,
    'bs_row_count', COALESCE(jsonb_array_length(v_bs_data), 0),
    'pnl_row_count', COALESCE(jsonb_array_length(v_pnl_data), 0),
    'frozen_at', now()
  );
END;
$$;
