
-- Expand mark_nav_invoice_paid_on_transaction_match to also set transaction_id on invoices and salary tables
CREATE OR REPLACE FUNCTION public.mark_nav_invoice_paid_on_transaction_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bizonylatsorszam TEXT;
  v_company_id UUID;
BEGIN
  IF NEW.matched_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.matched_invoice_id IS NOT DISTINCT FROM NEW.matched_invoice_id THEN
    RETURN NEW;
  END IF;

  -- Try invoices table first
  SELECT bizonylatsorszam, company_id INTO v_bizonylatsorszam, v_company_id
  FROM invoices WHERE id = NEW.matched_invoice_id;

  IF v_bizonylatsorszam IS NOT NULL AND v_company_id IS NOT NULL THEN
    -- Set transaction_id on the matched invoice
    UPDATE invoices SET transaction_id = NEW.id
    WHERE id = NEW.matched_invoice_id AND transaction_id IS DISTINCT FROM NEW.id;

    -- Also mark the corresponding NAV invoice
    UPDATE nav_invoices
    SET paid = true, submitted = true, transaction_id = NEW.id
    WHERE invoice_number = v_bizonylatsorszam
      AND company_id = v_company_id
      AND (paid IS NULL OR paid = false OR submitted IS NULL OR submitted = false);

    RETURN NEW;
  END IF;

  -- Try nav_invoices table
  IF EXISTS (SELECT 1 FROM nav_invoices WHERE id = NEW.matched_invoice_id) THEN
    UPDATE nav_invoices
    SET paid = true, transaction_id = NEW.id
    WHERE id = NEW.matched_invoice_id
      AND (paid IS NULL OR paid = false);

    RETURN NEW;
  END IF;

  -- Try salary table
  UPDATE salary SET transaction_id = NEW.id
  WHERE id = NEW.matched_invoice_id AND transaction_id IS DISTINCT FROM NEW.id;

  RETURN NEW;
END;
$function$;
