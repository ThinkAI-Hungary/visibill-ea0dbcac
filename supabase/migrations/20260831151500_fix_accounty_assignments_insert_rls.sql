-- =============================================================================
-- Migration: Fix accounty_assignments insert RLS and enhance is_iroda_admin_for_firm
-- =============================================================================

-- 1. Enhance is_iroda_admin_for_firm to also check company_members owner/admin roles
CREATE OR REPLACE FUNCTION public.is_iroda_admin_for_firm(p_firm_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p_firm_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM accounty_assignments
      WHERE accountant_user_id = auth.uid()
        AND (accounting_firm_id = p_firm_id OR company_id = p_firm_id)
        AND role IN ('iroda_admin', 'senior', 'admin')
    ) OR EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = p_firm_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'support_admin')
    ) OR EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND (is_support_admin = true OR role IN ('management', 'thinkai'))
    )
  );
$function$;

-- 2. Update assignments_insert policy to allow inserting with firm or company admin check
DROP POLICY IF EXISTS "assignments_insert" ON public.accounty_assignments;
CREATE POLICY "assignments_insert" ON public.accounty_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_iroda_admin_for_firm(accounting_firm_id)
    OR is_iroda_admin_for_firm(company_id)
    OR (
      accountant_user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM company_members
        WHERE company_members.user_id = (SELECT auth.uid())
          AND company_members.role IN ('owner', 'admin', 'support_admin')
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = (SELECT auth.uid())
        AND (is_support_admin = true OR role IN ('management', 'thinkai'))
    )
  );

-- 3. Ensure UPDATE and DELETE policies also check both firm and company
DROP POLICY IF EXISTS "assignments_update" ON public.accounty_assignments;
CREATE POLICY "assignments_update" ON public.accounty_assignments
  FOR UPDATE TO authenticated
  USING (
    is_iroda_admin_for_firm(accounting_firm_id)
    OR is_iroda_admin_for_firm(company_id)
  );

DROP POLICY IF EXISTS "assignments_delete" ON public.accounty_assignments;
CREATE POLICY "assignments_delete" ON public.accounty_assignments
  FOR DELETE TO authenticated
  USING (
    is_iroda_admin_for_firm(accounting_firm_id)
    OR is_iroda_admin_for_firm(company_id)
  );
