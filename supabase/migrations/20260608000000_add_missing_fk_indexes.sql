-- ==================================================
-- MERGED FROM: 20260608_add_missing_fk_indexes.sql
-- ==================================================
-- =====================================================
-- Migration: Add missing foreign key indexes
-- Risk: ZERO — indexes only improve performance, never break functionality
-- Note: Run outside transactions for CONCURRENTLY support on production
-- These were applied via execute_sql (without CONCURRENTLY) on 2026-06-08
-- Ref: supabase-postgres-best-practices / schema-foreign-key-indexes
-- =====================================================

-- accounty tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_deadlines_completed_by
  ON public.accounty_deadlines(completed_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_messages_sender_user_id
  ON public.accounty_messages(sender_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_missing_items_ignored_by
  ON public.accounty_missing_items(ignored_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_missing_items_resolved_by
  ON public.accounty_missing_items(resolved_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_payroll_cycles_approved_by
  ON public.accounty_payroll_cycles(approved_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_portal_tokens_created_by
  ON public.accounty_portal_tokens(created_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_timesheets_verified_by
  ON public.accounty_timesheets(verified_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_uploads_uploaded_by
  ON public.accounty_uploads(uploaded_by);

-- bs (balance sheet) tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bs_mapping_bs_structure_id
  ON public.bs_mapping(bs_structure_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bs_mapping_gl_account_id
  ON public.bs_mapping(gl_account_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bs_mapping_preset_id
  ON public.bs_mapping(preset_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bs_mapping_user_id
  ON public.bs_mapping(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bs_prior_year_bs_structure_id
  ON public.bs_prior_year(bs_structure_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bs_prior_year_user_id
  ON public.bs_prior_year(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bs_structure_parent_id
  ON public.bs_structure(parent_id);

-- core tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_project_id
  ON public.invoices(project_id);

-- vat tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vat_return_m_lines_partner_id
  ON public.vat_return_m_lines(partner_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vat_returns_user_id
  ON public.vat_returns(user_id);


-- ==================================================
-- MERGED FROM: 20260608_admin_modules.sql
-- ==================================================
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


-- ==================================================
-- MERGED FROM: 20260608_detected_bank.sql
-- ==================================================
-- Add detected_bank column to transaction_uploads
-- Stores the actually detected/resolved bank type after processing.
-- If user provided bank_hint → worker copies it here.
-- If no hint → worker auto-detects from filename/content.
-- NULL = unknown/undetected.

ALTER TABLE public.transaction_uploads 
  ADD COLUMN IF NOT EXISTS detected_bank TEXT DEFAULT NULL;

COMMENT ON COLUMN public.transaction_uploads.detected_bank IS 
  'Resolved bank type after processing. Set by worker from bank_hint or auto-detection. Values: otp, cib, raiffeisen, kh, erste, unicredit, magnet, granit, wise, revolut, etc.';

-- Index for efficient grouping by bank on the frontend
CREATE INDEX IF NOT EXISTS idx_transaction_uploads_detected_bank 
  ON public.transaction_uploads(company_id, detected_bank) 
  WHERE detected_bank IS NOT NULL;


-- ==================================================
-- MERGED FROM: 20260608_fix_permissive_rls_and_search_path.sql
-- ==================================================
-- =====================================================
-- Migration: Fix permissive RLS + search_path mutable
-- Applied: 2026-06-08
-- =====================================================

-- =====================================================
-- 1. Permissive RLS Fix (USING true → company_id check)
-- =====================================================

-- missing_items: tighten to accountant's companies
DROP POLICY IF EXISTS "missing_items_portal_update_auth" ON public.accounty_missing_items;
CREATE POLICY "missing_items_portal_update_auth" ON public.accounty_missing_items
  FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ))
  WITH CHECK (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ));

-- uploads: tighten update
DROP POLICY IF EXISTS "uploads_auth_update" ON public.accounty_uploads;
CREATE POLICY "uploads_auth_update" ON public.accounty_uploads
  FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ));

-- uploads: tighten insert
DROP POLICY IF EXISTS "uploads_insert" ON public.accounty_uploads;
CREATE POLICY "uploads_insert" ON public.accounty_uploads
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 2. Search Path Fix (all SECURITY DEFINER functions)
-- =====================================================
ALTER FUNCTION public.calculate_vat_return SET search_path TO 'public';
ALTER FUNCTION public.check_request SET search_path TO 'public';
ALTER FUNCTION public.claim_invoice_jobs SET search_path TO 'public';
ALTER FUNCTION public.create_comment_event SET search_path TO 'public';
ALTER FUNCTION public.create_ticket_created_event SET search_path TO 'public';
ALTER FUNCTION public.create_ticket_status_event SET search_path TO 'public';
ALTER FUNCTION public.enqueue_report_job SET search_path TO 'public';
ALTER FUNCTION public.freeze_annual_data SET search_path TO 'public';
ALTER FUNCTION public.generate_ticket_number SET search_path TO 'public';
ALTER FUNCTION public.get_accounty_company_names SET search_path TO 'public';
ALTER FUNCTION public.get_accounty_company_summary SET search_path TO 'public';
ALTER FUNCTION public.get_bs_report SET search_path TO 'public';
ALTER FUNCTION public.get_gl_categorized_items SET search_path TO 'public';
ALTER FUNCTION public.get_invoice_aggregates SET search_path TO 'public';
ALTER FUNCTION public.get_pnl_report SET search_path TO 'public';
ALTER FUNCTION public.get_user_emails_for_management SET search_path TO 'public';
ALTER FUNCTION public.global_audit_trigger_func SET search_path TO 'public';
ALTER FUNCTION public.on_company_created SET search_path TO 'public';
ALTER FUNCTION public.pgmq_archive SET search_path TO 'public';
ALTER FUNCTION public.pgmq_delete SET search_path TO 'public';
ALTER FUNCTION public.pgmq_metrics SET search_path TO 'public';
ALTER FUNCTION public.pgmq_read SET search_path TO 'public';
ALTER FUNCTION public.rematch_courier_report SET search_path TO 'public';
ALTER FUNCTION public.save_bs_mappings SET search_path TO 'public';
ALTER FUNCTION public.save_bs_prior_year SET search_path TO 'public';
ALTER FUNCTION public.trigger_enqueue_gl_job SET search_path TO 'public';
ALTER FUNCTION public.trigger_enqueue_invoice_job SET search_path TO 'public';
ALTER FUNCTION public.trigger_enqueue_transaction_job SET search_path TO 'public';
ALTER FUNCTION public.user_is_company_member SET search_path TO 'public';
ALTER FUNCTION public.validate_annual_report SET search_path TO 'public';
ALTER FUNCTION public.accounty_set_updated_at SET search_path TO 'public';
ALTER FUNCTION public.update_vat_updated_at SET search_path TO 'public';
ALTER FUNCTION public.update_annual_reports_updated_at SET search_path TO 'public';


-- ==================================================
-- MERGED FROM: 20260608_revoke_anon_security_definer.sql
-- ==================================================
-- =====================================================
-- Migration: Revoke anon EXECUTE on SECURITY DEFINER functions
-- Risk: ZERO — frontend uses 'authenticated', worker uses 'service_role'
-- Ref: Supabase Security Advisor + ADR A-017
-- =====================================================

-- =====================================================
-- 1. Business RPC Functions (frontend-hívott)
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.freeze_annual_data(uuid, uuid, uuid, integer, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_annual_report(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pnl_report(uuid, uuid, date, date, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_bs_report(uuid, uuid, date, integer, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_invoice_aggregates FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_bs_mappings(uuid, uuid, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_bs_prior_year(uuid, integer, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rematch_courier_report(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_default_vat_codes FROM anon, PUBLIC;

-- =====================================================
-- 2. Filtered invoice query functions (2 overloads each)
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, numeric, numeric, text, text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date) FROM anon, PUBLIC;

-- =====================================================
-- 3. Management / Admin functions
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.get_user_emails_for_management(uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_accounty_company_summary(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_accounty_company_names(uuid[]) FROM anon, PUBLIC;

-- =====================================================
-- 4. Auth / Helper functions
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.check_request() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_is_company_member(uuid) FROM anon, PUBLIC;

-- =====================================================
-- 5. Queue functions (PGMQ wrappers — worker-only)
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.pgmq_read(text, integer, integer, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pgmq_archive(text, bigint) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pgmq_delete(text, bigint) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pgmq_metrics(text) FROM anon, PUBLIC;

-- =====================================================
-- 6. Trigger / Internal functions (should never be called via REST)
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.global_audit_trigger_func() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_report_job() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_enqueue_gl_job() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_enqueue_invoice_job() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_enqueue_transaction_job() FROM anon, PUBLIC;

-- =====================================================
-- 7. Worker claim functions
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.claim_gl_jobs FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_transaction_jobs FROM anon, PUBLIC;

-- =====================================================
-- 8. Other internal functions
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.on_company_created() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accounty_set_updated_at() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_vat_updated_at() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_annual_reports_updated_at() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_ticket_number() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_ticket_created_event() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_ticket_status_event() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_comment_event() FROM anon, PUBLIC;

-- =====================================================
-- Ensure 'authenticated' role can still EXECUTE business functions
-- (should be inherited from PUBLIC grant, but let's be explicit)
-- =====================================================
GRANT EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.freeze_annual_data(uuid, uuid, uuid, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_annual_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pnl_report(uuid, uuid, date, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bs_report(uuid, uuid, date, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_aggregates TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_bs_mappings(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_bs_prior_year(uuid, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rematch_courier_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_vat_codes TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, numeric, numeric, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_emails_for_management(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accounty_company_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accounty_company_names(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_request() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_company_member(uuid) TO authenticated;


-- ==================================================
-- MERGED FROM: 20260608_rls_initplan_optimization.sql
-- ==================================================
-- =====================================================
-- Migration: RLS InitPlan Optimization
-- Risk: ZERO — functionally identical, only faster execution plan
-- Change: auth.uid() → (select auth.uid()) in all RLS policies
-- Impact: 5-10x faster RLS on large tables
-- Ref: supabase-postgres-best-practices / security-rls-performance
-- =====================================================

-- =====================================================
-- 1. accounty_assignments (3 policies)
-- =====================================================
DROP POLICY IF EXISTS "assignments_delete" ON public.accounty_assignments;
CREATE POLICY "assignments_delete" ON public.accounty_assignments
  FOR DELETE TO authenticated
  USING (accountant_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "assignments_select" ON public.accounty_assignments;
CREATE POLICY "assignments_select" ON public.accounty_assignments
  FOR SELECT TO authenticated
  USING (accountant_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "assignments_update" ON public.accounty_assignments;
CREATE POLICY "assignments_update" ON public.accounty_assignments
  FOR UPDATE TO authenticated
  USING (accountant_user_id = (SELECT auth.uid()));

-- =====================================================
-- 2. accounty_audit_log (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "accounty_audit_log_select" ON public.accounty_audit_log;
CREATE POLICY "accounty_audit_log_select" ON public.accounty_audit_log
  FOR SELECT TO authenticated
  USING (
    ((company_id IS NOT NULL) AND is_company_member_or_above(company_id))
    OR ((company_id IS NOT NULL) AND (EXISTS (
      SELECT 1 FROM accounty_assignments aa
      WHERE aa.company_id = accounty_audit_log.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    )))
    OR (user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "accounty_audit_log_insert" ON public.accounty_audit_log;
CREATE POLICY "accounty_audit_log_insert" ON public.accounty_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- =====================================================
-- 3. accounty_cafeteria (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "accounty_cafeteria_modify" ON public.accounty_cafeteria;
CREATE POLICY "accounty_cafeteria_modify" ON public.accounty_cafeteria
  FOR ALL TO authenticated
  USING (employment_id IN (
    SELECT emp.id FROM accounty_employments emp
    WHERE emp.company_id IN (
      SELECT aa.company_id FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  ));

DROP POLICY IF EXISTS "accounty_cafeteria_select" ON public.accounty_cafeteria;
CREATE POLICY "accounty_cafeteria_select" ON public.accounty_cafeteria
  FOR SELECT TO authenticated
  USING (employment_id IN (
    SELECT emp.id FROM accounty_employments emp
    WHERE emp.company_id IN (
      SELECT aa.company_id FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  ));

-- =====================================================
-- 4. accounty_communication_preferences (1 policy)
-- =====================================================
DROP POLICY IF EXISTS "comm_prefs_select" ON public.accounty_communication_preferences;
CREATE POLICY "comm_prefs_select" ON public.accounty_communication_preferences
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 5. accounty_deadlines (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "deadlines_select" ON public.accounty_deadlines;
CREATE POLICY "deadlines_select" ON public.accounty_deadlines
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "deadlines_update" ON public.accounty_deadlines;
CREATE POLICY "deadlines_update" ON public.accounty_deadlines
  FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 6. accounty_declarations (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "accounty_declarations_modify" ON public.accounty_declarations;
CREATE POLICY "accounty_declarations_modify" ON public.accounty_declarations
  FOR ALL TO authenticated
  USING (employee_id IN (
    SELECT e.id FROM accounty_employees e
    WHERE e.company_id IN (
      SELECT aa.company_id FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  ));

DROP POLICY IF EXISTS "accounty_declarations_select" ON public.accounty_declarations;
CREATE POLICY "accounty_declarations_select" ON public.accounty_declarations
  FOR SELECT TO authenticated
  USING (employee_id IN (
    SELECT e.id FROM accounty_employees e
    WHERE e.company_id IN (
      SELECT aa.company_id FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  ));

-- =====================================================
-- 7. accounty_employees (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "accounty_employees_modify" ON public.accounty_employees;
CREATE POLICY "accounty_employees_modify" ON public.accounty_employees
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "accounty_employees_select" ON public.accounty_employees;
CREATE POLICY "accounty_employees_select" ON public.accounty_employees
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 8. accounty_employments (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "accounty_employments_modify" ON public.accounty_employments;
CREATE POLICY "accounty_employments_modify" ON public.accounty_employments
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "accounty_employments_select" ON public.accounty_employments;
CREATE POLICY "accounty_employments_select" ON public.accounty_employments
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 9. accounty_filings (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "accounty_filings_modify" ON public.accounty_filings;
CREATE POLICY "accounty_filings_modify" ON public.accounty_filings
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "accounty_filings_select" ON public.accounty_filings;
CREATE POLICY "accounty_filings_select" ON public.accounty_filings
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 10. accounty_garnishments (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "accounty_garnishments_modify" ON public.accounty_garnishments;
CREATE POLICY "accounty_garnishments_modify" ON public.accounty_garnishments
  FOR ALL TO authenticated
  USING (employee_id IN (
    SELECT e.id FROM accounty_employees e
    WHERE e.company_id IN (
      SELECT aa.company_id FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  ));

DROP POLICY IF EXISTS "accounty_garnishments_select" ON public.accounty_garnishments;
CREATE POLICY "accounty_garnishments_select" ON public.accounty_garnishments
  FOR SELECT TO authenticated
  USING (employee_id IN (
    SELECT e.id FROM accounty_employees e
    WHERE e.company_id IN (
      SELECT aa.company_id FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  ));

-- =====================================================
-- 11. accounty_leaves (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "accounty_leaves_modify" ON public.accounty_leaves;
CREATE POLICY "accounty_leaves_modify" ON public.accounty_leaves
  FOR ALL TO authenticated
  USING (employment_id IN (
    SELECT emp.id FROM accounty_employments emp
    WHERE emp.company_id IN (
      SELECT aa.company_id FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  ));

DROP POLICY IF EXISTS "accounty_leaves_select" ON public.accounty_leaves;
CREATE POLICY "accounty_leaves_select" ON public.accounty_leaves
  FOR SELECT TO authenticated
  USING (employment_id IN (
    SELECT emp.id FROM accounty_employments emp
    WHERE emp.company_id IN (
      SELECT aa.company_id FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  ));

-- =====================================================
-- 12. accounty_messages (4 policies)
-- =====================================================
DROP POLICY IF EXISTS "accounty_messages_delete" ON public.accounty_messages;
CREATE POLICY "accounty_messages_delete" ON public.accounty_messages
  FOR DELETE TO authenticated
  USING (sender_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "accounty_messages_select" ON public.accounty_messages;
CREATE POLICY "accounty_messages_select" ON public.accounty_messages
  FOR SELECT TO authenticated
  USING (
    is_company_member_or_above(company_id)
    OR (EXISTS (
      SELECT 1 FROM accounty_assignments aa
      WHERE aa.company_id = accounty_messages.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
  );

DROP POLICY IF EXISTS "accounty_messages_update" ON public.accounty_messages;
CREATE POLICY "accounty_messages_update" ON public.accounty_messages
  FOR UPDATE TO authenticated
  USING (sender_user_id = (SELECT auth.uid()))
  WITH CHECK (sender_user_id = (SELECT auth.uid()));

-- =====================================================
-- 13. accounty_missing_items (2 policies — NOT the portal ones)
-- =====================================================
DROP POLICY IF EXISTS "missing_items_select" ON public.accounty_missing_items;
CREATE POLICY "missing_items_select" ON public.accounty_missing_items
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "missing_items_update" ON public.accounty_missing_items;
CREATE POLICY "missing_items_update" ON public.accounty_missing_items
  FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 14. accounty_payroll_calculations (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "accounty_payroll_calculations_modify" ON public.accounty_payroll_calculations;
CREATE POLICY "accounty_payroll_calculations_modify" ON public.accounty_payroll_calculations
  FOR ALL TO authenticated
  USING (cycle_id IN (
    SELECT c.id FROM accounty_payroll_cycles c
    WHERE c.company_id IN (
      SELECT aa.company_id FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  ));

DROP POLICY IF EXISTS "accounty_payroll_calculations_select" ON public.accounty_payroll_calculations;
CREATE POLICY "accounty_payroll_calculations_select" ON public.accounty_payroll_calculations
  FOR SELECT TO authenticated
  USING (cycle_id IN (
    SELECT c.id FROM accounty_payroll_cycles c
    WHERE c.company_id IN (
      SELECT aa.company_id FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  ));

-- =====================================================
-- 15. accounty_payroll_cycles (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "accounty_payroll_cycles_modify" ON public.accounty_payroll_cycles;
CREATE POLICY "accounty_payroll_cycles_modify" ON public.accounty_payroll_cycles
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "accounty_payroll_cycles_select" ON public.accounty_payroll_cycles;
CREATE POLICY "accounty_payroll_cycles_select" ON public.accounty_payroll_cycles
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 16. accounty_payroll_items (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "accounty_payroll_items_modify" ON public.accounty_payroll_items;
CREATE POLICY "accounty_payroll_items_modify" ON public.accounty_payroll_items
  FOR ALL TO authenticated
  USING (cycle_id IN (
    SELECT c.id FROM accounty_payroll_cycles c
    WHERE c.company_id IN (
      SELECT aa.company_id FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  ));

DROP POLICY IF EXISTS "accounty_payroll_items_select" ON public.accounty_payroll_items;
CREATE POLICY "accounty_payroll_items_select" ON public.accounty_payroll_items
  FOR SELECT TO authenticated
  USING (cycle_id IN (
    SELECT c.id FROM accounty_payroll_cycles c
    WHERE c.company_id IN (
      SELECT aa.company_id FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  ));

-- =====================================================
-- 17. accounty_portal_tokens (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "portal_tokens_select" ON public.accounty_portal_tokens;
CREATE POLICY "portal_tokens_select" ON public.accounty_portal_tokens
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "portal_tokens_insert" ON public.accounty_portal_tokens;
CREATE POLICY "portal_tokens_insert" ON public.accounty_portal_tokens
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 18. accounty_tax_profiles (3 policies)
-- =====================================================
DROP POLICY IF EXISTS "tax_profiles_select" ON public.accounty_tax_profiles;
CREATE POLICY "tax_profiles_select" ON public.accounty_tax_profiles
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "tax_profiles_update" ON public.accounty_tax_profiles;
CREATE POLICY "tax_profiles_update" ON public.accounty_tax_profiles
  FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "tax_profiles_insert" ON public.accounty_tax_profiles;
CREATE POLICY "tax_profiles_insert" ON public.accounty_tax_profiles
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 19. accounty_timesheets (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "accounty_timesheets_modify" ON public.accounty_timesheets;
CREATE POLICY "accounty_timesheets_modify" ON public.accounty_timesheets
  FOR ALL TO authenticated
  USING (cycle_id IN (
    SELECT c.id FROM accounty_payroll_cycles c
    WHERE c.company_id IN (
      SELECT aa.company_id FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  ));

DROP POLICY IF EXISTS "accounty_timesheets_select" ON public.accounty_timesheets;
CREATE POLICY "accounty_timesheets_select" ON public.accounty_timesheets
  FOR SELECT TO authenticated
  USING (cycle_id IN (
    SELECT c.id FROM accounty_payroll_cycles c
    WHERE c.company_id IN (
      SELECT aa.company_id FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  ));

-- =====================================================
-- 20. bs_mapping (4 policies)
-- =====================================================
DROP POLICY IF EXISTS "bs_mapping_delete" ON public.bs_mapping;
CREATE POLICY "bs_mapping_delete" ON public.bs_mapping
  FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT company_members.company_id FROM company_members
    WHERE company_members.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "bs_mapping_read" ON public.bs_mapping;
CREATE POLICY "bs_mapping_read" ON public.bs_mapping
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_members.company_id FROM company_members
    WHERE company_members.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "bs_mapping_update" ON public.bs_mapping;
CREATE POLICY "bs_mapping_update" ON public.bs_mapping
  FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT company_members.company_id FROM company_members
    WHERE company_members.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "bs_mapping_insert" ON public.bs_mapping;
CREATE POLICY "bs_mapping_insert" ON public.bs_mapping
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT company_members.company_id FROM company_members
    WHERE company_members.user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 21. bs_prior_year (4 policies)
-- =====================================================
DROP POLICY IF EXISTS "bs_prior_year_delete" ON public.bs_prior_year;
CREATE POLICY "bs_prior_year_delete" ON public.bs_prior_year
  FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT company_members.company_id FROM company_members
    WHERE company_members.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "bs_prior_year_read" ON public.bs_prior_year;
CREATE POLICY "bs_prior_year_read" ON public.bs_prior_year
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_members.company_id FROM company_members
    WHERE company_members.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "bs_prior_year_update" ON public.bs_prior_year;
CREATE POLICY "bs_prior_year_update" ON public.bs_prior_year
  FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT company_members.company_id FROM company_members
    WHERE company_members.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "bs_prior_year_insert" ON public.bs_prior_year;
CREATE POLICY "bs_prior_year_insert" ON public.bs_prior_year
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT company_members.company_id FROM company_members
    WHERE company_members.user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 22. companies (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "Accountants can view assigned companies" ON public.companies;
CREATE POLICY "Accountants can view assigned companies" ON public.companies
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM accounty_assignments
    WHERE accounty_assignments.company_id = companies.id
      AND accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Users can view companies" ON public.companies;
CREATE POLICY "Users can view companies" ON public.companies
  FOR SELECT TO authenticated
  USING (
    ((SELECT auth.uid()) = owner_id)
    OR (EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = companies.id AND cm.user_id = (SELECT auth.uid())
    ))
    OR (EXISTS (
      SELECT 1 FROM accounty_assignments aa
      WHERE aa.company_id = companies.id AND aa.accountant_user_id = (SELECT auth.uid())
    ))
  );

-- =====================================================
-- 23. company_members (1 policy)
-- =====================================================
DROP POLICY IF EXISTS "Members can delete memberships" ON public.company_members;
CREATE POLICY "Members can delete memberships" ON public.company_members
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR is_company_admin(company_id));

-- =====================================================
-- 24. employee_rates (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "Users can view employee_rates" ON public.employee_rates;
CREATE POLICY "Users can view employee_rates" ON public.employee_rates
  FOR SELECT TO authenticated
  USING (is_company_member_or_above(company_id) OR (user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can update employee_rates" ON public.employee_rates;
CREATE POLICY "Users can update employee_rates" ON public.employee_rates
  FOR UPDATE TO authenticated
  USING (is_company_admin(company_id) OR ((user_id IS NULL) AND (registration_token IS NOT NULL)))
  WITH CHECK (is_company_admin(company_id) OR (user_id = (SELECT auth.uid())));

-- =====================================================
-- 25. invoice_items (1 policy)
-- =====================================================
DROP POLICY IF EXISTS "Members can manage invoice items" ON public.invoice_items;
CREATE POLICY "Members can manage invoice items" ON public.invoice_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices i
    JOIN company_members cm ON cm.company_id = i.company_id
    WHERE i.id = invoice_items.invoice_id AND cm.user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 26. invoices (1 policy)
-- =====================================================
DROP POLICY IF EXISTS "Accountants can view assigned company invoices" ON public.invoices;
CREATE POLICY "Accountants can view assigned company invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM accounty_assignments
    WHERE accounty_assignments.company_id = invoices.company_id
      AND accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 27. nav_invoices (1 policy)
-- =====================================================
DROP POLICY IF EXISTS "Accountants can view assigned NAV invoices" ON public.nav_invoices;
CREATE POLICY "Accountants can view assigned NAV invoices" ON public.nav_invoices
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM accounty_assignments
    WHERE accounty_assignments.company_id = nav_invoices.company_id
      AND accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 28. nav_invoice_items (1 policy)
-- =====================================================
DROP POLICY IF EXISTS "Members can manage nav invoice items" ON public.nav_invoice_items;
CREATE POLICY "Members can manage nav invoice items" ON public.nav_invoice_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM nav_invoices ni
    JOIN company_members cm ON cm.company_id = ni.company_id
    WHERE ni.id = nav_invoice_items.nav_invoice_id AND cm.user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 29. outgoing_emails (1 policy)
-- =====================================================
DROP POLICY IF EXISTS "Users can view own outgoing emails" ON public.outgoing_emails;
CREATE POLICY "Users can view own outgoing emails" ON public.outgoing_emails
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- =====================================================
-- 30. profiles (1 policy)
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);  -- This is intentionally permissive (public profiles)

-- =====================================================
-- 31. ticket_reads (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "Users can update own reads" ON public.ticket_reads;
CREATE POLICY "Users can update own reads" ON public.ticket_reads
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own reads" ON public.ticket_reads;
CREATE POLICY "Users can view own reads" ON public.ticket_reads
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- =====================================================
-- 32. transaction_invoice_matches (2 policies)
-- =====================================================
DROP POLICY IF EXISTS "Members can delete transaction_invoice_matches" ON public.transaction_invoice_matches;
CREATE POLICY "Members can delete transaction_invoice_matches" ON public.transaction_invoice_matches
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM transactions t
    JOIN company_members cm ON cm.company_id = t.company_id
    WHERE t.id = transaction_invoice_matches.transaction_id
      AND cm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Members can view transaction_invoice_matches" ON public.transaction_invoice_matches;
CREATE POLICY "Members can view transaction_invoice_matches" ON public.transaction_invoice_matches
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM transactions t
    JOIN company_members cm ON cm.company_id = t.company_id
    WHERE t.id = transaction_invoice_matches.transaction_id
      AND cm.user_id = (SELECT auth.uid())
  ));
