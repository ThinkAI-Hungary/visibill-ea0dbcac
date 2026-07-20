-- ==================================================
-- MERGED FROM: 20260707_fix_dedup_trigger_email_bypass.sql
-- ==================================================
-- Fix: Dedup trigger bypass for fallback records + uploads with explicit source
--
-- Problem 1 (existing): The 1-minute dedup window incorrectly blocks legitimate
-- uploads in two cases:
--   1. Email webhook retries (Mailgun): handled by webhook Message-Id idempotency.
--   2. Manual re-uploads: the user explicitly confirmed re-upload.
--
-- Problem 2 (new): When the bidirectional fallback pipeline creates a new record
-- in invoice_uploads or transaction_uploads, the dedup trigger may block it because
-- the same file_name + company_id already exists. Fallback records are NOT duplicates
-- — they represent a second processing attempt through a different pipeline.
--
-- Solution:
-- 1. Skip dedup when metadata.source is ANY non-null value (email_alias, manual_reupload)
-- 2. Skip dedup when fallback_from_* is NOT NULL (bidirectional fallback pipeline)
-- 3. Include fallback_from_* in PGMQ payload so worker can detect fallback origin

CREATE OR REPLACE FUNCTION public.trigger_enqueue_invoice_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.processing_status = 'pending' THEN

    -- Bypass dedup for fallback records (bidirectional pipeline)
    -- and for uploads with an explicit source (email, manual re-upload).
    -- Default frontend uploads (source IS NULL, no fallback) need the dedup window.
    IF (NEW.metadata->>'source') IS NULL
       AND NEW.fallback_from_transaction_upload_id IS NULL
    THEN
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
        'metadata', NEW.metadata,
        'fallback_from_transaction_upload_id', NEW.fallback_from_transaction_upload_id
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;


-- ── Transaction uploads trigger ────────────────────────────────────────
-- Same pattern: bypass dedup for fallback records and explicit-source uploads.
CREATE OR REPLACE FUNCTION public.trigger_enqueue_transaction_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.processing_status = 'pending' THEN

    -- Bypass dedup for fallback records (bidirectional pipeline)
    -- and for uploads with an explicit source (email, manual re-upload).
    IF (NEW.metadata->>'source') IS NULL
       AND NEW.fallback_from_invoice_upload_id IS NULL
    THEN
      IF EXISTS (
        SELECT 1 FROM transaction_uploads
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
      'transaction_jobs',
      jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'company_id', NEW.company_id,
        'file_url', NEW.file_url,
        'file_name', NEW.file_name,
        'source', 'transaction_uploads',
        'metadata', NEW.metadata,
        'fallback_from_invoice_upload_id', NEW.fallback_from_invoice_upload_id
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;


-- ==================================================
-- MERGED FROM: 20260707_routing_notes_columns.sql
-- ==================================================
-- Migration: Add notes JSONB, email_sender_domain, and fallback_from_* columns
-- to both invoice_uploads and transaction_uploads tables.
--
-- Purpose:
--   - notes: Processing log entries tracking the full classification + processing journey
--   - email_sender_domain: Original sender domain for analytics/debugging
--   - fallback_from_*: Link to the source record when created via fallback pipeline

-- ── transaction_uploads ──────────────────────────────────────────

ALTER TABLE public.transaction_uploads
  ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT NULL;
COMMENT ON COLUMN public.transaction_uploads.notes IS
  'Processing log entries tracking the file classification and processing journey';

ALTER TABLE public.transaction_uploads
  ADD COLUMN IF NOT EXISTS email_sender_domain text DEFAULT NULL;

ALTER TABLE public.transaction_uploads
  ADD COLUMN IF NOT EXISTS fallback_from_invoice_upload_id uuid DEFAULT NULL;

-- ── invoice_uploads ──────────────────────────────────────────────

ALTER TABLE public.invoice_uploads
  ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT NULL;
COMMENT ON COLUMN public.invoice_uploads.notes IS
  'Processing log entries tracking the file classification and processing journey';

ALTER TABLE public.invoice_uploads
  ADD COLUMN IF NOT EXISTS email_sender_domain text DEFAULT NULL;

ALTER TABLE public.invoice_uploads
  ADD COLUMN IF NOT EXISTS fallback_from_transaction_upload_id uuid DEFAULT NULL;
