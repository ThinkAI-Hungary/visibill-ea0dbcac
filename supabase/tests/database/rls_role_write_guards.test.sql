-- ==============================================================================
-- pgTAP Test: role-aware write guards, payroll_specialist isolation, VAT immutability
-- Covers migration: 20261011042300_rls_role_write_guards_and_payroll_isolation.sql (A-247 addendum)
-- Run: npx supabase test db  (ends with ROLLBACK - no data is left behind)
--
-- Part 1 = catalog assertions (always runnable).
-- Part 2 = behavioural persona matrix. It picks an existing company that has a finalized and a
--          draft VAT return plus an invoice item, and 4 spare auth users with NO relation to that
--          company (otherwise "highest relation wins" would mask the guard). If no such fixture
--          exists in the database the behavioural assertions FAIL with 'fixture-missing'
--          (deliberate signal, not a silent skip).
-- ==============================================================================

BEGIN;

SET search_path TO 'public', 'extensions';

SELECT plan(44);

-- ─── Part 1: helper functions ─────────────────────────────────────────────────────────
SELECT is(
  (SELECT provolatile FROM pg_proc WHERE oid = 'public.rls_write_denied_company_ids(text,text[])'::regprocedure),
  's'::"char", 'rls_write_denied_company_ids is STABLE');
SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.rls_write_denied_company_ids(text,text[])'::regprocedure),
  'rls_write_denied_company_ids is SECURITY DEFINER');
SELECT ok(
  (SELECT proconfig::text LIKE '%search_path=public%' FROM pg_proc WHERE oid = 'public.rls_write_denied_company_ids(text,text[])'::regprocedure),
  'rls_write_denied_company_ids pins search_path');
SELECT ok(NOT has_function_privilege('anon', 'public.rls_write_denied_company_ids(text,text[])', 'EXECUTE'),
  'anon must NOT execute rls_write_denied_company_ids');
SELECT ok(has_function_privilege('authenticated', 'public.rls_write_denied_company_ids(text,text[])', 'EXECUTE'),
  'authenticated MAY execute rls_write_denied_company_ids (needed by RLS)');
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    WHERE p.oid = 'public.rls_write_denied_company_ids(text,text[])'::regprocedure
      AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'),
  'PUBLIC must NOT hold EXECUTE on rls_write_denied_company_ids');

SELECT is(
  (SELECT provolatile FROM pg_proc WHERE oid = 'public.rls_payroll_blocked_company_ids(text[])'::regprocedure),
  's'::"char", 'rls_payroll_blocked_company_ids is STABLE');
SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.rls_payroll_blocked_company_ids(text[])'::regprocedure),
  'rls_payroll_blocked_company_ids is SECURITY DEFINER');
SELECT ok(
  (SELECT proconfig::text LIKE '%search_path=public%' FROM pg_proc WHERE oid = 'public.rls_payroll_blocked_company_ids(text[])'::regprocedure),
  'rls_payroll_blocked_company_ids pins search_path');
SELECT ok(NOT has_function_privilege('anon', 'public.rls_payroll_blocked_company_ids(text[])', 'EXECUTE'),
  'anon must NOT execute rls_payroll_blocked_company_ids');
SELECT ok(has_function_privilege('authenticated', 'public.rls_payroll_blocked_company_ids(text[])', 'EXECUTE'),
  'authenticated MAY execute rls_payroll_blocked_company_ids (needed by RLS)');

-- ─── Part 1: RESTRICTIVE write policies (10 tables x 3 commands) ───────────────────────
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND policyname LIKE 'rls\_guard\_write\_%'
     AND permissive = 'RESTRICTIVE'
     AND tablename IN ('vat_returns','vat_return_a60_lines','acc_journals','acc_journal_headers',
                       'acc_open_item_matches','acc_accounting_periods','vat_return_lines',
                       'vat_return_m_lines','acc_journal_lines','invoice_items')),
  30, '10 tables carry 3 RESTRICTIVE write guards each (INSERT/UPDATE/DELETE)');

SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND policyname LIKE 'rls\_guard\_write\_%' AND permissive <> 'RESTRICTIVE'),
  0, 'no write guard is PERMISSIVE (guards may only narrow access)');

