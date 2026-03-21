
-- 1. Trigger: when an invoice row is inserted with an invoice_uploads_id,
-- automatically set the parent invoice_uploads.processing_status to 'completed'
CREATE OR REPLACE FUNCTION public.mark_invoice_upload_completed_on_invoice_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.invoice_uploads_id IS NOT NULL THEN
    UPDATE invoice_uploads
    SET processing_status = 'completed', updated_at = now()
    WHERE id = NEW.invoice_uploads_id
      AND processing_status IN ('pending', 'processing', 'webhook_sent');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mark_invoice_upload_completed
AFTER INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.mark_invoice_upload_completed_on_invoice_insert();

-- 2. Trigger: when a transaction row is inserted with an upload_id,
-- automatically set the parent transaction_uploads.processing_status to 'completed'
CREATE OR REPLACE FUNCTION public.mark_transaction_upload_completed_on_transaction_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.upload_id IS NOT NULL THEN
    UPDATE transaction_uploads
    SET processing_status = 'completed', updated_at = now()
    WHERE id = NEW.upload_id
      AND processing_status IN ('pending', 'processing', 'webhook_sent');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mark_transaction_upload_completed
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.mark_transaction_upload_completed_on_transaction_insert();

-- 3. Retroactively fix old salary_files stuck in webhook_sent that have salary rows
UPDATE salary_files sf
SET status = 'completed', updated_at = now()
WHERE sf.status = 'webhook_sent'
  AND EXISTS (SELECT 1 FROM salary s WHERE s.salary_file_id = sf.id);

-- 4. Retroactively fix old invoice_uploads stuck in webhook_sent that have invoices
UPDATE invoice_uploads iu
SET processing_status = 'completed', updated_at = now()
WHERE iu.processing_status = 'webhook_sent'
  AND EXISTS (SELECT 1 FROM invoices i WHERE i.invoice_uploads_id = iu.id);

-- 5. Retroactively fix old transaction_uploads stuck in webhook_sent that have transactions
UPDATE transaction_uploads tu
SET processing_status = 'completed', updated_at = now()
WHERE tu.processing_status = 'webhook_sent'
  AND EXISTS (SELECT 1 FROM transactions t WHERE t.upload_id = tu.id);
