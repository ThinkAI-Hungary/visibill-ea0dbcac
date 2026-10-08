-- Migration: 20261008104000_fix_company_auto_accounting_rules_rls.sql
-- Description:
--   Expand RLS policies on public.company_auto_accounting_rules to align with company_prompt_rules and acc_journals:
--   - Allow company_members (all member roles)
--   - Allow accounty_assignments (assigned accountants in eaisyBooks)
--   - Allow is_support_admin()

-- Drop previous policies
DROP POLICY IF EXISTS "Users can view auto rules of accessible companies" ON public.company_auto_accounting_rules;
DROP POLICY IF EXISTS "Admins/Accountants can upsert auto rules" ON public.company_auto_accounting_rules;
DROP POLICY IF EXISTS "company_auto_accounting_rules_select" ON public.company_auto_accounting_rules;
DROP POLICY IF EXISTS "company_auto_accounting_rules_insert" ON public.company_auto_accounting_rules;
DROP POLICY IF EXISTS "company_auto_accounting_rules_update" ON public.company_auto_accounting_rules;
DROP POLICY IF EXISTS "company_auto_accounting_rules_delete" ON public.company_auto_accounting_rules;
DROP POLICY IF EXISTS "company_auto_accounting_rules_service_role_all" ON public.company_auto_accounting_rules;

-- 1. Service role full access
CREATE POLICY "company_auto_accounting_rules_service_role_all"
ON public.company_auto_accounting_rules FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 2. Select policy
CREATE POLICY "company_auto_accounting_rules_select"
ON public.company_auto_accounting_rules FOR SELECT TO authenticated
USING (
    (company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
    ))
    OR (company_id IN (
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR is_support_admin()
);

-- 3. Insert policy
CREATE POLICY "company_auto_accounting_rules_insert"
ON public.company_auto_accounting_rules FOR INSERT TO authenticated
WITH CHECK (
    (company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
    ))
    OR (company_id IN (
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR is_support_admin()
);

-- 4. Update policy
CREATE POLICY "company_auto_accounting_rules_update"
ON public.company_auto_accounting_rules FOR UPDATE TO authenticated
USING (
    (company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
    ))
    OR (company_id IN (
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR is_support_admin()
)
WITH CHECK (
    (company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
    ))
    OR (company_id IN (
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR is_support_admin()
);

-- 5. Delete policy
CREATE POLICY "company_auto_accounting_rules_delete"
ON public.company_auto_accounting_rules FOR DELETE TO authenticated
USING (
    (company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
    ))
    OR (company_id IN (
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR is_support_admin()
);
