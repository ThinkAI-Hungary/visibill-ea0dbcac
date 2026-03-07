
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

  -- Try to find a matching submitted invoice first
  SELECT bizonylatsorszam, company_id INTO v_bizonylatsorszam, v_company_id
  FROM invoices WHERE id = NEW.matched_invoice_id;

  IF v_bizonylatsorszam IS NOT NULL AND v_company_id IS NOT NULL THEN
    -- Match via submitted invoice -> NAV invoice by invoice_number
    UPDATE nav_invoices
    SET paid = true, submitted = true
    WHERE invoice_number = v_bizonylatsorszam
      AND company_id = v_company_id
      AND (paid IS NULL OR paid = false OR submitted IS NULL OR submitted = false);
  ELSE
    -- Direct match: matched_invoice_id points to nav_invoices.id
    UPDATE nav_invoices
    SET paid = true
    WHERE id = NEW.matched_invoice_id
      AND (paid IS NULL OR paid = false);
  END IF;

  RETURN NEW;
END;
$function$;
