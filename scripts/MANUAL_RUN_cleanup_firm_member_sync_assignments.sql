-- ============================================================================
-- MANUAL RUN (NOT part of the automatic migration pipeline - no timestamp prefix on purpose)
-- Cleanup of auto-synced accounty_assignments of accounting-firm office companies.
-- Companion of 20261011050500_fix_firm_member_sync_roles.sql  (A-247, discrepancy 1)
--
-- Why manual: it REVOKES access (deletes assignments). It must be reviewed per environment.
--   * Dev  (qhvcdqkqpgpdxogqqvyr): approved + executed 2026-10-11.
--   * Prod (vxxgvdlqvvchtlmqnrqf): run STEP 1 (preview), review the rows, only then STEP 2.
--
-- Scope: ONLY source = 'sync' rows on accounting-firm office companies
--        (public.resolve_accounting_firm_id_for_company(company_id) IS NOT NULL).
--        Manual assignments and sync rows of client companies are never touched.
-- ============================================================================

-- ─── STEP 1: preview (read-only) ────────────────────────────────────────────────────────
-- reason = orphan        : the company_members row no longer exists (membership removed, right stayed)
--          no_role       : the member's role maps to NO bookkeeping role (viewer / employee / ...)
--          wrong_role     : assistant that was synced as könyvelő (must be asszisztens)
SELECT aa.id, aa.accountant_user_id, aa.company_id, aa.role AS current_role,
       cm.role AS member_role,
       CASE
         WHEN cm.user_id IS NULL                                        THEN 'orphan'
         WHEN public.firm_member_accounting_role(cm.role) IS NULL       THEN 'no_role'
         ELSE 'wrong_role'
       END AS reason
FROM public.accounty_assignments aa
LEFT JOIN public.company_members cm
  ON cm.company_id = aa.company_id AND cm.user_id = aa.accountant_user_id
WHERE aa.source = 'sync'
  AND public.resolve_accounting_firm_id_for_company(aa.company_id) IS NOT NULL
  AND (
        cm.user_id IS NULL
     OR public.firm_member_accounting_role(cm.role) IS NULL
     OR (cm.role = 'assistant' AND aa.role <> 'asszisztens')
  );

-- ─── STEP 2: cleanup ────────────────────────────────────────────────────────────────────
BEGIN;

-- 2a) revoke: orphans + members without a bookkeeping role (the access cache follows via trigger)
DELETE FROM public.accounty_assignments aa
WHERE aa.source = 'sync'
  AND public.resolve_accounting_firm_id_for_company(aa.company_id) IS NOT NULL
  AND (
        NOT EXISTS (SELECT 1 FROM public.company_members cm
                    WHERE cm.company_id = aa.company_id AND cm.user_id = aa.accountant_user_id)
     OR EXISTS (SELECT 1 FROM public.company_members cm
                WHERE cm.company_id = aa.company_id AND cm.user_id = aa.accountant_user_id
                  AND public.firm_member_accounting_role(cm.role) IS NULL)
  );

-- 2b) downgrade: assistants that were synced as könyvelő -> asszisztens (only a downgrade, never an elevation)
UPDATE public.accounty_assignments aa
SET role = 'asszisztens', updated_at = now()
FROM public.company_members cm
WHERE cm.company_id = aa.company_id
  AND cm.user_id = aa.accountant_user_id
  AND cm.role = 'assistant'
  AND aa.source = 'sync'
  AND aa.role <> 'asszisztens'
  AND public.resolve_accounting_firm_id_for_company(aa.company_id) IS NOT NULL;

COMMIT;
