-- Enable required extensions for cron job scheduling
-- Run this SQL in the Supabase SQL Editor
--
-- NOTE: The actual cron job is registered via the Lovable agent using the
-- CRON_SECRET edge-function secret. This file is documentation only — do not
-- paste the placeholder below into production.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Reschedule (unschedule first to avoid duplicates)
-- SELECT cron.unschedule('nav-daily-sync');

SELECT cron.schedule(
  'nav-daily-sync',
  '0 2 * * *',  -- 2:00 AM UTC daily
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/nav-auto-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET edge-function secret value>'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- View scheduled cron jobs:        SELECT * FROM cron.job;
-- Cron run history:                SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- Unschedule:                      SELECT cron.unschedule('nav-daily-sync');
