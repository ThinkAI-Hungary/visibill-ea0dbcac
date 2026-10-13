-- ==============================================================================
-- pgTAP Test: external accountant (accounty assignment WITHOUT company_members) ledger access
-- Covers migration: 20261011052000_external_accountant_ledger_access.sql (A-247, discrepancy 3)
-- Run: npx supabase test db  (ends with ROLLBACK - no data is left behind)
--
-- Part 1 = catalog assertions (always runnable).
-- Part 2 = behavioural persona matrix on a company that has journals, journal lines and invoice
--          items; 5 spare auth users with NO relation to it get fresh accounty assignments
--          (senior_könyvelő, könyvelő, asszisztens, payroll_specialist) or nothing (outsider).
--          If the fixture is missing the behavioural assertions FAIL with 'fixture-missing'.
-- ==============================================================================

BEGIN;

SET search_path TO 'public', 'extensions';

SELECT plan(22);

-- ─── Part 1: catalog ─────────────────────────────────────────────────────────────────
SELECT ok(
  (SELECT prosecdef AND proconfig::text LIKE '%search_path=public%' AND provolatile = 's'
   FROM pg_proc WHERE oid = 'public.rls_accounty_bookkeeping_company_ids()'::regprocedure),
  'rls_accounty_bookkeeping_company_ids is STABLE SECURITY DEFINER with pinned search_path');
SELECT ok(NOT has_function_privilege('anon', 'public.rls_accounty_bookkeeping_company_ids()', 'EXECUTE'),
  'anon must NOT execute rls_accounty_bookkeeping_company_ids');
SELECT ok(has_function_privilege('authenticated', 'public.rls_accounty_bookkeeping_company_ids()', 'EXECUTE'),
  'authenticated MAY execute rls_accounty_bookkeeping_company_ids (needed by RLS)');
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND policyname = 'accounty_bookkeeping_access'
     AND permissive = 'PERMISSIVE' AND cmd = 'ALL'
     AND tablename IN ('acc_journals', 'acc_journal_headers', 'acc_journal_lines', 'acc_open_item_matches')),
  4, 'the 4 ledger tables carry the FOR ALL accounty_bookkeeping_access policy');
SELECT is(
  (SELECT count(*)::int FROM pg_policies
   WHERE schemaname = 'public' AND policyname = 'accounty_bookkeeping_read'
     AND permissive = 'PERMISSIVE' AND cmd = 'SELECT'
     AND tablename IN ('acc_accounting_periods', 'invoice_items')),
  2, 'acc_accounting_periods and invoice_items are SELECT-only for external accountants');

-- ─── Part 2: behaviour ───────────────────────────────────────────────────────────────
CREATE TEMP TABLE _ext_res (k text PRIMARY KEY, v text);
GRANT ALL ON _ext_res TO authenticated;

DO $fx$
DECLARE
  co uuid; v_firm uuid; jid uuid; hid uuid; iid uuid;
  us uuid[]; personas text[] := ARRAY['senior', 'konyvelo', 'assist', 'payroll', 'outsider'];
  i int; p text; n int;
