-- ═══════════════════════════════════════════════════════════
-- BESZÁMOLÓ MODULE v2: RLS fix + Validation improvements
-- B2: Fix overly permissive RLS
-- B3: Fix V2 validation (PnL net income calculation)
-- B6: New validation rules V6-V8
-- ═══════════════════════════════════════════════════════════

-- ── B2: RLS POLICY FIX ──────────────────────────────────

-- Drop the old overly-permissive policies
DROP POLICY IF EXISTS "annual_reports_select" ON public.annual_reports;
DROP POLICY IF EXISTS "annual_reports_insert" ON public.annual_reports;
DROP POLICY IF EXISTS "annual_reports_update" ON public.annual_reports;
DROP POLICY IF EXISTS "annual_reports_delete" ON public.annual_reports;

-- Create proper company-based RLS
CREATE POLICY "annual_reports_select" ON public.annual_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = annual_reports.company_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "annual_reports_insert" ON public.annual_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = annual_reports.company_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "annual_reports_update" ON public.annual_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = annual_reports.company_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "annual_reports_delete" ON public.annual_reports
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = annual_reports.company_id
        AND cm.user_id = auth.uid()
    )
  );


-- ── B3 + B6: IMPROVED VALIDATION RPC ────────────────────

DROP FUNCTION IF EXISTS public.validate_annual_report(uuid);

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
  v_equity_total numeric := 0;
  v_prior_assets numeric := 0;
  v_current_assets numeric := 0;
  v_notes_required integer := 0;
  v_notes_filled integer := 0;
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

  -- ── Parse BS totals (sum arabic rows for each section) ──
  SELECT COALESCE(SUM((row_val->>'current_balance')::numeric), 0) INTO v_bs_total_assets
  FROM jsonb_array_elements(v_report.frozen_bs_data) row_val
  WHERE row_val->>'section' = 'assets' AND row_val->>'type' = 'arabic';

  SELECT COALESCE(SUM((row_val->>'current_balance')::numeric), 0) INTO v_bs_total_liabilities
  FROM jsonb_array_elements(v_report.frozen_bs_data) row_val
  WHERE (row_val->>'section' = 'liabilities' AND row_val->>'type' = 'arabic')
     OR (row_val->>'is_pnl_bridge')::boolean = true;

  -- ── B3 FIX: PnL net income = sum of ALL row balances × multiplier ──
  -- The 'D.' capital row is a calculated subtotal. Its direct balance
  -- is the sum of its children. We compute it by summing
  -- balance * multiplier for ALL roman-level rows (I. through X.).
  SELECT COALESCE(SUM(
    ((row_val->>'balance')::numeric) * ((row_val->>'multiplier')::integer)
  ), 0) INTO v_pnl_net_income
  FROM jsonb_array_elements(v_report.frozen_pnl_data) row_val
  WHERE row_val->>'type' = 'roman';

  -- BS PNL bridge value (the is_pnl_bridge row in BS)
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
      'message', format('Eszközök (%s) ≠ Források (%s). Eltérés: %s Ft',
        v_bs_total_assets, v_bs_total_liabilities,
        v_bs_total_assets - v_bs_total_liabilities)
    );
    v_all_passed := false;
  ELSE
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V1', 'rule_name', 'Mérleg egyezőség',
      'passed', true, 'severity', 'info', 'message', 'Eszközök = Források ✓'
    );
  END IF;

  -- V2: PNL net income must match BS PNL bridge (FIXED: use roman rows sum)
  IF ABS(v_pnl_net_income - v_bs_net_income) > 1 THEN
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V2',
      'rule_name', 'P&L - Mérleg összhang',
      'passed', false,
      'severity', 'error',
      'message', format('P&L Adózott eredmény (%s) ≠ Mérleg D/VII (%s). Eltérés: %s',
        v_pnl_net_income, v_bs_net_income,
        v_pnl_net_income - v_bs_net_income)
    );
    v_all_passed := false;
  ELSE
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V2', 'rule_name', 'P&L - Mérleg összhang',
      'passed', true, 'severity', 'info', 'message', 'P&L eredmény = Mérleg D/VII ✓'
    );
  END IF;

  -- V3: Representative name must be filled
  IF v_report.representative_name IS NULL OR TRIM(v_report.representative_name) = '' THEN
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V3', 'rule_name', 'Képviselő neve',
      'passed', false, 'severity', 'error',
      'message', 'A képviselő neve nincs kitöltve.'
    );
    v_all_passed := false;
  ELSE
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V3', 'rule_name', 'Képviselő neve',
      'passed', true, 'severity', 'info', 'message', 'Képviselő neve kitöltve ✓'
    );
  END IF;

  -- V4: Dividend must not exceed net income
  IF v_report.dividend_amount > 0 AND v_report.dividend_amount > v_report.net_income THEN
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V4', 'rule_name', 'Osztalék limit',
      'passed', false, 'severity', 'error',
      'message', format('Osztalék (%s) > Adózott eredmény (%s)',
        v_report.dividend_amount, v_report.net_income)
    );
    v_all_passed := false;
  ELSE
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V4', 'rule_name', 'Osztalék limit',
      'passed', true, 'severity', 'info', 'message', 'Osztalék ≤ Eredmény ✓'
    );
  END IF;

  -- V5: Frozen data must not be too old (within 30 days)
  IF v_report.frozen_at < now() - interval '30 days' THEN
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V5', 'rule_name', 'Adatok frissessége',
      'passed', false, 'severity', 'warning',
      'message', 'A befagyasztott adatok 30 napnál régebbiek. Frissítsd!'
    );
  ELSE
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V5', 'rule_name', 'Adatok frissessége',
      'passed', true, 'severity', 'info', 'message', 'Adatok frissek ✓'
    );
  END IF;

  -- ═══ NEW RULES (B6) ═══

  -- V6: Negative equity warning (tőkeveszett)
  SELECT COALESCE(SUM((row_val->>'current_balance')::numeric), 0) INTO v_equity_total
  FROM jsonb_array_elements(v_report.frozen_bs_data) row_val
  WHERE row_val->>'section' = 'liabilities'
    AND (row_val->>'row_code') LIKE 'D%'
    AND row_val->>'type' = 'letter';

  IF v_equity_total < 0 THEN
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V6', 'rule_name', 'Saját tőke helyzet',
      'passed', false, 'severity', 'warning',
      'message', format('⚠ A saját tőke negatív (%s Ft) — a társaság tőkeveszett. A Ptk. 3:133. § szerinti intézkedés szükséges.',
        v_equity_total)
    );
  ELSE
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V6', 'rule_name', 'Saját tőke helyzet',
      'passed', true, 'severity', 'info', 'message', format('Saját tőke pozitív (%s Ft) ✓', v_equity_total)
    );
  END IF;

  -- V7: Balance sheet total change >50% vs prior year
  SELECT COALESCE(SUM((row_val->>'current_balance')::numeric), 0) INTO v_current_assets
  FROM jsonb_array_elements(v_report.frozen_bs_data) row_val
  WHERE row_val->>'section' = 'assets' AND row_val->>'type' = 'total';

  SELECT COALESCE(SUM((row_val->>'prior_year_balance')::numeric), 0) INTO v_prior_assets
  FROM jsonb_array_elements(v_report.frozen_bs_data) row_val
  WHERE row_val->>'section' = 'assets' AND row_val->>'type' = 'total';

  IF v_prior_assets > 0 AND ABS(v_current_assets - v_prior_assets) / v_prior_assets > 0.5 THEN
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V7', 'rule_name', 'Mérlegfőösszeg-változás',
      'passed', true, -- info, not a failure
      'severity', 'warning',
      'message', format('A mérlegfőösszeg >50%%-kal változott: %s → %s. Kérlek ellenőrizd az adatokat.',
        v_prior_assets, v_current_assets)
    );
  ELSE
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V7', 'rule_name', 'Mérlegfőösszeg-változás',
      'passed', true, 'severity', 'info', 'message', 'Mérlegfőösszeg-változás normál tartományban ✓'
    );
  END IF;

  -- V8: Required notes sections filled
  SELECT COUNT(*) INTO v_notes_required
  FROM public.annual_report_notes_templates
  WHERE is_required = true;

  IF v_report.notes_sections IS NOT NULL AND jsonb_array_length(v_report.notes_sections) > 0 THEN
    SELECT COUNT(*) INTO v_notes_filled
    FROM jsonb_array_elements(v_report.notes_sections) ns
    WHERE TRIM(COALESCE(ns->>'text', '')) <> '';
  END IF;

  IF v_notes_required > 0 AND v_notes_filled < v_notes_required THEN
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V8', 'rule_name', 'Kiegészítő melléklet',
      'passed', false, 'severity', 'warning',
      'message', format('A %s kötelező szekció közül %s van kitöltve. A hiányzókat a 4. lépésben pótolhatod.',
        v_notes_required, v_notes_filled)
    );
  ELSE
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V8', 'rule_name', 'Kiegészítő melléklet',
      'passed', true, 'severity', 'info', 'message', format('Minden kötelező szekció kitöltve (%s/%s) ✓', v_notes_filled, v_notes_required)
    );
  END IF;

  -- Save results + auto-set net_income from frozen PnL
  UPDATE public.annual_reports
  SET validation_results = v_results,
      validated_at = now(),
      net_income = v_pnl_net_income,
      retained_earnings = v_pnl_net_income - COALESCE(dividend_amount, 0),
      updated_at = now()
  WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'all_passed', v_all_passed,
    'results', v_results,
    'net_income', v_pnl_net_income
  );
END;
$$;
