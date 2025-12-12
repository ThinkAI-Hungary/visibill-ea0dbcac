-- Create trigger function to mark nav_invoices as submitted when matching invoice is inserted
CREATE OR REPLACE FUNCTION public.mark_nav_invoice_as_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update nav_invoices where invoice_number matches szamlaszam
  -- and company_id matches (or both are null)
  UPDATE public.nav_invoices
  SET submitted = true
  WHERE invoice_number = NEW.szamlaszam
    AND (
      (company_id = NEW.company_id) 
      OR (company_id IS NULL AND NEW.company_id IS NULL)
    )
    AND submitted = false;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on invoices table
CREATE TRIGGER trigger_mark_nav_invoice_submitted
  AFTER INSERT OR UPDATE OF szamlaszam, company_id
  ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION mark_nav_invoice_as_submitted();

-- Sync existing data (for any current matches)
UPDATE public.nav_invoices n
SET submitted = true
FROM public.invoices i
WHERE n.invoice_number = i.szamlaszam
  AND (
    (n.company_id = i.company_id) 
    OR (n.company_id IS NULL AND i.company_id IS NULL)
  )
  AND n.submitted = false;