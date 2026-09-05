-- ============================================================================
-- Migration: Batch 5 - Optimize RLS InitPlan (Settings, Templates, Tax & Condo)
-- Date: 2026-09-05
-- Tables:
--   1. accounty_cegkapu_settings (3 policies)
--   2. accounty_office_settings (3 policies)
--   3. accounty_email_preferences (3 policies)
--   4. accounty_transfers (3 policies)
--   5. accounty_year_end_tasks (4 policies)
--   6. accounty_job_modifications (2 policies)
--   7. accounty_tao_yearly (2 policies)
--   8. accounty_penztarkonyv_period_close (2 policies)
--   9. accounty_templates (4 policies)
--  10. accounty_template_versions (2 policies)
--  11. accounty_global_tax_params (3 policies)
--  12. accounty_tax_params_global (3 policies)
--  13. accounty_condo_funds (1 policy)
--  14. accounty_condo_maintenance (1 policy)
--  15. accounty_condo_units (1 policy)
-- Target Policies: 34 InitPlan warnings resolved
-- Standards: ADR A-003, A-016, A-017, Supabase Postgres Best Practices
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. accounty_cegkapu_settings
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_cegkapu_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view cegkapu settings for assigned companies" ON public.accounty_cegkapu_settings;
DROP POLICY IF EXISTS "Users can insert cegkapu settings for assigned companies" ON public.accounty_cegkapu_settings;
DROP POLICY IF EXISTS "Users can update cegkapu settings for assigned companies" ON public.accounty_cegkapu_settings;
DROP POLICY IF EXISTS "accounty_cegkapu_settings_service_role_all" ON public.accounty_cegkapu_settings;

CREATE POLICY "Users can view cegkapu settings for assigned companies"
  ON public.accounty_cegkapu_settings
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_cegkapu_settings.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_cegkapu_settings.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "Users can insert cegkapu settings for assigned companies"
  ON public.accounty_cegkapu_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_cegkapu_settings.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_cegkapu_settings.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "Users can update cegkapu settings for assigned companies"
  ON public.accounty_cegkapu_settings
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_cegkapu_settings.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_cegkapu_settings.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_cegkapu_settings.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_cegkapu_settings.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_cegkapu_settings_service_role_all"
  ON public.accounty_cegkapu_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 2. accounty_office_settings
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_office_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office_select" ON public.accounty_office_settings;
DROP POLICY IF EXISTS "office_insert" ON public.accounty_office_settings;
DROP POLICY IF EXISTS "office_update" ON public.accounty_office_settings;
DROP POLICY IF EXISTS "accounty_office_settings_service_role_all" ON public.accounty_office_settings;

CREATE POLICY "office_select"
  ON public.accounty_office_settings
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "office_insert"
  ON public.accounty_office_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "office_update"
  ON public.accounty_office_settings
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "accounty_office_settings_service_role_all"
  ON public.accounty_office_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3. accounty_email_preferences
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_email_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own accounty email prefs" ON public.accounty_email_preferences;
DROP POLICY IF EXISTS "Users can insert own accounty email prefs" ON public.accounty_email_preferences;
DROP POLICY IF EXISTS "Users can update own accounty email prefs" ON public.accounty_email_preferences;
DROP POLICY IF EXISTS "accounty_email_preferences_service_role_all" ON public.accounty_email_preferences;

CREATE POLICY "Users can view own accounty email prefs"
  ON public.accounty_email_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own accounty email prefs"
  ON public.accounty_email_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own accounty email prefs"
  ON public.accounty_email_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "accounty_email_preferences_service_role_all"
  ON public.accounty_email_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. accounty_transfers
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tr_select" ON public.accounty_transfers;
DROP POLICY IF EXISTS "tr_insert" ON public.accounty_transfers;
DROP POLICY IF EXISTS "tr_update" ON public.accounty_transfers;
DROP POLICY IF EXISTS "accounty_transfers_service_role_all" ON public.accounty_transfers;

CREATE POLICY "tr_select"
  ON public.accounty_transfers
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_transfers.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_transfers.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "tr_insert"
  ON public.accounty_transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_transfers.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_transfers.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "tr_update"
  ON public.accounty_transfers
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_transfers.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_transfers.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_transfers.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_transfers.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_transfers_service_role_all"
  ON public.accounty_transfers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. accounty_year_end_tasks
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_year_end_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "yet_select" ON public.accounty_year_end_tasks;
DROP POLICY IF EXISTS "yet_insert" ON public.accounty_year_end_tasks;
DROP POLICY IF EXISTS "yet_update" ON public.accounty_year_end_tasks;
DROP POLICY IF EXISTS "yet_delete" ON public.accounty_year_end_tasks;
DROP POLICY IF EXISTS "accounty_year_end_tasks_service_role_all" ON public.accounty_year_end_tasks;

