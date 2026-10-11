-- ==============================================================================
-- Test: legacy_gl_rpc_authz.test.sql
-- Description: Comprehensive authorization verification for legacy GL RPCs,
--              period closing RPC, and O1 fallback semantics.
-- ==============================================================================
BEGIN;
SELECT plan(23);

-- ─── 1. Metadata / Signature verification ─────────────────────────────────────
SELECT ok(prosecdef, 'set_accounting_period_closed is SECURITY DEFINER')
  FROM pg_proc WHERE proname = 'set_accounting_period_closed' AND pronamespace = 'public'::regnamespace;

SELECT ok(prosecdef, 'assert_company_role_tier is SECURITY DEFINER')
  FROM pg_proc WHERE proname = 'assert_company_role_tier' AND pronamespace = 'public'::regnamespace;

SELECT ok(NOT has_function_privilege('anon', 'public.set_accounting_period_closed(uuid, smallint, smallint, boolean)', 'EXECUTE'),
  'anon must NOT execute set_accounting_period_closed');

SELECT ok(NOT has_function_privilege('anon', 'public.acc_post_journal_entry(uuid, uuid)', 'EXECUTE'),
  'anon must NOT execute acc_post_journal_entry');

SELECT ok(NOT has_function_privilege('anon', 'public.settle_open_items(uuid, uuid, uuid, numeric, numeric, character varying, text)', 'EXECUTE'),
  'anon must NOT execute settle_open_items');

SELECT ok(NOT has_function_privilege('anon', 'public.post_cash_report_to_gl(uuid, uuid)', 'EXECUTE'),
  'anon must NOT execute post_cash_report_to_gl');

SELECT ok(NOT has_function_privilege('anon', 'public.calculate_vat_return(uuid, integer, integer, text, text)', 'EXECUTE'),
  'anon must NOT execute calculate_vat_return');

-- ─── 2. Behavioral verification using temporary test fixtures ─────────────────
CREATE TEMP TABLE _authz_res (k text PRIMARY KEY, v text);
GRANT ALL ON _authz_res TO authenticated;

DO $test_fixture$
DECLARE
  v_co_with_accountant uuid := gen_random_uuid();
  v_co_without_accountant uuid := gen_random_uuid();
  us uuid[];
  v_uid_outsider uuid;
  v_uid_viewer uuid;
  v_uid_assistant uuid;
  v_uid_konyvelo uuid;
  v_uid_senior uuid;
  v_uid_owner_managed uuid;
  v_uid_owner_self uuid;
