-- ==============================================================================
-- Test Suite: autoposter_rpc_functions.test.sql
-- Description: pgTAP tests for Discrepancy 2 auto-poster RPC functions and permissions
-- ==============================================================================
BEGIN;
SELECT plan(32);

-- ─── 1. Function existence and SECURITY DEFINER checks ─────────────────────────
SELECT has_function('public', 'check_user_can_auto_post_gl', ARRAY['uuid', 'boolean'], 'check_user_can_auto_post_gl exists');
SELECT is_definer('public', 'check_user_can_auto_post_gl', 'check_user_can_auto_post_gl is SECURITY DEFINER');

SELECT has_function('public', 'post_depreciation_run_to_gl', ARRAY['uuid', 'text', 'date', 'date', 'date', 'text', 'text', 'text', 'jsonb'], 'post_depreciation_run_to_gl exists');
SELECT is_definer('public', 'post_depreciation_run_to_gl', 'post_depreciation_run_to_gl is SECURITY DEFINER');

SELECT has_function('public', 'post_asset_activation_to_gl', ARRAY['uuid', 'uuid', 'text', 'text', 'numeric', 'date', 'uuid', 'uuid', 'text'], 'post_asset_activation_to_gl exists');
SELECT is_definer('public', 'post_asset_activation_to_gl', 'post_asset_activation_to_gl is SECURITY DEFINER');

SELECT has_function('public', 'remove_asset_activation_from_gl', ARRAY['uuid', 'text'], 'remove_asset_activation_from_gl exists');
SELECT is_definer('public', 'remove_asset_activation_from_gl', 'remove_asset_activation_from_gl is SECURITY DEFINER');

SELECT has_function('public', 'post_development_reserve_to_gl', ARRAY['uuid', 'uuid', 'text', 'text', 'numeric', 'date', 'integer', 'uuid', 'uuid'], 'post_development_reserve_to_gl exists');
SELECT is_definer('public', 'post_development_reserve_to_gl', 'post_development_reserve_to_gl is SECURITY DEFINER');

SELECT has_function('public', 'remove_development_reserve_from_gl', ARRAY['uuid', 'text'], 'remove_development_reserve_from_gl exists');
SELECT is_definer('public', 'remove_development_reserve_from_gl', 'remove_development_reserve_from_gl is SECURITY DEFINER');

SELECT has_function('public', 'post_dividend_to_gl', ARRAY['uuid', 'uuid', 'numeric', 'numeric', 'numeric', 'text', 'text', 'date', 'date', 'uuid', 'uuid', 'uuid', 'uuid'], 'post_dividend_to_gl exists');
SELECT is_definer('public', 'post_dividend_to_gl', 'post_dividend_to_gl is SECURITY DEFINER');

SELECT has_function('public', 'delete_dividend_gl_entry', ARRAY['uuid', 'uuid'], 'delete_dividend_gl_entry exists');
SELECT is_definer('public', 'delete_dividend_gl_entry', 'delete_dividend_gl_entry is SECURITY DEFINER');

SELECT has_function('public', 'post_payroll_cycle_to_gl', ARRAY['uuid', 'uuid', 'jsonb', 'jsonb'], 'post_payroll_cycle_to_gl exists');
SELECT is_definer('public', 'post_payroll_cycle_to_gl', 'post_payroll_cycle_to_gl is SECURITY DEFINER');

-- ─── 2. Permission revocation checks (anon / PUBLIC cannot execute) ───────────
SELECT throws_matching(
  $$
    SET ROLE anon;
    SELECT public.check_user_can_auto_post_gl('00000000-0000-0000-0000-000000000001'::uuid, false);
  $$,
  'permission denied',
  'anon cannot execute check_user_can_auto_post_gl'
);
RESET ROLE;

SELECT throws_matching(
  $$
    SET ROLE anon;
    SELECT public.post_depreciation_run_to_gl('00000000-0000-0000-0000-000000000001'::uuid, 'monthly', CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, 'DOC-1', 'Desc', 'HUF', '[]'::jsonb);
  $$,
  'permission denied',
  'anon cannot execute post_depreciation_run_to_gl'
);
RESET ROLE;

