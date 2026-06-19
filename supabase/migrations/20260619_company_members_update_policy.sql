-- ============================================================================
-- company_members UPDATE policy — allow owner/admin to modify member roles
-- ============================================================================
-- Currently no UPDATE policy exists on company_members, which means
-- role changes silently affect 0 rows. This adds a policy that allows:
-- 1. Company owner (companies.owner_id) to update any member row
-- 2. Admin members (role='admin') to update non-owner member rows
-- ============================================================================

-- Drop if exists (idempotent)
DROP POLICY IF EXISTS "Owner or admin can update members" ON public.company_members;

CREATE POLICY "Owner or admin can update members" ON public.company_members
  FOR UPDATE
  USING (
    -- The calling user is the company owner
    company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    )
    OR
    -- The calling user is an admin of this company
    EXISTS (
      SELECT 1 FROM public.company_members cm2
      WHERE cm2.company_id = company_members.company_id
        AND cm2.user_id = auth.uid()
        AND cm2.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    -- Same check for the new row
    company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.company_members cm2
      WHERE cm2.company_id = company_members.company_id
        AND cm2.user_id = auth.uid()
        AND cm2.role IN ('admin', 'owner')
    )
  );

COMMENT ON POLICY "Owner or admin can update members" ON public.company_members IS
  'Allows company owners and admin members to update member roles via Settings → Tagok dropdown.';
