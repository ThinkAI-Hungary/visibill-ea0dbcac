-- =====================================================
-- Fix: add missing INSERT/UPDATE/DELETE policies for
-- accounty_communication_preferences
-- The RLS optimization migration only created a SELECT
-- policy, breaking upserts from the client.
-- =====================================================

-- INSERT policy (for new rows via upsert)
DROP POLICY IF EXISTS "comm_prefs_insert" ON public.accounty_communication_preferences;
CREATE POLICY "comm_prefs_insert" ON public.accounty_communication_preferences
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

-- UPDATE policy (for existing rows via upsert)
DROP POLICY IF EXISTS "comm_prefs_update" ON public.accounty_communication_preferences;
CREATE POLICY "comm_prefs_update" ON public.accounty_communication_preferences
  FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

-- DELETE policy (for completeness)
DROP POLICY IF EXISTS "comm_prefs_delete" ON public.accounty_communication_preferences;
CREATE POLICY "comm_prefs_delete" ON public.accounty_communication_preferences
  FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));
