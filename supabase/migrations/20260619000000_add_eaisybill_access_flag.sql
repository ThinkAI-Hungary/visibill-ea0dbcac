-- ==================================================
-- MERGED FROM: 20260619_add_eaisybill_access_flag.sql
-- ==================================================
-- ============================================================================
-- Add eaisybill_access flag to profiles
-- ============================================================================
-- Allows accounty iroda_admin users to control whether individual
-- accountants/team members can access the eaisybill module.
-- Default: true (all users have access by default).
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS eaisybill_access BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.eaisybill_access IS
  'Whether this user can access eaisybill. Managed by accounty iroda_admin.';


-- ==================================================
-- MERGED FROM: 20260619_add_main_accountant.sql
-- ==================================================
-- ============================================================================
-- Add is_main_accountant flag to accounty_assignments
-- ============================================================================
-- Tracks which accountant is the primary/lead accountant for a company.
-- Each company can have at most ONE main accountant (enforced by unique index).
-- The iroda_admin stays assigned to all companies regardless.
-- ============================================================================

ALTER TABLE public.accounty_assignments
ADD COLUMN IF NOT EXISTS is_main_accountant BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.accounty_assignments.is_main_accountant IS
  'True if this accountant is the main/lead accountant for this company. Only one per company.';

-- Ensure only one main accountant per company (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_main_accountant_per_company
  ON public.accounty_assignments (company_id)
  WHERE is_main_accountant = true;


-- ==================================================
-- MERGED FROM: 20260619_add_registration_source.sql
-- ==================================================
-- Add registration_source to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS registration_source TEXT;

-- Update handle_new_user trigger function to parse and pass source
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  verify_token text;
  request_id bigint;
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY';
  supabase_url text := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
BEGIN
  -- Generate verification token
  verify_token := encode(gen_random_bytes(32), 'hex');

  -- Insert profile
  INSERT INTO public.profiles (user_id, name, email_verified, email_verify_token, registration_source)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'name',
    false,
    verify_token,
    COALESCE(NEW.raw_user_meta_data ->> 'source', 'eaisybill')
  );

  -- Fire welcome email via pg_net (async server-to-server HTTP, no CORS)
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-welcome-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key,
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'userId', NEW.id::text,
      'email', NEW.email,
      'name', COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      'source', COALESCE(NEW.raw_user_meta_data ->> 'source', 'eaisybill')
    )
  ) INTO request_id;
  
  RAISE LOG '[handle_new_user] Welcome email queued via pg_net, request_id: %', request_id;

  RETURN NEW;
END;
$function$;


-- ==================================================
-- MERGED FROM: 20260619_admin_update_profiles_policy.sql
-- ==================================================
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


-- ==================================================
-- MERGED FROM: 20260619_backfill_missing_user_data.sql
-- ==================================================
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


-- ==================================================
-- MERGED FROM: 20260619_company_members_update_policy.sql
-- ==================================================
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


-- ==================================================
-- MERGED FROM: 20260619_lookup_user_by_email.sql
-- ==================================================
-- ============================================================================
-- lookup_user_by_email — RPC for InviteUserDialog email lookup
-- ============================================================================
-- Returns { email, name } for a given email if user exists.
-- Used by the frontend to check if a user is already registered
-- before adding them to a company.
-- Only owner/admin callers should use this (frontend enforces).
-- ============================================================================

CREATE OR REPLACE FUNCTION lookup_user_by_email(p_email TEXT)
RETURNS TABLE(user_id UUID, email TEXT, name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    au.id AS user_id,
    au.email::TEXT AS email,
    COALESCE(p.name, au.raw_user_meta_data->>'name', au.email)::TEXT AS name
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.user_id = au.id
  WHERE lower(au.email) = lower(p_email)
  LIMIT 1;
END;
$$;

-- Only authenticated users can call this
REVOKE EXECUTE ON FUNCTION public.lookup_user_by_email FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_user_by_email TO authenticated;

COMMENT ON FUNCTION public.lookup_user_by_email IS
  'Looks up a user by email address. Returns user_id, email, and name if found. '
  'Used by InviteUserDialog to check if user exists before inviting.';
