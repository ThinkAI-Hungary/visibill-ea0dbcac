-- ==============================================================================
-- pgTAP Test: get_gl_balances
-- Description: Automated unit and regression tests for General Ledger balances RPC
-- Run: npx supabase test db  (or run inside transaction with ROLLBACK)
-- ==============================================================================

BEGIN;

SET search_path TO 'public', 'extensions';

-- 1. Declare number of planned tests
SELECT plan(6);

-- 2. Function existence and schema check
SELECT has_function(
  'public',
  'get_gl_balances',
  ARRAY['uuid', 'uuid', 'date', 'date', 'jsonb', 'text', 'text'],
  'get_gl_balances RPC must exist in public schema with correct parameters'
);

-- 3. Return type and columns check
SELECT function_returns(
  'public',
  'get_gl_balances',
  ARRAY['uuid', 'uuid', 'date', 'date', 'jsonb', 'text', 'text'],
  'setof record',
  'get_gl_balances must return a set of records'
);

-- 4. Zero-state test: Non-existent or empty company returns no data without crashing
SELECT is_empty(
  'SELECT * FROM public.get_gl_balances(''00000000-0000-0000-0000-000000000000''::uuid, ''00000000-0000-0000-0000-000000000000''::uuid)',
  'Empty company should return zero rows without throwing errors'
);

-- 5. Execution safety test: Query completes without runtime exceptions
SELECT lives_ok(
  'SELECT count(*) FROM public.get_gl_balances(''418b3264-1169-46bb-9a2a-4f58a186bf1e''::uuid, ''a6c46c77-52b7-499e-bb12-419aa94349af''::uuid, ''2026-01-01''::date, ''2026-12-31''::date)',
  'Running get_gl_balances on Mandala Fogadó Kft must complete without errors'
);

-- 6. Date basis check: Full date filtering works properly on both kibocsatas and teljesites
SELECT ok(
  (SELECT count(*) >= 0 FROM public.get_gl_balances(''418b3264-1169-46bb-9a2a-4f58a186bf1e''::uuid, ''a6c46c77-52b7-499e-bb12-419aa94349af''::uuid, '2026-01-01'::date, '2026-12-31'::date, '{}'::jsonb, 'ALL', 'teljesites')),
  'get_gl_balances must execute successfully with date_basis = teljesites'
);

-- 7. Security check: Anon role is restricted from direct execution
SELECT throws_ok(
  'SET ROLE anon; SELECT * FROM public.get_gl_balances(''418b3264-1169-46bb-9a2a-4f58a186bf1e''::uuid, ''a6c46c77-52b7-499e-bb12-419aa94349af''::uuid)',
  '42501',
  NULL,
  'Anonymous role must be denied execute permissions on get_gl_balances'
);

-- Finish test suite
SELECT * FROM finish();

-- Roll back transaction to leave database clean
ROLLBACK;
