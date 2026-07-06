-- VSWEB cron jobs
-- Run in Supabase SQL Editor after setting CRON_SECRET in Edge Function secrets
-- IMPORTANT: Replace <YOUR_CRON_SECRET> with the actual CRON_SECRET value before running!

-- Remove old cron jobs if they exist
SELECT cron.unschedule('nav-auto-sync-daily');
SELECT cron.unschedule('send-weekly-summary');

-- NAV Auto-Sync: daily at 2:00 AM UTC (3:00 AM CET)
SELECT cron.schedule(
  'nav-auto-sync-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pirgpqadfodoggcgbwbh.supabase.co/functions/v1/nav-auto-sync',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<YOUR_CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Weekly Summary: Mondays at 7:00 AM UTC (8:00 AM CET)
SELECT cron.schedule(
  'send-weekly-summary',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://pirgpqadfodoggcgbwbh.supabase.co/functions/v1/send-weekly-summary',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<YOUR_CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
