-- =============================================
-- Trigger: mark invoices as paid when multi-matched via transaction_invoice_matches
-- =============================================
-- When additional invoice matches are inserted into the join table,
-- mark the corresponding invoices/nav_invoices as paid.

CREATE OR REPLACE FUNCTION public.mark_invoice_paid_on_multi_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bizonylatsorszam TEXT;
  v_company_id UUID;
  v_transaction_id UUID;
BEGIN
  v_transaction_id := NEW.transaction_id;

  -- Try invoices table first (submitted invoices)
  SELECT bizonylatsorszam, company_id INTO v_bizonylatsorszam, v_company_id
  FROM invoices WHERE id = NEW.invoice_id;

  IF v_bizonylatsorszam IS NOT NULL AND v_company_id IS NOT NULL THEN
    -- Set transaction_id on the matched invoice
    UPDATE invoices SET transaction_id = v_transaction_id
    WHERE id = NEW.invoice_id AND transaction_id IS DISTINCT FROM v_transaction_id;

    -- Also mark the corresponding NAV invoice
    UPDATE nav_invoices
    SET paid = true, submitted = true, transaction_id = v_transaction_id
    WHERE invoice_number = v_bizonylatsorszam
      AND company_id = v_company_id
      AND (paid IS NULL OR paid = false OR submitted IS NULL OR submitted = false);

    RETURN NEW;
  END IF;

  -- Try nav_invoices table
  IF EXISTS (SELECT 1 FROM nav_invoices WHERE id = NEW.invoice_id) THEN
    UPDATE nav_invoices
    SET paid = true, transaction_id = v_transaction_id
    WHERE id = NEW.invoice_id
      AND (paid IS NULL OR paid = false);

    RETURN NEW;
  END IF;

  -- Try salary table
  UPDATE salary SET transaction_id = v_transaction_id
  WHERE id = NEW.invoice_id AND transaction_id IS DISTINCT FROM v_transaction_id;

  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_mark_invoice_paid_on_multi_match ON public.transaction_invoice_matches;
CREATE TRIGGER trg_mark_invoice_paid_on_multi_match
  AFTER INSERT ON public.transaction_invoice_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_invoice_paid_on_multi_match();
