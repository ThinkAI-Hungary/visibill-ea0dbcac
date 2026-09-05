-- ============================================================================
-- Migration: Fix worker_heartbeats RLS and permissions
-- Date: 2026-09-05
-- Standard: ADR A-003, A-017, Supabase Security Best Practices
-- Description: Adds service_role full access and management select access to worker_heartbeats.
-- ============================================================================

ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "worker_heartbeats_service_role_all" ON public.worker_heartbeats;
DROP POLICY IF EXISTS "worker_heartbeats_management_select" ON public.worker_heartbeats;

CREATE POLICY "worker_heartbeats_service_role_all"
  ON public.worker_heartbeats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "worker_heartbeats_management_select"
  ON public.worker_heartbeats
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.role = ANY (ARRAY['thinkai'::text, 'management'::text])
    )
  );

REVOKE ALL ON TABLE public.worker_heartbeats FROM anon;
