-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  Accounty Cron Schedules                                    ║
-- ║  pg_cron jobs for automated Edge Function invocation         ║
-- ║                                                              ║
-- ║  Functions:                                                  ║
-- ║  1. accounty-generate-deadlines  — Napi 02:00 UTC           ║
-- ║  2. accounty-detect-missing      — Napi 03:00 UTC           ║
-- ║  3. accounty-detect-bank         — Napi 04:00 UTC           ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Enable pg_cron and pg_net extensions (required for HTTP calls)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 1. Deadline generator — runs daily at 02:00 UTC ──
SELECT cron.schedule(
  'accounty-generate-deadlines',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/accounty-generate-deadlines',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.placeholder_service_role_key'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── 2. NAV missing invoice detector — runs daily at 03:00 UTC ──
SELECT cron.schedule(
  'accounty-detect-missing',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/accounty-detect-missing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.placeholder_service_role_key'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── 3. Bank transaction detector — runs daily at 04:00 UTC ──
SELECT cron.schedule(
  'accounty-detect-bank',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/accounty-detect-bank',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.placeholder_service_role_key'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ═══════════════════════════════════════════════════════════════
-- FONTOS: A fenti service_role key placeholder!
-- Futtatás előtt cseréld ki a valódi service_role key-re:
--   Supabase Dashboard > Settings > API > service_role (secret)
-- ═══════════════════════════════════════════════════════════════

-- Ellenőrzés: aktív cron jobok listázása
-- SELECT * FROM cron.job;
