-- ============================================================================
-- RLS hardening for the role/capability refactor (follow-up of 20261011012947)
-- ADR : docs/architecture/decisions/A-247-role-capability-matrix.md (addendum)
--
--  1. Role-aware WRITE guards (RESTRICTIVE policies) so that "Megfigyelő" (viewer),
--     employee, eaisyBill assistant (on accounting data) and payroll_specialist cannot
--     write books/VAT data through the Data API - not only in the UI.
--  2. payroll_specialist (Bérszámfejtő) READ isolation on financial tables.
--  3. VAT-return immutability: finalized returns (header + lines) can no longer be
--     DELETED / modified / recalculated by anybody who may not finalize them.
--
-- Design notes
--  * RESTRICTIVE policies are AND-ed with the existing permissive ones, so they can only
--    NARROW access - no existing grant is widened and no existing policy is rewritten.
--  * Role -> company sets are computed by SECURITY DEFINER set-returning helpers and used as
--    uncorrelated `company_id NOT IN (SELECT fn(...))` predicates (hashed SubPlan, evaluated
--    once per statement - ADR A-103), keeping hot tables (invoices, transactions) fast.
--  * service_role / postgres (BYPASSRLS) and SECURITY DEFINER RPCs/triggers are unaffected.
--  * Per-user module overrides (eaisybill_module_permissions / accounty_module_permissions)
--    can GRANT more than the role floor (hybrid model, D-5) - they never remove it.
--
-- Idempotent: safe to re-run.   Rollback: see the DROP block in the ADR addendum.
-- ============================================================================

