-- 1. Create BEFORE INSERT trigger on nav_invoices to match with existing submitted invoices & transactions
CREATE OR REPLACE FUNCTION public.match_nav_invoice_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice_id UUID;
  v_has_transaction BOOLEAN;
BEGIN
  -- Check if a submitted invoice exists with matching bizonylatsorszam
  SELECT id INTO v_invoice_id
  FROM invoices
  WHERE bizonylatsorszam = NEW.invoice_number
    AND company_id = NEW.company_id
  LIMIT 1;

  IF v_invoice_id IS NOT NULL THEN
    -- Mark as submitted
    NEW.submitted := true;

    -- Check if that invoice has a matched transaction
    SELECT EXISTS (
      SELECT 1 FROM transactions
      WHERE matched_invoice_id = v_invoice_id
    ) INTO v_has_transaction;

    IF v_has_transaction THEN
      NEW.paid := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_match_nav_invoice_on_insert
  BEFORE INSERT ON nav_invoices
  FOR EACH ROW
  EXECUTE FUNCTION match_nav_invoice_on_insert();

-- 2. Backfill: mark existing NAV invoices as submitted where a matching submitted invoice exists
UPDATE nav_invoices ni
SET submitted = true
FROM invoices i
WHERE i.bizonylatsorszam = ni.invoice_number
  AND i.company_id = ni.company_id
  AND (ni.submitted IS NULL OR ni.submitted = false);

-- 3. Backfill: mark existing NAV invoices as paid where a matching transaction exists
UPDATE nav_invoices ni
SET paid = true
FROM invoices i
JOIN transactions t ON t.matched_invoice_id = i.id
WHERE i.bizonylatsorszam = ni.invoice_number
  AND i.company_id = ni.company_id
  AND (ni.paid IS NULL OR ni.paid = false);