-- Migration: Fix cleanup_pdf_exports pg_net URL null error & unschedule invalid direct storage delete cron job
-- Date: 2026-08-29

-- 1. Unschedule failing direct storage delete job (jobid 16) which is blocked by Supabase storage triggers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = 16) THEN
    PERFORM cron.unschedule(16);
  END IF;
END $$;

-- 2. Update cleanup_pdf_exports with safe null guards and hardcoded project URL fallback
CREATE OR REPLACE FUNCTION public.cleanup_pdf_exports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url text;
  v_service_key text;
  v_file record;
BEGIN
  -- Get config
  v_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);

  -- Fallback to vault secrets
  IF v_url IS NULL THEN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  END IF;
  IF v_service_key IS NULL THEN
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  END IF;

  -- Fallback to project standard URL if still null
  IF v_url IS NULL THEN
    v_url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
  END IF;

  -- Only invoke http_delete if we have both a valid URL and service key
  IF v_url IS NOT NULL AND v_service_key IS NOT NULL THEN
    FOR v_file IN
      SELECT name
      FROM storage.objects
      WHERE bucket_id = 'pdf-exports'
      AND created_at < now() - interval '24 hours'
    LOOP
      PERFORM net.http_delete(
        url := v_url || '/storage/v1/object/pdf-exports/' || v_file.name,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || v_service_key,
          'apikey', v_service_key
        )
      );
    END LOOP;
  END IF;

  -- Clean up old job records (7+ days)
  DELETE FROM pdf_export_jobs
  WHERE status IN ('downloaded', 'expired', 'error')
  AND created_at < now() - interval '7 days';
END;
$$;
