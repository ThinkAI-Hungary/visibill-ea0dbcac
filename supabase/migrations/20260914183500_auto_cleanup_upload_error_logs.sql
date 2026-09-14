-- Migration: 20260914183500_auto_cleanup_upload_error_logs.sql
-- Description: Automatically clean up app_error_logs entries when an upload is successfully processed or dismissed

-- 1. Create partial index for fast lookup/deletion on app_error_logs by upload_id
CREATE INDEX IF NOT EXISTS idx_app_error_logs_context_upload_id 
ON public.app_error_logs ((context->>'upload_id')) 
WHERE context->>'upload_id' IS NOT NULL;

-- 2. Trigger Function to remove app_error_logs referencing upload_id or job_id
CREATE OR REPLACE FUNCTION public.trg_fn_cleanup_upload_error_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trigger on success ('completed', 'processed') or manual dismissal ('dismissed')
  IF NEW.processing_status IN ('completed', 'processed', 'dismissed') 
     AND (TG_OP = 'INSERT' OR OLD.processing_status IS DISTINCT FROM NEW.processing_status) THEN
     
    DELETE FROM public.app_error_logs
    WHERE (context->>'upload_id' = NEW.id::text OR context->>'job_id' = NEW.id::text);
    
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach triggers to upload tables
DROP TRIGGER IF EXISTS trg_cleanup_error_logs_transaction ON public.transaction_uploads;
CREATE TRIGGER trg_cleanup_error_logs_transaction
AFTER INSERT OR UPDATE OF processing_status ON public.transaction_uploads
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_cleanup_upload_error_logs();

DROP TRIGGER IF EXISTS trg_cleanup_error_logs_invoice ON public.invoice_uploads;
CREATE TRIGGER trg_cleanup_error_logs_invoice
AFTER INSERT OR UPDATE OF processing_status ON public.invoice_uploads
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_cleanup_upload_error_logs();

DROP TRIGGER IF EXISTS trg_cleanup_error_logs_report ON public.report_uploads;
CREATE TRIGGER trg_cleanup_error_logs_report
AFTER INSERT OR UPDATE OF processing_status ON public.report_uploads
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_cleanup_upload_error_logs();

DROP TRIGGER IF EXISTS trg_cleanup_error_logs_bank ON public.bank_statement_uploads;
CREATE TRIGGER trg_cleanup_error_logs_bank
AFTER INSERT OR UPDATE OF processing_status ON public.bank_statement_uploads
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_cleanup_upload_error_logs();

-- 4. One-time cleanup for any historical errors whose upload is ALREADY completed/processed/dismissed
DELETE FROM public.app_error_logs
WHERE (context->>'upload_id') IN (
  SELECT id::text FROM public.transaction_uploads WHERE processing_status IN ('completed', 'dismissed')
  UNION ALL
  SELECT id::text FROM public.invoice_uploads WHERE processing_status IN ('processed', 'dismissed')
  UNION ALL
  SELECT id::text FROM public.report_uploads WHERE processing_status IN ('completed', 'dismissed')
  UNION ALL
  SELECT id::text FROM public.bank_statement_uploads WHERE processing_status IN ('completed', 'dismissed')
);
