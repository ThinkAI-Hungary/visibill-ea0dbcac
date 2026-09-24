-- Migration: 20260924114500_sync_outbound_customer_name_from_submitted_invoices.sql
-- Description: Automatically populates nav_invoices.customer_name for outbound invoices
--              from the submitted invoices table (invoices.vevo_nev) whenever a private customer's
--              invoice is uploaded, overcoming the NAV Online Számla (OSA) GDPR / non-taxpayer redaction.

CREATE OR REPLACE FUNCTION public.sync_submitted_customer_name_to_nav()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_biz TEXT;
BEGIN
  -- Only process outbound invoices with a non-empty buyer name
  IF NEW.invoice_direction = 'OUTBOUND' AND NEW.vevo_nev IS NOT NULL AND TRIM(NEW.vevo_nev) <> '' THEN
    v_norm_biz := UPPER(REGEXP_REPLACE(COALESCE(NEW.bizonylatsorszam, ''), '[^A-Za-z0-9]', '', 'g'));
    
    IF v_norm_biz <> '' THEN
      UPDATE public.nav_invoices
      SET customer_name = TRIM(NEW.vevo_nev)
      WHERE company_id = NEW.company_id
        AND invoice_direction = 'OUTBOUND'
        AND (customer_name IS NULL OR TRIM(customer_name) = '' OR customer_name = 'Ismeretlen partner' OR customer_name = 'Ismeretlen vevő')
        AND UPPER(REGEXP_REPLACE(COALESCE(invoice_number, ''), '[^A-Za-z0-9]', '', 'g')) = v_norm_biz;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_customer_name_to_nav ON public.invoices;

CREATE TRIGGER trg_sync_customer_name_to_nav
AFTER INSERT OR UPDATE OF vevo_nev, bizonylatsorszam, invoice_direction
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.sync_submitted_customer_name_to_nav();
