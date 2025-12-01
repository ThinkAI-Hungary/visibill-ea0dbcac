-- Enable required extensions for cron job scheduling
-- Run this SQL in the Supabase SQL Editor

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily NAV synchronization
-- Runs every day at 2:00 AM UTC (3:00 AM CET)
SELECT cron.schedule(
  'nav-daily-sync',                    -- Job name
  '0 2 * * *',                         -- Cron expression: 2:00 AM UTC daily
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/nav-auto-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- View scheduled cron jobs
SELECT * FROM cron.job;

-- To unschedule the job (if needed):
-- SELECT cron.unschedule('nav-daily-sync');

-- To see cron job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
