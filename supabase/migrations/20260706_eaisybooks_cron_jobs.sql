-- ═══════════════════════════════════════════════════════════════════
-- eaisyBooks Cron Jobs
-- ═══════════════════════════════════════════════════════════════════
-- HASZNÁLAT: Másold be a teljes tartalmat a Supabase SQL Editorba.
-- FONTOS: A <CRON_SECRET_ACCOUNTY> helyére írd be a secretet (a <> jeleket is töröld)!
-- A secretet a Supabase Dashboard → Settings → Edge Functions → Secrets-ben találod.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Töröljük a régi eaisyBooks cron job-okat ha léteznek
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
DO $$ BEGIN
  PERFORM cron.unschedule('accounty-digest-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Hiányzó számla detektálás + ügyfél státusz változás — NAPONTA 5:00 CET
SELECT cron.schedule(
  'accounty-detect-missing-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/accounty-detect-missing',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET_ACCOUNTY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 3. Határidő emlékeztető — NAPONTA 7:00 CET
SELECT cron.schedule(
  'accounty-check-deadlines-daily',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/accounty-check-deadlines',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET_ACCOUNTY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 4. Heti portfólió riport — HÉTFŐ 8:00 CET
SELECT cron.schedule(
  'accounty-weekly-report',
  '0 6 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/send-accounty-weekly-report',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET_ACCOUNTY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 5. Havi portfólió riport — HÓNAP 1. 8:00 CET
SELECT cron.schedule(
  'accounty-monthly-report',
  '0 6 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/send-accounty-monthly-report',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET_ACCOUNTY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 6. Új Digest funkció (óránként fut, de csak annak küld, akinek akkor kell)
SELECT cron.schedule(
  'accounty-digest-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/send-accounty-digest',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET_ACCOUNTY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
