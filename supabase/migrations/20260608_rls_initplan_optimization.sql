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
