-- ============================================================================
-- Fix: Backfill missing profiles and access cache for test users
-- ============================================================================
-- The "Database error querying schema" occurs when a user logs in but
-- doesn't have a profiles row (the handle_new_user trigger might not have
-- fired for admin-created users).
-- ============================================================================

-- 1. Backfill missing profiles for users that exist in auth.users but not in profiles
INSERT INTO public.profiles (user_id, name)
SELECT au.id, COALESCE(au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1))
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
)
ON CONFLICT (user_id) DO NOTHING;

-- 2. Backfill missing user_subscriptions
INSERT INTO public.user_subscriptions (user_id, tier, invoice_limit, invoices_used)
SELECT p.user_id, 'teszt', 999999, 0
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = p.user_id
)
ON CONFLICT (user_id) DO NOTHING;

-- 3. Backfill missing access cache entries from company_members
INSERT INTO user_company_access_cache (user_id, company_id, access_source, role,
  can_read_invoices, can_read_transactions, can_read_salaries, can_read_hr)
SELECT cm.user_id, cm.company_id, 'company_member', cm.role,
  cm.role NOT IN ('employee'),
  cm.role NOT IN ('employee'),
  cm.role NOT IN ('employee', 'viewer'),
  cm.role NOT IN ('viewer')
FROM company_members cm
WHERE NOT EXISTS (
  SELECT 1 FROM user_company_access_cache uac
  WHERE uac.user_id = cm.user_id AND uac.company_id = cm.company_id
);

-- Show what was fixed
SELECT 'profiles' AS table_name, count(*) AS total FROM profiles
UNION ALL
SELECT 'user_subscriptions', count(*) FROM user_subscriptions
UNION ALL
SELECT 'access_cache', count(*) FROM user_company_access_cache;
