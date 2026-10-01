-- ==============================================================================
-- pgTAP Test: calculate_vat_return & calculate_hungarian_vat_return
-- Description: Automated unit and regression tests for NAV 2665 VAT return calculations
-- Run: npx supabase test db  (or run inside transaction with ROLLBACK)
-- ==============================================================================

BEGIN;

SET search_path TO 'public', 'extensions';

-- 1. Declare number of planned tests
SELECT plan(7);

-- 2. Function existence checks
SELECT has_function(
  'public',
  'calculate_vat_return',
  ARRAY['uuid', 'integer', 'integer', 'text', 'text'],
  'calculate_vat_return RPC must exist in public schema with 5 parameters'
);

SELECT has_function(
  'public',
  'calculate_hungarian_vat_return',
  ARRAY['uuid', 'integer', 'integer', 'text'],
  'calculate_hungarian_vat_return RPC must exist in public schema with 4 parameters'
);

-- 3. Return types check
SELECT function_returns(
  'public',
  'calculate_vat_return',
  ARRAY['uuid', 'integer', 'integer', 'text', 'text'],
  'jsonb',
  'calculate_vat_return must return jsonb'
);

SELECT function_returns(
  'public',
  'calculate_hungarian_vat_return',
  ARRAY['uuid', 'integer', 'integer', 'text'],
  'jsonb',
  'calculate_hungarian_vat_return must return jsonb'
);

-- 4. Null safety test: Calling calculate_vat_return without company_id returns safe error json
SELECT is(
  public.calculate_vat_return(NULL::uuid, 2026, 1, 'H'::text, 'all'::text),
  '{"success": false, "error": "Hiányzó company_id"}'::jsonb,
  'calculate_vat_return returns error json when company_id is NULL'
);

-- 5. Execution safety test: Running Hungarian VAT return on test company completes with success=true
SELECT ok(
  (public.calculate_hungarian_vat_return('418b3264-1169-46bb-9a2a-4f58a186bf1e'::uuid, 2026, 1, 'H'::text)->>'success')::boolean,
  'calculate_hungarian_vat_return completes with success=true on active company'
);

-- 6. Security check: Anon role is restricted from direct execution
SELECT throws_ok(
  'SET ROLE anon; SELECT public.calculate_hungarian_vat_return(''418b3264-1169-46bb-9a2a-4f58a186bf1e''::uuid, 2026, 1, ''H''::text)',
  '42501',
  NULL,
  'Anonymous role must be denied execute permissions on calculate_hungarian_vat_return'
);

-- Finish test suite
SELECT * FROM finish();

-- Roll back transaction to leave database clean
ROLLBACK;
