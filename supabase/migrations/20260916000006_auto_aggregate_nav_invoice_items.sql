-- Migration: 20260916000006_auto_aggregate_nav_invoice_items.sql
-- Description: Automatically sync nav_invoices header totals from nav_invoice_items when header is 0, fix historical zero-gross invoices, and fix partner naming artifacts

-- 1. Create or replace trigger function to aggregate item amounts into nav_invoices header
CREATE OR REPLACE FUNCTION public.sync_nav_invoice_totals_from_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nav_invoice_id uuid;
  v_calc_net numeric;
  v_calc_vat numeric;
  v_calc_gross numeric;
  v_current_gross numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_nav_invoice_id := OLD.nav_invoice_id;
  ELSE
    v_nav_invoice_id := NEW.nav_invoice_id;
  END IF;

  IF v_nav_invoice_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check current gross on header
  SELECT invoice_gross_amount INTO v_current_gross
  FROM nav_invoices
  WHERE id = v_nav_invoice_id;

  -- Only calculate and update if header gross is 0 or NULL
  IF v_current_gross IS NULL OR v_current_gross = 0 THEN
    SELECT 
      COALESCE(SUM(net_amount), 0),
      COALESCE(SUM(vat_amount), 0),
      COALESCE(SUM(gross_amount), 0)
    INTO v_calc_net, v_calc_vat, v_calc_gross
    FROM nav_invoice_items
    WHERE nav_invoice_id = v_nav_invoice_id;

    IF v_calc_gross > 0 THEN
      UPDATE nav_invoices
      SET 
        invoice_net_amount = v_calc_net,
        invoice_vat_amount = v_calc_vat,
        invoice_gross_amount = v_calc_gross
      WHERE id = v_nav_invoice_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- 2. Attach trigger to nav_invoice_items
DROP TRIGGER IF EXISTS trg_sync_nav_invoice_totals ON nav_invoice_items;
CREATE TRIGGER trg_sync_nav_invoice_totals
AFTER INSERT OR UPDATE OF net_amount, vat_amount, gross_amount OR DELETE
ON nav_invoice_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_nav_invoice_totals_from_items();

-- 3. One-time historical fix: Update all existing nav_invoices where header gross is 0 but items exist
WITH item_sums AS (
  SELECT 
    nav_invoice_id,
    SUM(COALESCE(net_amount, 0)) AS calc_net,
    SUM(COALESCE(vat_amount, 0)) AS calc_vat,
    SUM(COALESCE(gross_amount, 0)) AS calc_gross
  FROM nav_invoice_items
  GROUP BY nav_invoice_id
  HAVING SUM(COALESCE(gross_amount, 0)) > 0
)
UPDATE nav_invoices ni
SET 
  invoice_net_amount = s.calc_net,
  invoice_vat_amount = s.calc_vat,
  invoice_gross_amount = s.calc_gross
FROM item_sums s
WHERE ni.id = s.nav_invoice_id
  AND COALESCE(ni.invoice_gross_amount, 0) = 0;

-- 4. Fix Katacont Kft. name artifact on submitted invoices where customer name was accidentally concatenated
UPDATE invoices
SET elado_nev = 'Katacont Kft.'
WHERE elado_nev ILIKE 'Katacont%Hangszerkereskedelmi%';
