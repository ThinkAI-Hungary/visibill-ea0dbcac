-- =============================================
-- Migration: Support Admin Impersonation
-- =============================================

-- 1. Extend company_members role check to allow 'support_admin'
ALTER TABLE public.company_members
  DROP CONSTRAINT IF EXISTS company_members_role_check;

ALTER TABLE public.company_members
  ADD CONSTRAINT company_members_role_check
  CHECK (role = ANY (ARRAY['owner','admin','member','assistant','viewer','employee','support_admin']));

-- 2. Add impersonation_started_at column (nullable — only set for support_admin rows)
ALTER TABLE public.company_members
  ADD COLUMN IF NOT EXISTS impersonation_started_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.company_members.impersonation_started_at IS
  'Set when a support_admin impersonation session starts. Used for auto-cleanup.';

-- 3. Cleanup function: removes stale support_admin rows older than 2 hours
CREATE OR REPLACE FUNCTION public.cleanup_stale_impersonations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.company_members
  WHERE role = 'support_admin'
    AND impersonation_started_at IS NOT NULL
    AND impersonation_started_at < now() - interval '2 hours';
END;
$$;

-- 4. Schedule cleanup every 15 minutes via pg_cron
SELECT cron.unschedule('cleanup-stale-impersonations')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stale-impersonations'
);

SELECT cron.schedule(
  'cleanup-stale-impersonations',
  '*/15 * * * *',
  $$SELECT public.cleanup_stale_impersonations()$$
);

-- 5. Index for fast cleanup queries
CREATE INDEX IF NOT EXISTS idx_company_members_support_admin
  ON public.company_members (role, impersonation_started_at)
  WHERE role = 'support_admin';
