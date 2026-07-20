-- ==================================================
-- MERGED FROM: 20260618_permission_phase2.sql
-- ==================================================
-- ============================================================================
-- PERMISSION SYSTEM PHASE 2 + 3
-- ============================================================================
-- Phase 2:
-- 1. sync_company_member_to_cache() trigger frissítés: employee role izoláció
-- 2. has_company_module_access() granular helper function
-- 3. Meglévő RLS policyk frissítése: employee kizárás pénzügyi táblákból
-- 4. Accounty könyvelők hozzáférése: transactions, partners
-- 5. Backfill: employee cache sorok javítása
-- Phase 3:
-- 6. Viewer role hozzáadása a company_members constraint-hez
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  0. Viewer role hozzáadása a constraint-hez                        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

ALTER TABLE company_members DROP CONSTRAINT IF EXISTS company_members_role_check;
ALTER TABLE company_members ADD CONSTRAINT company_members_role_check
  CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'employee'));

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  1. sync_company_member_to_cache() – employee role izoláció        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION sync_company_member_to_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM user_company_access_cache
    WHERE user_id = OLD.user_id
      AND company_id = OLD.company_id
      AND access_source = 'eaisybill';
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE
  -- Employee role: ONLY working time access, no financial data
  INSERT INTO user_company_access_cache (
    user_id, company_id, access_source, role,
    can_read_invoices, can_write_invoices, can_read_transactions,
    can_read_salaries, can_read_hr, updated_at
  ) VALUES (
    NEW.user_id, NEW.company_id, 'eaisybill', NEW.role,
    NEW.role != 'employee',                    -- invoices: everyone except employee
    NEW.role IN ('owner', 'admin'),            -- write invoices: owner/admin only
    NEW.role != 'employee',                    -- transactions: everyone except employee
    NEW.role IN ('owner', 'admin'),            -- salaries: owner/admin only
    NEW.role IN ('owner', 'admin'),            -- HR (payroll): owner/admin only
    now()
  )
  ON CONFLICT (user_id, company_id, access_source) DO UPDATE SET
    role = EXCLUDED.role,
    can_read_invoices = EXCLUDED.can_read_invoices,
    can_write_invoices = EXCLUDED.can_write_invoices,
    can_read_transactions = EXCLUDED.can_read_transactions,
    can_read_salaries = EXCLUDED.can_read_salaries,
    can_read_hr = EXCLUDED.can_read_hr,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  2. has_company_module_access() – granular per-module helper       ║
-- ║  Defense in depth: even if frontend hides UI, DB enforces access   ║
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
        ELSE true  -- unknown module → allow (fail open for non-financial)
      END
  );
$$;

COMMENT ON FUNCTION has_company_module_access IS
  'Granular access check: verifies user has access to a specific module for a company. '
  'Used in RLS policies to enforce employee isolation at DB level.';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  3. RLS: Employee kizárás pénzügyi táblákból                      ║
-- ║  A meglévő "Members can view X" policyk módosítása                ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ── invoices: employee NE lásson számlákat ──
DROP POLICY IF EXISTS "Members can view invoices" ON public.invoices;
CREATE POLICY "Members can view invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role != 'employee'
    )
  );

-- ── transactions: employee NE lásson tranzakciókat ──
DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;
CREATE POLICY "Members can view transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = transactions.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role != 'employee'
    )
  );

-- ── partners: employee NE lásson partnereket ──
DROP POLICY IF EXISTS "Members can view partners" ON public.partners;
CREATE POLICY "Members can view partners" ON public.partners
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = partners.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role != 'employee'
    )
  );

-- ── invoices UPDATE/DELETE: employee NE módosíthasson ──
DROP POLICY IF EXISTS "Members can update invoices" ON public.invoices;
CREATE POLICY "Members can update invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = invoices.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role != 'employee'
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
        AND company_members.role != 'employee'
    )
  );

-- ── transactions UPDATE/DELETE: employee NE módosíthasson ──
DROP POLICY IF EXISTS "Members can update transactions" ON public.transactions;
CREATE POLICY "Members can update transactions" ON public.transactions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = transactions.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role != 'employee'
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
        AND company_members.role != 'employee'
    )
  );

-- ── partners UPDATE/DELETE: employee NE módosíthasson ──
DROP POLICY IF EXISTS "Members can update partners" ON public.partners;
CREATE POLICY "Members can update partners" ON public.partners
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = partners.company_id
        AND company_members.user_id = (SELECT auth.uid())
        AND company_members.role != 'employee'
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
        AND company_members.role != 'employee'
    )
  );

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  4. Accounty könyvelők hozzáférése: transactions, partners        ║
-- ║  A könyvelők jelenleg NEM férnek hozzá ezekhez a táblákhoz,       ║
-- ║  mert nincs company_members soruk, csak accounty_assignments.     ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- transactions: accounty könyvelők is lássák
CREATE POLICY "Accountants can view assigned company transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (has_company_access_via_cache(company_id, 'accounty'));

-- partners: accounty könyvelők is lássák
CREATE POLICY "Accountants can view assigned company partners" ON public.partners
  FOR SELECT TO authenticated
  USING (has_company_access_via_cache(company_id, 'accounty'));

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  5. Backfill: meglévő employee cache sorok javítása               ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Fix any existing employee rows in the cache
UPDATE user_company_access_cache
SET
  can_read_invoices = false,
  can_write_invoices = false,
  can_read_transactions = false,
  can_read_salaries = false,
  can_read_hr = false,
  updated_at = now()
WHERE access_source = 'eaisybill'
  AND role = 'employee';


-- ==================================================
-- MERGED FROM: 20260618_permission_phase3_security_fixes.sql
-- ==================================================
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
