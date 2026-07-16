-- Migration: Fix invoice status trigger to allow 'jovahagyasra_var' status
-- Created at: 2026-07-16

CREATE OR REPLACE FUNCTION public.set_invoice_feldolgozva_on_upload_link()
RETURNS TRIGGER AS $$
BEGIN
  -- If invoice_uploads_id is set (not null), mark as feldolgozott,
  -- unless it is specifically set to 'jovahagyasra_var'
  IF NEW.invoice_uploads_id IS NOT NULL AND NEW.statusz IS DISTINCT FROM 'jovahagyasra_var' THEN
    NEW.statusz := 'feldolgozott';
    -- Only set feldolgozva timestamp if not already set
    IF NEW.feldolgozva IS NULL THEN
      NEW.feldolgozva := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
