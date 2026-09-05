-- ===========================================================================
-- Batch POL-3: Fix Profiles RLS and Role Explosion
-- Eliminates multiple_permissive_policies on:
--   profiles (7 findings across anon, authenticated, authenticator, etc.)
-- ===========================================================================

-- Drop obsolete / overlapping policies
DROP POLICY IF EXISTS "See team members" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "iroda_admin_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or iroda admin" ON public.profiles;

-- 1. SELECT: Single clean policy for authenticated users
CREATE POLICY "Authenticated users can read all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (true);

-- 2. INSERT: Single clean policy for authenticated users creating own profile
CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3. UPDATE: Single unified policy for own profile update OR iroda admin update
CREATE POLICY "Users can update own profile or iroda admin" ON public.profiles
FOR UPDATE TO authenticated
USING (
  ((SELECT auth.uid()) = user_id)
  OR (EXISTS (
    SELECT 1 FROM public.accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
      AND aa.role = 'iroda_admin'::text
  ))
)
WITH CHECK (
  ((SELECT auth.uid()) = user_id)
  OR (EXISTS (
    SELECT 1 FROM public.accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
      AND aa.role = 'iroda_admin'::text
  ))
);