CREATE POLICY "yet_select"
  ON public.accounty_year_end_tasks
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_year_end_tasks.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_year_end_tasks.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "yet_insert"
  ON public.accounty_year_end_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_year_end_tasks.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_year_end_tasks.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "yet_update"
  ON public.accounty_year_end_tasks
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_year_end_tasks.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_year_end_tasks.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_year_end_tasks.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_year_end_tasks.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "yet_delete"
  ON public.accounty_year_end_tasks
  FOR DELETE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_year_end_tasks.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_year_end_tasks.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_year_end_tasks_service_role_all"
  ON public.accounty_year_end_tasks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 6. accounty_job_modifications
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_job_modifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jm_select" ON public.accounty_job_modifications;
DROP POLICY IF EXISTS "jm_insert" ON public.accounty_job_modifications;
DROP POLICY IF EXISTS "accounty_job_modifications_service_role_all" ON public.accounty_job_modifications;

CREATE POLICY "jm_select"
  ON public.accounty_job_modifications
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_job_modifications.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_job_modifications.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "jm_insert"
  ON public.accounty_job_modifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_job_modifications.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_job_modifications.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_job_modifications_service_role_all"
  ON public.accounty_job_modifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 7. accounty_tao_yearly
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_tao_yearly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounty_tao_yearly_select" ON public.accounty_tao_yearly;
DROP POLICY IF EXISTS "accounty_tao_yearly_modify" ON public.accounty_tao_yearly;
DROP POLICY IF EXISTS "accounty_tao_yearly_service_role_all" ON public.accounty_tao_yearly;

CREATE POLICY "accounty_tao_yearly_select"
  ON public.accounty_tao_yearly
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_tao_yearly.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_tao_yearly.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_tao_yearly_modify"
  ON public.accounty_tao_yearly
  FOR ALL
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_tao_yearly.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_tao_yearly.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_tao_yearly.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_tao_yearly.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_tao_yearly_service_role_all"
  ON public.accounty_tao_yearly
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 8. accounty_penztarkonyv_period_close
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_penztarkonyv_period_close ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounty_penztarkonyv_period_close_insert" ON public.accounty_penztarkonyv_period_close;
DROP POLICY IF EXISTS "accounty_penztarkonyv_period_close_update" ON public.accounty_penztarkonyv_period_close;
DROP POLICY IF EXISTS "accounty_penztarkonyv_period_close_service_role_all" ON public.accounty_penztarkonyv_period_close;

CREATE POLICY "accounty_penztarkonyv_period_close_insert"
  ON public.accounty_penztarkonyv_period_close
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_accounty_company_access(company_id)
    AND (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'iroda_admin'::text
    ))
  );

CREATE POLICY "accounty_penztarkonyv_period_close_update"
  ON public.accounty_penztarkonyv_period_close
  FOR UPDATE
  TO authenticated
  USING (
    has_accounty_company_access(company_id)
    AND (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'iroda_admin'::text
    ))
  )
  WITH CHECK (
    has_accounty_company_access(company_id)
    AND (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'iroda_admin'::text
    ))
  );

CREATE POLICY "accounty_penztarkonyv_period_close_service_role_all"
  ON public.accounty_penztarkonyv_period_close
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 9. accounty_templates (Global templates table)
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_select" ON public.accounty_templates;
DROP POLICY IF EXISTS "templates_insert" ON public.accounty_templates;
DROP POLICY IF EXISTS "templates_update" ON public.accounty_templates;
DROP POLICY IF EXISTS "templates_delete" ON public.accounty_templates;
DROP POLICY IF EXISTS "accounty_templates_service_role_all" ON public.accounty_templates;

CREATE POLICY "templates_select"
  ON public.accounty_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "templates_insert"
  ON public.accounty_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'senior'::text
    )
  );

CREATE POLICY "templates_update"
  ON public.accounty_templates
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

CREATE POLICY "templates_delete"
  ON public.accounty_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'senior'::text
    )
  );

CREATE POLICY "accounty_templates_service_role_all"
  ON public.accounty_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 10. accounty_template_versions
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_template_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "template_ver_select" ON public.accounty_template_versions;
DROP POLICY IF EXISTS "template_ver_insert" ON public.accounty_template_versions;
DROP POLICY IF EXISTS "accounty_template_versions_service_role_all" ON public.accounty_template_versions;

CREATE POLICY "template_ver_select"
  ON public.accounty_template_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "template_ver_insert"
  ON public.accounty_template_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'senior'::text
    )
  );

