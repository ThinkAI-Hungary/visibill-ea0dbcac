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
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/nav-auto-sync',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<YOUR_CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Weekly Summary (eaisyBill): Mondays at 7:00 AM UTC (8:00 AM CET)
SELECT cron.schedule(
  'send-weekly-summary',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/send-weekly-summary',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<YOUR_CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ═══════════════════════════════════════════════════════════════════
-- eaisyBooks (Accounty) Cron Jobs
-- ═══════════════════════════════════════════════════════════════════

-- Remove old eaisyBooks cron jobs if they exist (idempotent)
DO $$ BEGIN
  PERFORM cron.unschedule('accounty-detect-missing-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('accounty-check-deadlines-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('accounty-weekly-report');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('accounty-monthly-report');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- eaisyBooks: Missing Invoice Detection + Client Status Change: daily at 3:00 AM UTC (5:00 AM CET)
SELECT cron.schedule(
  'accounty-detect-missing-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/accounty-detect-missing',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "na3f64tp7ed2hwg8sluovbyzmrcix05k19jq"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- eaisyBooks: Deadline Reminder Check: daily at 5:00 AM UTC (7:00 AM CET)
SELECT cron.schedule(
  'accounty-check-deadlines-daily',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/accounty-check-deadlines',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "na3f64tp7ed2hwg8sluovbyzmrcix05k19jq"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- eaisyBooks: Weekly Portfolio Report: Mondays at 6:00 AM UTC (8:00 AM CET)
SELECT cron.schedule(
  'accounty-weekly-report',
  '0 6 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/send-accounty-weekly-report',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "na3f64tp7ed2hwg8sluovbyzmrcix05k19jq"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- eaisyBooks: Monthly Portfolio Report: 1st of each month at 6:00 AM UTC (8:00 AM CET)
SELECT cron.schedule(
  'accounty-monthly-report',
  '0 6 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/send-accounty-monthly-report',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "na3f64tp7ed2hwg8sluovbyzmrcix05k19jq"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
