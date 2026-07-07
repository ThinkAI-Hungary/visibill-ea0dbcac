-- Fix: Dedup trigger bypass for uploads with explicit source
--
-- Problem: The 1-minute dedup window incorrectly blocks legitimate uploads
-- in two cases:
--   1. Email webhook retries (Mailgun): attachments from retried webhook calls
--      should be processed (dedup handled by webhook Message-Id idempotency).
--   2. Manual re-uploads: the user explicitly confirmed re-upload via the
--      duplicate warning dialog — their intent is clear.
--
-- Solution: Only apply dedup when metadata.source IS NULL (default frontend
-- upload with no explicit source). Any upload with an explicit source
-- (email_alias, manual_reupload, etc.) bypasses the dedup window.
--
-- Changes:
-- 1. Skip dedup check when metadata.source is ANY non-null value
-- 2. Include NEW.metadata in PGMQ payload so worker preserves it
--
-- Frontend uploads without confirmation (metadata.source IS NULL) retain
-- full dedup protection.

CREATE OR REPLACE FUNCTION public.trigger_enqueue_invoice_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.processing_status = 'pending' THEN

    -- Dedup guard: only for uploads WITHOUT an explicit source.
    -- Email uploads (source='email_alias') have Mailgun Message-Id idempotency.
    -- Manual re-uploads (source='manual_reupload') were confirmed by the user.
    -- Default frontend uploads (source IS NULL) need the 1-minute dedup window.
    IF (NEW.metadata->>'source') IS NULL THEN
      IF EXISTS (
        SELECT 1 FROM invoice_uploads
        WHERE file_name = NEW.file_name
          AND company_id = NEW.company_id
          AND id != NEW.id
          AND created_at > NOW() - INTERVAL '1 minute'
          AND processing_status IN ('pending', 'processing')
        LIMIT 1
      ) THEN
        NEW.processing_status := 'ignored';
        NEW.error_message := 'Duplicate skipped by trigger dedup (1 min window)';
        RETURN NEW;
      END IF;
    END IF;

    PERFORM pgmq.send(
      'invoice_jobs',
      jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'company_id', NEW.company_id,
        'file_url', NEW.file_url,
        'file_name', NEW.file_name,
        'document_category', NEW.document_category,
        'source', 'invoice_uploads',
        'metadata', NEW.metadata
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;
