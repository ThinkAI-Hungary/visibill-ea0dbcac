-- ============================================================================
-- RLS SECURITY HARDENING – Összevont javítás
-- ============================================================================
-- Futtasd a Supabase SQL Editor-ban!
-- 
-- Javítások:
--   1. viewer/employee UPDATE/DELETE tiltás (invoices, transactions, partners, salary, nav_invoices)
--   2. accounty_assignments INSERT: WITH CHECK (iroda_admin)
--   3. company_members INSERT: WITH CHECK (self + admin)
--   4. invoices/transactions INSERT: role check hozzáadás (viewer/employee nem hozhat létre)
--   5. salary UPDATE/DELETE: csak admin/owner
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  1. INVOICES: viewer/employee nem módosíthat/törölhet              ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "Members can update invoices" ON public.invoices;
CREATE POLICY "Members can update invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role NOT IN ('employee', 'viewer')
    )
  );

DROP POLICY IF EXISTS "Members can delete invoices" ON public.invoices;
CREATE POLICY "Members can delete invoices" ON public.invoices
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role NOT IN ('employee', 'viewer')
    )
  );

-- INSERT: viewer/employee nem hozhat létre számlát
DROP POLICY IF EXISTS "Members can create invoices" ON public.invoices;
CREATE POLICY "Members can create invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role NOT IN ('employee', 'viewer')
    )
  );

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  2. TRANSACTIONS: viewer/employee nem módosíthat/törölhet          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "Members can update transactions" ON public.transactions;
CREATE POLICY "Members can update transactions" ON public.transactions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = transactions.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role NOT IN ('employee', 'viewer')
    )
  );

DROP POLICY IF EXISTS "Members can delete transactions" ON public.transactions;
CREATE POLICY "Members can delete transactions" ON public.transactions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = transactions.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role NOT IN ('employee', 'viewer')
    )
  );

-- INSERT: viewer/employee nem hozhat létre tranzakciót
DROP POLICY IF EXISTS "Members can create transactions" ON public.transactions;
CREATE POLICY "Members can create transactions" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = transactions.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role NOT IN ('employee', 'viewer')
    )
  );

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  3. PARTNERS: viewer/employee nem módosíthat/törölhet              ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "Members can update partners" ON public.partners;
CREATE POLICY "Members can update partners" ON public.partners
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = partners.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role NOT IN ('employee', 'viewer')
    )
  );

DROP POLICY IF EXISTS "Members can delete partners" ON public.partners;
CREATE POLICY "Members can delete partners" ON public.partners
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = partners.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role NOT IN ('employee', 'viewer')
    )
  );

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  4. SALARY: csak admin/owner módosíthat/törölhet                   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "Members can update salary" ON public.salary;
CREATE POLICY "Members can update salary" ON public.salary
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = salary.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Members can delete salary" ON public.salary;
CREATE POLICY "Members can delete salary" ON public.salary
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = salary.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Members can create salary" ON public.salary;
CREATE POLICY "Members can create salary" ON public.salary
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = salary.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role IN ('owner', 'admin')
    )
  );

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  5. NAV_INVOICES: viewer/employee nem módosíthat                   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "Members can manage NAV invoices" ON public.nav_invoices;
CREATE POLICY "Members can manage NAV invoices" ON public.nav_invoices
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = nav_invoices.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role NOT IN ('employee', 'viewer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = nav_invoices.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role NOT IN ('employee', 'viewer')
    )
  );

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  6. ACCOUNTY_ASSIGNMENTS INSERT: csak iroda_admin                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "assignments_insert" ON public.accounty_assignments;
CREATE POLICY "assignments_insert" ON public.accounty_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_iroda_admin_for_firm(accounting_firm_id)
  );

-- UPDATE/DELETE is biztosítsuk
DROP POLICY IF EXISTS "assignments_update" ON public.accounty_assignments;
CREATE POLICY "assignments_update" ON public.accounty_assignments
  FOR UPDATE TO authenticated
  USING (
    is_iroda_admin_for_firm(accounting_firm_id)
  );

DROP POLICY IF EXISTS "assignments_delete" ON public.accounty_assignments;
CREATE POLICY "assignments_delete" ON public.accounty_assignments
  FOR DELETE TO authenticated
  USING (
    is_iroda_admin_for_firm(accounting_firm_id)
  );

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  7. COMPANY_MEMBERS INSERT: self-insert vagy admin                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS "Users can insert own membership" ON public.company_members;
CREATE POLICY "Users can insert own membership" ON public.company_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR is_company_admin(company_id)
  );

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  8. has_company_module_access() – fail-closed javítás              ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION has_company_module_access(
  p_company_id UUID,
  p_module TEXT DEFAULT 'invoices'
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_company_access_cache
    WHERE user_id = auth.uid()
      AND company_id = p_company_id
      AND CASE p_module
        WHEN 'invoices' THEN can_read_invoices
        WHEN 'transactions' THEN can_read_transactions
        WHEN 'salaries' THEN can_read_salaries
        WHEN 'hr' THEN can_read_hr
        ELSE false  -- unknown module → deny (fail closed)
      END
  );
$$;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICATION: Ellenőrizzük az új policy-kat                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

SELECT tablename, policyname, permissive, cmd,
  CASE WHEN qual IS NOT NULL THEN '✅ HAS USING' ELSE '—' END as has_using,
  CASE WHEN with_check IS NOT NULL THEN '✅ HAS CHECK' ELSE '—' END as has_check
FROM pg_policies
WHERE tablename IN (
  'invoices', 'transactions', 'partners', 'salary', 'nav_invoices',
  'accounty_assignments', 'company_members'
)
ORDER BY tablename, cmd, policyname;
