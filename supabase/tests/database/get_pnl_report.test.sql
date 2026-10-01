-- ==============================================================================
-- pgTAP Test: get_pnl_report
-- Description: Automated unit and regression tests for Profit and Loss statement calculation
-- Run: npx supabase test db  (or run inside transaction with ROLLBACK)
-- ==============================================================================

BEGIN;

SET search_path TO 'public', 'extensions';

-- 1. Declare number of planned tests
SELECT plan(6);

-- 2. Function existence check
SELECT has_function(
  'public',
  'get_pnl_report',
  ARRAY['uuid', 'uuid', 'date', 'date', 'jsonb'],
  'get_pnl_report RPC exists in public schema with 5 arguments'
);

-- 3. Return type check
SELECT function_returns(
  'public',
  'get_pnl_report',
  ARRAY['uuid', 'uuid', 'date', 'date', 'jsonb'],
  'setof record',
  'get_pnl_report must return a set of records'
);

-- 4. Zero-state test: Non-existent company returns standard 14 structural P&L rows without crashing
SELECT ok(
  (SELECT count(*) = 14 FROM public.get_pnl_report('00000000-0000-0000-0000-000000000000'::uuid, 'a6c46c77-52b7-499e-bb12-419aa94349af'::uuid, '2026-01-01'::date, '2026-12-31'::date, '{}'::jsonb)),
  'Empty company returns standard 14 structural P&L rows without error'
);

-- 5. Execution safety test: Query completes successfully on active company
SELECT ok(
  (SELECT count(*) = 14 FROM public.get_pnl_report('418b3264-1169-46bb-9a2a-4f58a186bf1e'::uuid, 'a6c46c77-52b7-499e-bb12-419aa94349af'::uuid, '2026-01-01'::date, '2026-12-31'::date, '{}'::jsonb)),
  'get_pnl_report completes successfully on active company'
);

-- 6. Structure validation: Multiplier values must be properly assigned (+1 for revenue, -1 for expenses)
SELECT ok(
  (SELECT bool_and(multiplier IN (1, -1)) FROM public.get_pnl_report('418b3264-1169-46bb-9a2a-4f58a186bf1e'::uuid, 'a6c46c77-52b7-499e-bb12-419aa94349af'::uuid, '2026-01-01'::date, '2026-12-31'::date, '{}'::jsonb)),
  'P&L rows must have valid multiplier flags (+1 or -1)'
);

-- 7. Security check: Anon role is restricted from direct execution
SELECT throws_ok(
  'SET ROLE anon; SELECT * FROM public.get_pnl_report(''418b3264-1169-46bb-9a2a-4f58a186bf1e''::uuid, ''a6c46c77-52b7-499e-bb12-419aa94349af''::uuid, ''2026-01-01''::date, ''2026-12-31''::date, ''{}''::jsonb)',
  '42501',
  NULL,
  'Anonymous role must be denied execute permissions on get_pnl_report'
);

-- Finish test suite
SELECT * FROM finish();

-- Roll back transaction to leave database clean
ROLLBACK;
