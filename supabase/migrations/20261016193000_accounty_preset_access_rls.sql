-- ============================================================================
-- Migration: Grant external accountants access to company chart_of_accounts_presets
-- Ticket: EB-0280 (Different preset and missing subledger account 4541 for external accountant)
-- ADR: docs/architecture/decisions/A-247-role-capability-matrix.md
--
-- Problem:
--   chart_of_accounts_presets only had policies for company_members.
--   External accountants assigned via accounty_assignments could not see company-specific
--   custom presets via RLS, falling back to the generic built-in preset.
--   Consequently, accounts created in custom presets (such as 4541) were invisible
--   in the ledger and subledger views for assigned accountants.
--
-- Solution:
--   Add PERMISSIVE RLS policies on public.chart_of_accounts_presets:
--   1) accounty_bookkeeping_read (SELECT): allows users in rls_accounty_bookkeeping_company_ids()
--      and support admins.
--   2) accounty_bookkeeping_write (ALL): allows users in rls_accounty_bookkeeping_company_ids()
--      and support admins.
--
-- Idempotent & safe to re-run.
-- ============================================================================

DO $do$
BEGIN
  IF to_regclass('public.chart_of_accounts_presets') IS NOT NULL THEN
    -- Read policy for assigned external accountants
    DROP POLICY IF EXISTS accounty_bookkeeping_read ON public.chart_of_accounts_presets;
    CREATE POLICY accounty_bookkeeping_read ON public.chart_of_accounts_presets
      AS PERMISSIVE FOR SELECT TO authenticated
      USING (
        company_id IN (SELECT public.rls_accounty_bookkeeping_company_ids())
        OR public.is_support_admin()
      );

    -- Write policy for assigned external accountants
    DROP POLICY IF EXISTS accounty_bookkeeping_write ON public.chart_of_accounts_presets;
    CREATE POLICY accounty_bookkeeping_write ON public.chart_of_accounts_presets
      AS PERMISSIVE FOR ALL TO authenticated
      USING (
        company_id IN (SELECT public.rls_accounty_bookkeeping_company_ids())
        OR public.is_support_admin()
      )
      WITH CHECK (
        company_id IN (SELECT public.rls_accounty_bookkeeping_company_ids())
        OR public.is_support_admin()
      );
  END IF;
END
$do$;

NOTIFY pgrst, 'reload schema';
