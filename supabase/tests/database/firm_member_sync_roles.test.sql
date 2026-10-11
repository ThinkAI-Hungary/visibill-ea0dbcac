-- ==============================================================================
-- pgTAP Test: accounting-firm member -> eaisyBooks assignment sync (A-247, discrepancy 1)
-- Covers migration: 20261011050500_fix_firm_member_sync_roles.sql
-- Run: npx supabase test db  (ends with ROLLBACK - no data is left behind)
--
-- Part 1 = catalog assertions (always runnable).
-- Part 2 = behavioural: adds spare auth users to an existing accounting-firm office company and checks
--          the synced accounty_assignments. If no such fixture exists the behavioural assertions
--          FAIL with 'fixture-missing' (deliberate signal, not a silent skip).
-- ==============================================================================

BEGIN;

SET search_path TO 'public', 'extensions';

SELECT plan(24);

-- ─── Part 1: catalog ─────────────────────────────────────────────────────────────────
SELECT is(public.firm_member_accounting_role('owner'),      'iroda_admin', 'owner -> iroda_admin');
SELECT is(public.firm_member_accounting_role('admin'),      'iroda_admin', 'admin (Cégvezető) -> iroda_admin');
SELECT is(public.firm_member_accounting_role('member'),     'könyvelő',    'member (Pénzügyi Vezető) -> könyvelő');
SELECT is(public.firm_member_accounting_role('accountant'), 'könyvelő',    'legacy accountant -> könyvelő');
SELECT is(public.firm_member_accounting_role('assistant'),  'asszisztens', 'assistant -> asszisztens');
SELECT is(public.firm_member_accounting_role('viewer'),     NULL,          'viewer (Megfigyelő) -> no assignment');
SELECT is(public.firm_member_accounting_role('employee'),   NULL,          'employee (Munkavállaló) -> no assignment');
SELECT is(public.firm_member_accounting_role('whatever'),   NULL,          'unknown role -> no assignment');

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.sync_company_member_to_eaisybooks()'::regprocedure),
  'sync_company_member_to_eaisybooks is SECURITY DEFINER (A-020)');
SELECT ok(
  (SELECT proconfig::text LIKE '%search_path=public%' FROM pg_proc WHERE oid = 'public.sync_company_member_to_eaisybooks()'::regprocedure),
  'sync_company_member_to_eaisybooks pins search_path');
SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.sync_eaisybill_accountant_removal()'::regprocedure),
  'sync_eaisybill_accountant_removal is SECURITY DEFINER');
SELECT ok(NOT has_function_privilege('anon', 'public.resolve_accounting_firm_id_for_company(uuid)', 'EXECUTE'),
  'anon must NOT execute resolve_accounting_firm_id_for_company');
SELECT ok(NOT has_function_privilege('authenticated', 'public.resolve_accounting_firm_id_for_company(uuid)', 'EXECUTE'),
  'authenticated must NOT execute the internal firm resolver');
SELECT ok(
  (SELECT (tgtype & 4) <> 0 AND (tgtype & 16) <> 0                -- INSERT + UPDATE
   FROM pg_trigger WHERE tgrelid = 'public.company_members'::regclass AND tgname = 'trg_company_members_auto_eaisybooks_sync'),
  'sync trigger fires on INSERT and UPDATE');

-- ─── Part 2: behaviour ───────────────────────────────────────────────────────────────
CREATE TEMP TABLE _sync_res (k text PRIMARY KEY, v text);

DO $fx$
DECLARE
  v_hub uuid; us uuid[]; r text;
