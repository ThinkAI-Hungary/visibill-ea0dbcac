-- ============================================================================
-- Migration: Fix accrual_entries security, RLS policies and RPC permissions (CRIT-1)
-- Date: 2026-09-05
-- Reference: visibill-db-audit CRIT-1 / ADR A-003, A-016, A-017
-- ============================================================================

-- 1. Régi, hibás és redundáns policy-k törlése (idempotens futtathatóság biztosítása)
DROP POLICY IF EXISTS "Service role can manage accrual entries" ON public.accrual_entries;
DROP POLICY IF EXISTS "Users can manage accrual entries for own companies" ON public.accrual_entries;
DROP POLICY IF EXISTS "Users can view accrual entries for own companies" ON public.accrual_entries;
DROP POLICY IF EXISTS "accrual_entries_service_role_all" ON public.accrual_entries;
DROP POLICY IF EXISTS "accrual_entries_authenticated_select" ON public.accrual_entries;
DROP POLICY IF EXISTS "accrual_entries_authenticated_insert" ON public.accrual_entries;
DROP POLICY IF EXISTS "accrual_entries_authenticated_update" ON public.accrual_entries;
DROP POLICY IF EXISTS "accrual_entries_authenticated_delete" ON public.accrual_entries;

-- 2. Service role teljes jogú hozzáférése (Kifejezetten csak service_role szerepkörnek!)
CREATE POLICY "accrual_entries_service_role_all"
  ON public.accrual_entries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Hitelesített felhasználók olvasási joga (SELECT)
-- InitPlan-optimalizált (SELECT auth.uid()), cégtagok és kijelölt könyvelők részére
CREATE POLICY "accrual_entries_authenticated_select"
  ON public.accrual_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accrual_entries.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
    OR has_company_access_via_cache(company_id, 'accounty')
  );

-- 4. Hitelesített felhasználók beszúrási joga (INSERT)
-- Viewer és employee szerepkörök kizárásával
CREATE POLICY "accrual_entries_authenticated_insert"
  ON public.accrual_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accrual_entries.company_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.role NOT IN ('viewer', 'employee')
    )
    OR has_company_access_via_cache(company_id, 'accounty')
  );

-- 5. Hitelesített felhasználók módosítási joga (UPDATE)
CREATE POLICY "accrual_entries_authenticated_update"
  ON public.accrual_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accrual_entries.company_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.role NOT IN ('viewer', 'employee')
    )
    OR has_company_access_via_cache(company_id, 'accounty')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accrual_entries.company_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.role NOT IN ('viewer', 'employee')
    )
    OR has_company_access_via_cache(company_id, 'accounty')
  );

-- 6. Hitelesített felhasználók törlési joga (DELETE)
CREATE POLICY "accrual_entries_authenticated_delete"
  ON public.accrual_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accrual_entries.company_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.role NOT IN ('viewer', 'employee')
    )
    OR has_company_access_via_cache(company_id, 'accounty')
  );

-- 7. Kapcsolódó RPC funkciók jogosultságainak szigorítása (Hardening)
-- Megvonjuk a PUBLIC és anon végrehajtási jogokat, és expliciten megadjuk authenticated és service_role-nak
REVOKE EXECUTE ON FUNCTION public.generate_accrual_proposals(uuid, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_accrual_proposals(uuid, uuid, integer, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.book_accrual_entry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_accrual_entry(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reverse_accrual_entry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_accrual_entry(uuid) TO authenticated, service_role;

-- 8. Számlatükör sablon függőségi index pótlása
CREATE INDEX IF NOT EXISTS idx_accrual_entries_preset
  ON public.accrual_entries(preset_id);
