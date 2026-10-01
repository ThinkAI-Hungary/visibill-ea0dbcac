-- ==============================================================================
-- pgTAP Test: get_bs_report
-- Description: Automated unit and regression tests for Balance Sheet calculation
-- Run: npx supabase test db  (or run inside transaction with ROLLBACK)
-- ==============================================================================

BEGIN;

SET search_path TO 'public', 'extensions';

-- 1. Declare number of planned tests
SELECT plan(6);

-- 2. Function existence check
SELECT has_function(
  'public',
  'get_bs_report',
  ARRAY['uuid', 'uuid', 'date', 'integer', 'jsonb'],
  'get_bs_report RPC exists in public schema with 5 arguments'
);

-- 3. Return type check
SELECT function_returns(
  'public',
  'get_bs_report',
  ARRAY['uuid', 'uuid', 'date', 'integer', 'jsonb'],
  'setof record',
  'get_bs_report must return a set of records'
);

-- 4. Zero-state test: Non-existent company returns standard 94 structural Balance Sheet rows without crashing
SELECT ok(
  (SELECT count(*) = 94 FROM public.get_bs_report('00000000-0000-0000-0000-000000000000'::uuid, 'a6c46c77-52b7-499e-bb12-419aa94349af'::uuid, '2026-12-31'::date, 2026, '{}'::jsonb)),
  'Empty company returns standard 94 structural Balance Sheet rows without error'
);

-- 5. Execution safety test: Query completes successfully on active company
SELECT ok(
  (SELECT count(*) = 94 FROM public.get_bs_report('418b3264-1169-46bb-9a2a-4f58a186bf1e'::uuid, 'a6c46c77-52b7-499e-bb12-419aa94349af'::uuid, '2026-12-31'::date, 2026, '{}'::jsonb)),
  'get_bs_report completes successfully on active company'
);

-- 6. Structure validation: Balance sheet must contain P&L bridge row connecting net profit to equity
SELECT ok(
  (SELECT count(*) = 1 FROM public.get_bs_report('418b3264-1169-46bb-9a2a-4f58a186bf1e'::uuid, 'a6c46c77-52b7-499e-bb12-419aa94349af'::uuid, '2026-12-31'::date, 2026, '{}'::jsonb) WHERE is_pnl_bridge = true),
  'Balance Sheet contains exactly one P&L bridge row connecting net profit to equity'
);

-- 7. Security check: Anon role is restricted from direct execution
SELECT throws_ok(
  'SET ROLE anon; SELECT * FROM public.get_bs_report(''418b3264-1169-46bb-9a2a-4f58a186bf1e''::uuid, ''a6c46c77-52b7-499e-bb12-419aa94349af''::uuid, ''2026-12-31''::date, 2026, ''{}''::jsonb)',
  '42501',
  NULL,
  'Anonymous role must be denied execute permissions on get_bs_report'
);

-- Finish test suite
SELECT * FROM finish();

-- Roll back transaction to leave database clean
ROLLBACK;
