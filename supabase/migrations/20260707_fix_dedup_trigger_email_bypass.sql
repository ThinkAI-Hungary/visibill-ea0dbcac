-- Migration: Bypass dedup trigger for fallback records
--
-- Problem: When the bidirectional fallback pipeline creates a new record in
--   invoice_uploads or transaction_uploads, the BEFORE INSERT dedup trigger
--   may block it because the same file_name + company_id already exists
--   (from the original upload in the other table, or from this table if the
--   file was first uploaded here). Fallback records are NOT duplicates — they
--   represent a second processing attempt through a different pipeline.
--
-- Solution: Modify both trigger functions to skip the duplicate check when
--   the `fallback_from_*` column is set (non-null). This column is ONLY set
--   by the worker's fallback_to_invoice / fallback_to_transaction helpers.

-- ── Invoice uploads trigger ────────────────────────────────────────────
-- Recreate the trigger function with fallback bypass.
-- Preserves the original dedup logic and PGMQ enqueue behavior.
CREATE OR REPLACE FUNCTION public.trigger_enqueue_invoice_job()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Skip dedup check for fallback records (bidirectional pipeline)
  IF NEW.fallback_from_transaction_upload_id IS NOT NULL THEN
    -- Fallback record: always enqueue, never treat as duplicate
    PERFORM pgmq.send('invoice_jobs', jsonb_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'company_id', NEW.company_id,
      'file_url', NEW.file_url,
      'file_name', NEW.file_name,
      'file_type', NEW.file_type,
      'file_size', NEW.file_size,
      'metadata', NEW.metadata,
      'document_category', COALESCE(NEW.document_category, 'invoice'),
      'fallback_from_transaction_upload_id', NEW.fallback_from_transaction_upload_id
    ));
    RETURN NEW;
  END IF;

  -- Original dedup logic: check for existing record with same file
  IF EXISTS (
    SELECT 1 FROM public.invoice_uploads
    WHERE file_name = NEW.file_name
      AND company_id = NEW.company_id
      AND processing_status IN ('pending', 'processing', 'processed')
      AND id != NEW.id
      AND created_at > NOW() - INTERVAL '24 hours'
  ) THEN
    -- Mark as ignored (dedup) — the BEFORE INSERT trigger modifies NEW
    NEW.processing_status := 'ignored';
    NEW.error_message := 'Duplicate upload detected (same file within 24h)';
    RETURN NEW;
  END IF;

  -- Not a duplicate: enqueue to PGMQ for processing
  PERFORM pgmq.send('invoice_jobs', jsonb_build_object(
    'id', NEW.id,
    'user_id', NEW.user_id,
    'company_id', NEW.company_id,
    'file_url', NEW.file_url,
    'file_name', NEW.file_name,
    'file_type', NEW.file_type,
    'file_size', NEW.file_size,
    'metadata', NEW.metadata,
    'document_category', COALESCE(NEW.document_category, 'invoice'),
    'fallback_from_transaction_upload_id', NEW.fallback_from_transaction_upload_id
  ));

  RETURN NEW;
END;
$$;


-- ── Transaction uploads trigger ────────────────────────────────────────
-- Recreate with fallback bypass.
CREATE OR REPLACE FUNCTION public.trigger_enqueue_transaction_job()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Skip dedup check for fallback records (bidirectional pipeline)
  IF NEW.fallback_from_invoice_upload_id IS NOT NULL THEN
    -- Fallback record: always enqueue, never treat as duplicate
    PERFORM pgmq.send('transaction_jobs', jsonb_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'company_id', NEW.company_id,
      'file_url', NEW.file_url,
      'file_name', NEW.file_name,
      'file_type', NEW.file_type,
      'file_size', NEW.file_size,
      'metadata', NEW.metadata,
      'fallback_from_invoice_upload_id', NEW.fallback_from_invoice_upload_id
    ));
    RETURN NEW;
  END IF;

  -- Original dedup logic: check for existing record with same file
  IF EXISTS (
    SELECT 1 FROM public.transaction_uploads
    WHERE file_name = NEW.file_name
      AND company_id = NEW.company_id
      AND processing_status IN ('pending', 'processing', 'completed')
      AND id != NEW.id
      AND created_at > NOW() - INTERVAL '24 hours'
  ) THEN
    NEW.processing_status := 'ignored';
    NEW.error_message := 'Duplicate upload detected (same file within 24h)';
    RETURN NEW;
  END IF;

  -- Not a duplicate: enqueue to PGMQ for processing
  PERFORM pgmq.send('transaction_jobs', jsonb_build_object(
    'id', NEW.id,
    'user_id', NEW.user_id,
    'company_id', NEW.company_id,
    'file_url', NEW.file_url,
    'file_name', NEW.file_name,
    'file_type', NEW.file_type,
    'file_size', NEW.file_size,
    'metadata', NEW.metadata,
    'fallback_from_invoice_upload_id', NEW.fallback_from_invoice_upload_id
  ));

  RETURN NEW;
END;
$$;
