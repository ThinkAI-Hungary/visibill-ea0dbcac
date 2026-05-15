-- ============================================
-- BESZÁMOLÓ (ANNUAL REPORT) MODULE
-- Fázis 1: Tables + Seed + RLS
-- ============================================

-- 1. Annual Reports table
CREATE TABLE IF NOT EXISTS public.annual_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  preset_id uuid NOT NULL,
  fiscal_year integer NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'validated', 'finalized', 'submitted')),

  -- Step 1: Basic info
  representative_name text,
  representative_role text DEFAULT 'ügyvezető',
  report_date date DEFAULT CURRENT_DATE,
  accounting_method text DEFAULT 'kettős könyvvitel',

  -- Step 2: Frozen data snapshots
  frozen_bs_data jsonb,
  frozen_pnl_data jsonb,
  frozen_at timestamptz,

  -- Step 3: Validation results
  validation_results jsonb DEFAULT '[]'::jsonb,
  validated_at timestamptz,

  -- Step 4: Supplementary notes config
  notes_sections jsonb DEFAULT '[]'::jsonb,

  -- Step 5: Dividend / profit allocation
  net_income numeric DEFAULT 0,
  dividend_amount numeric DEFAULT 0,
  retained_earnings numeric DEFAULT 0,
  dividend_resolution_date date,
  dividend_resolution_number text,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,

  UNIQUE(company_id, preset_id, fiscal_year)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_annual_reports_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_annual_reports_updated_at ON public.annual_reports;
CREATE TRIGGER trg_annual_reports_updated_at
  BEFORE UPDATE ON public.annual_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_annual_reports_updated_at();

-- RLS
ALTER TABLE public.annual_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annual_reports_select" ON public.annual_reports
  FOR SELECT USING (true);

CREATE POLICY "annual_reports_insert" ON public.annual_reports
  FOR INSERT WITH CHECK (true);

CREATE POLICY "annual_reports_update" ON public.annual_reports
  FOR UPDATE USING (true);

CREATE POLICY "annual_reports_delete" ON public.annual_reports
  FOR DELETE USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_annual_reports_company_year
  ON public.annual_reports(company_id, fiscal_year);

-- 2. Notes Templates table (boilerplate text sections for Kiegészítő Melléklet)
CREATE TABLE IF NOT EXISTS public.annual_report_notes_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key text NOT NULL UNIQUE,
  section_title text NOT NULL,
  default_text text NOT NULL,
  order_num integer NOT NULL,
  is_required boolean DEFAULT true,
  category text NOT NULL
    CHECK (category IN ('general_info', 'valuation', 'asset_details', 'equity', 'other'))
);