-- ─── 1. Helper: companies where the current user may NOT write a data class ─────────────
-- p_level   'invoicing'  : owner/admin/member/assistant (+ accounty roles except payroll_specialist)
--           'accounting' : owner/admin/member only (+ accounty roles except payroll_specialist)
-- p_modules : module keys whose can_write override re-opens write access for this user
CREATE OR REPLACE FUNCTION public.rls_write_denied_company_ids(p_level text, p_modules text[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT r.company_id
  FROM (
    -- eaisyBill membership
    SELECT cm.company_id,
           (cm.role IN ('owner', 'admin', 'member', 'support_admin')
            OR (p_level = 'invoicing' AND cm.role = 'assistant')) AS ok
    FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
    UNION ALL
    -- eaisyBooks assignment (cache row) - every accounting role may write except the Bérszámfejtő
    SELECT c.company_id, (c.role <> 'payroll_specialist') AS ok
    FROM public.user_company_access_cache c
    WHERE c.user_id = (SELECT auth.uid())
      AND c.access_source = 'accounty'
    UNION ALL
    -- eaisyBill per-user module override (owner re-enabled a module)
    SELECT emp.company_id, true
    FROM public.eaisybill_module_permissions emp
    WHERE emp.user_id = (SELECT auth.uid())
      AND emp.module_name = ANY (p_modules)
      AND COALESCE(emp.can_write, false)
    UNION ALL
    -- eaisyBooks per-user module override (iroda_admin re-enabled a module, e.g. for payroll_specialist)
    SELECT aa.company_id, true
    FROM public.accounty_module_permissions amp
    JOIN public.accounty_assignments aa
      ON aa.accounting_firm_id = amp.accounting_firm_id
     AND aa.accountant_user_id = amp.user_id
    WHERE amp.user_id = (SELECT auth.uid())
      AND amp.module_name = ANY (p_modules)
      AND COALESCE(amp.can_write, false)
  ) r
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND NOT public.is_support_admin()
  GROUP BY r.company_id
  HAVING NOT bool_or(r.ok);
$function$;

REVOKE ALL ON FUNCTION public.rls_write_denied_company_ids(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rls_write_denied_company_ids(text, text[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.rls_write_denied_company_ids(text, text[]) IS
  'RLS helper (A-247): companies where the current user has NO write right for the given data class (viewer, employee, assistant on accounting data, payroll_specialist without override).';

-- ─── 2. Helper: companies where the current user is a payroll-only accountant ───────────
-- Bérszámfejtő (payroll_specialist): no read access to books / invoices / bank data unless an
-- explicit accounty_module_permissions override grants can_read for the module (D-5 hybrid).
CREATE OR REPLACE FUNCTION public.rls_payroll_blocked_company_ids(p_modules text[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.company_id
  FROM public.user_company_access_cache c
  WHERE c.user_id = (SELECT auth.uid())
    AND c.access_source = 'accounty'
    AND c.role = 'payroll_specialist'
    AND NOT public.is_support_admin()
    -- a real company membership (other than employee) always wins
    AND NOT EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = c.company_id
        AND cm.user_id = c.user_id
        AND cm.role <> 'employee'
    )
    -- explicit read override for this module
    AND NOT EXISTS (
      SELECT 1
      FROM public.accounty_module_permissions amp
      JOIN public.accounty_assignments aa
        ON aa.accounting_firm_id = amp.accounting_firm_id
       AND aa.accountant_user_id = amp.user_id
       AND aa.company_id = c.company_id
      WHERE amp.user_id = c.user_id
        AND amp.module_name = ANY (p_modules)
        AND COALESCE(amp.can_read, false)
    );
$function$;

REVOKE ALL ON FUNCTION public.rls_payroll_blocked_company_ids(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rls_payroll_blocked_company_ids(text[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.rls_payroll_blocked_company_ids(text[]) IS
  'RLS helper (A-247, D-5): companies where the current user is only a payroll_specialist (no read access to books/invoices unless overridden).';

-- ─── 3. RESTRICTIVE policies ────────────────────────────────────────────────────────────
DO $do$
DECLARE
  r record;
  v_expr text;
BEGIN
  -- 3a. Role-aware write guards, tables carrying company_id directly
  FOR r IN
    SELECT * FROM (VALUES
      ('vat_returns',            'accounting', ARRAY['vat_return']),
      ('vat_return_a60_lines',   'accounting', ARRAY['vat_return']),
      ('acc_journals',           'accounting', ARRAY['general_ledger', 'journals']),
      ('acc_journal_headers',    'accounting', ARRAY['general_ledger', 'journals']),
      ('acc_open_item_matches',  'accounting', ARRAY['general_ledger', 'journals']),
      ('acc_accounting_periods', 'accounting', ARRAY['general_ledger', 'journals'])
    ) AS t(tbl, lvl, mods)
  LOOP
    CONTINUE WHEN to_regclass('public.' || r.tbl) IS NULL;
    v_expr := format(
      '(company_id IS NULL OR company_id NOT IN (SELECT public.rls_write_denied_company_ids(%L, %L::text[])))',
      r.lvl, r.mods::text);

    EXECUTE format('DROP POLICY IF EXISTS rls_guard_write_ins ON public.%I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_guard_write_upd ON public.%I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_guard_write_del ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY rls_guard_write_ins ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK %s', r.tbl, v_expr);
    EXECUTE format('CREATE POLICY rls_guard_write_upd ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING %s WITH CHECK %s', r.tbl, v_expr, v_expr);
    EXECUTE format('CREATE POLICY rls_guard_write_del ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING %s', r.tbl, v_expr);
  END LOOP;

  -- 3b. Role-aware write guards, child tables resolved through the parent's company_id
  FOR r IN
    SELECT * FROM (VALUES
      ('vat_return_lines',   'vat_returns',        'vat_return_id', 'accounting', ARRAY['vat_return']),
      ('vat_return_m_lines', 'vat_returns',        'vat_return_id', 'accounting', ARRAY['vat_return']),
      ('acc_journal_lines',  'acc_journal_headers', 'header_id',     'accounting', ARRAY['general_ledger', 'journals']),
      ('invoice_items',      'invoices',           'invoice_id',    'invoicing',  ARRAY['invoices'])
    ) AS t(tbl, parent, fk, lvl, mods)
  LOOP
    CONTINUE WHEN to_regclass('public.' || r.tbl) IS NULL OR to_regclass('public.' || r.parent) IS NULL;
    v_expr := format(
      '(NOT EXISTS (SELECT 1 FROM public.%I p WHERE p.id = public.%I.%I AND p.company_id IN (SELECT public.rls_write_denied_company_ids(%L, %L::text[]))))',
      r.parent, r.tbl, r.fk, r.lvl, r.mods::text);

    EXECUTE format('DROP POLICY IF EXISTS rls_guard_write_ins ON public.%I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_guard_write_upd ON public.%I', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_guard_write_del ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY rls_guard_write_ins ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK %s', r.tbl, v_expr);
    EXECUTE format('CREATE POLICY rls_guard_write_upd ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING %s WITH CHECK %s', r.tbl, v_expr, v_expr);
    EXECUTE format('CREATE POLICY rls_guard_write_del ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING %s', r.tbl, v_expr);
  END LOOP;

  -- 3c. payroll_specialist read isolation (SELECT) on financial / bookkeeping tables.
  --     accounty_ev_records_wages is intentionally NOT isolated (payroll-relevant data).
  FOR r IN
    SELECT tbl, mods FROM (VALUES
      ('invoices',                           ARRAY['invoices']),
      ('nav_invoices',                       ARRAY['invoices']),
      ('transactions',                       ARRAY['transactions']),
      ('partners',                           ARRAY['partners']),
      ('vat_returns',                        ARRAY['vat_return']),
      ('vat_return_a60_lines',               ARRAY['vat_return']),
      ('vat_codes',                          ARRAY['vat_return']),
      ('accrual_entries',                    ARRAY['general_ledger']),
      ('purchase_vouchers',                  ARRAY['invoices']),
      ('purchase_voucher_items',             ARRAY['invoices']),
      ('llm_koltsegek',                      ARRAY['invoices']),
      ('accounty_penztarkonyv_tetel',        ARRAY['client_bookkeeping']),
      ('accounty_penztarkonyv_period_close', ARRAY['client_bookkeeping'])
    ) AS t(tbl, mods)
    UNION ALL
    SELECT c.relname::text, ARRAY['client_bookkeeping']
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind = 'r'
      AND c.relname LIKE 'accounty\_ev\_%'
      AND c.relname <> 'accounty_ev_records_wages'
  LOOP
    CONTINUE WHEN to_regclass('public.' || r.tbl) IS NULL;
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns k
      WHERE k.table_schema = 'public' AND k.table_name = r.tbl AND k.column_name = 'company_id');
    v_expr := format(
      '(company_id IS NULL OR company_id NOT IN (SELECT public.rls_payroll_blocked_company_ids(%L::text[])))',
      r.mods::text);

    EXECUTE format('DROP POLICY IF EXISTS rls_guard_payroll_isolation ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY rls_guard_payroll_isolation ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING %s', r.tbl, v_expr);
  END LOOP;
END
$do$;

-- ─── 4. VAT-return immutability (header) ────────────────────────────────────────────────
-- Replaces fn_vat_returns_finalize_guard (20261011012947): now also covers DELETE and EVERY update
-- of a finalized return, not only status transitions.
-- Re-states SECURITY DEFINER + search_path (CREATE OR REPLACE does not inherit attributes, A-020).
CREATE OR REPLACE FUNCTION public.fn_vat_returns_finalize_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'finalized' AND NOT public.can_finalize_company_filing(NEW.company_id) THEN
      RAISE EXCEPTION 'ACCESS_DENIED: csak senior könyvelő, iroda admin vagy a cég vezetői véglegesíthetik az ÁFA bevallást'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- status transition to/from 'finalized' OR any change of an already finalized return
    IF (OLD.status = 'finalized' OR NEW.status = 'finalized')
       AND NOT public.can_finalize_company_filing(NEW.company_id) THEN
      RAISE EXCEPTION 'ACCESS_DENIED: lezárt ÁFA bevallást csak senior könyvelő, iroda admin vagy a cég vezetői módosíthat / nyithat vissza'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  ELSE -- DELETE
    IF OLD.status = 'finalized' AND NOT public.can_finalize_company_filing(OLD.company_id) THEN
      RAISE EXCEPTION 'ACCESS_DENIED: lezárt ÁFA bevallást csak senior könyvelő, iroda admin vagy a cég vezetői törölhet'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_vat_returns_finalize_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_vat_returns_finalize_guard ON public.vat_returns;
CREATE TRIGGER trg_vat_returns_finalize_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.vat_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_vat_returns_finalize_guard();

-- ─── 5. VAT-return immutability (lines) ─────────────────────────────────────────────────
-- calculate_*_vat_return are SECURITY DEFINER and rewrite the lines of a return. auth.uid() still
-- identifies the caller, so a non-senior user can no longer recalculate / edit a FINALIZED return.
CREATE OR REPLACE FUNCTION public.fn_vat_return_children_finalize_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_return_id uuid;
  v_status    text;
  v_company   uuid;
  v_pass      int;
BEGIN
  -- pass 1 = OLD row (UPDATE/DELETE), pass 2 = NEW row (INSERT/UPDATE)
  FOR v_pass IN 1..2 LOOP
    IF v_pass = 1 AND TG_OP = 'INSERT' THEN CONTINUE; END IF;
    IF v_pass = 2 AND TG_OP = 'DELETE' THEN CONTINUE; END IF;

    v_return_id := CASE WHEN v_pass = 1 THEN OLD.vat_return_id ELSE NEW.vat_return_id END;
    SELECT vr.status, vr.company_id INTO v_status, v_company
    FROM public.vat_returns vr
    WHERE vr.id = v_return_id;

    IF v_status = 'finalized' AND NOT public.can_finalize_company_filing(v_company) THEN
      RAISE EXCEPTION 'ACCESS_DENIED: lezárt ÁFA bevallás sorait csak senior könyvelő, iroda admin vagy a cég vezetői módosíthatják (előbb vissza kell nyitni)'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_vat_return_children_finalize_guard() FROM PUBLIC, anon, authenticated;

DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vat_return_lines', 'vat_return_m_lines', 'vat_return_a60_lines']
  LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_finalize_guard ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_finalize_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_vat_return_children_finalize_guard()',
      t, t);
  END LOOP;
END
$do$;

NOTIFY pgrst, 'reload schema';
