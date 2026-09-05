-- ============================================================================
-- Migration: Batch 4 - Optimize RLS InitPlan (Accounty Core Master Data)
-- Date: 2026-09-05
-- Tables:
--   1. accounty_cost_centers (4 policies)
--   2. accounty_data_contracts (4 policies)
--   3. accounty_departments (4 policies)
--   4. accounty_documents (4 policies)
--   5. accounty_employee_jobs (4 policies)
--   6. accounty_nav_representations (4 policies)
--   7. accounty_retention_rules (4 policies)
--   8. accounty_sites (4 policies)
--   9. accounty_job_codes (4 policies)
--  10. accounty_legal_updates (4 policies)
-- Target Policies: ~39 InitPlan warnings resolved
-- Standards: ADR A-003, A-016, A-017, Supabase Postgres Best Practices
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. accounty_cost_centers
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_cost_centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cc_select" ON public.accounty_cost_centers;
DROP POLICY IF EXISTS "cc_insert" ON public.accounty_cost_centers;
DROP POLICY IF EXISTS "cc_update" ON public.accounty_cost_centers;
DROP POLICY IF EXISTS "cc_delete" ON public.accounty_cost_centers;
DROP POLICY IF EXISTS "accounty_cost_centers_service_role_all" ON public.accounty_cost_centers;

CREATE POLICY "cc_select"
  ON public.accounty_cost_centers
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_cost_centers.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_cost_centers.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "cc_insert"
  ON public.accounty_cost_centers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_cost_centers.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_cost_centers.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "cc_update"
  ON public.accounty_cost_centers
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_cost_centers.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_cost_centers.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_cost_centers.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_cost_centers.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "cc_delete"
  ON public.accounty_cost_centers
  FOR DELETE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_cost_centers.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_cost_centers.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_cost_centers_service_role_all"
  ON public.accounty_cost_centers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 2. accounty_data_contracts
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_data_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_contracts_select" ON public.accounty_data_contracts;
DROP POLICY IF EXISTS "data_contracts_insert" ON public.accounty_data_contracts;
DROP POLICY IF EXISTS "data_contracts_update" ON public.accounty_data_contracts;
DROP POLICY IF EXISTS "data_contracts_delete" ON public.accounty_data_contracts;
DROP POLICY IF EXISTS "accounty_data_contracts_service_role_all" ON public.accounty_data_contracts;

CREATE POLICY "data_contracts_select"
  ON public.accounty_data_contracts
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_data_contracts.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_data_contracts.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "data_contracts_insert"
  ON public.accounty_data_contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_data_contracts.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_data_contracts.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "data_contracts_update"
  ON public.accounty_data_contracts
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_data_contracts.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_data_contracts.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_data_contracts.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_data_contracts.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "data_contracts_delete"
  ON public.accounty_data_contracts
  FOR DELETE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_data_contracts.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_data_contracts.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_data_contracts_service_role_all"
  ON public.accounty_data_contracts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3. accounty_departments
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "depts_select" ON public.accounty_departments;
DROP POLICY IF EXISTS "depts_insert" ON public.accounty_departments;
DROP POLICY IF EXISTS "depts_update" ON public.accounty_departments;
DROP POLICY IF EXISTS "depts_delete" ON public.accounty_departments;
DROP POLICY IF EXISTS "accounty_departments_service_role_all" ON public.accounty_departments;

CREATE POLICY "depts_select"
  ON public.accounty_departments
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_departments.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_departments.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "depts_insert"
  ON public.accounty_departments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_departments.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_departments.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "depts_update"
  ON public.accounty_departments
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_departments.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_departments.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_departments.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_departments.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "depts_delete"
  ON public.accounty_departments
  FOR DELETE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_departments.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_departments.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_departments_service_role_all"
  ON public.accounty_departments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. accounty_documents
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_select" ON public.accounty_documents;
DROP POLICY IF EXISTS "doc_insert" ON public.accounty_documents;
DROP POLICY IF EXISTS "doc_update" ON public.accounty_documents;
DROP POLICY IF EXISTS "doc_delete" ON public.accounty_documents;
DROP POLICY IF EXISTS "accounty_documents_service_role_all" ON public.accounty_documents;

