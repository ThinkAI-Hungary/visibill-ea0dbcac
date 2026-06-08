-- ============================================================
-- Accounty Admin Modules — Database Schema
-- ============================================================

-- 12.3 Audit Log
CREATE TABLE IF NOT EXISTS public.accounty_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('login','logout','create','update','delete','submit','export','view','upload','resolve','send_email','approve','reject')),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user ON public.accounty_audit_log(user_id);
CREATE INDEX idx_audit_log_company ON public.accounty_audit_log(company_id);
CREATE INDEX idx_audit_log_event ON public.accounty_audit_log(event_type);
CREATE INDEX idx_audit_log_entity ON public.accounty_audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON public.accounty_audit_log(created_at DESC);

ALTER TABLE public.accounty_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_select ON public.accounty_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY audit_log_insert ON public.accounty_audit_log FOR INSERT TO authenticated WITH CHECK (true);


-- 12.4 GDPR Requests
CREATE TABLE IF NOT EXISTS public.accounty_gdpr_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.payroll_employees(id) ON DELETE SET NULL,
  employee_name TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('access','rectification','restriction','deletion')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','rejected')),
  notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gdpr_requests_company ON public.accounty_gdpr_requests(company_id);
CREATE INDEX idx_gdpr_requests_status ON public.accounty_gdpr_requests(status);

ALTER TABLE public.accounty_gdpr_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY gdpr_select ON public.accounty_gdpr_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY gdpr_insert ON public.accounty_gdpr_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY gdpr_update ON public.accounty_gdpr_requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY gdpr_delete ON public.accounty_gdpr_requests FOR DELETE TO authenticated USING (true);


-- 12.5 Templates
CREATE TABLE IF NOT EXISTS public.accounty_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('data_request','missing_docs','payslip','monthly_docs','m30','custom')),
  name TEXT NOT NULL,
  subject TEXT,
  body_markdown TEXT NOT NULL DEFAULT '',
  body_html TEXT,
  variables JSONB DEFAULT '[]',
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_category ON public.accounty_templates(category);

ALTER TABLE public.accounty_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY templates_select ON public.accounty_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY templates_insert ON public.accounty_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY templates_update ON public.accounty_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY templates_delete ON public.accounty_templates FOR DELETE TO authenticated USING (true);


-- 12.5 Template Versions
CREATE TABLE IF NOT EXISTS public.accounty_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.accounty_templates(id) ON DELETE CASCADE,
  version INT NOT NULL,
  body_markdown TEXT NOT NULL,
  body_html TEXT,
  subject TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_template_versions_template ON public.accounty_template_versions(template_id);

ALTER TABLE public.accounty_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_ver_select ON public.accounty_template_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY template_ver_insert ON public.accounty_template_versions FOR INSERT TO authenticated WITH CHECK (true);


-- 12.6 Job Codes
CREATE TABLE IF NOT EXISTS public.accounty_job_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_insured BOOLEAN NOT NULL DEFAULT true,
  min_contribution_rule TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from DATE,
  valid_to DATE,
  nav_reference_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(code, valid_from)
);

CREATE INDEX idx_job_codes_code ON public.accounty_job_codes(code);
CREATE INDEX idx_job_codes_active ON public.accounty_job_codes(is_active);

ALTER TABLE public.accounty_job_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_codes_select ON public.accounty_job_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY job_codes_insert ON public.accounty_job_codes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY job_codes_update ON public.accounty_job_codes FOR UPDATE TO authenticated USING (true);
CREATE POLICY job_codes_delete ON public.accounty_job_codes FOR DELETE TO authenticated USING (true);


-- 12.7 Global Tax Parameters
CREATE TABLE IF NOT EXISTS public.accounty_tax_params_global (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  key TEXT NOT NULL,
  value NUMERIC NOT NULL,
  legal_reference TEXT,
  valid_from DATE,
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year, key)
);

CREATE INDEX idx_tax_params_global_year ON public.accounty_tax_params_global(year);

ALTER TABLE public.accounty_tax_params_global ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_params_global_select ON public.accounty_tax_params_global FOR SELECT TO authenticated USING (true);
CREATE POLICY tax_params_global_insert ON public.accounty_tax_params_global FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tax_params_global_update ON public.accounty_tax_params_global FOR UPDATE TO authenticated USING (true);


-- 12.8 Legal Updates
CREATE TABLE IF NOT EXISTS public.accounty_legal_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('kozlony','nav','egyeb')),
  published_at DATE,
  affected_modules TEXT[] DEFAULT '{}',
  implementation_status TEXT NOT NULL DEFAULT 'planned' CHECK (implementation_status IN ('planned','in_progress','deployed')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_legal_updates_status ON public.accounty_legal_updates(implementation_status);
CREATE INDEX idx_legal_updates_published ON public.accounty_legal_updates(published_at DESC);

ALTER TABLE public.accounty_legal_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY legal_updates_select ON public.accounty_legal_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY legal_updates_insert ON public.accounty_legal_updates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY legal_updates_update ON public.accounty_legal_updates FOR UPDATE TO authenticated USING (true);
CREATE POLICY legal_updates_delete ON public.accounty_legal_updates FOR DELETE TO authenticated USING (true);


-- ============================================================
-- SEED: Job Codes (12.6)
-- ============================================================
INSERT INTO public.accounty_job_codes (code, name, is_insured, min_contribution_rule, is_active, valid_from, notes) VALUES
  ('1101', 'Munkaviszony (általános)', true, 'Minimálbér/garantált bérminimum', true, '2020-01-01', 'Leggyakoribb jogviszony'),
  ('1102', 'Munkaviszony (egyszerűsített)', true, 'Minimálbér', true, '2020-01-01', 'Egyszerűsített foglalkoztatás'),
  ('1103', 'Bedolgozói jogviszony', true, 'Minimálbér', true, '2020-01-01', NULL),
  ('1104', 'Megbízási szerződés (biztosított)', true, 'Minimálbér 30%', true, '2020-01-01', 'Havi díj >= minimálbér 30%'),
  ('1105', 'Megbízási szerződés (nem biztosított)', false, NULL, true, '2020-01-01', 'Havi díj < minimálbér 30%'),
  ('1106', 'Vállalkozási szerződés', false, NULL, true, '2020-01-01', NULL),
  ('1107', 'Társas vállalkozó (főfoglalkozású)', true, 'Minimálbér/garantált bérminimum', true, '2020-01-01', NULL),
  ('1108', 'Társas vállalkozó (mellékfoglalkozású)', true, NULL, true, '2020-01-01', NULL),
  ('1109', 'Egyéni vállalkozó (főfoglalkozású)', true, 'Minimálbér/garantált bérminimum', true, '2020-01-01', NULL),
  ('1110', 'Egyéni vállalkozó (mellékfoglalkozású)', true, NULL, true, '2020-01-01', NULL),
  ('1111', 'Közfoglalkoztatott', true, 'Közfoglalkoztatási bér', true, '2020-01-01', NULL),
  ('1112', 'Ösztöndíjas foglalkoztatott', true, 'Minimálbér', true, '2020-01-01', NULL),
  ('1113', 'Háztartási alkalmazott', true, NULL, true, '2020-01-01', NULL),
  ('1114', 'Iskolaszövetkezeti tag', true, NULL, true, '2020-01-01', NULL),
  ('1115', 'Tartós megbízási jogviszony', true, 'Minimálbér 30%', true, '2026-01-01', 'Új kód 2026.01.01-től – tartós megbízás'),
  ('1116', 'Választott tisztségviselő', false, NULL, true, '2020-01-01', NULL),
  ('1117', 'Szövetkezeti tag munkavégzése', true, NULL, true, '2020-01-01', NULL),
  ('1118', 'Nevelőszülői jogviszony', true, NULL, true, '2020-01-01', NULL),
  ('1119', 'Mezőgazdasági alkalmi munka', false, NULL, true, '2020-01-01', 'EFO jellegű'),
  ('1120', 'Filmipari statiszta', false, NULL, true, '2020-01-01', 'EFO filmipari')
ON CONFLICT (code, valid_from) DO NOTHING;


-- ============================================================
-- SEED: Global Tax Parameters 2026 (12.7)
-- ============================================================
INSERT INTO public.accounty_tax_params_global (year, key, value, legal_reference, valid_from) VALUES
  (2026, 'minimum_wage', 322800, '426/2025. Korm. r.', '2026-01-01'),
  (2026, 'guaranteed_minimum', 373200, '426/2025. Korm. r.', '2026-01-01'),
  (2026, 'szja_rate', 0.15, 'Szja tv.', '2026-01-01'),
  (2026, 'tb_rate', 0.185, 'Tbj.', '2026-01-01'),
  (2026, 'szocho_rate', 0.13, 'Szocho tv.', '2026-01-01'),
  (2026, 'ev_minimum_multiplier', 1.0, 'Szocho tv. 2026 mód.', '2026-01-01'),
  (2026, 'family_1_child', 20000, 'Szja tv. 2026 dupl.', '2026-01-01'),
  (2026, 'family_2_children', 40000, 'Szja tv. 2026 dupl.', '2026-01-01'),
  (2026, 'family_3plus_children', 66000, 'Szja tv. 2026 dupl.', '2026-01-01'),
  (2026, 'young_25_cap', 715765, 'Szja tv. 29/F. §', '2026-01-01'),
  (2026, 'personal_disability', 107600, 'Szja tv. 29/E. §', '2026-01-01'),
  (2026, 'first_marriage', 33335, 'Szja tv. 29/C. §', '2026-01-01'),
  (2026, 'health_service_monthly', 12300, 'Tbj.', '2026-01-01'),
  (2026, 'efo_daily_tax', 4800, 'Efo tv.', '2026-01-01'),
  (2026, 'efo_min_hourly_unskilled', 1578, 'Efo tv.', '2026-01-01'),
  (2026, 'efo_min_hourly_skilled', 1866, 'Efo tv.', '2026-01-01'),
  (2026, 'remote_work_allowance', 32280, 'Szja tv. 3. sz. mell.', '2026-01-01'),
  (2026, 'szep_recreation_annual', 450000, 'Szja tv.', '2026-01-01'),
  (2026, 'szep_active_annual', 120000, 'Szja tv. 2025', '2026-01-01'),
  (2026, 'housing_support_monthly', 150000, 'Szja tv.', '2026-01-01'),
  (2026, 'rehab_penalty_per_person', 2905200, 'minimálbér × 9', '2026-01-01'),
  (2026, 'szocho_capital_cap', 7747200, 'minimálbér × 24', '2026-01-01')
ON CONFLICT (year, key) DO NOTHING;