BEGIN
  -- an accounting-firm office company that exists as a company (branch 1 of the resolver)
  SELECT aa.accounting_firm_id INTO v_hub
  FROM public.accounty_assignments aa
  JOIN public.companies c ON c.id = aa.accounting_firm_id
  WHERE aa.accounting_firm_id IS NOT NULL
  LIMIT 1;
  IF v_hub IS NULL THEN RETURN; END IF;

  us := ARRAY(SELECT x.id FROM auth.users x
    WHERE NOT EXISTS (SELECT 1 FROM public.company_members m WHERE m.user_id = x.id)
      AND NOT EXISTS (SELECT 1 FROM public.accounty_assignments a WHERE a.accountant_user_id = x.id)
    ORDER BY x.id LIMIT 6);
  IF cardinality(us) < 6 THEN RETURN; END IF;

  -- us[1..5]: new firm members with five different eaisyBill roles; us[6]: member + MANUAL assignment
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (v_hub, us[1], 'viewer');
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (v_hub, us[2], 'employee');
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (v_hub, us[3], 'assistant');
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (v_hub, us[4], 'member');
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (v_hub, us[5], 'admin');

  FOR r IN SELECT unnest(ARRAY['1','2','3','4','5']) LOOP
    INSERT INTO _sync_res VALUES ('ins.' || r,
      coalesce((SELECT aa.role FROM public.accounty_assignments aa
                WHERE aa.company_id = v_hub AND aa.accountant_user_id = us[r::int]), 'none'));
  END LOOP;

  -- cache follows the assignments (no bookkeeping row for viewer / employee)
  INSERT INTO _sync_res VALUES ('cache.viewer',
    (SELECT count(*)::text FROM public.user_company_access_cache c
     WHERE c.user_id = us[1] AND c.company_id = v_hub AND c.access_source = 'accounty'));

  -- role downgrade admin -> viewer drops the synced row; member -> assistant re-maps it
  UPDATE public.company_members SET role = 'viewer'    WHERE company_id = v_hub AND user_id = us[5];
  UPDATE public.company_members SET role = 'assistant' WHERE company_id = v_hub AND user_id = us[4];
  INSERT INTO _sync_res VALUES ('upd.admin_to_viewer',
    coalesce((SELECT aa.role FROM public.accounty_assignments aa WHERE aa.company_id = v_hub AND aa.accountant_user_id = us[5]), 'none'));
  INSERT INTO _sync_res VALUES ('upd.member_to_assistant',
    coalesce((SELECT aa.role FROM public.accounty_assignments aa WHERE aa.company_id = v_hub AND aa.accountant_user_id = us[4]), 'none'));

  -- removal of a firm member (any role) drops the synced assignment
  DELETE FROM public.company_members WHERE company_id = v_hub AND user_id = us[3];
  INSERT INTO _sync_res VALUES ('del.assistant',
    coalesce((SELECT aa.role FROM public.accounty_assignments aa WHERE aa.company_id = v_hub AND aa.accountant_user_id = us[3]), 'none'));

  -- a MANUAL assignment is never touched by sync / downgrade / removal
  INSERT INTO public.accounty_assignments (accounting_firm_id, company_id, accountant_user_id, role, source)
    VALUES (v_hub, v_hub, us[6], 'senior_könyvelő', 'manual');
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (v_hub, us[6], 'member');
  UPDATE public.company_members SET role = 'viewer' WHERE company_id = v_hub AND user_id = us[6];
  DELETE FROM public.company_members WHERE company_id = v_hub AND user_id = us[6];
  INSERT INTO _sync_res VALUES ('manual.kept',
    coalesce((SELECT aa.role FROM public.accounty_assignments aa WHERE aa.company_id = v_hub AND aa.accountant_user_id = us[6]), 'none'));
END
$fx$;

SELECT is(coalesce((SELECT v FROM _sync_res WHERE k = 'ins.1'), 'fixture-missing'), 'none',
  'NEW viewer of a firm gets NO accounty assignment');
SELECT is(coalesce((SELECT v FROM _sync_res WHERE k = 'ins.2'), 'fixture-missing'), 'none',
  'NEW employee of a firm gets NO accounty assignment');
SELECT is(coalesce((SELECT v FROM _sync_res WHERE k = 'ins.3'), 'fixture-missing'), 'asszisztens',
  'NEW assistant of a firm becomes asszisztens (not könyvelő)');
SELECT is(coalesce((SELECT v FROM _sync_res WHERE k = 'ins.4'), 'fixture-missing'), 'könyvelő',
  'NEW member (Pénzügyi Vezető) of a firm becomes könyvelő');
SELECT is(coalesce((SELECT v FROM _sync_res WHERE k = 'ins.5'), 'fixture-missing'), 'iroda_admin',
  'NEW admin of a firm becomes iroda_admin');
SELECT is(coalesce((SELECT v FROM _sync_res WHERE k = 'cache.viewer'), 'fixture-missing'), '0',
  'viewer has no accounty access-cache row');
SELECT is(coalesce((SELECT v FROM _sync_res WHERE k = 'upd.admin_to_viewer'), 'fixture-missing'), 'none',
  'downgrade admin -> viewer removes the synced iroda_admin assignment');
SELECT is(coalesce((SELECT v FROM _sync_res WHERE k = 'upd.member_to_assistant'), 'fixture-missing'), 'asszisztens',
  'role change member -> assistant re-maps the synced assignment to asszisztens');
SELECT is(coalesce((SELECT v FROM _sync_res WHERE k = 'del.assistant'), 'fixture-missing'), 'none',
  'removing a firm member (any role) removes the synced assignment');
SELECT is(coalesce((SELECT v FROM _sync_res WHERE k = 'manual.kept'), 'fixture-missing'), 'senior_könyvelő',
  'a MANUAL assignment survives sync, downgrade and removal');

SELECT * FROM finish();

ROLLBACK;