CREATE POLICY "doc_select"
  ON public.accounty_documents
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_documents.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_documents.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "doc_insert"
  ON public.accounty_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_documents.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_documents.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "doc_update"
  ON public.accounty_documents
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_documents.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_documents.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_documents.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_documents.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "doc_delete"
  ON public.accounty_documents
  FOR DELETE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_documents.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_documents.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_documents_service_role_all"
  ON public.accounty_documents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. accounty_employee_jobs
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_employee_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ej_select" ON public.accounty_employee_jobs;
DROP POLICY IF EXISTS "ej_insert" ON public.accounty_employee_jobs;
DROP POLICY IF EXISTS "ej_update" ON public.accounty_employee_jobs;
DROP POLICY IF EXISTS "ej_delete" ON public.accounty_employee_jobs;
DROP POLICY IF EXISTS "accounty_employee_jobs_service_role_all" ON public.accounty_employee_jobs;

CREATE POLICY "ej_select"
  ON public.accounty_employee_jobs
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_employee_jobs.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_employee_jobs.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "ej_insert"
  ON public.accounty_employee_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_employee_jobs.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_employee_jobs.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "ej_update"
  ON public.accounty_employee_jobs
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_employee_jobs.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_employee_jobs.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_employee_jobs.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_employee_jobs.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "ej_delete"
  ON public.accounty_employee_jobs
  FOR DELETE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_employee_jobs.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_employee_jobs.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_employee_jobs_service_role_all"
  ON public.accounty_employee_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 6. accounty_nav_representations
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_nav_representations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nav_rep_select" ON public.accounty_nav_representations;
DROP POLICY IF EXISTS "nav_rep_insert" ON public.accounty_nav_representations;
DROP POLICY IF EXISTS "nav_rep_update" ON public.accounty_nav_representations;
DROP POLICY IF EXISTS "nav_rep_delete" ON public.accounty_nav_representations;
DROP POLICY IF EXISTS "accounty_nav_representations_service_role_all" ON public.accounty_nav_representations;

CREATE POLICY "nav_rep_select"
  ON public.accounty_nav_representations
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_nav_representations.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_nav_representations.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "nav_rep_insert"
  ON public.accounty_nav_representations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_nav_representations.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_nav_representations.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "nav_rep_update"
  ON public.accounty_nav_representations
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_nav_representations.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_nav_representations.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_nav_representations.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_nav_representations.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "nav_rep_delete"
  ON public.accounty_nav_representations
  FOR DELETE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_nav_representations.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_nav_representations.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_nav_representations_service_role_all"
  ON public.accounty_nav_representations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 7. accounty_retention_rules
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_retention_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ret_rules_select" ON public.accounty_retention_rules;
DROP POLICY IF EXISTS "ret_rules_insert" ON public.accounty_retention_rules;
DROP POLICY IF EXISTS "ret_rules_update" ON public.accounty_retention_rules;
DROP POLICY IF EXISTS "ret_rules_delete" ON public.accounty_retention_rules;
DROP POLICY IF EXISTS "accounty_retention_rules_service_role_all" ON public.accounty_retention_rules;

CREATE POLICY "ret_rules_select"
  ON public.accounty_retention_rules
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_retention_rules.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_retention_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "ret_rules_insert"
  ON public.accounty_retention_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_retention_rules.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_retention_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "ret_rules_update"
  ON public.accounty_retention_rules
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_retention_rules.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_retention_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_retention_rules.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_retention_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "ret_rules_delete"
  ON public.accounty_retention_rules
  FOR DELETE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_retention_rules.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_retention_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_retention_rules_service_role_all"
  ON public.accounty_retention_rules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 8. accounty_sites
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sites_select" ON public.accounty_sites;
DROP POLICY IF EXISTS "sites_insert" ON public.accounty_sites;
DROP POLICY IF EXISTS "sites_update" ON public.accounty_sites;
DROP POLICY IF EXISTS "sites_delete" ON public.accounty_sites;
DROP POLICY IF EXISTS "accounty_sites_service_role_all" ON public.accounty_sites;

