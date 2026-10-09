-- Migration: add feedback and ticket_reads to supabase_realtime publication
-- Ensures client tickets and read state updates trigger realtime notifications

DO $$
DECLARE
  t text;
  missing_tables text[] := ARRAY[
    'feedback',
    'ticket_reads'
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
