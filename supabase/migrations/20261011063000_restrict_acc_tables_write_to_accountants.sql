-- ==============================================================================
-- Migration: 20261011063000_restrict_acc_tables_write_to_accountants.sql
-- Description: Restrict direct table write access (INSERT, UPDATE, DELETE) on
--              general ledger tables (acc_journals, acc_journal_headers,
--              acc_journal_lines, acc_open_item_matches) exclusively to
--              professional accounting roles (iroda_admin, senior_könyvelő,
--              könyvelő, asszisztens) and support_admin.
--
-- Context: Discrepancy 2 of A-247 RBAC refactor. All 5 frontend auto-posters
--          (depreciation, asset activation, development reserve, dividend, payroll)
--          have been refactored to use transactional SECURITY DEFINER RPC functions
--          with strict server-side authorization. Company leadership (owner, admin, member)
--          no longer needs or has direct table write permissions on acc_* tables.
-- ==============================================================================

-- ─── 1. Drop old permissive company_members write policies ─────────────────────
DROP POLICY IF EXISTS acc_journals_authenticated_insert ON public.acc_journals;
DROP POLICY IF EXISTS acc_journals_authenticated_update ON public.acc_journals;
DROP POLICY IF EXISTS acc_journals_authenticated_delete ON public.acc_journals;

DROP POLICY IF EXISTS acc_journal_headers_authenticated_insert ON public.acc_journal_headers;
DROP POLICY IF EXISTS acc_journal_headers_authenticated_update ON public.acc_journal_headers;
DROP POLICY IF EXISTS acc_journal_headers_authenticated_delete ON public.acc_journal_headers;

DROP POLICY IF EXISTS acc_journal_lines_authenticated_insert ON public.acc_journal_lines;
DROP POLICY IF EXISTS acc_journal_lines_authenticated_update ON public.acc_journal_lines;
DROP POLICY IF EXISTS acc_journal_lines_authenticated_delete ON public.acc_journal_lines;

DROP POLICY IF EXISTS acc_open_item_matches_company_member ON public.acc_open_item_matches;

-- ─── 2. Add SELECT policy for company_members on acc_open_item_matches ────────
-- (Ensure company members can still read/view open item matches for financial reports)
CREATE POLICY acc_open_item_matches_authenticated_select ON public.acc_open_item_matches
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid()))
    OR public.is_support_admin()
  );

-- ─── 3. Add explicit support_admin write policies ──────────────────────────────
-- (Ensures support_admin can perform administrative operations without an accounting firm assignment)
CREATE POLICY acc_journals_support_admin_write ON public.acc_journals
  FOR ALL TO authenticated
  USING (public.is_support_admin())
  WITH CHECK (public.is_support_admin());

CREATE POLICY acc_journal_headers_support_admin_write ON public.acc_journal_headers
  FOR ALL TO authenticated
  USING (public.is_support_admin())
  WITH CHECK (public.is_support_admin());

CREATE POLICY acc_journal_lines_support_admin_write ON public.acc_journal_lines
  FOR ALL TO authenticated
  USING (public.is_support_admin())
  WITH CHECK (public.is_support_admin());

CREATE POLICY acc_open_item_matches_support_admin_write ON public.acc_open_item_matches
  FOR ALL TO authenticated
  USING (public.is_support_admin())
  WITH CHECK (public.is_support_admin());

-- ─── 4. Update RESTRICTIVE write guards on the 4 ledger tables ─────────────────
-- Re-point rls_guard_write_ins/upd/del on acc_* tables so that direct write
-- is strictly restricted to professional accountants or support_admin.
DO $do$
DECLARE
  v_direct_expr text := '(company_id IN (SELECT public.rls_accounty_bookkeeping_company_ids()) OR public.is_support_admin())';
  v_lines_expr text := '(EXISTS (SELECT 1 FROM public.acc_journal_headers h WHERE h.id = acc_journal_lines.header_id AND (h.company_id IN (SELECT public.rls_accounty_bookkeeping_company_ids()) OR public.is_support_admin())))';
  r record;
BEGIN
  -- Direct tables (acc_journals, acc_journal_headers, acc_open_item_matches)
  FOR r IN SELECT unnest(ARRAY['acc_journals', 'acc_journal_headers', 'acc_open_item_matches']) AS tbl
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS rls_guard_write_ins ON public.%I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_guard_write_upd ON public.%I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_guard_write_del ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY rls_guard_write_ins ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK %s', r.tbl, v_direct_expr);
    EXECUTE format('CREATE POLICY rls_guard_write_upd ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING %s WITH CHECK %s', r.tbl, v_direct_expr, v_direct_expr);
    EXECUTE format('CREATE POLICY rls_guard_write_del ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING %s', r.tbl, v_direct_expr);
  END LOOP;

  -- Child table (acc_journal_lines)
  EXECUTE 'DROP POLICY IF EXISTS rls_guard_write_ins ON public.acc_journal_lines';
  EXECUTE 'DROP POLICY IF EXISTS rls_guard_write_upd ON public.acc_journal_lines';
  EXECUTE 'DROP POLICY IF EXISTS rls_guard_write_del ON public.acc_journal_lines';
  EXECUTE format('CREATE POLICY rls_guard_write_ins ON public.acc_journal_lines AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK %s', v_lines_expr);
  EXECUTE format('CREATE POLICY rls_guard_write_upd ON public.acc_journal_lines AS RESTRICTIVE FOR UPDATE TO authenticated USING %s WITH CHECK %s', v_lines_expr, v_lines_expr);
  EXECUTE format('CREATE POLICY rls_guard_write_del ON public.acc_journal_lines AS RESTRICTIVE FOR DELETE TO authenticated USING %s', v_lines_expr);
END
$do$;

NOTIFY pgrst, 'reload schema';