CREATE POLICY "sites_select"
  ON public.accounty_sites
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_sites.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_sites.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "sites_insert"
  ON public.accounty_sites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_sites.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_sites.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "sites_update"
  ON public.accounty_sites
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_sites.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_sites.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_sites.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_sites.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "sites_delete"
  ON public.accounty_sites
  FOR DELETE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_sites.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_sites.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_sites_service_role_all"
  ON public.accounty_sites
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 9. accounty_job_codes (Global reference table)
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_job_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounty_job_codes_select" ON public.accounty_job_codes;
DROP POLICY IF EXISTS "job_codes_select" ON public.accounty_job_codes;
DROP POLICY IF EXISTS "job_codes_insert" ON public.accounty_job_codes;
DROP POLICY IF EXISTS "job_codes_update" ON public.accounty_job_codes;
DROP POLICY IF EXISTS "job_codes_delete" ON public.accounty_job_codes;
DROP POLICY IF EXISTS "accounty_job_codes_service_role_all" ON public.accounty_job_codes;

-- All authenticated users can view job codes (single permissive policy)
CREATE POLICY "job_codes_select"
  ON public.accounty_job_codes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "job_codes_insert"
  ON public.accounty_job_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'senior'::text
    )
  );

CREATE POLICY "job_codes_update"
  ON public.accounty_job_codes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'senior'::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'senior'::text
    )
  );

CREATE POLICY "job_codes_delete"
  ON public.accounty_job_codes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'senior'::text
    )
  );

CREATE POLICY "accounty_job_codes_service_role_all"
  ON public.accounty_job_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 10. accounty_legal_updates (Global legal updates table)
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_legal_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legal_updates_select" ON public.accounty_legal_updates;
DROP POLICY IF EXISTS "legal_updates_insert" ON public.accounty_legal_updates;
DROP POLICY IF EXISTS "legal_updates_update" ON public.accounty_legal_updates;
DROP POLICY IF EXISTS "legal_updates_delete" ON public.accounty_legal_updates;
DROP POLICY IF EXISTS "accounty_legal_updates_service_role_all" ON public.accounty_legal_updates;

CREATE POLICY "legal_updates_select"
  ON public.accounty_legal_updates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "legal_updates_insert"
  ON public.accounty_legal_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'senior'::text
    )
  );

CREATE POLICY "legal_updates_update"
  ON public.accounty_legal_updates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'senior'::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'senior'::text
    )
  );

CREATE POLICY "legal_updates_delete"
  ON public.accounty_legal_updates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'senior'::text
    )
  );

CREATE POLICY "accounty_legal_updates_service_role_all"
  ON public.accounty_legal_updates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 11. Security Hardening: Revoke direct anon privileges
-- ----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.accounty_cost_centers FROM anon;
REVOKE ALL ON TABLE public.accounty_data_contracts FROM anon;
REVOKE ALL ON TABLE public.accounty_departments FROM anon;
REVOKE ALL ON TABLE public.accounty_documents FROM anon;
REVOKE ALL ON TABLE public.accounty_employee_jobs FROM anon;
REVOKE ALL ON TABLE public.accounty_nav_representations FROM anon;
REVOKE ALL ON TABLE public.accounty_retention_rules FROM anon;
REVOKE ALL ON TABLE public.accounty_sites FROM anon;
REVOKE ALL ON TABLE public.accounty_job_codes FROM anon;
REVOKE ALL ON TABLE public.accounty_legal_updates FROM anon;
