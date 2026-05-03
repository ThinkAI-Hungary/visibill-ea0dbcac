SELECT cron.schedule(
  'nav-auto-sync-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pirgpqadfodoggcgbwbh.supabase.co/functions/v1/nav-auto-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcmdwcWFkZm9kb2dnY2did2JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzY1MDcsImV4cCI6MjA5MzAxMjUwN30.PNky9E9RTSLQY-kAEkVvIgRnA9qoT1RUj74Mc9Gk9no"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

SELECT cron.schedule(
  'send-weekly-summary',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url:='https://pirgpqadfodoggcgbwbh.supabase.co/functions/v1/send-weekly-summary',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcmdwcWFkZm9kb2dnY2did2JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzY1MDcsImV4cCI6MjA5MzAxMjUwN30.PNky9E9RTSLQY-kAEkVvIgRnA9qoT1RUj74Mc9Gk9no"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);
