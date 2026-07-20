-- ==================================================
-- MERGED FROM: 20260624_annual_report_v2.sql
-- ==================================================
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


-- ==================================================
-- MERGED FROM: 20260624_fix_bs_pnl_bridge.sql
-- ==================================================
-- ═══════════════════════════════════════════════════════════
-- Fix #3: BS auto-derived balances (bank + receivables + payables)
-- 
-- Includes BOTH submitted invoices AND NAV invoices in 
-- receivables/payables calculation.
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_bs_report(uuid, uuid, date, integer);
DROP FUNCTION IF EXISTS public.get_bs_report(uuid, uuid, date, integer, jsonb);

CREATE OR REPLACE FUNCTION public.get_bs_report(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_to date DEFAULT NULL,
  p_fiscal_year integer DEFAULT NULL,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  bs_structure_id uuid,
  row_code text,
  name text,
  section text,
  type text,
  order_num integer,
  parent_id uuid,
  is_pnl_bridge boolean,
  current_balance numeric,
  prior_year_balance numeric,
  prior_year_adjustment numeric,
  gl_accounts jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- 1. Get cumulative GL balances
  gl_data AS (
    SELECT * FROM public.get_gl_balances(p_company_id, p_preset_id, NULL, p_date_to, p_exchange_rates)
  ),

  -- 2. Map GL accounts to BS rows using prefix inheritance
  all_mappings AS (
    SELECT m.gl_account_id, m.bs_structure_id AS mapped_bs_id, a.gl_number,
           REPLACE(a.gl_number, '.', '') as clean_gl_number
    FROM public.bs_mapping m
    JOIN public.gl_accounts a ON m.gl_account_id = a.id
    WHERE m.company_id = p_company_id AND m.preset_id = p_preset_id
  ),
  mapped_data AS (
    SELECT
      g.gl_account_id,
      g.gl_number,
      g.short_name,
      g.total_balance,
      (
        SELECT am.mapped_bs_id
        FROM all_mappings am
        WHERE REPLACE(g.gl_number, '.', '') LIKE am.clean_gl_number || '%'
        ORDER BY LENGTH(am.clean_gl_number) DESC
        LIMIT 1
      ) AS mapped_bs_id
    FROM gl_data g
  ),

  -- 3. P&L Bridge: prefix matching (same as get_pnl_report)
  pnl_bridge_calc AS (
    SELECT COALESCE(SUM(pnl_bal.total_balance), 0) AS pnl_result
    FROM public.get_gl_balances(p_company_id, p_preset_id, NULL, p_date_to, p_exchange_rates) pnl_bal
    WHERE EXISTS (
      SELECT 1
      FROM public.pnl_mapping pm2
      JOIN public.gl_accounts a2 ON pm2.gl_account_id = a2.id
      WHERE pm2.company_id = p_company_id
        AND pm2.preset_id = p_preset_id
        AND REPLACE(pnl_bal.gl_number, '.', '') LIKE REPLACE(a2.gl_number, '.', '') || '%'
    )
  ),

  -- 4. Auto-derived BS balances
  -- 4a. Bank balance = SUM of ALL bank transactions
  auto_bank AS (
    SELECT COALESCE(SUM(
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1)
    ), 0) AS bank_total
    FROM public.transactions t
    WHERE t.company_id = p_company_id
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)
  ),
  bank_target AS (
    SELECT am.mapped_bs_id
    FROM all_mappings am
    WHERE am.clean_gl_number LIKE '38%'
    ORDER BY LENGTH(am.clean_gl_number) DESC
    LIMIT 1
  ),

  -- 4b. Receivables = outbound invoices (submitted + NAV)
  auto_receivables AS (
    SELECT COALESCE(SUM(amt), 0) AS receivables_total FROM (
      -- Submitted outbound invoices
      SELECT COALESCE(ii.net_amount, 0) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amt
      FROM public.invoice_items ii
      JOIN public.invoices i ON ii.invoice_id = i.id
      WHERE i.company_id = p_company_id
        AND i.invoice_direction = 'OUTBOUND'
        AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)
      UNION ALL
      -- NAV outbound invoices
      SELECT COALESCE(ni.net_amount, 0) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amt
      FROM public.nav_invoice_items ni
      JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
      WHERE n.company_id = p_company_id
        AND n.invoice_direction = 'OUTBOUND'
        AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
    ) all_receivables
  ),
  receivables_target AS (
    SELECT am.mapped_bs_id
    FROM all_mappings am
    WHERE am.clean_gl_number LIKE '31%'
    ORDER BY LENGTH(am.clean_gl_number) DESC
    LIMIT 1
  ),

  -- 4c. Payables = inbound invoices (submitted + NAV)
  auto_payables AS (
    SELECT COALESCE(SUM(amt), 0) AS payables_total FROM (
      -- Submitted inbound invoices
      SELECT COALESCE(ii.net_amount, 0) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amt
      FROM public.invoice_items ii
      JOIN public.invoices i ON ii.invoice_id = i.id
      WHERE i.company_id = p_company_id
        AND i.invoice_direction = 'INBOUND'
        AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)
      UNION ALL
      -- NAV inbound invoices
      SELECT COALESCE(ni.net_amount, 0) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amt
      FROM public.nav_invoice_items ni
      JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
      WHERE n.company_id = p_company_id
        AND n.invoice_direction = 'INBOUND'
        AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
    ) all_payables
  ),
  payables_target AS (
    SELECT am.mapped_bs_id
    FROM all_mappings am
    WHERE am.clean_gl_number LIKE '45%' OR am.clean_gl_number LIKE '44%'
    ORDER BY LENGTH(am.clean_gl_number) DESC
    LIMIT 1
  ),

  -- 5. Prior year data
  prior_data AS (
    SELECT py.bs_structure_id AS prior_bs_id, py.prior_year_balance AS py_balance, py.prior_year_adjustment AS py_adjustment
    FROM public.bs_prior_year py
    WHERE py.company_id = p_company_id
      AND py.fiscal_year = COALESCE(p_fiscal_year, EXTRACT(YEAR FROM COALESCE(p_date_to, CURRENT_DATE))::integer)
  ),

  -- 6. Aggregate with auto-derived amounts
  aggregated AS (
    SELECT
      s.id AS bs_structure_id,
      s.row_code::text,
      s.name::text,
      s.section::text,
      s.type::text,
      s.order_num,
      s.parent_id,
      s.is_pnl_bridge,
      CASE
        WHEN s.is_pnl_bridge THEN (SELECT pnl_result FROM pnl_bridge_calc)
        ELSE COALESCE(SUM(md.total_balance), 0)::numeric
          + CASE WHEN s.id = (SELECT mapped_bs_id FROM bank_target) THEN (SELECT bank_total FROM auto_bank) ELSE 0 END
          + CASE WHEN s.id = (SELECT mapped_bs_id FROM receivables_target) THEN (SELECT receivables_total FROM auto_receivables) ELSE 0 END
          + CASE WHEN s.id = (SELECT mapped_bs_id FROM payables_target) THEN (SELECT payables_total FROM auto_payables) ELSE 0 END
      END AS current_balance,
      COALESCE(pd.py_balance, 0)::numeric AS prior_year_balance,
      COALESCE(pd.py_adjustment, 0)::numeric AS prior_year_adjustment,
      CASE
        WHEN s.is_pnl_bridge THEN '[]'::jsonb
        ELSE COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'gl_account_id', md.gl_account_id,
              'gl_number', md.gl_number,
              'short_name', md.short_name,
              'balance', md.total_balance
            )
          ) FILTER (WHERE md.gl_account_id IS NOT NULL),
          '[]'::jsonb
        )
      END AS gl_accounts
    FROM public.bs_structure s
    LEFT JOIN mapped_data md ON s.id = md.mapped_bs_id AND NOT s.is_pnl_bridge
    LEFT JOIN prior_data pd ON s.id = pd.prior_bs_id
    GROUP BY s.id, s.row_code, s.name, s.section, s.type, s.order_num,
             s.parent_id, s.is_pnl_bridge, pd.py_balance, pd.py_adjustment
  )
  SELECT * FROM aggregated
  ORDER BY aggregated.order_num;
