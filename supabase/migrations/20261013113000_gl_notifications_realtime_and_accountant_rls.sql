-- ============================================================================
-- Migration: Fix gl_upload_notifications realtime streaming, replica identity,
-- and RLS access for external accountants
--
-- 1. Ensure REPLICA IDENTITY FULL on gl_upload_notifications so Supabase Realtime
--    can evaluate filters on non-primary-key columns (e.g. company_id=eq...) on UPDATE.
-- 2. Ensure gl_upload_notifications is in supabase_realtime publication.
-- 3. Extend SELECT and INSERT RLS policies to allow external accountants
--    (via public.rls_accounty_bookkeeping_company_ids()) in addition to company_members.
-- ============================================================================

-- 1. Replica Identity FULL
ALTER TABLE public.gl_upload_notifications REPLICA IDENTITY FULL;

-- 2. Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'gl_upload_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gl_upload_notifications;
  END IF;
END $$;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Users can insert notifications for their company" ON public.gl_upload_notifications;
CREATE POLICY "Users can insert notifications for their company"
  ON public.gl_upload_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
    OR
    company_id IN (
      SELECT public.rls_accounty_bookkeeping_company_ids()
    )
  );

DROP POLICY IF EXISTS "Users can view notifications for their company" ON public.gl_upload_notifications;
CREATE POLICY "Users can view notifications for their company"
  ON public.gl_upload_notifications
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
    OR
    company_id IN (
      SELECT public.rls_accounty_bookkeeping_company_ids()
    )
  );