SELECT ok(
  (SELECT count(*) = 3 FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'invoice_items' AND policyname LIKE 'rls\_guard\_write\_%'),
  'invoice_items has the 3 write guards (assistant may write, viewer/employee may not)');

-- ─── Part 1: payroll_specialist isolation ──────────────────────────────────────────────
SELECT ok(
  (SELECT count(*) >= 33 FROM pg_policies
   WHERE schemaname = 'public' AND policyname = 'rls_guard_payroll_isolation'
     AND permissive = 'RESTRICTIVE' AND cmd = 'SELECT'),
  'at least 33 tables carry the RESTRICTIVE payroll isolation SELECT policy');

SELECT ok(
  (SELECT bool_and(EXISTS (SELECT 1 FROM pg_policies p
                           WHERE p.schemaname = 'public' AND p.tablename = t
                             AND p.policyname = 'rls_guard_payroll_isolation'))
   FROM unnest(ARRAY['invoices','nav_invoices','transactions','partners','vat_returns','vat_codes',
                     'accrual_entries','purchase_vouchers','llm_koltsegek',
                     'accounty_penztarkonyv_tetel']) AS t),
  'core financial tables are isolated from payroll_specialist');

SELECT ok(
  NOT EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'accounty_ev_records_wages'
                AND policyname = 'rls_guard_payroll_isolation'),
  'accounty_ev_records_wages is intentionally NOT isolated (payroll-relevant)');

-- ─── Part 1: VAT immutability triggers ─────────────────────────────────────────────────
SELECT ok(NOT has_function_privilege('authenticated', 'public.fn_vat_returns_finalize_guard()', 'EXECUTE'),
  'authenticated must NOT execute fn_vat_returns_finalize_guard');
SELECT ok(NOT has_function_privilege('authenticated', 'public.fn_vat_return_children_finalize_guard()', 'EXECUTE'),
  'authenticated must NOT execute fn_vat_return_children_finalize_guard');
SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.fn_vat_return_children_finalize_guard()'::regprocedure),
  'fn_vat_return_children_finalize_guard is SECURITY DEFINER');
SELECT ok(
  (SELECT proconfig::text LIKE '%search_path=public%' FROM pg_proc WHERE oid = 'public.fn_vat_return_children_finalize_guard()'::regprocedure),
  'fn_vat_return_children_finalize_guard pins search_path');

SELECT ok(
  (SELECT (tgtype & 4) <> 0 AND (tgtype & 8) <> 0 AND (tgtype & 16) <> 0   -- INSERT, DELETE, UPDATE
   FROM pg_trigger WHERE tgrelid = 'public.vat_returns'::regclass AND tgname = 'trg_vat_returns_finalize_guard'),
  'vat_returns guard fires on INSERT, UPDATE and DELETE');

SELECT ok(
  (SELECT count(*) = 3 FROM pg_trigger
   WHERE NOT tgisinternal
     AND tgname IN ('trg_vat_return_lines_finalize_guard',
                    'trg_vat_return_m_lines_finalize_guard',
                    'trg_vat_return_a60_lines_finalize_guard')
     AND (tgtype & 4) <> 0 AND (tgtype & 8) <> 0 AND (tgtype & 16) <> 0),
  'all 3 VAT line tables have the INSERT/UPDATE/DELETE finalize guard');

-- ─── Part 2: behavioural persona matrix ────────────────────────────────────────────────
CREATE TEMP TABLE _rls_res (k text PRIMARY KEY, v text);
GRANT ALL ON _rls_res TO authenticated;

DO $fx$
DECLARE
  v_co uuid; v_vat_fin uuid; v_vat_draft uuid; v_item uuid; v_firm uuid;
  us uuid[]; u uuid; persona text; n int;
  personas text[] := ARRAY['viewer','assistant','payroll','konyvelo','owner','admin','member','employee'];
  i int;