BEGIN
  -- Pick 7 real users from auth.users who have NO memberships, assignments or support admin status
  us := ARRAY(
    SELECT x.id FROM auth.users x
    WHERE NOT EXISTS (SELECT 1 FROM public.company_members m WHERE m.user_id = x.id)
      AND NOT EXISTS (SELECT 1 FROM public.accounty_assignments a WHERE a.accountant_user_id = x.id)
      AND NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = x.id AND pr.is_support_admin)
    ORDER BY x.id
    LIMIT 7
  );

  IF cardinality(us) < 7 THEN
    RAISE EXCEPTION 'Not enough clean test users in auth.users (found %)', cardinality(us);
  END IF;

  v_uid_outsider := us[1];
  v_uid_viewer := us[2];
  v_uid_assistant := us[3];
  v_uid_konyvelo := us[4];
  v_uid_senior := us[5];
  v_uid_owner_managed := us[6];
  v_uid_owner_self := us[7];

  -- Insert dummy test companies with owner_id referencing auth.users
  INSERT INTO public.companies (id, name, tax_number, owner_id) VALUES
    (v_co_with_accountant, 'Test Firm Client Kft', '11111111-1-11', v_uid_owner_managed),
    (v_co_without_accountant, 'Test Self Managed Kft', '22222222-2-22', v_uid_owner_self);

  -- Company 1: Has assigned accountants
  INSERT INTO public.company_members (company_id, user_id, role) VALUES
    (v_co_with_accountant, v_uid_viewer, 'viewer'),
    (v_co_with_accountant, v_uid_assistant, 'assistant'),
    (v_co_with_accountant, v_uid_owner_managed, 'owner')
  ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.accounty_assignments (accounting_firm_id, company_id, accountant_user_id, role) VALUES
    (NULL, v_co_with_accountant, v_uid_konyvelo, 'könyvelő'),
    (NULL, v_co_with_accountant, v_uid_senior, 'senior_könyvelő')
  ON CONFLICT (accountant_user_id, company_id) DO UPDATE SET role = EXCLUDED.role;

  -- Company 2: Has NO accountant assigned (self-managed)
  INSERT INTO public.company_members (company_id, user_id, role) VALUES
    (v_co_without_accountant, v_uid_owner_self, 'owner')
  ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Test 1: Outsider
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid_outsider, 'role', 'authenticated')::text, true);
  INSERT INTO _authz_res VALUES ('outsider.member_write', public.has_company_role_tier(v_co_with_accountant, 'member_write')::text);
  INSERT INTO _authz_res VALUES ('outsider.ledger_write', public.has_company_role_tier(v_co_with_accountant, 'ledger_write')::text);

  -- Test 2: Viewer
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid_viewer, 'role', 'authenticated')::text, true);
  INSERT INTO _authz_res VALUES ('viewer.member_write', public.has_company_role_tier(v_co_with_accountant, 'member_write')::text);
  INSERT INTO _authz_res VALUES ('viewer.ledger_write', public.has_company_role_tier(v_co_with_accountant, 'ledger_write')::text);
  INSERT INTO _authz_res VALUES ('viewer.senior', public.has_company_role_tier(v_co_with_accountant, 'senior')::text);

  -- Test 3: Assistant (member_write yes, ledger_write no)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid_assistant, 'role', 'authenticated')::text, true);
  INSERT INTO _authz_res VALUES ('assistant.member_write', public.has_company_role_tier(v_co_with_accountant, 'member_write')::text);
  INSERT INTO _authz_res VALUES ('assistant.ledger_write', public.has_company_role_tier(v_co_with_accountant, 'ledger_write')::text);
  INSERT INTO _authz_res VALUES ('assistant.senior', public.has_company_role_tier(v_co_with_accountant, 'senior')::text);

  -- Test 4: Managed company owner (has accountant -> member_write yes, ledger_write NO, senior NO)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid_owner_managed, 'role', 'authenticated')::text, true);
  INSERT INTO _authz_res VALUES ('managed_owner.member_write', public.has_company_role_tier(v_co_with_accountant, 'member_write')::text);
  INSERT INTO _authz_res VALUES ('managed_owner.ledger_write', public.has_company_role_tier(v_co_with_accountant, 'ledger_write')::text);
  INSERT INTO _authz_res VALUES ('managed_owner.senior', public.has_company_role_tier(v_co_with_accountant, 'senior')::text);

  -- Test 5: Könyvelő (ledger_write yes, senior NO)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid_konyvelo, 'role', 'authenticated')::text, true);
  INSERT INTO _authz_res VALUES ('konyvelo.ledger_write', public.has_company_role_tier(v_co_with_accountant, 'ledger_write')::text);
  INSERT INTO _authz_res VALUES ('konyvelo.senior', public.has_company_role_tier(v_co_with_accountant, 'senior')::text);

  -- Test 6: Senior könyvelő (ledger_write yes, senior YES)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid_senior, 'role', 'authenticated')::text, true);
  INSERT INTO _authz_res VALUES ('senior.ledger_write', public.has_company_role_tier(v_co_with_accountant, 'ledger_write')::text);
  INSERT INTO _authz_res VALUES ('senior.senior', public.has_company_role_tier(v_co_with_accountant, 'senior')::text);

  -- Test 7: O1 Fallback on Self-Managed Company (owner gets ledger_write AND senior!)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid_owner_self, 'role', 'authenticated')::text, true);
  INSERT INTO _authz_res VALUES ('self_owner.member_write', public.has_company_role_tier(v_co_without_accountant, 'member_write')::text);
  INSERT INTO _authz_res VALUES ('self_owner.ledger_write', public.has_company_role_tier(v_co_without_accountant, 'ledger_write')::text);
  INSERT INTO _authz_res VALUES ('self_owner.senior', public.has_company_role_tier(v_co_without_accountant, 'senior')::text);
  
  -- Self-owner can close period via RPC
  PERFORM public.set_accounting_period_closed(v_co_without_accountant, 2026::smallint, 1::smallint, true);
  INSERT INTO _authz_res VALUES ('self_owner.period_closed', 
    (SELECT is_closed::text FROM public.acc_accounting_periods WHERE company_id = v_co_without_accountant AND year = 2026 AND month = 1));

  -- Managed owner CANNOT close period via RPC (senior tier exception)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid_owner_managed, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.set_accounting_period_closed(v_co_with_accountant, 2026::smallint, 1::smallint, true);
    INSERT INTO _authz_res VALUES ('managed_owner.period_close_attempt', 'success');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _authz_res VALUES ('managed_owner.period_close_attempt', 'blocked');
  END;

