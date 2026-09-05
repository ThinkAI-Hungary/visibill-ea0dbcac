-- ============================================================================
-- Migration: Optimize Batch 1 - GL & Kettos Konyvvitel RLS InitPlan (27 policies)
-- Date: 2026-09-05
-- Reference: Supabase Performance Advisory 0003_auth_rls_initplan
-- ADR: A-003 (Multi-tenancy RLS), A-016 (Query Strategy), A-020 (InitPlan)
-- ============================================================================

-- ============================================================================
-- 1. acc_journals (Konyvelesi naplok torzsadat)
-- ============================================================================
DROP POLICY IF EXISTS "Allow read access for company members" ON public.acc_journals;
DROP POLICY IF EXISTS "Allow write access for company members" ON public.acc_journals;
DROP POLICY IF EXISTS "acc_journals_service_role_all" ON public.acc_journals;
DROP POLICY IF EXISTS "acc_journals_authenticated_select" ON public.acc_journals;
DROP POLICY IF EXISTS "acc_journals_authenticated_write" ON public.acc_journals;

CREATE POLICY "acc_journals_service_role_all"
  ON public.acc_journals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "acc_journals_authenticated_select"
  ON public.acc_journals
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "acc_journals_authenticated_write"
  ON public.acc_journals
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.acc_journals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acc_journals TO authenticated;
GRANT ALL ON public.acc_journals TO service_role;

-- ============================================================================
-- 2. acc_journal_headers (Naplotetel fejlecek)
-- ============================================================================
DROP POLICY IF EXISTS "Allow read access for company members" ON public.acc_journal_headers;
DROP POLICY IF EXISTS "Allow write access for company members" ON public.acc_journal_headers;
DROP POLICY IF EXISTS "acc_journal_headers_service_role_all" ON public.acc_journal_headers;
DROP POLICY IF EXISTS "acc_journal_headers_authenticated_select" ON public.acc_journal_headers;
DROP POLICY IF EXISTS "acc_journal_headers_authenticated_write" ON public.acc_journal_headers;

CREATE POLICY "acc_journal_headers_service_role_all"
  ON public.acc_journal_headers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "acc_journal_headers_authenticated_select"
  ON public.acc_journal_headers
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "acc_journal_headers_authenticated_write"
  ON public.acc_journal_headers
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.acc_journal_headers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acc_journal_headers TO authenticated;
GRANT ALL ON public.acc_journal_headers TO service_role;

-- ============================================================================
-- 3. acc_journal_lines (Naplosorok - nagy volumen!)
-- ============================================================================
DROP POLICY IF EXISTS "Allow read access for company members" ON public.acc_journal_lines;
DROP POLICY IF EXISTS "Allow write access for company members" ON public.acc_journal_lines;
DROP POLICY IF EXISTS "acc_journal_lines_service_role_all" ON public.acc_journal_lines;
DROP POLICY IF EXISTS "acc_journal_lines_authenticated_select" ON public.acc_journal_lines;
DROP POLICY IF EXISTS "acc_journal_lines_authenticated_write" ON public.acc_journal_lines;