-- 3. Seed: Default notes templates
INSERT INTO public.annual_report_notes_templates (section_key, section_title, default_text, order_num, is_required, category) VALUES
(
  'general_info',
  'I. Általános információk',
  E'A társaság a Számvitelről szóló 2000. évi C. törvény (továbbiakban: Sztv.) előírásai szerint, a kettős könyvvitel szabályainak megfelelően vezeti könyveit.\n\nA beszámoló a Sztv. szerinti éves beszámoló formájában készül.\n\nA mérleg fordulónapja: tárgyév december 31.\nA mérlegkészítés időpontja: a beszámoló aláírásának napja.',
  1, true, 'general_info'
),
(
  'accounting_policy',
  'II. Számviteli politika összefoglalása',
  E'A társaság a Számviteli politikáját a Sztv. előírásaival összhangban alakította ki. A számviteli politika tartalmazza az értékelési eljárásokat, az értékcsökkenési leírás módszereit, és a leltározási szabályzatot.\n\nAz üzleti év megegyezik a naptári évvel.\nA könyvvezetés pénzneme: magyar forint (HUF).',
  2, true, 'general_info'
),
(
  'valuation_methods',
  'III. Értékelési eljárások',
  E'Az immateriális javak és a tárgyi eszközök értékelése: bekerülési (beszerzési, előállítási) értéken, csökkentve az elszámolt terv szerinti és terven felüli értékcsökkenéssel.\n\nA készletek értékelése: bekerülési értéken (FIFO módszerrel).\n\nA követelések értékelése: könyv szerinti értéken, szükség esetén értékvesztés elszámolásával.\n\nA pénzeszközök értékelése: könyv szerinti (névleges) értéken.\n\nA kötelezettségek értékelése: könyv szerinti értéken.',
  3, true, 'valuation'
),
(
  'depreciation_methods',
  'IV. Értékcsökkenési leírás módszerei',
  E'A társaság a tárgyi eszközök és immateriális javak után lineáris módszerrel számolja el az értékcsökkenést.\n\nAz alkalmazott leírási kulcsok:\n- Épületek, építmények: 2%\n- Gépek, berendezések: 14,5%\n- Járművek: 20%\n- Számítástechnikai eszközök: 33%\n- Immateriális javak: 16,67%\n- 100.000 Ft alatti eszközök: egyösszegű leírás (használatba vételkor)',
  4, true, 'valuation'
),
(
  'asset_movement',
  'V. Tárgyi eszközök bruttó érték és értékcsökkenés alakulása',
  E'A tárgyi eszközök bruttó értékének és halmozott értékcsökkenésének változását az alábbi táblázat mutatja be.\n\n[AUTOMATIKUS TÁBLÁZAT - TENY MODULBÓL]',
  5, true, 'asset_details'
),
(
  'receivables_info',
  'VI. Követelések és kötelezettségek',
  E'A társaság követelései és kötelezettségei lejárat szerint:\n\n- Éven belüli követelések: a mérlegben szereplő összeg\n- Éven túli követelések: nincs\n- Éven belüli kötelezettségek: a mérlegben szereplő összeg\n- Éven túli kötelezettségek: nincs\n\nA követelések között értékvesztés nem került elszámolásra.',
  6, false, 'asset_details'
),
(
  'equity_changes',
  'VII. Saját tőke változásának bemutatása',
  E'A saját tőke összetevőinek változását az alábbi táblázat mutatja.\n\n[AUTOMATIKUS TÁBLÁZAT - MÉRLEG D. SOROKBÓL]',
  7, true, 'equity'
),
(
  'employee_info',
  'VIII. Létszám- és személyi jellegű ráfordítások',
  E'A társaság foglalkoztatottainak átlagos statisztikai létszáma a tárgyévben: ___ fő.\n\nSzemélyi jellegű ráfordítások:\n- Bérköltség: ___ Ft\n- Személyi jellegű egyéb kifizetések: ___ Ft\n- Bérjárulékok: ___ Ft\n\nA vezető tisztségviselők részére a tárgyévben kifizetett összeg: ___ Ft.',
  8, false, 'other'
),
(
  'off_balance_sheet',
  'IX. Mérlegen kívüli tételek',
  E'A társaságnak a mérleg fordulónapján mérlegen kívüli kötelezettségei és követelései nincsenek.\n\n(Amennyiben vannak, itt kell feltüntetni a pénzügyi lízingek, garanciák, kezességek, stb. összegét.)',
  9, false, 'other'
),
(
  'subsequent_events',
  'X. Mérlegfordulónap utáni események',
  E'A mérleg fordulónapja és a mérlegkészítés időpontja között a társaság vagyoni, pénzügyi és jövedelmi helyzetét érintő lényeges esemény nem történt.\n\n(Amennyiben történt, itt kell bemutatni.)',
  10, false, 'other'
)
ON CONFLICT (section_key) DO NOTHING;


-- 4. Freeze annual data RPC
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
  v_date_to date;
BEGIN
  v_date_to := make_date(p_fiscal_year, 12, 31);

  -- Fetch BS data
  SELECT jsonb_agg(row_to_json(bs))
  INTO v_bs_data
  FROM public.get_bs_report(p_company_id, p_preset_id, v_date_to, p_fiscal_year) bs;

  -- Fetch PNL data
  SELECT jsonb_agg(row_to_json(pnl))
  INTO v_pnl_data
  FROM public.get_pnl_report(p_company_id, p_preset_id, NULL, v_date_to) pnl;

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


-- 5. Validate annual report RPC
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

  -- V2: PNL net income must match BS PNL bridge
  IF ABS(v_pnl_net_income - v_bs_net_income) > 1 THEN
    v_results := v_results || jsonb_build_object(
      'rule_id', 'V2',
      'rule_name', 'P&L - Mérleg összhang',
      'passed', false,
      'severity', 'error',
      'message', format('P&L Adózott eredmény (%s) ≠ Mérleg D/VII (%s)',
        v_pnl_net_income, v_bs_net_income)
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
