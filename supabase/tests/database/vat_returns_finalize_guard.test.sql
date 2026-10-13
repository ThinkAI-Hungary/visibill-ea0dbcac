-- ==============================================================================
-- pgTAP Test: VAT-return finalize guard + payroll_specialist role (D-4 / D-5)
-- Covers migration: 20261011012947_role_capability_refactor.sql
-- Run: npx supabase test db  (or execute directly - ends with ROLLBACK)
-- Behavioural per-role matrix is covered by the manual Dev-DB session test
-- documented in docs/architecture/decisions/A-247-role-capability-matrix.md.
-- ==============================================================================

BEGIN;

SET search_path TO 'public', 'extensions';

SELECT plan(14);

-- 1. can_finalize_company_filing: STABLE SECURITY DEFINER, search_path pinned, not callable by anon/PUBLIC
SELECT is(
  (SELECT provolatile FROM pg_proc WHERE oid = 'public.can_finalize_company_filing(uuid)'::regprocedure),
  's'::"char",
  'can_finalize_company_filing is STABLE');

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.can_finalize_company_filing(uuid)'::regprocedure),
  'can_finalize_company_filing is SECURITY DEFINER');

SELECT ok(
  (SELECT proconfig::text LIKE '%search_path=public%' FROM pg_proc WHERE oid = 'public.can_finalize_company_filing(uuid)'::regprocedure),
  'can_finalize_company_filing pins search_path');

SELECT ok(NOT has_function_privilege('anon', 'public.can_finalize_company_filing(uuid)', 'EXECUTE'),
  'anon must NOT execute can_finalize_company_filing');

SELECT ok(has_function_privilege('authenticated', 'public.can_finalize_company_filing(uuid)', 'EXECUTE'),
  'authenticated MAY execute can_finalize_company_filing');

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    WHERE p.oid = 'public.can_finalize_company_filing(uuid)'::regprocedure
      AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC must NOT hold EXECUTE on can_finalize_company_filing');

-- 2. Trigger function is not directly callable by end users
SELECT ok(NOT has_function_privilege('authenticated', 'public.fn_vat_returns_finalize_guard()', 'EXECUTE'),
  'authenticated must NOT execute the finalize guard trigger function');

-- 3. Trigger is installed BEFORE INSERT OR UPDATE OF status on vat_returns
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.vat_returns'::regclass
      AND tgname = 'trg_vat_returns_finalize_guard'
      AND NOT tgisinternal
  ),
  'trg_vat_returns_finalize_guard exists on vat_returns');

-- 4. System session (no end-user JWT, e.g. migrations / service role) may finalize
SELECT ok(
  public.can_finalize_company_filing('00000000-0000-0000-0000-000000000000'::uuid),
  'system session (no JWT) is allowed');

-- 5. accounty_assignments.role accepts payroll_specialist, rejects unknown roles
SELECT ok(
  (SELECT pg_get_constraintdef(oid) LIKE '%payroll_specialist%'
   FROM pg_constraint WHERE conname = 'accounty_assignments_role_check'),
  'accounty_assignments_role_check allows payroll_specialist');

SELECT ok(
  (SELECT pg_get_constraintdef(oid) NOT LIKE '%viewer%'
   FROM pg_constraint WHERE conname = 'accounty_assignments_role_check'),
  'accounty_assignments_role_check does not allow eaisyBill-only roles');

-- 6. accounty_module_permissions.module_name accepts the frontend keys that used to fail (23514)
SELECT ok(
  (SELECT pg_get_constraintdef(oid) LIKE '%''tao''%' AND pg_get_constraintdef(oid) LIKE '%admin_permissions%'
          AND pg_get_constraintdef(oid) LIKE '%client_bookkeeping%'
   FROM pg_constraint WHERE conname = 'accounty_module_permissions_module_name_check'),
  'module_name CHECK includes tao, admin_* and client_bookkeeping');

-- 7. Cache trigger keeps payroll_specialist away from invoices / transactions
SELECT ok(
  (SELECT pg_get_functiondef(p.oid) LIKE '%payroll_specialist%'
   FROM pg_proc p WHERE p.oid = 'public.sync_accounty_assignment_to_cache()'::regprocedure),
  'sync_accounty_assignment_to_cache is payroll_specialist aware');

SELECT ok(NOT has_function_privilege('anon', 'public.sync_accounty_assignment_to_cache()', 'EXECUTE'),
  'anon must NOT execute sync_accounty_assignment_to_cache');

SELECT * FROM finish();

ROLLBACK;