CREATE POLICY "acc_journal_lines_service_role_all"
  ON public.acc_journal_lines
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "acc_journal_lines_authenticated_select"
  ON public.acc_journal_lines
  FOR SELECT
  TO authenticated
  USING (
    header_id IN (
      SELECT h.id FROM public.acc_journal_headers h
      WHERE h.company_id IN (
        SELECT cm.company_id FROM public.company_members cm
        WHERE cm.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_support_admin()
  );

CREATE POLICY "acc_journal_lines_authenticated_write"
  ON public.acc_journal_lines
  FOR ALL
  TO authenticated
  USING (
    header_id IN (
      SELECT h.id FROM public.acc_journal_headers h
      WHERE h.company_id IN (
        SELECT cm.company_id FROM public.company_members cm
        WHERE cm.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_support_admin()
  )
  WITH CHECK (
    header_id IN (
      SELECT h.id FROM public.acc_journal_headers h
      WHERE h.company_id IN (
        SELECT cm.company_id FROM public.company_members cm
        WHERE cm.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.acc_journal_lines FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acc_journal_lines TO authenticated;
GRANT ALL ON public.acc_journal_lines TO service_role;

-- ============================================================================
-- 4. acc_journal_counters (Naplosorszam szamlalok)
-- ============================================================================
DROP POLICY IF EXISTS "Allow read access for company members" ON public.acc_journal_counters;
DROP POLICY IF EXISTS "Allow write access for company members" ON public.acc_journal_counters;
DROP POLICY IF EXISTS "acc_journal_counters_service_role_all" ON public.acc_journal_counters;
DROP POLICY IF EXISTS "acc_journal_counters_authenticated_select" ON public.acc_journal_counters;
DROP POLICY IF EXISTS "acc_journal_counters_authenticated_write" ON public.acc_journal_counters;

CREATE POLICY "acc_journal_counters_service_role_all"
  ON public.acc_journal_counters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "acc_journal_counters_authenticated_select"
  ON public.acc_journal_counters
  FOR SELECT
  TO authenticated
  USING (
    journal_id IN (
      SELECT j.id FROM public.acc_journals j
      WHERE j.company_id IN (
        SELECT cm.company_id FROM public.company_members cm
        WHERE cm.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_support_admin()
  );

CREATE POLICY "acc_journal_counters_authenticated_write"
  ON public.acc_journal_counters
  FOR ALL
  TO authenticated
  USING (
    journal_id IN (
      SELECT j.id FROM public.acc_journals j
      WHERE j.company_id IN (
        SELECT cm.company_id FROM public.company_members cm
        WHERE cm.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_support_admin()
  )
  WITH CHECK (
    journal_id IN (
      SELECT j.id FROM public.acc_journals j
      WHERE j.company_id IN (
        SELECT cm.company_id FROM public.company_members cm
        WHERE cm.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.acc_journal_counters FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acc_journal_counters TO authenticated;
GRANT ALL ON public.acc_journal_counters TO service_role;

-- ============================================================================
-- 5. acc_journal_audit_logs (Naplo audit naplo)
-- ============================================================================
DROP POLICY IF EXISTS "Allow read access for company members" ON public.acc_journal_audit_logs;
DROP POLICY IF EXISTS "Allow insert access for company members" ON public.acc_journal_audit_logs;
DROP POLICY IF EXISTS "acc_journal_audit_logs_service_role_all" ON public.acc_journal_audit_logs;
DROP POLICY IF EXISTS "acc_journal_audit_logs_authenticated_select" ON public.acc_journal_audit_logs;
DROP POLICY IF EXISTS "acc_journal_audit_logs_authenticated_insert" ON public.acc_journal_audit_logs;

CREATE POLICY "acc_journal_audit_logs_service_role_all"
  ON public.acc_journal_audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "acc_journal_audit_logs_authenticated_select"
  ON public.acc_journal_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "acc_journal_audit_logs_authenticated_insert"
  ON public.acc_journal_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.acc_journal_audit_logs FROM anon;
GRANT SELECT, INSERT ON public.acc_journal_audit_logs TO authenticated;
GRANT ALL ON public.acc_journal_audit_logs TO service_role;

-- ============================================================================
-- 6. acc_accounting_periods (Konyvelesi idoszakok)
-- ============================================================================
DROP POLICY IF EXISTS "Allow read access for company members" ON public.acc_accounting_periods;
DROP POLICY IF EXISTS "Allow write access for company members" ON public.acc_accounting_periods;
DROP POLICY IF EXISTS "acc_accounting_periods_service_role_all" ON public.acc_accounting_periods;
DROP POLICY IF EXISTS "acc_accounting_periods_authenticated_select" ON public.acc_accounting_periods;
DROP POLICY IF EXISTS "acc_accounting_periods_authenticated_write" ON public.acc_accounting_periods;

CREATE POLICY "acc_accounting_periods_service_role_all"
  ON public.acc_accounting_periods
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "acc_accounting_periods_authenticated_select"
  ON public.acc_accounting_periods
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "acc_accounting_periods_authenticated_write"
  ON public.acc_accounting_periods
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.acc_accounting_periods FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acc_accounting_periods TO authenticated;
GRANT ALL ON public.acc_accounting_periods TO service_role;

-- ============================================================================
-- 7. gl_journal_entries (Fokonyvi naplobejegyzesek)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own company journal entries" ON public.gl_journal_entries;
DROP POLICY IF EXISTS "Users can insert journal entries for own company" ON public.gl_journal_entries;
DROP POLICY IF EXISTS "Users can update own company journal entries" ON public.gl_journal_entries;
DROP POLICY IF EXISTS "Users can delete own company journal entries" ON public.gl_journal_entries;
DROP POLICY IF EXISTS "gl_journal_entries_service_role_all" ON public.gl_journal_entries;
DROP POLICY IF EXISTS "gl_journal_entries_authenticated_select" ON public.gl_journal_entries;
DROP POLICY IF EXISTS "gl_journal_entries_authenticated_insert" ON public.gl_journal_entries;
DROP POLICY IF EXISTS "gl_journal_entries_authenticated_update" ON public.gl_journal_entries;
DROP POLICY IF EXISTS "gl_journal_entries_authenticated_delete" ON public.gl_journal_entries;

CREATE POLICY "gl_journal_entries_service_role_all"
  ON public.gl_journal_entries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "gl_journal_entries_authenticated_select"
  ON public.gl_journal_entries
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "gl_journal_entries_authenticated_insert"
  ON public.gl_journal_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "gl_journal_entries_authenticated_update"
  ON public.gl_journal_entries
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "gl_journal_entries_authenticated_delete"
  ON public.gl_journal_entries
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.gl_journal_entries FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gl_journal_entries TO authenticated;
GRANT ALL ON public.gl_journal_entries TO service_role;

-- ============================================================================
-- 8. gl_audit_imports (Fokonyvi XML audit importok)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own company audit imports" ON public.gl_audit_imports;
DROP POLICY IF EXISTS "Users can insert audit imports for own company" ON public.gl_audit_imports;
DROP POLICY IF EXISTS "Users can update own company audit imports" ON public.gl_audit_imports;
DROP POLICY IF EXISTS "Users can delete own audit imports" ON public.gl_audit_imports;
DROP POLICY IF EXISTS "Users can delete own company audit imports" ON public.gl_audit_imports;
DROP POLICY IF EXISTS "gl_audit_imports_service_role_all" ON public.gl_audit_imports;
DROP POLICY IF EXISTS "gl_audit_imports_authenticated_select" ON public.gl_audit_imports;
DROP POLICY IF EXISTS "gl_audit_imports_authenticated_insert" ON public.gl_audit_imports;
DROP POLICY IF EXISTS "gl_audit_imports_authenticated_update" ON public.gl_audit_imports;
DROP POLICY IF EXISTS "gl_audit_imports_authenticated_delete" ON public.gl_audit_imports;

CREATE POLICY "gl_audit_imports_service_role_all"
  ON public.gl_audit_imports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "gl_audit_imports_authenticated_select"
  ON public.gl_audit_imports
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "gl_audit_imports_authenticated_insert"
  ON public.gl_audit_imports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "gl_audit_imports_authenticated_update"
  ON public.gl_audit_imports
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "gl_audit_imports_authenticated_delete"
  ON public.gl_audit_imports
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.gl_audit_imports FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gl_audit_imports TO authenticated;
GRANT ALL ON public.gl_audit_imports TO service_role;

-- ============================================================================
-- 9. gl_audit_partners (Audit partnerek)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own company audit partners" ON public.gl_audit_partners;
DROP POLICY IF EXISTS "gl_audit_partners_service_role_all" ON public.gl_audit_partners;
DROP POLICY IF EXISTS "gl_audit_partners_authenticated_select" ON public.gl_audit_partners;
DROP POLICY IF EXISTS "gl_audit_partners_authenticated_write" ON public.gl_audit_partners;

CREATE POLICY "gl_audit_partners_service_role_all"
  ON public.gl_audit_partners
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "gl_audit_partners_authenticated_select"
  ON public.gl_audit_partners
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "gl_audit_partners_authenticated_write"
  ON public.gl_audit_partners
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.gl_audit_partners FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gl_audit_partners TO authenticated;
GRANT ALL ON public.gl_audit_partners TO service_role;

-- ============================================================================
-- 10. gl_audit_accounts (Audit szamlak)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own company audit accounts" ON public.gl_audit_accounts;
DROP POLICY IF EXISTS "gl_audit_accounts_service_role_all" ON public.gl_audit_accounts;
DROP POLICY IF EXISTS "gl_audit_accounts_authenticated_select" ON public.gl_audit_accounts;
DROP POLICY IF EXISTS "gl_audit_accounts_authenticated_write" ON public.gl_audit_accounts;

CREATE POLICY "gl_audit_accounts_service_role_all"
  ON public.gl_audit_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "gl_audit_accounts_authenticated_select"
  ON public.gl_audit_accounts
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "gl_audit_accounts_authenticated_write"
  ON public.gl_audit_accounts
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.gl_audit_accounts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gl_audit_accounts TO authenticated;
GRANT ALL ON public.gl_audit_accounts TO service_role;

-- ============================================================================
-- 11. annual_reports (Eves beszamolok)
-- ============================================================================
DROP POLICY IF EXISTS "annual_reports_select" ON public.annual_reports;
DROP POLICY IF EXISTS "annual_reports_insert" ON public.annual_reports;
DROP POLICY IF EXISTS "annual_reports_update" ON public.annual_reports;
DROP POLICY IF EXISTS "annual_reports_delete" ON public.annual_reports;
DROP POLICY IF EXISTS "annual_reports_service_role_all" ON public.annual_reports;
DROP POLICY IF EXISTS "annual_reports_authenticated_select" ON public.annual_reports;
DROP POLICY IF EXISTS "annual_reports_authenticated_insert" ON public.annual_reports;
DROP POLICY IF EXISTS "annual_reports_authenticated_update" ON public.annual_reports;
DROP POLICY IF EXISTS "annual_reports_authenticated_delete" ON public.annual_reports;

CREATE POLICY "annual_reports_service_role_all"
  ON public.annual_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "annual_reports_authenticated_select"
  ON public.annual_reports
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "annual_reports_authenticated_insert"
  ON public.annual_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "annual_reports_authenticated_update"
  ON public.annual_reports
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "annual_reports_authenticated_delete"
  ON public.annual_reports
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.annual_reports FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.annual_reports TO authenticated;
GRANT ALL ON public.annual_reports TO service_role;
