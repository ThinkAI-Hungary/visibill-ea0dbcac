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
