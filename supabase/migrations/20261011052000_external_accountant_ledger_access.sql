-- ============================================================================
-- External accountant (accounty_assignments WITHOUT a company_members row) - ledger access
-- ADR : docs/architecture/decisions/A-247-role-capability-matrix.md (addendum, discrepancy 3)
--
-- Problem: the whole acc_* ledger family only checked company_members. An external accountant
-- (assignment only, e.g. a client company managed by an accounting firm) could neither READ nor
-- WRITE journals through the Data API, although invoices / transactions / vat_returns are already
-- readable for him via the access cache.
--
-- Decision (user-approved option 1): add PERMISSIVE policies for every non-payroll accounty role.
--   iroda_admin, senior_könyvelő, könyvelő, asszisztens  -> read + write the ledger
--   payroll_specialist (Bérszámfejtő)                      -> NO ledger access (not in the helper)
--   acc_journals, acc_journal_headers, acc_journal_lines, acc_open_item_matches : FOR ALL
--   acc_accounting_periods : SELECT only. The closed-period lock of the journal UI is evaluated
--                            client-side from this table; without read access it would fail OPEN.
--                            Closing / reopening a period stays reserved to company members.
--   invoice_items          : SELECT only (parity with invoices, which externals can already read).
--                            Writing invoices / transactions for externals is a separate decision.
--
-- Source of truth = accounty_assignments (not the access cache, which is derived data).
-- Existing policies are NOT rewritten; the RESTRICTIVE write guards of 20261011042300 still AND
-- on top (viewer / employee / payroll_specialist can never write, a member-level downgrade wins).
-- service_role / SECURITY DEFINER RPCs are unaffected.
--
-- Idempotent: safe to re-run.   Rollback: DROP POLICY accounty_bookkeeping_* + DROP FUNCTION (ADR addendum).
-- ============================================================================

-- ─── 1. Helper: companies where the current user holds a non-payroll accounty assignment ─
-- SETOF + uncorrelated `IN (SELECT fn())` => hashed SubPlan, evaluated once per statement (A-103).
CREATE OR REPLACE FUNCTION public.rls_accounty_bookkeeping_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT aa.company_id
  FROM public.accounty_assignments aa
  WHERE aa.accountant_user_id = (SELECT auth.uid())
    AND aa.role IN ('iroda_admin', 'senior_könyvelő', 'könyvelő', 'asszisztens');
$function$;

REVOKE ALL ON FUNCTION public.rls_accounty_bookkeeping_company_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rls_accounty_bookkeeping_company_ids() TO authenticated, service_role;

COMMENT ON FUNCTION public.rls_accounty_bookkeeping_company_ids() IS
  'RLS helper (A-247): companies where the current user has a bookkeeping-capable accounty assignment (every accounty role except payroll_specialist).';

-- ─── 2. Policies ───────────────────────────────────────────────────────────────────────
DO $do$
DECLARE
  r record;
  v_expr text;
BEGIN
  -- 2a) tables carrying company_id directly: FOR ALL (journals, headers, open-item matches)
  FOR r IN
    SELECT unnest(ARRAY['acc_journals', 'acc_journal_headers', 'acc_open_item_matches']) AS tbl
  LOOP
    CONTINUE WHEN to_regclass('public.' || r.tbl) IS NULL;
    v_expr := '(company_id IN (SELECT public.rls_accounty_bookkeeping_company_ids()))';
    EXECUTE format('DROP POLICY IF EXISTS accounty_bookkeeping_access ON public.%I', r.tbl);
    EXECUTE format(
      'CREATE POLICY accounty_bookkeeping_access ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING %s WITH CHECK %s',
      r.tbl, v_expr, v_expr);
  END LOOP;

  -- 2b) period table: SELECT only (closed-period lock must be visible, closing stays with members)
  IF to_regclass('public.acc_accounting_periods') IS NOT NULL THEN
    DROP POLICY IF EXISTS accounty_bookkeeping_read ON public.acc_accounting_periods;
    CREATE POLICY accounty_bookkeeping_read ON public.acc_accounting_periods
      AS PERMISSIVE FOR SELECT TO authenticated
      USING (company_id IN (SELECT public.rls_accounty_bookkeeping_company_ids()));
  END IF;

  -- 2c) journal lines: resolved through the parent header's company
  IF to_regclass('public.acc_journal_lines') IS NOT NULL THEN
    v_expr := '(EXISTS (SELECT 1 FROM public.acc_journal_headers h WHERE h.id = acc_journal_lines.header_id AND h.company_id IN (SELECT public.rls_accounty_bookkeeping_company_ids())))';
    DROP POLICY IF EXISTS accounty_bookkeeping_access ON public.acc_journal_lines;
    EXECUTE format(
      'CREATE POLICY accounty_bookkeeping_access ON public.acc_journal_lines AS PERMISSIVE FOR ALL TO authenticated USING %s WITH CHECK %s',
      v_expr, v_expr);
  END IF;

  -- 2d) invoice items: SELECT only, resolved through the parent invoice's company
  IF to_regclass('public.invoice_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS accounty_bookkeeping_read ON public.invoice_items;
    CREATE POLICY accounty_bookkeeping_read ON public.invoice_items
      AS PERMISSIVE FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_items.invoice_id
          AND i.company_id IN (SELECT public.rls_accounty_bookkeeping_company_ids())));
  END IF;
END
$do$;

NOTIFY pgrst, 'reload schema';
