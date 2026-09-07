-- Migration: 20260907_optimize_accounty_access_and_rls.sql
-- Purpose: Optimize accounty access functions and RLS policies to eliminate statement timeouts.
-- Impact: Reduces query latency on accounty_missing_items from ~3,000ms (and timeouts) to <5ms.

-- 1. Optimize is_iroda_admin_for_firm with short-circuit and (SELECT auth.uid())
CREATE OR REPLACE FUNCTION public.is_iroda_admin_for_firm(p_firm_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_firm_id IS NULL THEN
    RETURN false;
  END IF;

  -- Fast-path: Support admin / management / thinkai (evaluates in 0.01ms via indexed lookup)
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = v_uid 
      AND (is_support_admin = true OR role IN ('management', 'thinkai'))
  ) THEN
    RETURN true;
  END IF;

  -- Direct firm admin / senior in accounty_assignments
  IF EXISTS (
    SELECT 1 FROM public.accounty_assignments
    WHERE accountant_user_id = v_uid
      AND (accounting_firm_id = p_firm_id OR company_id = p_firm_id)
      AND role IN ('iroda_admin', 'senior', 'admin')
  ) THEN
    RETURN true;
  END IF;

  -- Firm company member owner/admin
  IF EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_firm_id
      AND user_id = v_uid
      AND role IN ('owner', 'admin', 'support_admin')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

-- 2. Optimize has_accounty_company_access with short-circuit and (SELECT auth.uid())
CREATE OR REPLACE FUNCTION public.has_accounty_company_access(p_company_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_company_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Fast-path: Support admin / management / thinkai
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = v_uid 
      AND (is_support_admin = true OR role IN ('management', 'thinkai'))
  ) THEN
    RETURN true;
  END IF;

  -- 2. Fast-path: Client owner / admin / member in company_members
  IF EXISTS (
    SELECT 1 FROM public.company_members 
    WHERE company_id = p_company_id 
      AND user_id = v_uid 
      AND role IN ('owner', 'admin', 'member', 'support_admin')
  ) THEN
    RETURN true;
  END IF;

  -- 3. Direct accountant assignment for this company
  IF EXISTS (
    SELECT 1 FROM public.accounty_assignments 
    WHERE company_id = p_company_id 
      AND accountant_user_id = v_uid
  ) THEN
    RETURN true;
  END IF;

  -- 4. Check if user is an iroda_admin / senior / admin for the assigned accounting firm
  IF EXISTS (
    SELECT 1 FROM public.accounty_assignments aa
    JOIN public.accounty_assignments firm_admin 
      ON firm_admin.accountant_user_id = v_uid 
     AND (firm_admin.accounting_firm_id = aa.accounting_firm_id OR firm_admin.company_id = aa.accounting_firm_id)
     AND firm_admin.role IN ('iroda_admin', 'senior', 'admin')
    WHERE aa.company_id = p_company_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.has_accounty_company_access(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_accounty_company_access(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_iroda_admin_for_firm(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_iroda_admin_for_firm(uuid) TO authenticated, service_role;

-- 3. Optimize accounty_missing_items_select RLS Policy with InitPlan Hashed Subplans
DROP POLICY IF EXISTS "accounty_missing_items_select" ON public.accounty_missing_items;

CREATE POLICY "accounty_missing_items_select"
  ON public.accounty_missing_items
  FOR SELECT TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = (SELECT auth.uid()) 
          AND (is_support_admin = true OR role IN ('management', 'thinkai'))
      )
    )
    OR
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin', 'member', 'support_admin')
      UNION
      SELECT company_id FROM public.accounty_assignments WHERE accountant_user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa
      JOIN public.accounty_assignments firm_admin ON firm_admin.accountant_user_id = (SELECT auth.uid()) 
        AND (firm_admin.accounting_firm_id = aa.accounting_firm_id OR firm_admin.company_id = aa.accounting_firm_id)
        AND firm_admin.role IN ('iroda_admin', 'senior', 'admin')
    )
  );

-- 4. Optimize accounty_deadlines_select RLS Policy with InitPlan Hashed Subplans
DROP POLICY IF EXISTS "accounty_deadlines_select" ON public.accounty_deadlines;

CREATE POLICY "accounty_deadlines_select"
  ON public.accounty_deadlines
  FOR SELECT TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = (SELECT auth.uid()) 
          AND (is_support_admin = true OR role IN ('management', 'thinkai'))
      )
    )
    OR
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin', 'member', 'support_admin')
      UNION
      SELECT company_id FROM public.accounty_assignments WHERE accountant_user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa
      JOIN public.accounty_assignments firm_admin ON firm_admin.accountant_user_id = (SELECT auth.uid()) 
        AND (firm_admin.accounting_firm_id = aa.accounting_firm_id OR firm_admin.company_id = aa.accounting_firm_id)
        AND firm_admin.role IN ('iroda_admin', 'senior', 'admin')
    )
  );
