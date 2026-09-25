-- Migration: add missing tables to supabase_realtime publication
-- Fixes LiveNotificationProvider CHANNEL_ERROR on websocket subscription

DO $$
DECLARE
  t text;
  missing_tables text[] := ARRAY[
    'payment_transfers',
    'acc_journal_headers',
    'categories',
    'projects',
    'dunning_sends',
    'nav_sync_logs',
    'report_uploads',
    'courier_reports'
  ];
BEGIN
  FOREACH t IN ARRAY missing_tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    END IF;
  END LOOP;
END $$;
