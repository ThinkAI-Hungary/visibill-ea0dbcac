-- Migration: 20260916000003_auto_apply_skonto_trigger.sql
-- Purpose: Automatically apply partner skonto settings to newly inserted or updated inbound invoices

CREATE OR REPLACE FUNCTION public.apply_partner_skonto_to_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner RECORD;
  v_issue_date DATE;
  v_gross NUMERIC;
BEGIN
  -- Only process INBOUND invoices
  IF NEW.invoice_direction = 'INBOUND' THEN
    -- 1. For invoices table
    IF TG_TABLE_NAME = 'invoices' THEN
      SELECT has_skonto, skonto_days, skonto_percent, skonto_excludes_shipping
      INTO v_partner
      FROM partners
      WHERE company_id = NEW.company_id
        AND has_skonto = true
        AND (
          (NEW.elado_vat_id IS NOT NULL AND tax_number = NEW.elado_vat_id)
          OR (NEW.elado_nev IS NOT NULL AND LOWER(TRIM(name)) = LOWER(TRIM(NEW.elado_nev)))
        )
      LIMIT 1;

      IF FOUND AND v_partner.has_skonto THEN
        NEW.has_skonto := true;
        NEW.skonto_days := COALESCE(v_partner.skonto_days, 8);
        NEW.skonto_percent := COALESCE(v_partner.skonto_percent, 2.0);
        v_issue_date := COALESCE(NEW.kibocsatas_datuma, NEW.teljesites_datuma, NEW.fizetesi_hatarido, CURRENT_DATE);
        NEW.skonto_due_date := v_issue_date + (NEW.skonto_days || ' days')::interval;
        v_gross := COALESCE(NEW.brutto_vegosszeg, 0);
        NEW.skonto_amount := ROUND(v_gross * (1.0 - (NEW.skonto_percent / 100.0)));
        NEW.skonto_selected := true;
      END IF;

    -- 2. For nav_invoices table
    ELSIF TG_TABLE_NAME = 'nav_invoices' THEN
      SELECT has_skonto, skonto_days, skonto_percent, skonto_excludes_shipping
      INTO v_partner
      FROM partners
      WHERE company_id = NEW.company_id
        AND has_skonto = true
        AND (
          (NEW.supplier_tax_number IS NOT NULL AND tax_number = NEW.supplier_tax_number)
          OR (NEW.supplier_name IS NOT NULL AND LOWER(TRIM(name)) = LOWER(TRIM(NEW.supplier_name)))
        )
      LIMIT 1;

      IF FOUND AND v_partner.has_skonto THEN
        NEW.has_skonto := true;
        NEW.skonto_days := COALESCE(v_partner.skonto_days, 8);
        NEW.skonto_percent := COALESCE(v_partner.skonto_percent, 2.0);
        v_issue_date := COALESCE(NEW.invoice_issue_date, NEW.invoice_delivery_date, NEW.payment_date, CURRENT_DATE);
        NEW.skonto_due_date := v_issue_date + (NEW.skonto_days || ' days')::interval;
        v_gross := COALESCE(NEW.invoice_gross_amount, 0);
        NEW.skonto_amount := ROUND(v_gross * (1.0 - (NEW.skonto_percent / 100.0)));
        NEW.skonto_selected := true;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop triggers if already exist
DROP TRIGGER IF EXISTS trg_apply_partner_skonto_invoices ON public.invoices;
CREATE TRIGGER trg_apply_partner_skonto_invoices
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_partner_skonto_to_invoice();

DROP TRIGGER IF EXISTS trg_apply_partner_skonto_nav_invoices ON public.nav_invoices;
CREATE TRIGGER trg_apply_partner_skonto_nav_invoices
  BEFORE INSERT ON public.nav_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_partner_skonto_to_invoice();
