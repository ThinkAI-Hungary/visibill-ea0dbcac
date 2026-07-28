-- Fix: PGMQ trigger payload-okhoz file_size hozzáadása
-- Root cause: trigger_enqueue_invoice_job és trigger_enqueue_transaction_job nem tartalmazta
-- a file_size mezőt, ezért cross-pipeline fallback soroknál NULL/0 maradt a méret
-- a management dashboard Fájlok nézetben.
-- Kapcsolódó: A-019 management dashboard, A-004 PGMQ queue

-- 1. invoice_jobs trigger: file_size + file_type hozzáadása payload-hoz
CREATE OR REPLACE FUNCTION public.trigger_enqueue_invoice_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
        'file_size', NEW.file_size,
        'file_type', NEW.file_type,
        'document_category', NEW.document_category,
        'source', 'invoice_uploads',
        'metadata', NEW.metadata,
        'fallback_from_transaction_upload_id', NEW.fallback_from_transaction_upload_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 2. transaction_jobs trigger: file_size + file_type hozzáadása payload-hoz
CREATE OR REPLACE FUNCTION public.trigger_enqueue_transaction_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
        'file_size', NEW.file_size,
        'file_type', NEW.file_type,
        'source', 'transaction_uploads',
        'metadata', NEW.metadata,
        'fallback_from_invoice_upload_id', NEW.fallback_from_invoice_upload_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 3. report_jobs trigger: teljes payload kibővítése (korábban csak id-t küldött!)
CREATE OR REPLACE FUNCTION public.enqueue_report_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.processing_status = 'pending' THEN
    PERFORM pgmq.send(
      'report_jobs',
      jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'company_id', NEW.company_id,
        'file_url', NEW.file_url,
        'file_name', NEW.file_name,
        'file_size', NEW.file_size,
        'file_type', NEW.file_type,
        'source', 'report_uploads',
        'metadata', NEW.metadata
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