END
$test_fixture$;

-- Assertions
SELECT is((SELECT v FROM _authz_res WHERE k = 'outsider.member_write'), 'false', 'outsider denied member_write');
SELECT is((SELECT v FROM _authz_res WHERE k = 'viewer.member_write'), 'false', 'viewer denied member_write');
SELECT is((SELECT v FROM _authz_res WHERE k = 'viewer.ledger_write'), 'false', 'viewer denied ledger_write');
SELECT is((SELECT v FROM _authz_res WHERE k = 'assistant.member_write'), 'true', 'assistant granted member_write');
SELECT is((SELECT v FROM _authz_res WHERE k = 'assistant.ledger_write'), 'false', 'assistant denied ledger_write');
SELECT is((SELECT v FROM _authz_res WHERE k = 'managed_owner.member_write'), 'true', 'managed owner granted member_write');
SELECT is((SELECT v FROM _authz_res WHERE k = 'managed_owner.ledger_write'), 'false', 'managed owner denied ledger_write (accountant assigned)');
SELECT is((SELECT v FROM _authz_res WHERE k = 'managed_owner.senior'), 'false', 'managed owner denied senior (accountant assigned)');
SELECT is((SELECT v FROM _authz_res WHERE k = 'konyvelo.ledger_write'), 'true', 'könyvelő granted ledger_write');
SELECT is((SELECT v FROM _authz_res WHERE k = 'konyvelo.senior'), 'false', 'könyvelő denied senior (closing/chart)');
SELECT is((SELECT v FROM _authz_res WHERE k = 'senior.ledger_write'), 'true', 'senior_könyvelő granted ledger_write');
SELECT is((SELECT v FROM _authz_res WHERE k = 'senior.senior'), 'true', 'senior_könyvelő granted senior');
SELECT is((SELECT v FROM _authz_res WHERE k = 'self_owner.ledger_write'), 'true', 'O1 fallback: self owner granted ledger_write');
SELECT is((SELECT v FROM _authz_res WHERE k = 'self_owner.senior'), 'true', 'O1 fallback: self owner granted senior');
SELECT is((SELECT v FROM _authz_res WHERE k = 'self_owner.period_closed'), 'true', 'O1 fallback: self owner successfully closed period via RPC');
SELECT is((SELECT v FROM _authz_res WHERE k = 'managed_owner.period_close_attempt'), 'blocked', 'managed owner blocked from closing period via RPC (42501)');

SELECT * FROM finish();
ROLLBACK;
