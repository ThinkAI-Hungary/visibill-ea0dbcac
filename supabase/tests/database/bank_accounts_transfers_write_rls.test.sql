-- ==============================================================================
-- pgTAP Test: RBAC Csomag A (A-247) - company_bank_accounts + payment_transfers write RLS
-- Covers migration: 20261011130700_restrict_bank_accounts_and_transfers_write_rls.sql
-- Run: npx supabase test db  (ends with ROLLBACK - no data is left behind)
-- Catalog assertions only (always runnable); behaviour was verified on the Dev DB with
-- SET LOCAL ROLE authenticated + request.jwt.claims for an assistant (denied) and a member (allowed).
-- ==============================================================================

BEGIN;

SET search_path TO 'public', 'extensions';

SELECT plan(14);

-- Old permissive policies are gone
SELECT is_empty($$SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_bank_accounts' AND policyname LIKE 'Members can %' AND cmd IN ('INSERT','UPDATE','DELETE')$$,
  'no permissive Members write policy on company_bank_accounts');
SELECT is_empty($$SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_transfers' AND policyname LIKE 'Members can %' AND cmd IN ('INSERT','UPDATE','DELETE')$$,
  'no permissive Members write policy on payment_transfers');

-- Finance-role write policies exist for every command on both tables
SELECT policies_are('public', 'company_bank_accounts', ARRAY[
  'Members can view bank accounts',
  'Finance roles can insert bank accounts',
  'Finance roles can update bank accounts',
  'Finance roles can delete bank accounts',
  'company_bank_accounts_service_role_all'
], 'company_bank_accounts policy set is exact');
SELECT policies_are('public', 'payment_transfers', ARRAY[
  'Members can view payment transfers',
  'Finance roles can insert payment transfers',
  'Finance roles can update payment transfers',
  'Finance roles can delete payment transfers',
  'payment_transfers_service_role_all'
], 'payment_transfers policy set is exact');

-- Write policies include only the finance roles
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname='public' AND tablename IN ('company_bank_accounts','payment_transfers')
    AND policyname LIKE 'Finance roles%'
    AND (coalesce(qual,'') || coalesce(with_check,'')) ~ '(assistant|viewer|employee)'
), 'no write policy mentions assistant/viewer/employee');

SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname='public' AND tablename IN ('company_bank_accounts','payment_transfers')
    AND policyname LIKE 'Finance roles%'
    AND (coalesce(qual,'') || coalesce(with_check,'')) !~ 'owner'
), 'every write policy lists owner');

SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname='public' AND tablename IN ('company_bank_accounts','payment_transfers')
    AND policyname LIKE 'Finance roles%'
    AND (coalesce(qual,'') || coalesce(with_check,'')) !~ 'support_admin'
), 'every write policy lists support_admin');

-- SELECT stays open to every member (read-only roles keep visibility)
SELECT ok((SELECT qual NOT LIKE '%role%' FROM pg_policies WHERE schemaname='public' AND tablename='company_bank_accounts' AND cmd='SELECT'),
  'company_bank_accounts SELECT is not role-restricted');
SELECT ok((SELECT qual NOT LIKE '%role%' FROM pg_policies WHERE schemaname='public' AND tablename='payment_transfers' AND cmd='SELECT'),
  'payment_transfers SELECT is not role-restricted');

-- RLS enabled
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.company_bank_accounts'::regclass), 'RLS enabled on company_bank_accounts');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.payment_transfers'::regclass), 'RLS enabled on payment_transfers');

-- Write policies target authenticated only
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_policies
  WHERE schemaname='public' AND tablename IN ('company_bank_accounts','payment_transfers')
    AND policyname LIKE 'Finance roles%' AND roles <> '{authenticated}'
), 'write policies are TO authenticated only');

SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_bank_accounts' AND policyname='Finance roles can update bank accounts' AND with_check IS NOT NULL),
  'bank accounts UPDATE has WITH CHECK');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_transfers' AND policyname='Finance roles can update payment transfers' AND with_check IS NOT NULL),
  'payment transfers UPDATE has WITH CHECK');

SELECT * FROM finish();

ROLLBACK;
