-- ============================================================================
-- Allow iroda_admin to update other users' profiles (eaisybill_access toggle)
-- ============================================================================
-- The default RLS policy only allows users to update their own profile.
-- This policy allows iroda_admin users to update any profile (needed for
-- toggling eaisybill_access on the Accountant Management page).
-- ============================================================================

CREATE POLICY iroda_admin_update_profiles
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'iroda_admin'
    )
  );
