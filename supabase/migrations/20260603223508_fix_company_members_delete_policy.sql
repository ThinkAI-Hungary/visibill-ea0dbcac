-- Drop the existing restrictive delete policy
DROP POLICY IF EXISTS "Users can leave companies" ON public.company_members;

-- Create a new delete policy that allows:
-- 1. Users to delete their own membership (leave the company)
-- 2. Company owners/admins to remove members from their company
CREATE POLICY "Members can delete memberships"
  ON public.company_members FOR DELETE
  USING (
    auth.uid() = user_id OR
    public.is_company_admin(company_id)
  );
