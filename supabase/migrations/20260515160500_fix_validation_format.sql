-- Fix: validate_annual_report — human-readable number formatting (E Ft, thousand separators)
CREATE OR REPLACE FUNCTION public.validate_annual_report(
  p_report_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report record;
  v_results jsonb := '[]'::jsonb;
  v_bs_total_assets numeric := 0;
  v_bs_total_liabilities numeric := 0;
  v_pnl_net_income numeric := 0;
  v_bs_net_income numeric := 0;
  v_all_passed boolean := true;
BEGIN
  -- Load the report
  SELECT * INTO v_report FROM public.annual_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Report not found');
  END IF;

  -- Must have frozen data
  IF v_report.frozen_bs_data IS NULL OR v_report.frozen_pnl_data IS NULL THEN
    RETURN jsonb_build_object('error', 'Data not frozen yet. Run Step 2 first.');
  END IF;

  -- Parse BS totals
  SELECT COALESCE(SUM((row_val->>'current_balance')::numeric), 0) INTO v_bs_total_assets
  FROM jsonb_array_elements(v_report.frozen_bs_data) row_val
  WHERE row_val->>'section' = 'assets' AND row_val->>'type' = 'arabic';

  SELECT COALESCE(SUM((row_val->>'current_balance')::numeric), 0) INTO v_bs_total_liabilities
  FROM jsonb_array_elements(v_report.frozen_bs_data) row_val
  WHERE (row_val->>'section' = 'liabilities' AND row_val->>'type' = 'arabic')
     OR (row_val->>'is_pnl_bridge')::boolean = true;

  -- Parse PNL net income (last row = D. or bottom line)
  SELECT COALESCE((row_val->>'balance')::numeric, 0) INTO v_pnl_net_income
  FROM jsonb_array_elements(v_report.frozen_pnl_data) row_val
  WHERE row_val->>'row_code' = 'D.'
  LIMIT 1;

  -- BS PNL bridge value
  SELECT COALESCE((row_val->>'current_balance')::numeric, 0) INTO v_bs_net_income
  FROM jsonb_array_elements(v_report.frozen_bs_data) row_val
  WHERE (row_val->>'is_pnl_bridge')::boolean = true
  LIMIT 1;

  -- ═══ VALIDATION RULES ═══

  -- V1: Balance sheet must balance
  IF ABS(v_bs_total_assets - v_bs_total_liabilities) > 1 THEN
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V1',
      'rule_name', 'Mérleg egyezőség',
      'passed', false,
      'severity', 'error',
      'message', format(
        'Eszközök: %s E Ft  ≠  Források: %s E Ft.  Eltérés: %s E Ft',
        to_char(ROUND(v_bs_total_assets / 1000), 'FM999G999G999'),
        to_char(ROUND(v_bs_total_liabilities / 1000), 'FM999G999G999'),
        to_char(ROUND((v_bs_total_assets - v_bs_total_liabilities) / 1000), 'FM999G999G999')
      ),
      'assets', ROUND(v_bs_total_assets / 1000),
      'liabilities', ROUND(v_bs_total_liabilities / 1000),
      'difference', ROUND((v_bs_total_assets - v_bs_total_liabilities) / 1000)
    );
    v_all_passed := false;
  ELSE
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V1', 'rule_name', 'Mérleg egyezőség',
      'passed', true, 'severity', 'info',
      'message', format('Eszközök = Források = %s E Ft ✓',
        to_char(ROUND(v_bs_total_assets / 1000), 'FM999G999G999')
      ),
      'assets', ROUND(v_bs_total_assets / 1000),
      'liabilities', ROUND(v_bs_total_liabilities / 1000)
    );
  END IF;

  -- V2: PNL net income must match BS PNL bridge
  IF ABS(v_pnl_net_income - v_bs_net_income) > 1 THEN
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V2',
      'rule_name', 'P&L — Mérleg összhang',
      'passed', false,
      'severity', 'error',
      'message', format(
        'Eredménykimutatás eredménye: %s E Ft  ≠  Mérleg D/VII sor: %s E Ft',
        to_char(ROUND(v_pnl_net_income / 1000), 'FM999G999G999'),
        to_char(ROUND(v_bs_net_income / 1000), 'FM999G999G999')
      )
    );
    v_all_passed := false;
  ELSE
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V2', 'rule_name', 'P&L — Mérleg összhang',
      'passed', true, 'severity', 'info',
      'message', format('Eredménykimutatás eredménye = Mérleg D/VII = %s E Ft ✓',
        to_char(ROUND(v_pnl_net_income / 1000), 'FM999G999G999')
      )
    );
  END IF;

  -- V3: Representative name must be filled
  IF v_report.representative_name IS NULL OR TRIM(v_report.representative_name) = '' THEN
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V3', 'rule_name', 'Képviselő neve',
      'passed', false, 'severity', 'error',
      'message', 'A képviselő neve nincs kitöltve az 1. lépésben.'
    );
    v_all_passed := false;
  ELSE
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V3', 'rule_name', 'Képviselő neve',
      'passed', true, 'severity', 'info',
      'message', format('Képviselő: %s ✓', v_report.representative_name)
    );
  END IF;

  -- V4: Dividend must not exceed net income
  IF v_report.dividend_amount > 0 AND v_report.dividend_amount > v_report.net_income THEN
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V4', 'rule_name', 'Osztalék limit',
      'passed', false, 'severity', 'error',
      'message', format(
        'Osztalék (%s E Ft) meghaladja az adózott eredményt (%s E Ft)!',
        to_char(ROUND(v_report.dividend_amount / 1000), 'FM999G999G999'),
        to_char(ROUND(v_report.net_income / 1000), 'FM999G999G999')
      )
    );
    v_all_passed := false;
  ELSE
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V4', 'rule_name', 'Osztalék limit',
      'passed', true, 'severity', 'info', 'message', 'Osztalék ≤ Adózott eredmény ✓'
    );
  END IF;

  -- V5: Frozen data must not be too old (within 30 days)
  IF v_report.frozen_at < now() - interval '30 days' THEN
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V5', 'rule_name', 'Adatok frissessége',
      'passed', false, 'severity', 'warning',
      'message', format('A befagyasztott adatok %s napja készültek. Javasolt újra futtatni a 2. lépést.',
        EXTRACT(DAY FROM now() - v_report.frozen_at)::integer
      )
    );
  ELSE
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V5', 'rule_name', 'Adatok frissessége',
      'passed', true, 'severity', 'info',
      'message', format('Adatok frissek (%s) ✓', to_char(v_report.frozen_at, 'YYYY.MM.DD HH24:MI'))
    );
  END IF;

  -- Save results
  UPDATE public.annual_reports
  SET validation_results = v_results,
      validated_at = now(),
      updated_at = now()
  WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'all_passed', v_all_passed,
    'results', v_results
  );
END;
$$;