BEGIN
  SELECT vr.company_id INTO v_co FROM public.vat_returns vr
  WHERE vr.status = 'finalized'
    AND EXISTS (SELECT 1 FROM public.vat_returns d WHERE d.company_id = vr.company_id AND d.status <> 'finalized')
    AND EXISTS (SELECT 1 FROM public.invoices i JOIN public.invoice_items ii ON ii.invoice_id = i.id WHERE i.company_id = vr.company_id)
    AND EXISTS (SELECT 1 FROM public.accounty_assignments)
    -- NOT an accounting-firm office company: sync_company_member_to_eaisybooks() turns every member of
    -- such a company into an accounty assignment (admin -> iroda_admin, others -> könyvelő), which would
    -- mask the eaisyBill role under test.
    AND NOT EXISTS (SELECT 1 FROM public.accounty_assignments aa WHERE aa.accounting_firm_id = vr.company_id)
    AND NOT EXISTS (SELECT 1 FROM public.companies c JOIN public.accounty_assignments aa
                      ON aa.accountant_user_id = c.owner_id AND aa.role = 'iroda_admin' AND aa.accounting_firm_id IS NOT NULL
                    WHERE c.id = vr.company_id)
  LIMIT 1;
  IF v_co IS NULL THEN RETURN; END IF;

  SELECT id INTO v_vat_fin   FROM public.vat_returns WHERE company_id = v_co AND status = 'finalized' LIMIT 1;
  SELECT id INTO v_vat_draft FROM public.vat_returns WHERE company_id = v_co AND status <> 'finalized' LIMIT 1;
  SELECT ii.id INTO v_item FROM public.invoice_items ii JOIN public.invoices i ON i.id = ii.invoice_id WHERE i.company_id = v_co LIMIT 1;
  SELECT accounting_firm_id INTO v_firm FROM public.accounty_assignments LIMIT 1;

  us := ARRAY(SELECT x.id FROM auth.users x
    WHERE NOT EXISTS (SELECT 1 FROM public.company_members m WHERE m.user_id = x.id AND m.company_id = v_co)
      AND NOT EXISTS (SELECT 1 FROM public.user_company_access_cache c WHERE c.user_id = x.id AND c.company_id = v_co)
      AND NOT EXISTS (SELECT 1 FROM public.accounty_assignments a WHERE a.accountant_user_id = x.id)
      AND NOT EXISTS (SELECT 1 FROM public.accounty_module_permissions p WHERE p.user_id = x.id)
      AND NOT EXISTS (SELECT 1 FROM public.eaisybill_module_permissions p WHERE p.user_id = x.id)
      AND NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = x.id AND pr.is_support_admin)
    ORDER BY x.id LIMIT 8);
  IF cardinality(us) < 8 THEN RETURN; END IF;

  INSERT INTO public.company_members (company_id, user_id, role) VALUES (v_co, us[1], 'viewer');
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (v_co, us[2], 'assistant');
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (v_co, us[5], 'owner');
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (v_co, us[6], 'admin');
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (v_co, us[7], 'member');
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (v_co, us[8], 'employee');
  INSERT INTO public.accounty_assignments (accounting_firm_id, company_id, accountant_user_id, role)
    VALUES (v_firm, v_co, us[3], 'payroll_specialist');
  INSERT INTO public.accounty_assignments (accounting_firm_id, company_id, accountant_user_id, role)
    VALUES (v_firm, v_co, us[4], 'könyvelő');

  FOR i IN 1..8 LOOP
    persona := personas[i]; u := us[i];
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO n FROM public.invoices WHERE company_id = v_co;
    INSERT INTO _rls_res VALUES (persona || '.read_invoices', n::text);
    SELECT count(*) INTO n FROM public.vat_returns WHERE company_id = v_co;
    INSERT INTO _rls_res VALUES (persona || '.read_vat', n::text);

    UPDATE public.vat_returns SET status = status WHERE id = v_vat_draft;
    GET DIAGNOSTICS n = ROW_COUNT;
    INSERT INTO _rls_res VALUES (persona || '.upd_draft_vat', n::text);

    UPDATE public.invoice_items SET id = id WHERE id = v_item;
    GET DIAGNOSTICS n = ROW_COUNT;
    INSERT INTO _rls_res VALUES (persona || '.upd_invoice_item', n::text);

    BEGIN
      UPDATE public.vat_returns SET status = status WHERE id = v_vat_fin;
      GET DIAGNOSTICS n = ROW_COUNT;
      INSERT INTO _rls_res VALUES (persona || '.upd_final_vat', n::text);
    EXCEPTION WHEN insufficient_privilege THEN
      INSERT INTO _rls_res VALUES (persona || '.upd_final_vat', 'blocked');
    END;

    BEGIN
      DELETE FROM public.vat_returns WHERE id = v_vat_fin;
      GET DIAGNOSTICS n = ROW_COUNT;
      INSERT INTO _rls_res VALUES (persona || '.del_final_vat', n::text);
    EXCEPTION WHEN insufficient_privilege THEN
      INSERT INTO _rls_res VALUES (persona || '.del_final_vat', 'blocked');
    END;

    RESET ROLE;
  END LOOP;
