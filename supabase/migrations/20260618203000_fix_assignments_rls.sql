-- Fix: RLS policies on accounty_assignments
-- Dropping old senior/junior policies that no longer apply due to role renames

DROP POLICY IF EXISTS "accounty_assignments_insert_senior" ON public.accounty_assignments;
DROP POLICY IF EXISTS "accounty_assignments_update_senior" ON public.accounty_assignments;
DROP POLICY IF EXISTS "assignments_insert" ON public.accounty_assignments;
DROP POLICY IF EXISTS "assignments_update" ON public.accounty_assignments;
DROP POLICY IF EXISTS "assignments_delete" ON public.accounty_assignments;

-- Allow insert if the user is iroda_admin of the firm
CREATE POLICY "assignments_insert" ON public.accounty_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_iroda_admin_for_firm(accounting_firm_id)
  );

-- Allow update if the user is iroda_admin of the firm
CREATE POLICY "assignments_update" ON public.accounty_assignments
  FOR UPDATE TO authenticated
  USING (
    is_iroda_admin_for_firm(accounting_firm_id)
  );

-- Allow delete if the user is iroda_admin of the firm
CREATE POLICY "assignments_delete" ON public.accounty_assignments
  FOR DELETE TO authenticated
  USING (
    is_iroda_admin_for_firm(accounting_firm_id)
  );
