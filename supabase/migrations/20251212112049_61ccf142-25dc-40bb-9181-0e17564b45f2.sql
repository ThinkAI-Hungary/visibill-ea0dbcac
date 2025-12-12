-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule weekly summary email for Monday at 8:00 AM CET (7:00 UTC)
SELECT cron.schedule(
  'send-weekly-summary-monday',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url:='https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/send-weekly-summary',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);