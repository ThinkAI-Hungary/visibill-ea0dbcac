-- ============================================================================
-- Add 'thinkai' to profiles.role CHECK constraint, then assign it
-- ============================================================================
-- Run this in the Supabase SQL Editor.
-- ============================================================================

-- 1. Drop the existing constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Re-create it with 'thinkai' added
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'management', 'thinkai'));

-- 3. Set the role
UPDATE public.profiles
SET role = 'thinkai'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'management@thinkai.hu'
);

-- Verify
SELECT au.email, p.name, p.role AS profile_role
FROM auth.users au
JOIN public.profiles p ON p.user_id = au.id
WHERE au.email = 'management@thinkai.hu';
