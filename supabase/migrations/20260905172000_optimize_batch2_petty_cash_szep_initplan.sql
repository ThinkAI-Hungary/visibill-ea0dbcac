-- ============================================================================
-- Migration: Optimize Batch 2 - Petty Cash & Szep Card RLS InitPlan (20 policies)
-- Date: 2026-09-05
-- Reference: Supabase Performance Advisory 0003_auth_rls_initplan
-- ADR: A-003 (Multi-tenancy RLS), A-016 (Query Strategy), A-020 (InitPlan)
-- ============================================================================

-- ============================================================================
-- 1. petty_cash_registers (Hazipenztarak)
-- ============================================================================
DROP POLICY IF EXISTS "Members can delete petty_cash_registers" ON public.petty_cash_registers;
DROP POLICY IF EXISTS "Members can insert petty_cash_registers" ON public.petty_cash_registers;
DROP POLICY IF EXISTS "Members can update petty_cash_registers" ON public.petty_cash_registers;
DROP POLICY IF EXISTS "Members can view petty_cash_registers" ON public.petty_cash_registers;
DROP POLICY IF EXISTS "petty_cash_registers_service_role_all" ON public.petty_cash_registers;
DROP POLICY IF EXISTS "petty_cash_registers_authenticated_select" ON public.petty_cash_registers;
DROP POLICY IF EXISTS "petty_cash_registers_authenticated_insert" ON public.petty_cash_registers;
DROP POLICY IF EXISTS "petty_cash_registers_authenticated_update" ON public.petty_cash_registers;
DROP POLICY IF EXISTS "petty_cash_registers_authenticated_delete" ON public.petty_cash_registers;

CREATE POLICY "petty_cash_registers_service_role_all"
  ON public.petty_cash_registers FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "petty_cash_registers_authenticated_select"
  ON public.petty_cash_registers FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "petty_cash_registers_authenticated_insert"
  ON public.petty_cash_registers FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "petty_cash_registers_authenticated_update"
  ON public.petty_cash_registers FOR UPDATE TO authenticated
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

CREATE POLICY "petty_cash_registers_authenticated_delete"
  ON public.petty_cash_registers FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.petty_cash_registers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.petty_cash_registers TO authenticated;
GRANT ALL ON public.petty_cash_registers TO service_role;

-- ============================================================================
-- 2. petty_cash_entries (Hazipenztar bizonylatok / tetelek)
-- ============================================================================
DROP POLICY IF EXISTS "Members can delete petty_cash_entries" ON public.petty_cash_entries;
DROP POLICY IF EXISTS "Members can insert petty_cash_entries" ON public.petty_cash_entries;
DROP POLICY IF EXISTS "Members can update petty_cash_entries" ON public.petty_cash_entries;
DROP POLICY IF EXISTS "Members can view petty_cash_entries" ON public.petty_cash_entries;
DROP POLICY IF EXISTS "petty_cash_entries_service_role_all" ON public.petty_cash_entries;
DROP POLICY IF EXISTS "petty_cash_entries_authenticated_select" ON public.petty_cash_entries;
DROP POLICY IF EXISTS "petty_cash_entries_authenticated_insert" ON public.petty_cash_entries;
DROP POLICY IF EXISTS "petty_cash_entries_authenticated_update" ON public.petty_cash_entries;
DROP POLICY IF EXISTS "petty_cash_entries_authenticated_delete" ON public.petty_cash_entries;

CREATE POLICY "petty_cash_entries_service_role_all"
  ON public.petty_cash_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "petty_cash_entries_authenticated_select"
  ON public.petty_cash_entries FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "petty_cash_entries_authenticated_insert"
  ON public.petty_cash_entries FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "petty_cash_entries_authenticated_update"
  ON public.petty_cash_entries FOR UPDATE TO authenticated
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

CREATE POLICY "petty_cash_entries_authenticated_delete"
  ON public.petty_cash_entries FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.petty_cash_entries FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.petty_cash_entries TO authenticated;
GRANT ALL ON public.petty_cash_entries TO service_role;

-- ============================================================================
-- 3. petty_cash_opening_balances (Penzkeszlet nyito egyenlegek)
-- ============================================================================
DROP POLICY IF EXISTS "Members can delete petty_cash_opening_balances" ON public.petty_cash_opening_balances;
DROP POLICY IF EXISTS "Members can insert petty_cash_opening_balances" ON public.petty_cash_opening_balances;
DROP POLICY IF EXISTS "Members can update petty_cash_opening_balances" ON public.petty_cash_opening_balances;
DROP POLICY IF EXISTS "Members can view petty_cash_opening_balances" ON public.petty_cash_opening_balances;
DROP POLICY IF EXISTS "petty_cash_opening_balances_service_role_all" ON public.petty_cash_opening_balances;
DROP POLICY IF EXISTS "petty_cash_opening_balances_authenticated_select" ON public.petty_cash_opening_balances;
DROP POLICY IF EXISTS "petty_cash_opening_balances_authenticated_insert" ON public.petty_cash_opening_balances;
DROP POLICY IF EXISTS "petty_cash_opening_balances_authenticated_update" ON public.petty_cash_opening_balances;
DROP POLICY IF EXISTS "petty_cash_opening_balances_authenticated_delete" ON public.petty_cash_opening_balances;