SELECT throws_matching(
  $$
    SET ROLE anon;
    SELECT public.post_asset_activation_to_gl('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Asset', 'INV-1', 1000, CURRENT_DATE, '00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'HUF');
  $$,
  'permission denied',
  'anon cannot execute post_asset_activation_to_gl'
);
RESET ROLE;

SELECT throws_matching(
  $$
    SET ROLE anon;
    SELECT public.post_dividend_to_gl('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 1000, 150, 130, 'Member', 'RES-1', CURRENT_DATE, CURRENT_DATE, '00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000004'::uuid);
  $$,
  'permission denied',
  'anon cannot execute post_dividend_to_gl'
);
RESET ROLE;

SELECT throws_matching(
  $$
    SET ROLE anon;
    SELECT public.post_payroll_cycle_to_gl('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, '{}'::jsonb);
  $$,
  'permission denied',
  'anon cannot execute post_payroll_cycle_to_gl'
);
RESET ROLE;

-- ─── 3. Functional tests in transaction fixture ───────────────────────────────
DO $$
DECLARE
  v_cid uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_u_admin uuid := 'a0000000-0000-0000-0000-000000000002'::uuid;
  v_u_payroll uuid := 'a0000000-0000-0000-0000-000000000003'::uuid;
  v_u_viewer uuid := 'a0000000-0000-0000-0000-000000000004'::uuid;
  v_u_accountant uuid := 'a0000000-0000-0000-0000-000000000005'::uuid;
  v_journal_id uuid;
  v_gl_asset uuid;
  v_gl_cip uuid;
  v_res jsonb;
  v_rem_res jsonb;
BEGIN
  -- Users in auth.users
  INSERT INTO auth.users (id, email) VALUES
    (v_u_admin, 'admin_ap@test.local'),
    (v_u_payroll, 'payroll_ap@test.local'),
    (v_u_viewer, 'viewer_ap@test.local'),
    (v_u_accountant, 'accountant_ap@test.local')
  ON CONFLICT (id) DO NOTHING;

  -- Test company fixture (must come after auth.users for owner_id FK)
  INSERT INTO public.companies (id, name, tax_number, owner_id)
  VALUES (v_cid, 'AutoPoster Test Kft', '99999999-2-41', v_u_admin)
  ON CONFLICT (id) DO NOTHING;

  -- Company members
  INSERT INTO public.company_members (company_id, user_id, role) VALUES
    (v_cid, v_u_admin, 'admin'),
    (v_cid, v_u_viewer, 'viewer')
  ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- External accountant & payroll specialist assignments
  INSERT INTO public.accounty_assignments (company_id, accountant_user_id, role) VALUES
    (v_cid, v_u_payroll, 'payroll_specialist'),
    (v_cid, v_u_accountant, 'könyvelő')
  ON CONFLICT (company_id, accountant_user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Vegyes journal fixture
  INSERT INTO public.acc_journals (company_id, code, name, type, is_active)
  VALUES (v_cid, 'VE', 'Vegyes napló', 'MIXED', true)
  RETURNING id INTO v_journal_id;

  -- Preset fixture
  INSERT INTO public.chart_of_accounts_presets (id, company_id, name, type, is_active)
  VALUES ('a0000000-0000-0000-0000-000000000099'::uuid, v_cid, 'Test Preset', 'custom', true)
  ON CONFLICT (id) DO NOTHING;

  -- GL accounts fixtures
  INSERT INTO public.gl_accounts (company_id, preset_id, gl_number, short_name)
  VALUES (v_cid, 'a0000000-0000-0000-0000-000000000099'::uuid, '1341', 'Irodai gépek')
  RETURNING id INTO v_gl_asset;

  INSERT INTO public.gl_accounts (company_id, preset_id, gl_number, short_name)
  VALUES (v_cid, 'a0000000-0000-0000-0000-000000000099'::uuid, '1611', 'Befejezetlen beruházás')
  RETURNING id INTO v_gl_cip;
END;
$$;

-- Test check_user_can_auto_post_gl for admin (true)
SET LOCAL "request.jwt.claims" = '{"sub": "a0000000-0000-0000-0000-000000000002"}';
SELECT is(public.check_user_can_auto_post_gl('a0000000-0000-0000-0000-000000000001'::uuid, false), true, 'Admin can auto-post asset/general operations');

-- Test check_user_can_auto_post_gl for payroll_specialist (false when allow_payroll=false, true when allow_payroll=true)
SET LOCAL "request.jwt.claims" = '{"sub": "a0000000-0000-0000-0000-000000000003"}';
SELECT is(public.check_user_can_auto_post_gl('a0000000-0000-0000-0000-000000000001'::uuid, false), false, 'Payroll specialist CANNOT auto-post asset operations');
SELECT is(public.check_user_can_auto_post_gl('a0000000-0000-0000-0000-000000000001'::uuid, true), true, 'Payroll specialist CAN auto-post payroll/dividend operations');

-- Test check_user_can_auto_post_gl for viewer (false)
SET LOCAL "request.jwt.claims" = '{"sub": "a0000000-0000-0000-0000-000000000004"}';
SELECT is(public.check_user_can_auto_post_gl('a0000000-0000-0000-0000-000000000001'::uuid, true), false, 'Viewer CANNOT auto-post any operations');

-- Test check_user_can_auto_post_gl for accountant (true)
SET LOCAL "request.jwt.claims" = '{"sub": "a0000000-0000-0000-0000-000000000005"}';
SELECT is(public.check_user_can_auto_post_gl('a0000000-0000-0000-0000-000000000001'::uuid, false), true, 'Accountant CAN auto-post asset operations');

-- Test post_asset_activation_to_gl execution by admin
SET LOCAL "request.jwt.claims" = '{"sub": "a0000000-0000-0000-0000-000000000002"}';
SELECT lives_ok(
  $$
    SELECT public.post_asset_activation_to_gl(
      'a0000000-0000-0000-0000-000000000001'::uuid,
      'a0000000-0000-0000-0000-000000000010'::uuid,
      'MacBook Pro',
      'ESZK-2026-001',
      850000,
      '2026-03-15'::date,
      (SELECT id FROM public.gl_accounts WHERE company_id = 'a0000000-0000-0000-0000-000000000001'::uuid AND gl_number = '1341'),
      (SELECT id FROM public.gl_accounts WHERE company_id = 'a0000000-0000-0000-0000-000000000001'::uuid AND gl_number = '1611'),
      'HUF'
    );
  $$,
  'Admin successfully activates asset via post_asset_activation_to_gl'
);

-- Verify journal header was posted and sorszámozott
SELECT results_eq(
  $$
    SELECT status::text, journal_number IS NOT NULL
    FROM public.acc_journal_headers
    WHERE company_id = 'a0000000-0000-0000-0000-000000000001'::uuid
      AND document_id = 'JK-ESZK-2026-001';
  $$,
  $$ VALUES ('KONYVELT'::text, true) $$,
  'Asset activation header is KONYVELT with allocated journal_number'
);

-- Test remove_asset_activation_from_gl generates storno entry
SELECT lives_ok(
  $$
    SELECT public.remove_asset_activation_from_gl(
      'a0000000-0000-0000-0000-000000000001'::uuid,
      'ESZK-2026-001'
    );
  $$,
  'Admin stornos asset activation via remove_asset_activation_from_gl'
);

SELECT results_eq(
  $$
    SELECT status::text
    FROM public.acc_journal_headers
    WHERE company_id = 'a0000000-0000-0000-0000-000000000001'::uuid
      AND document_id = 'JK-ESZK-2026-001'
      AND entry_type = 'NORMAL';
  $$,
  $$ VALUES ('SZTORNOZOTT'::text) $$,
  'Original asset activation header is marked SZTORNOZOTT per Sztv. 166. §'
);

SELECT finish();
ROLLBACK;
