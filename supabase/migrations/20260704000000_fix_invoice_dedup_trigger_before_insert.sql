-- Fix: Change invoice dedup trigger from AFTER INSERT to BEFORE INSERT
--
-- Problem: The trigger_enqueue_invoice_job() function modifies NEW.processing_status
-- to 'ignored' when a duplicate is detected. However, as an AFTER INSERT trigger,
-- modifying NEW has no effect on the already-inserted row. This caused duplicate
-- uploads to remain stuck in 'pending' status forever without a PGMQ message.
--
-- Solution: Switch to BEFORE INSERT so that NEW modifications (setting status to
-- 'ignored') take effect on the row being inserted. The pgmq.send() call also
-- works correctly in BEFORE INSERT since it participates in the same transaction.

DROP TRIGGER IF EXISTS trg_enqueue_invoice ON public.invoice_uploads;

CREATE TRIGGER trg_enqueue_invoice
  BEFORE INSERT ON public.invoice_uploads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_enqueue_invoice_job();
