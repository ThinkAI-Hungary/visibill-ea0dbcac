-- ============================================================
-- Security Hardening: Admin Module RLS Policies
-- ============================================================
-- Fixes USING(true) / WITH CHECK(true) policies on admin module
-- tables from 20260608_admin_modules.sql
--
-- Fix #4: accounty_gdpr_requests — company_id scoped to assigned accountants
-- Fix #5: accounty_tax_params_global — INSERT/UPDATE restricted to seniors
-- Also hardens: audit_log, templates, job_codes, legal_updates
-- ============================================================


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  1. accounty_audit_log — restrict to assigned companies            ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Keep existing SELECT for own audit entries, but scope it
DROP POLICY IF EXISTS audit_log_select ON public.accounty_audit_log;
DROP POLICY IF EXISTS audit_log_insert ON public.accounty_audit_log;

-- SELECT: user can see audit entries for companies they are assigned to,
-- OR entries they created themselves (user_id match)
CREATE POLICY audit_log_select ON public.accounty_audit_log
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- INSERT: any authenticated user can write their own audit log entries
CREATE POLICY audit_log_insert ON public.accounty_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  2. accounty_gdpr_requests — company_id scoped (Fix #4)            ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS gdpr_select ON public.accounty_gdpr_requests;
DROP POLICY IF EXISTS gdpr_insert ON public.accounty_gdpr_requests;
DROP POLICY IF EXISTS gdpr_update ON public.accounty_gdpr_requests;
DROP POLICY IF EXISTS gdpr_delete ON public.accounty_gdpr_requests;

-- SELECT: only for companies assigned to the accountant
CREATE POLICY gdpr_select ON public.accounty_gdpr_requests
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- INSERT: only for companies assigned to the accountant
CREATE POLICY gdpr_insert ON public.accounty_gdpr_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- UPDATE: only for companies assigned to the accountant
CREATE POLICY gdpr_update ON public.accounty_gdpr_requests
  FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- DELETE: only seniors can delete GDPR requests
CREATE POLICY gdpr_delete ON public.accounty_gdpr_requests
  FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  3. accounty_templates — restrict writes to seniors                ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS templates_select ON public.accounty_templates;
DROP POLICY IF EXISTS templates_insert ON public.accounty_templates;
DROP POLICY IF EXISTS templates_update ON public.accounty_templates;
DROP POLICY IF EXISTS templates_delete ON public.accounty_templates;

-- SELECT: all authenticated accountants can read templates
CREATE POLICY templates_select ON public.accounty_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- INSERT: only seniors
CREATE POLICY templates_insert ON public.accounty_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

-- UPDATE: only seniors
CREATE POLICY templates_update ON public.accounty_templates
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

-- DELETE: only seniors
CREATE POLICY templates_delete ON public.accounty_templates
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

-- Template versions: read for all accountants, insert for seniors
DROP POLICY IF EXISTS template_ver_select ON public.accounty_template_versions;
DROP POLICY IF EXISTS template_ver_insert ON public.accounty_template_versions;

CREATE POLICY template_ver_select ON public.accounty_template_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

CREATE POLICY template_ver_insert ON public.accounty_template_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  4. accounty_job_codes — read for all, write for seniors           ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS job_codes_select ON public.accounty_job_codes;
DROP POLICY IF EXISTS job_codes_insert ON public.accounty_job_codes;
DROP POLICY IF EXISTS job_codes_update ON public.accounty_job_codes;
DROP POLICY IF EXISTS job_codes_delete ON public.accounty_job_codes;

-- SELECT: all authenticated accountants can read
CREATE POLICY job_codes_select ON public.accounty_job_codes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: seniors only
CREATE POLICY job_codes_insert ON public.accounty_job_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

CREATE POLICY job_codes_update ON public.accounty_job_codes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

CREATE POLICY job_codes_delete ON public.accounty_job_codes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  5. accounty_tax_params_global — read for all, write seniors (Fix #5)║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS tax_params_global_select ON public.accounty_tax_params_global;
DROP POLICY IF EXISTS tax_params_global_insert ON public.accounty_tax_params_global;
DROP POLICY IF EXISTS tax_params_global_update ON public.accounty_tax_params_global;

-- SELECT: all authenticated accountants can read global tax params
CREATE POLICY tax_params_global_select ON public.accounty_tax_params_global
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- INSERT: seniors only
CREATE POLICY tax_params_global_insert ON public.accounty_tax_params_global
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

-- UPDATE: seniors only
CREATE POLICY tax_params_global_update ON public.accounty_tax_params_global
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  6. accounty_legal_updates — read for all, write for seniors       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS legal_updates_select ON public.accounty_legal_updates;
DROP POLICY IF EXISTS legal_updates_insert ON public.accounty_legal_updates;
DROP POLICY IF EXISTS legal_updates_update ON public.accounty_legal_updates;
DROP POLICY IF EXISTS legal_updates_delete ON public.accounty_legal_updates;

-- SELECT: all authenticated accountants
CREATE POLICY legal_updates_select ON public.accounty_legal_updates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: seniors only
CREATE POLICY legal_updates_insert ON public.accounty_legal_updates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

CREATE POLICY legal_updates_update ON public.accounty_legal_updates
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

CREATE POLICY legal_updates_delete ON public.accounty_legal_updates
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );
