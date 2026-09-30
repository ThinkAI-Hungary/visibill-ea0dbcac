-- Migration: optimize_auth_rls_initplan_32_policies
-- Created: 2026-09-29 23:50:00
-- Purpose: Remediate 32 Supabase linter auth_rls_initplan warnings by wrapping
--          auth.uid() calls in (select auth.uid()) subqueries.
--          This enables PostgreSQL per-scan InitPlan caching instead of per-row evaluation.

-- 1. bank_transactions
DROP POLICY IF EXISTS "Company members can view company bank_transactions" ON public.bank_transactions;
CREATE POLICY "Company members can view company bank_transactions"
  ON public.bank_transactions
  FOR SELECT
  TO public
  USING (
    company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = bank_transactions.company_id
        AND company_members.user_id = (SELECT auth.uid())
    )
  );

-- 2. acc_open_item_matches
DROP POLICY IF EXISTS "acc_open_item_matches_company_member" ON public.acc_open_item_matches;
CREATE POLICY "acc_open_item_matches_company_member"
  ON public.acc_open_item_matches
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid())
    )
  );

-- 3. accounty_ai_chat_sessions
DROP POLICY IF EXISTS "Users can view own chat sessions" ON public.accounty_ai_chat_sessions;
CREATE POLICY "Users can view own chat sessions"
  ON public.accounty_ai_chat_sessions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own chat sessions" ON public.accounty_ai_chat_sessions;
CREATE POLICY "Users can insert own chat sessions"
  ON public.accounty_ai_chat_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.accounty_ai_chat_sessions;
CREATE POLICY "Users can update own chat sessions"
  ON public.accounty_ai_chat_sessions
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 4. accounty_dividends
DROP POLICY IF EXISTS "accounty_dividends_tenant_select" ON public.accounty_dividends;
CREATE POLICY "accounty_dividends_tenant_select"
  ON public.accounty_dividends
  FOR SELECT
  TO public
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.accounty_assignments
      WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
        AND accounty_assignments.company_id = accounty_dividends.company_id
    )
  );

DROP POLICY IF EXISTS "accounty_dividends_tenant_modify" ON public.accounty_dividends;
CREATE POLICY "accounty_dividends_tenant_modify"
  ON public.accounty_dividends
  FOR ALL
  TO public
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.accounty_assignments
      WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
        AND accounty_assignments.company_id = accounty_dividends.company_id
    )
  );

-- 5. accounty_payroll_settings
DROP POLICY IF EXISTS "accounty_payroll_settings_select" ON public.accounty_payroll_settings;
CREATE POLICY "accounty_payroll_settings_select"
  ON public.accounty_payroll_settings
  FOR SELECT
  TO public
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid())
    )
    OR company_id IN (
      SELECT accounty_assignments.company_id
      FROM public.accounty_assignments
      WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "accounty_payroll_settings_insert" ON public.accounty_payroll_settings;
CREATE POLICY "accounty_payroll_settings_insert"
  ON public.accounty_payroll_settings
  FOR INSERT
  TO public
  WITH CHECK (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid())
    )
    OR company_id IN (
      SELECT accounty_assignments.company_id
      FROM public.accounty_assignments
      WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "accounty_payroll_settings_update" ON public.accounty_payroll_settings;
CREATE POLICY "accounty_payroll_settings_update"
  ON public.accounty_payroll_settings
  FOR UPDATE
  TO public
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid())
    )
    OR company_id IN (
      SELECT accounty_assignments.company_id
      FROM public.accounty_assignments
      WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "accounty_payroll_settings_delete" ON public.accounty_payroll_settings;
CREATE POLICY "accounty_payroll_settings_delete"
  ON public.accounty_payroll_settings
  FOR DELETE
  TO public
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid())
    )
    OR company_id IN (
      SELECT accounty_assignments.company_id
      FROM public.accounty_assignments
      WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
    )
  );

-- 6. aggreg8_accounts
DROP POLICY IF EXISTS "Company members can view aggreg8 accounts" ON public.aggreg8_accounts;
CREATE POLICY "Company members can view aggreg8 accounts"
  ON public.aggreg8_accounts
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = aggreg8_accounts.company_id
        AND company_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Company managers can manage aggreg8 accounts" ON public.aggreg8_accounts;
CREATE POLICY "Company managers can manage aggreg8 accounts"
  ON public.aggreg8_accounts
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = aggreg8_accounts.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = aggreg8_accounts.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
    )
  );

-- 7. aggreg8_consents
DROP POLICY IF EXISTS "Company members can view aggreg8 consents" ON public.aggreg8_consents;
CREATE POLICY "Company members can view aggreg8 consents"
  ON public.aggreg8_consents
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = aggreg8_consents.company_id
        AND company_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Company managers can manage aggreg8 consents" ON public.aggreg8_consents;
CREATE POLICY "Company managers can manage aggreg8 consents"
  ON public.aggreg8_consents
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = aggreg8_consents.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = aggreg8_consents.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
    )
  );

-- 8. auto_categorize_jobs
DROP POLICY IF EXISTS "auto_categorize_jobs_select_company" ON public.auto_categorize_jobs;
CREATE POLICY "auto_categorize_jobs_select_company"
  ON public.auto_categorize_jobs
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT user_company_access_cache.company_id
      FROM public.user_company_access_cache
      WHERE user_company_access_cache.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "auto_categorize_jobs_insert_company" ON public.auto_categorize_jobs;
CREATE POLICY "auto_categorize_jobs_insert_company"
  ON public.auto_categorize_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT user_company_access_cache.company_id
      FROM public.user_company_access_cache
      WHERE user_company_access_cache.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "auto_categorize_jobs_update_company" ON public.auto_categorize_jobs;
CREATE POLICY "auto_categorize_jobs_update_company"
  ON public.auto_categorize_jobs
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT user_company_access_cache.company_id
      FROM public.user_company_access_cache
      WHERE user_company_access_cache.user_id = (SELECT auth.uid())
    )
  );

-- 9. changelog_entries
DROP POLICY IF EXISTS "Anyone can view published changelog entries" ON public.changelog_entries;
CREATE POLICY "Anyone can view published changelog entries"
  ON public.changelog_entries
  FOR SELECT
  TO authenticated
  USING (
    is_published = true 
    OR is_support_admin() 
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['management'::text, 'thinkai'::text])
    )
  );

DROP POLICY IF EXISTS "Admins can insert changelog entries" ON public.changelog_entries;
CREATE POLICY "Admins can insert changelog entries"
  ON public.changelog_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_support_admin() 
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['management'::text, 'thinkai'::text])
    )
  );

DROP POLICY IF EXISTS "Admins can update changelog entries" ON public.changelog_entries;
CREATE POLICY "Admins can update changelog entries"
  ON public.changelog_entries
  FOR UPDATE
  TO authenticated
  USING (
    is_support_admin() 
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['management'::text, 'thinkai'::text])
    )
  )
  WITH CHECK (
    is_support_admin() 
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['management'::text, 'thinkai'::text])
    )
  );

DROP POLICY IF EXISTS "Admins can delete changelog entries" ON public.changelog_entries;
CREATE POLICY "Admins can delete changelog entries"
  ON public.changelog_entries
  FOR DELETE
  TO authenticated
  USING (
    is_support_admin() 
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['management'::text, 'thinkai'::text])
    )
  );

-- 10. company_minimax_credentials
DROP POLICY IF EXISTS "Members can view company Minimax credentials" ON public.company_minimax_credentials;
CREATE POLICY "Members can view company Minimax credentials"
  ON public.company_minimax_credentials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_minimax_credentials.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can manage company Minimax credentials" ON public.company_minimax_credentials;
CREATE POLICY "Members can manage company Minimax credentials"
  ON public.company_minimax_credentials
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_minimax_credentials.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

-- 11. development_reserves
DROP POLICY IF EXISTS "development_reserves_select" ON public.development_reserves;
CREATE POLICY "development_reserves_select"
  ON public.development_reserves
  FOR SELECT
  TO public
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "development_reserves_insert" ON public.development_reserves;
CREATE POLICY "development_reserves_insert"
  ON public.development_reserves
  FOR INSERT
  TO public
  WITH CHECK (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "development_reserves_update" ON public.development_reserves;
CREATE POLICY "development_reserves_update"
  ON public.development_reserves
  FOR UPDATE
  TO public
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "development_reserves_delete" ON public.development_reserves;
CREATE POLICY "development_reserves_delete"
  ON public.development_reserves
  FOR DELETE
  TO public
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid())
    )
  );

-- 12. minimax_sync_logs
DROP POLICY IF EXISTS "Members can view minimax sync logs" ON public.minimax_sync_logs;
CREATE POLICY "Members can view minimax sync logs"
  ON public.minimax_sync_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = minimax_sync_logs.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

-- 13. vat_code_overrides_log
DROP POLICY IF EXISTS "Users can view own company vat code overrides" ON public.vat_code_overrides_log;
CREATE POLICY "Users can view own company vat code overrides"
  ON public.vat_code_overrides_log
  FOR SELECT
  TO public
  USING (
    company_id IN (
      SELECT cm.company_id
      FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert vat code overrides for own company" ON public.vat_code_overrides_log;
CREATE POLICY "Users can insert vat code overrides for own company"
  ON public.vat_code_overrides_log
  FOR INSERT
  TO public
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id
      FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete vat code overrides for own company" ON public.vat_code_overrides_log;
CREATE POLICY "Users can delete vat code overrides for own company"
  ON public.vat_code_overrides_log
  FOR DELETE
  TO public
  USING (
    company_id IN (
      SELECT cm.company_id
      FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
  );
