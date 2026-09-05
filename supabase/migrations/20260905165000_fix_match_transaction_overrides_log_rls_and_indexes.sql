-- ============================================================================
-- Migration: Fix match_transaction_overrides_log RLS policies and FK indexes (CRIT-4)
-- Date: 2026-09-05
-- Reference: visibill-db-audit CRIT-4 / ADR A-003, A-017, A-020
-- ============================================================================

-- 1. Régi és új policy-k törlése az idempotens futtathatóság érdekében
DROP POLICY IF EXISTS "Users can view own company match overrides" ON public.match_transaction_overrides_log;
DROP POLICY IF EXISTS "Users can insert match overrides for own company" ON public.match_transaction_overrides_log;
DROP POLICY IF EXISTS "match_transaction_overrides_log_service_role_all" ON public.match_transaction_overrides_log;
DROP POLICY IF EXISTS "match_transaction_overrides_log_authenticated_select" ON public.match_transaction_overrides_log;
DROP POLICY IF EXISTS "match_transaction_overrides_log_authenticated_insert" ON public.match_transaction_overrides_log;
DROP POLICY IF EXISTS "match_transaction_overrides_log_authenticated_delete" ON public.match_transaction_overrides_log;

-- 2. Service role teljes jogú hozzáférése (Kifejezetten csak service_role szerepkörnek!)
CREATE POLICY "match_transaction_overrides_log_service_role_all"
  ON public.match_transaction_overrides_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Hitelesített felhasználók olvasási joga (SELECT)
-- InitPlan-optimalizált (SELECT auth.uid()), saját cégtagok és support adminok részére
CREATE POLICY "match_transaction_overrides_log_authenticated_select"
  ON public.match_transaction_overrides_log
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
    OR public.is_support_admin()
  );

-- 4. Hitelesített felhasználók beszúrási joga (INSERT)
-- Viewer és employee szerepkörök kizárásával
CREATE POLICY "match_transaction_overrides_log_authenticated_insert"
  ON public.match_transaction_overrides_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.role NOT IN ('viewer', 'employee')
    )
    OR public.is_support_admin()
  );

-- 5. Hitelesített felhasználók törlési joga (DELETE)
-- Kizárólag cégtulajdonos, cégadmin vagy support admin törölhet
CREATE POLICY "match_transaction_overrides_log_authenticated_delete"
  ON public.match_transaction_overrides_log
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.role IN ('owner', 'admin')
    )
    OR public.is_support_admin()
  );

-- 6. Hiányzó Foreign Key és Lekérdezési Indexek pótlása
CREATE INDEX IF NOT EXISTS idx_match_overrides_company
  ON public.match_transaction_overrides_log(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_overrides_transaction
  ON public.match_transaction_overrides_log(transaction_id);

CREATE INDEX IF NOT EXISTS idx_match_overrides_created_by
  ON public.match_transaction_overrides_log(created_by);

-- 7. Táblajogosultságok szigorítása
REVOKE ALL ON public.match_transaction_overrides_log FROM anon;
GRANT SELECT, INSERT, DELETE ON public.match_transaction_overrides_log TO authenticated;
GRANT ALL ON public.match_transaction_overrides_log TO service_role;
