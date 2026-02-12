
-- Helper function to avoid infinite recursion in company_members RLS
CREATE OR REPLACE FUNCTION public.user_is_company_member(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
  );
$$;

-- Replace restrictive SELECT policy with one that shows all co-members
DROP POLICY IF EXISTS "Users can view their memberships" ON public.company_members;

CREATE POLICY "Members can view company memberships"
  ON public.company_members FOR SELECT
  USING (public.user_is_company_member(company_id));
