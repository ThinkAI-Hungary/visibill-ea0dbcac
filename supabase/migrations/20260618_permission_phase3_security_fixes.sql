-- ============================================================================
-- PERMISSION SYSTEM PHASE 3: Security fixes
-- ============================================================================
-- C1: Viewer UPDATE/DELETE RLS — viewer nem módosíthat pénzügyi adatot
-- M3: has_company_module_access() fail-closed — ismeretlen modul → false
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  C1. Viewer UPDATE/DELETE RLS javítás                             ║
-- ║  A viewer-t ki kell zárni az UPDATE/DELETE policyból is           ║
-- ║  (jelenleg csak az employee van kizárva)                          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── invoices UPDATE: only owner/admin/member can modify ──
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

-- ── invoices DELETE: only owner/admin/member can delete ──
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

-- ── transactions UPDATE: only owner/admin/member can modify ──
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

-- ── transactions DELETE: only owner/admin/member can delete ──
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

-- ── partners UPDATE: only owner/admin/member can modify ──
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

-- ── partners DELETE: only owner/admin/member can delete ──
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
-- ║  M3. has_company_module_access() — fail-closed javítás            ║
-- ║  Ismeretlen modul → false (nem true)                              ║
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

COMMENT ON FUNCTION has_company_module_access IS
  'Granular access check: verifies user has access to a specific module for a company. '
  'Used in RLS policies to enforce employee/viewer isolation at DB level. '
  'Unknown modules are denied (fail-closed).';