END;
$$;


-- ==================================================
-- MERGED FROM: 20260624_vat_code_audit.sql
-- ==================================================
-- ============================================================
-- V8: ÁFA kód audit log — target_rows változás naplózása
-- ============================================================

-- 1. Audit log tábla
CREATE TABLE IF NOT EXISTS public.vat_code_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vat_code_id UUID NOT NULL REFERENCES public.vat_codes(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  vat_code_code TEXT NOT NULL,
  old_target_rows JSONB,
  new_target_rows JSONB,
  old_label TEXT,
  new_label TEXT,
  change_type TEXT NOT NULL DEFAULT 'update', -- 'update', 'create', 'delete'
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast company lookups
CREATE INDEX IF NOT EXISTS idx_vat_code_audit_company
  ON public.vat_code_audit_log(company_id, changed_at DESC);

-- 2. Trigger function
CREATE OR REPLACE FUNCTION log_vat_code_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if target_rows or label actually changed
  IF TG_OP = 'UPDATE' AND (
    OLD.target_rows IS DISTINCT FROM NEW.target_rows
    OR OLD.label IS DISTINCT FROM NEW.label
  ) THEN
    INSERT INTO public.vat_code_audit_log (
      vat_code_id, company_id, changed_by, vat_code_code,
      old_target_rows, new_target_rows,
      old_label, new_label,
      change_type
    ) VALUES (
      NEW.id, NEW.company_id, auth.uid(), NEW.code,
      OLD.target_rows, NEW.target_rows,
      OLD.label, NEW.label,
      'update'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach trigger
DROP TRIGGER IF EXISTS trg_vat_code_audit ON public.vat_codes;
CREATE TRIGGER trg_vat_code_audit
  AFTER UPDATE ON public.vat_codes
  FOR EACH ROW
  EXECUTE FUNCTION log_vat_code_change();

-- 4. RLS policies
ALTER TABLE public.vat_code_audit_log ENABLE ROW LEVEL SECURITY;

-- Company members can read audit log
CREATE POLICY "Company members can view vat code audit log"
  ON public.vat_code_audit_log
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Trigger inserts bypass RLS (SECURITY DEFINER function)
-- No INSERT/UPDATE/DELETE policies needed for users

COMMENT ON TABLE public.vat_code_audit_log IS 'Audit log for VAT code target_rows and label changes';
