-- ============================================================================
-- Set management@thinkai.hu profile role to 'thinkai'
-- ============================================================================
-- Run this in the Supabase SQL Editor.
-- The 'thinkai' role grants access ONLY to the Management Dashboard.
-- ============================================================================

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