CREATE POLICY "petty_cash_opening_balances_service_role_all"
  ON public.petty_cash_opening_balances FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "petty_cash_opening_balances_authenticated_select"
  ON public.petty_cash_opening_balances FOR SELECT TO authenticated
  USING (
    register_id IN (
      SELECT r.id FROM public.petty_cash_registers r
      WHERE r.company_id IN (
        SELECT cm.company_id FROM public.company_members cm
        WHERE cm.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_support_admin()
  );

CREATE POLICY "petty_cash_opening_balances_authenticated_insert"
  ON public.petty_cash_opening_balances FOR INSERT TO authenticated
  WITH CHECK (
    register_id IN (
      SELECT r.id FROM public.petty_cash_registers r
      WHERE r.company_id IN (
        SELECT cm.company_id FROM public.company_members cm
        WHERE cm.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_support_admin()
  );

CREATE POLICY "petty_cash_opening_balances_authenticated_update"
  ON public.petty_cash_opening_balances FOR UPDATE TO authenticated
  USING (
    register_id IN (
      SELECT r.id FROM public.petty_cash_registers r
      WHERE r.company_id IN (
        SELECT cm.company_id FROM public.company_members cm
        WHERE cm.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_support_admin()
  )
  WITH CHECK (
    register_id IN (
      SELECT r.id FROM public.petty_cash_registers r
      WHERE r.company_id IN (
        SELECT cm.company_id FROM public.company_members cm
        WHERE cm.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_support_admin()
  );

CREATE POLICY "petty_cash_opening_balances_authenticated_delete"
  ON public.petty_cash_opening_balances FOR DELETE TO authenticated
  USING (
    register_id IN (
      SELECT r.id FROM public.petty_cash_registers r
      WHERE r.company_id IN (
        SELECT cm.company_id FROM public.company_members cm
        WHERE cm.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.petty_cash_opening_balances FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.petty_cash_opening_balances TO authenticated;
GRANT ALL ON public.petty_cash_opening_balances TO service_role;

-- ============================================================================
-- 4. petty_cash_routing_rules (Penztari iranyitasi szabalyok)
-- ============================================================================
DROP POLICY IF EXISTS "Members can delete petty_cash_routing_rules" ON public.petty_cash_routing_rules;
DROP POLICY IF EXISTS "Members can insert petty_cash_routing_rules" ON public.petty_cash_routing_rules;
DROP POLICY IF EXISTS "Members can update petty_cash_routing_rules" ON public.petty_cash_routing_rules;
DROP POLICY IF EXISTS "Members can view petty_cash_routing_rules" ON public.petty_cash_routing_rules;
DROP POLICY IF EXISTS "petty_cash_routing_rules_service_role_all" ON public.petty_cash_routing_rules;
DROP POLICY IF EXISTS "petty_cash_routing_rules_authenticated_select" ON public.petty_cash_routing_rules;
DROP POLICY IF EXISTS "petty_cash_routing_rules_authenticated_insert" ON public.petty_cash_routing_rules;
DROP POLICY IF EXISTS "petty_cash_routing_rules_authenticated_update" ON public.petty_cash_routing_rules;
DROP POLICY IF EXISTS "petty_cash_routing_rules_authenticated_delete" ON public.petty_cash_routing_rules;

CREATE POLICY "petty_cash_routing_rules_service_role_all"
  ON public.petty_cash_routing_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "petty_cash_routing_rules_authenticated_select"
  ON public.petty_cash_routing_rules FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "petty_cash_routing_rules_authenticated_insert"
  ON public.petty_cash_routing_rules FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "petty_cash_routing_rules_authenticated_update"
  ON public.petty_cash_routing_rules FOR UPDATE TO authenticated
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

CREATE POLICY "petty_cash_routing_rules_authenticated_delete"
  ON public.petty_cash_routing_rules FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.petty_cash_routing_rules FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.petty_cash_routing_rules TO authenticated;
GRANT ALL ON public.petty_cash_routing_rules TO service_role;

-- ============================================================================
-- 5. szep_card_transactions (SZEP kartya tranzakciok)
-- ============================================================================
DROP POLICY IF EXISTS "Members can delete szep transactions" ON public.szep_card_transactions;
DROP POLICY IF EXISTS "Members can insert szep transactions" ON public.szep_card_transactions;
DROP POLICY IF EXISTS "Members can update szep transactions" ON public.szep_card_transactions;
DROP POLICY IF EXISTS "Members can view szep transactions" ON public.szep_card_transactions;
DROP POLICY IF EXISTS "szep_card_transactions_service_role_all" ON public.szep_card_transactions;
DROP POLICY IF EXISTS "szep_card_transactions_authenticated_select" ON public.szep_card_transactions;
DROP POLICY IF EXISTS "szep_card_transactions_authenticated_insert" ON public.szep_card_transactions;
DROP POLICY IF EXISTS "szep_card_transactions_authenticated_update" ON public.szep_card_transactions;
DROP POLICY IF EXISTS "szep_card_transactions_authenticated_delete" ON public.szep_card_transactions;

CREATE POLICY "szep_card_transactions_service_role_all"
  ON public.szep_card_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "szep_card_transactions_authenticated_select"
  ON public.szep_card_transactions FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "szep_card_transactions_authenticated_insert"
  ON public.szep_card_transactions FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

CREATE POLICY "szep_card_transactions_authenticated_update"
  ON public.szep_card_transactions FOR UPDATE TO authenticated
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

CREATE POLICY "szep_card_transactions_authenticated_delete"
  ON public.szep_card_transactions FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

REVOKE ALL ON public.szep_card_transactions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.szep_card_transactions TO authenticated;
GRANT ALL ON public.szep_card_transactions TO service_role;