END
$fx$;

-- viewer (Megfigyelő): reads, never writes
SELECT ok(coalesce((SELECT v::int > 0 FROM _rls_res WHERE k = 'viewer.read_vat'), false),
  'viewer can READ vat_returns');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'viewer.upd_draft_vat'), 'fixture-missing'), '0',
  'viewer cannot update a draft VAT return');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'viewer.upd_invoice_item'), 'fixture-missing'), '0',
  'viewer cannot update invoice_items');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'viewer.upd_final_vat'), 'fixture-missing'), '0',
  'viewer cannot update a finalized VAT return');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'viewer.del_final_vat'), 'fixture-missing'), '0',
  'viewer cannot delete a finalized VAT return');

-- eaisyBill assistant: invoicing yes, accounting / VAT no
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'assistant.upd_invoice_item'), 'fixture-missing'), '1',
  'assistant can update invoice_items');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'assistant.upd_draft_vat'), 'fixture-missing'), '0',
  'assistant cannot update a VAT return');

-- payroll_specialist (Bérszámfejtő): no financial data at RLS level
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'payroll.read_invoices'), 'fixture-missing'), '0',
  'payroll_specialist cannot read invoices');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'payroll.read_vat'), 'fixture-missing'), '0',
  'payroll_specialist cannot read vat_returns');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'payroll.upd_draft_vat'), 'fixture-missing'), '0',
  'payroll_specialist cannot write vat_returns');

-- könyvelő (non-senior): drafts yes, finalized VAT returns immutable (42501)
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'konyvelo.upd_draft_vat'), 'fixture-missing'), '1',
  'könyvelő can update a draft VAT return');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'konyvelo.upd_final_vat'), 'fixture-missing'), 'blocked',
  'könyvelő cannot modify a finalized VAT return (42501)');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'konyvelo.del_final_vat'), 'fixture-missing'), 'blocked',
  'könyvelő cannot delete a finalized VAT return (42501)');

-- eaisyBill company roles: owner / admin / member (Pénzügyi Vezető) work on VAT drafts and invoice items,
-- employee (Munkavállaló) can do neither.
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'owner.upd_draft_vat'), 'fixture-missing'), '1',
  'owner can update a draft VAT return');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'owner.upd_invoice_item'), 'fixture-missing'), '1',
  'owner can update invoice_items');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'admin.upd_draft_vat'), 'fixture-missing'), '1',
  'admin (Cégvezető) can update a draft VAT return');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'admin.upd_invoice_item'), 'fixture-missing'), '1',
  'admin (Cégvezető) can update invoice_items');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'member.upd_draft_vat'), 'fixture-missing'), '1',
  'member (Pénzügyi Vezető) can update a draft VAT return');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'member.upd_invoice_item'), 'fixture-missing'), '1',
  'member (Pénzügyi Vezető) can update invoice_items');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'employee.upd_draft_vat'), 'fixture-missing'), '0',
  'employee cannot update a VAT return');
SELECT is(coalesce((SELECT v FROM _rls_res WHERE k = 'employee.upd_invoice_item'), 'fixture-missing'), '0',
  'employee cannot update invoice_items');

SELECT * FROM finish();

ROLLBACK;
