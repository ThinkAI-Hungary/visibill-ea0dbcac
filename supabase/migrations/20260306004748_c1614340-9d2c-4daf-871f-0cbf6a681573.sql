-- 1. Rename column on invoices
ALTER TABLE public.invoices RENAME COLUMN szamlaszam TO bizonylatsorszam;

-- 2. Rename column on sima_szamla_backup
ALTER TABLE public.sima_szamla_backup RENAME COLUMN szamlaszam TO bizonylatsorszam;

-- 3. Recreate mark_nav_invoice_as_submitted with new column name
CREATE OR REPLACE FUNCTION public.mark_nav_invoice_as_submitted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.nav_invoices
  SET submitted = true
  WHERE invoice_number = NEW.bizonylatsorszam
    AND (
      (company_id = NEW.company_id) 
      OR (company_id IS NULL AND NEW.company_id IS NULL)
    )
    AND submitted = false;
  
  RETURN NEW;
END;
$function$;

-- 4. Recreate mark_nav_invoice_paid_on_transaction_match with new column name
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

  SELECT bizonylatsorszam, company_id INTO v_bizonylatsorszam, v_company_id
  FROM invoices WHERE id = NEW.matched_invoice_id;

  IF v_bizonylatsorszam IS NOT NULL AND v_company_id IS NOT NULL THEN
    UPDATE nav_invoices
    SET paid = true, submitted = true
    WHERE invoice_number = v_bizonylatsorszam
      AND company_id = v_company_id
      AND (paid IS NULL OR paid = false OR submitted IS NULL OR submitted = false);
  END IF;

  RETURN NEW;
END;
$function$;