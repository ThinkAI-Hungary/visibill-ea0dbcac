-- Create function to match payment transfers when invoice transaction_id is set
CREATE OR REPLACE FUNCTION public.match_payment_transfers_on_invoice_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- If transaction_id goes from NULL to a value
  IF NEW.transaction_id IS NOT NULL AND (OLD.transaction_id IS NULL OR OLD.transaction_id IS DISTINCT FROM NEW.transaction_id) THEN
    UPDATE public.payment_transfers
    SET status = 'matched',
        matched_transaction_id = NEW.transaction_id
    WHERE company_id = NEW.company_id
      AND NEW.id = ANY(invoice_ids)
      AND status = 'pending';
  -- If transaction_id is cleared (unmatched)
  ELSIF NEW.transaction_id IS NULL AND OLD.transaction_id IS NOT NULL THEN
    UPDATE public.payment_transfers
    SET status = 'pending',
        matched_transaction_id = NULL
    WHERE company_id = NEW.company_id
      AND NEW.id = ANY(invoice_ids)
      AND status = 'matched'
      AND matched_transaction_id = OLD.transaction_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger on invoices table
DROP TRIGGER IF EXISTS trg_match_payment_transfers_on_invoice_match ON public.invoices;
CREATE TRIGGER trg_match_payment_transfers_on_invoice_match
  AFTER UPDATE OF transaction_id ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.match_payment_transfers_on_invoice_match();

-- Create trigger on nav_invoices table
DROP TRIGGER IF EXISTS trg_match_payment_transfers_on_nav_invoice_match ON public.nav_invoices;
CREATE TRIGGER trg_match_payment_transfers_on_nav_invoice_match
  AFTER UPDATE OF transaction_id ON public.nav_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.match_payment_transfers_on_invoice_match();
