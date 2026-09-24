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

-- Complementary trigger: when a NAV invoice is inserted/updated (e.g. from NAV sync),
-- check if a submitted invoice already exists with the customer name
CREATE OR REPLACE FUNCTION public.sync_nav_customer_name_from_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_biz TEXT;
  v_vevo_nev TEXT;
BEGIN
  IF NEW.invoice_direction = 'OUTBOUND' AND (NEW.customer_name IS NULL OR TRIM(NEW.customer_name) = '' OR NEW.customer_name = 'Ismeretlen partner' OR NEW.customer_name = 'Ismeretlen vevő') THEN
    v_norm_biz := UPPER(REGEXP_REPLACE(COALESCE(NEW.invoice_number, ''), '[^A-Za-z0-9]', '', 'g'));
    
    IF v_norm_biz <> '' THEN
      SELECT vevo_nev INTO v_vevo_nev
      FROM public.invoices
      WHERE company_id = NEW.company_id
        AND invoice_direction = 'OUTBOUND'
        AND vevo_nev IS NOT NULL AND TRIM(vevo_nev) <> ''
        AND UPPER(REGEXP_REPLACE(COALESCE(bizonylatsorszam, ''), '[^A-Za-z0-9]', '', 'g')) = v_norm_biz
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_vevo_nev IS NOT NULL AND TRIM(v_vevo_nev) <> '' THEN
        NEW.customer_name := TRIM(v_vevo_nev);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_nav_customer_name_from_submitted ON public.nav_invoices;

CREATE TRIGGER trg_sync_nav_customer_name_from_submitted
BEFORE INSERT OR UPDATE OF customer_name, invoice_number, invoice_direction
ON public.nav_invoices
FOR EACH ROW
EXECUTE FUNCTION public.sync_nav_customer_name_from_submitted();