BEGIN
  SELECT j.company_id INTO co
  FROM public.acc_journals j
  WHERE EXISTS (SELECT 1 FROM public.acc_journal_headers h JOIN public.acc_journal_lines l ON l.header_id = h.id WHERE h.company_id = j.company_id)
    AND EXISTS (SELECT 1 FROM public.invoices iv JOIN public.invoice_items ii ON ii.invoice_id = iv.id WHERE iv.company_id = j.company_id)
  LIMIT 1;
  IF co IS NULL THEN RETURN; END IF;

  SELECT accounting_firm_id INTO v_firm FROM public.accounty_assignments WHERE accounting_firm_id IS NOT NULL LIMIT 1;
  us := ARRAY(SELECT x.id FROM auth.users x
    WHERE NOT EXISTS (SELECT 1 FROM public.company_members m WHERE m.user_id = x.id)
      AND NOT EXISTS (SELECT 1 FROM public.accounty_assignments a WHERE a.accountant_user_id = x.id)
      AND NOT EXISTS (SELECT 1 FROM public.accounty_module_permissions mp WHERE mp.user_id = x.id)
      AND NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = x.id AND pr.is_support_admin)
    ORDER BY x.id LIMIT 5);
  IF v_firm IS NULL OR cardinality(us) < 5 THEN RETURN; END IF;

  SELECT id INTO jid FROM public.acc_journals WHERE company_id = co LIMIT 1;
  SELECT h.id INTO hid FROM public.acc_journal_headers h JOIN public.acc_journal_lines l ON l.header_id = h.id WHERE h.company_id = co LIMIT 1;
  SELECT ii.id INTO iid FROM public.invoice_items ii JOIN public.invoices iv ON iv.id = ii.invoice_id WHERE iv.company_id = co LIMIT 1;
  INSERT INTO public.acc_accounting_periods (company_id, year, month, is_closed) VALUES (co, 2099, 1, true);

  INSERT INTO public.accounty_assignments (accounting_firm_id, company_id, accountant_user_id, role) VALUES (v_firm, co, us[1], 'senior_könyvelő');
  INSERT INTO public.accounty_assignments (accounting_firm_id, company_id, accountant_user_id, role) VALUES (v_firm, co, us[2], 'könyvelő');
  INSERT INTO public.accounty_assignments (accounting_firm_id, company_id, accountant_user_id, role) VALUES (v_firm, co, us[3], 'asszisztens');
  INSERT INTO public.accounty_assignments (accounting_firm_id, company_id, accountant_user_id, role) VALUES (v_firm, co, us[4], 'payroll_specialist');

  FOR i IN 1..5 LOOP
    p := personas[i];
    PERFORM set_config('request.jwt.claims', json_build_object('sub', us[i], 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO n FROM public.acc_journal_headers WHERE company_id = co;
    INSERT INTO _ext_res VALUES (p || '.read_headers', n::text);
    SELECT count(*) INTO n FROM public.acc_journal_lines WHERE header_id = hid;
    INSERT INTO _ext_res VALUES (p || '.read_lines', n::text);
    SELECT count(*) INTO n FROM public.invoice_items WHERE id = iid;
    INSERT INTO _ext_res VALUES (p || '.read_items', n::text);
    SELECT count(*) INTO n FROM public.acc_accounting_periods WHERE company_id = co AND year = 2099;
    INSERT INTO _ext_res VALUES (p || '.read_periods', n::text);

    UPDATE public.acc_journals SET id = id WHERE id = jid;
    GET DIAGNOSTICS n = ROW_COUNT;
    INSERT INTO _ext_res VALUES (p || '.upd_journal', n::text);
    UPDATE public.invoice_items SET id = id WHERE id = iid;
    GET DIAGNOSTICS n = ROW_COUNT;
    INSERT INTO _ext_res VALUES (p || '.upd_item', n::text);
    UPDATE public.acc_accounting_periods SET is_closed = is_closed WHERE company_id = co AND year = 2099;
    GET DIAGNOSTICS n = ROW_COUNT;
    INSERT INTO _ext_res VALUES (p || '.upd_period', n::text);

    RESET ROLE;
  END LOOP;
END
$fx$;

-- senior_könyvelő: full ledger, items read-only, periods read-only
SELECT ok(coalesce((SELECT v::int > 0 FROM _ext_res WHERE k = 'senior.read_headers'), false), 'external senior can READ journal headers');
SELECT ok(coalesce((SELECT v::int > 0 FROM _ext_res WHERE k = 'senior.read_lines'), false),   'external senior can READ journal lines');
SELECT ok(coalesce((SELECT v::int > 0 FROM _ext_res WHERE k = 'senior.read_items'), false),   'external senior can READ invoice_items');
SELECT is(coalesce((SELECT v FROM _ext_res WHERE k = 'senior.upd_journal'), 'fixture-missing'), '1', 'external senior can WRITE acc_journals');
SELECT is(coalesce((SELECT v FROM _ext_res WHERE k = 'senior.upd_item'), 'fixture-missing'), '0',    'external senior cannot write invoice_items (separate decision)');
SELECT is(coalesce((SELECT v FROM _ext_res WHERE k = 'senior.read_periods'), 'fixture-missing'), '1', 'external senior can READ accounting periods (closed-period lock stays visible)');
SELECT is(coalesce((SELECT v FROM _ext_res WHERE k = 'senior.upd_period'), 'fixture-missing'), '0',   'external senior cannot close / reopen periods via the Data API');

-- könyvelő / asszisztens: read + write the ledger
SELECT ok(coalesce((SELECT v::int > 0 FROM _ext_res WHERE k = 'konyvelo.read_headers'), false), 'external könyvelő can READ journal headers');
SELECT is(coalesce((SELECT v FROM _ext_res WHERE k = 'konyvelo.upd_journal'), 'fixture-missing'), '1', 'external könyvelő can WRITE acc_journals');
SELECT ok(coalesce((SELECT v::int > 0 FROM _ext_res WHERE k = 'assist.read_headers'), false), 'external asszisztens can READ journal headers');
SELECT is(coalesce((SELECT v FROM _ext_res WHERE k = 'assist.upd_journal'), 'fixture-missing'), '1', 'external asszisztens can WRITE acc_journals');

-- payroll_specialist (Bérszámfejtő): no ledger at all
SELECT is(coalesce((SELECT v FROM _ext_res WHERE k = 'payroll.read_headers'), 'fixture-missing'), '0', 'payroll_specialist cannot READ journal headers');
SELECT is(coalesce((SELECT v FROM _ext_res WHERE k = 'payroll.upd_journal'), 'fixture-missing'), '0',  'payroll_specialist cannot WRITE acc_journals');
SELECT is(coalesce((SELECT v FROM _ext_res WHERE k = 'payroll.read_periods'), 'fixture-missing'), '0', 'payroll_specialist cannot READ accounting periods');

-- unrelated authenticated user: nothing
SELECT is(coalesce((SELECT v FROM _ext_res WHERE k = 'outsider.read_headers'), 'fixture-missing'), '0', 'unrelated user cannot READ journal headers');
SELECT is(coalesce((SELECT v FROM _ext_res WHERE k = 'outsider.upd_journal'), 'fixture-missing'), '0',  'unrelated user cannot WRITE acc_journals');

SELECT * FROM finish();

ROLLBACK;