CREATE POLICY "accounty_template_versions_service_role_all"
  ON public.accounty_template_versions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 11. accounty_global_tax_params
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_global_tax_params ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounty_global_tax_params_select" ON public.accounty_global_tax_params;
DROP POLICY IF EXISTS "accounty_global_tax_params_insert" ON public.accounty_global_tax_params;
DROP POLICY IF EXISTS "accounty_global_tax_params_update" ON public.accounty_global_tax_params;
DROP POLICY IF EXISTS "accounty_global_tax_params_service_role_all" ON public.accounty_global_tax_params;

CREATE POLICY "accounty_global_tax_params_select"
  ON public.accounty_global_tax_params
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "accounty_global_tax_params_insert"
  ON public.accounty_global_tax_params
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'iroda_admin'::text
    )
  );

CREATE POLICY "accounty_global_tax_params_update"
  ON public.accounty_global_tax_params
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'iroda_admin'::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'iroda_admin'::text
    )
  );

CREATE POLICY "accounty_global_tax_params_service_role_all"
  ON public.accounty_global_tax_params
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 12. accounty_tax_params_global
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_tax_params_global ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tax_params_global_select" ON public.accounty_tax_params_global;
DROP POLICY IF EXISTS "tax_params_global_insert" ON public.accounty_tax_params_global;
DROP POLICY IF EXISTS "tax_params_global_update" ON public.accounty_tax_params_global;
DROP POLICY IF EXISTS "accounty_tax_params_global_service_role_all" ON public.accounty_tax_params_global;

CREATE POLICY "tax_params_global_select"
  ON public.accounty_tax_params_global
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "tax_params_global_insert"
  ON public.accounty_tax_params_global
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'senior'::text
    )
  );

CREATE POLICY "tax_params_global_update"
  ON public.accounty_tax_params_global
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

CREATE POLICY "accounty_tax_params_global_service_role_all"
  ON public.accounty_tax_params_global
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 13. accounty_condo_funds
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_condo_funds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage condo_funds for their companies" ON public.accounty_condo_funds;
DROP POLICY IF EXISTS "accounty_condo_funds_service_role_all" ON public.accounty_condo_funds;

CREATE POLICY "Users can manage condo_funds for their companies"
  ON public.accounty_condo_funds
  FOR ALL
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = accounty_condo_funds.company_id
        AND c.owner_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_condo_funds.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = accounty_condo_funds.company_id
        AND c.owner_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_condo_funds.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_condo_funds_service_role_all"
  ON public.accounty_condo_funds
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 14. accounty_condo_maintenance
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_condo_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage condo_maintenance for their companies" ON public.accounty_condo_maintenance;
DROP POLICY IF EXISTS "accounty_condo_maintenance_service_role_all" ON public.accounty_condo_maintenance;

CREATE POLICY "Users can manage condo_maintenance for their companies"
  ON public.accounty_condo_maintenance
  FOR ALL
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = accounty_condo_maintenance.company_id
        AND c.owner_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_condo_maintenance.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = accounty_condo_maintenance.company_id
        AND c.owner_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_condo_maintenance.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_condo_maintenance_service_role_all"
  ON public.accounty_condo_maintenance
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 15. accounty_condo_units
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_condo_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage condo_units for their companies" ON public.accounty_condo_units;
DROP POLICY IF EXISTS "accounty_condo_units_service_role_all" ON public.accounty_condo_units;

CREATE POLICY "Users can manage condo_units for their companies"
  ON public.accounty_condo_units
  FOR ALL
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = accounty_condo_units.company_id
        AND c.owner_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_condo_units.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = accounty_condo_units.company_id
        AND c.owner_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_condo_units.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "accounty_condo_units_service_role_all"
  ON public.accounty_condo_units
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 16. Security Hardening: Revoke direct anon privileges
-- ----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.accounty_cegkapu_settings FROM anon;
REVOKE ALL ON TABLE public.accounty_office_settings FROM anon;
REVOKE ALL ON TABLE public.accounty_email_preferences FROM anon;
REVOKE ALL ON TABLE public.accounty_transfers FROM anon;
REVOKE ALL ON TABLE public.accounty_year_end_tasks FROM anon;
REVOKE ALL ON TABLE public.accounty_job_modifications FROM anon;
REVOKE ALL ON TABLE public.accounty_tao_yearly FROM anon;
REVOKE ALL ON TABLE public.accounty_penztarkonyv_period_close FROM anon;
REVOKE ALL ON TABLE public.accounty_templates FROM anon;
REVOKE ALL ON TABLE public.accounty_template_versions FROM anon;
REVOKE ALL ON TABLE public.accounty_global_tax_params FROM anon;
REVOKE ALL ON TABLE public.accounty_tax_params_global FROM anon;
REVOKE ALL ON TABLE public.accounty_condo_funds FROM anon;
REVOKE ALL ON TABLE public.accounty_condo_maintenance FROM anon;
REVOKE ALL ON TABLE public.accounty_condo_units FROM anon;
