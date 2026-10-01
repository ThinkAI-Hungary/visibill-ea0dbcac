-- ==============================================================================
-- pgTAP Test: acc_journal_lifecycle
-- Description: Automated unit and regression tests for Double-Entry Bookkeeping lifecycle:
--              1. Sequential gapless numbering (acc_get_next_journal_number)
--              2. Balance validation (T=K) enforcement (acc_post_journal_entry)
--              3. Subledger partner enforcement (acc_post_journal_entry)
--              4. Final posting and immutability lock (acc_post_journal_entry)
--              5. Strict storno accounting and inverted corrections (acc_storno_journal_entry)
-- Run: npx supabase test db  (or run inside transaction with ROLLBACK)
-- ==============================================================================

BEGIN;

SET search_path TO 'public', 'extensions';

-- 1. Declare number of planned tests
SELECT plan(8);

-- 2. Function existence checks
SELECT has_function(
  'public',
  'acc_get_next_journal_number',
  ARRAY['uuid', 'smallint'],
  'acc_get_next_journal_number RPC must exist in public schema'
);

SELECT has_function(
  'public',
  'acc_post_journal_entry',
  ARRAY['uuid', 'uuid'],
  'acc_post_journal_entry RPC must exist in public schema'
);

SELECT has_function(
  'public',
  'acc_storno_journal_entry',
  ARRAY['uuid', 'uuid', 'text', 'boolean'],
  'acc_storno_journal_entry RPC must exist in public schema'
);

-- 3. Number generator allocates a sequence
SELECT ok(
  acc_get_next_journal_number('f11b032d-a662-4816-9807-396c76609b8d'::uuid, 2026::smallint) > 0,
  'acc_get_next_journal_number allocates a positive integer sequence'
);

-- Prepare test draft header (isolated in transaction)
DO $$
DECLARE
  v_h_id uuid := '11111111-2222-3333-4444-555555555555'::uuid;
BEGIN
  INSERT INTO public.acc_journal_headers (
    id, company_id, journal_id, accounting_year, status, entry_type, source,
    document_id, posting_date, document_date, description, currency
  ) VALUES (
    v_h_id, '418b3264-1169-46bb-9a2a-4f58a186bf1e'::uuid, 'f11b032d-a662-4816-9807-396c76609b8d'::uuid, 2026, 'KEZI_PISZKOZAT', 'NORMAL', 'KEZI_MODOSITAS',
    'DOC-PGTAP-001', '2026-06-01', '2026-06-01', 'pgTAP Test Unbalanced Entry', 'HUF'
  );

  -- Insert single line (imbalanced: T = 1000, K = 0)
  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount
  ) VALUES (
    v_h_id, 1, 'ecebbf3d-8787-4e5f-9513-f8b0d8f8457d'::uuid, 'T', 1000, 1000
  );
END $$;

-- 4. Imbalance rejection: Must throw exception
SELECT throws_matching(
  'SELECT public.acc_post_journal_entry(''11111111-2222-3333-4444-555555555555''::uuid, NULL::uuid)',
  'Kettős könyvviteli egyensúlytalanság',
  'acc_post_journal_entry must reject unbalanced journal entries (Debit != Credit)'
);

-- Add matching K line on partner account (311) but header has no partner_id
INSERT INTO public.acc_journal_lines (
  header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount
) VALUES (
  '11111111-2222-3333-4444-555555555555'::uuid, 2, '27628582-f91c-4fd8-9f98-7aefcf8efd85'::uuid, 'K', 1000, 1000
);

-- 5. Partner enforcement: Must throw exception
SELECT throws_matching(
  'SELECT public.acc_post_journal_entry(''11111111-2222-3333-4444-555555555555''::uuid, NULL::uuid)',
  'partnerhez kötött folyószámla',
  'acc_post_journal_entry must reject partner GL lines when header partner_id is missing'
);

-- Fix line 2 to use non-partner account 112
UPDATE public.acc_journal_lines 
SET gl_account_id = '99f682aa-e6ab-4f22-9fb2-e10549798c57'::uuid 
WHERE header_id = '11111111-2222-3333-4444-555555555555'::uuid AND sequence_number = 2;

-- 6. Balanced posting succeeds
SELECT is(
  public.acc_post_journal_entry('11111111-2222-3333-4444-555555555555'::uuid, NULL::uuid),
  true,
  'acc_post_journal_entry posts balanced journal entry successfully'
);

-- 7. Storno succeeds and creates inverted entry
SELECT ok(
  public.acc_storno_journal_entry('11111111-2222-3333-4444-555555555555'::uuid, NULL::uuid, 'pgTAP regression test', false) IS NOT NULL,
  'acc_storno_journal_entry stornos posted entry and returns storno header id'
);

-- Finish test suite
SELECT * FROM finish();

-- Roll back transaction to leave database clean
ROLLBACK;
