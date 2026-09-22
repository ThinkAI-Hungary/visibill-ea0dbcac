-- Migration: 20260920140000_nav_auto_sync_staggered_cron.sql
-- Description: Reschedule nav-daily-sync to run across 4 dawn time slots (01:00, 02:00, 03:00, 04:00 UTC)
--              for Load Staggering (Hajnali Idő-ablakos Terheléselosztás)

DO $$
BEGIN
  -- Unschedule existing job if registered
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nav-daily-sync') THEN
    PERFORM cron.unschedule('nav-daily-sync');
  END IF;

  -- Reschedule across the 4 dawn hours (01:00, 02:00, 03:00, 04:00 UTC)
  -- In local time:
  --   Slot 0 (01:00 UTC) -> 02:00 CET / 03:00 CEST (companies with UUID modulo 4 = 0)
  --   Slot 1 (02:00 UTC) -> 03:00 CET / 04:00 CEST (companies with UUID modulo 4 = 1)
  --   Slot 2 (03:00 UTC) -> 04:00 CET / 05:00 CEST (companies with UUID modulo 4 = 2)
  --   Slot 3 (04:00 UTC) -> 05:00 CET / 06:00 CEST (companies with UUID modulo 4 = 3)
  PERFORM cron.schedule(
    'nav-daily-sync',
    '0 1,2,3,4 * * *',
    $cmd$
    SELECT net.http_post(
      url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/nav-auto-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) as request_id;
    $cmd$
  );
END $$;
