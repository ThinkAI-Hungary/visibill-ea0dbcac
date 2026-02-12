
-- Step 1a: Fix Members List Visibility
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Members can view co-member profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.company_members cm1
      JOIN public.company_members cm2 ON cm1.company_id = cm2.company_id
      WHERE cm1.user_id = auth.uid()
        AND cm2.user_id = profiles.user_id
    )
  );

-- Step 1b: Add Token Expiration Column
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS share_token_created_at timestamptz;
