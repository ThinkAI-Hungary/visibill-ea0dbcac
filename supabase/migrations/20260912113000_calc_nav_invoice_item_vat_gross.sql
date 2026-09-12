-- Migration: Auto-calculate vat_amount and gross_amount for nav_invoice_items when omitted by NAV Online Számla (e.g. MVM, utilities)

CREATE OR REPLACE FUNCTION public.calc_nav_invoice_item_vat_gross()
RETURNS TRIGGER AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  -- Strict guard: ONLY execute when BOTH gross_amount and vat_amount are missing or zero,
  -- and net_amount is positive, and vat_rate is provided.
  IF (NEW.gross_amount IS NULL OR NEW.gross_amount = 0)
     AND (NEW.vat_amount IS NULL OR NEW.vat_amount = 0)
     AND NEW.net_amount IS NOT NULL 
     AND NEW.net_amount > 0 
     AND NEW.vat_rate IS NOT NULL THEN

    -- Only proceed if vat_rate is a pure positive numeric rate (not text codes like AAM, TAM, FAD, EU)
    IF NEW.vat_rate ~ '^[0-9]+(\.[0-9]+)?$' THEN
      v_rate := NEW.vat_rate::NUMERIC;

      IF v_rate = 0 THEN
        NEW.vat_amount := 0;
        NEW.gross_amount := NEW.net_amount;
      ELSIF v_rate > 0 THEN
        -- Normalize percentage (e.g. 27 -> 0.27, 0.27 -> 0.27)
        IF v_rate >= 1 THEN
          v_rate := v_rate / 100.0;
        END IF;

        NEW.vat_amount := ROUND(NEW.net_amount * v_rate);
        NEW.gross_amount := NEW.net_amount + NEW.vat_amount;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_nav_invoice_item_vat_gross ON public.nav_invoice_items;
CREATE TRIGGER trg_calc_nav_invoice_item_vat_gross
BEFORE INSERT OR UPDATE ON public.nav_invoice_items
FOR EACH ROW
EXECUTE FUNCTION public.calc_nav_invoice_item_vat_gross();

-- One-time Backfill for historical items with the exact same strict guard:
UPDATE public.nav_invoice_items
SET 
  vat_amount = ROUND(net_amount * (CASE WHEN vat_rate::numeric >= 1 THEN vat_rate::numeric / 100.0 ELSE vat_rate::numeric END)),
  gross_amount = net_amount + ROUND(net_amount * (CASE WHEN vat_rate::numeric >= 1 THEN vat_rate::numeric / 100.0 ELSE vat_rate::numeric END))
WHERE (gross_amount IS NULL OR gross_amount = 0)
  AND (vat_amount IS NULL OR vat_amount = 0)
  AND net_amount IS NOT NULL 
  AND net_amount > 0 
  AND vat_rate IS NOT NULL 
  AND vat_rate ~ '^[0-9]+(\.[0-9]+)?$' 
  AND vat_rate::numeric > 0;
