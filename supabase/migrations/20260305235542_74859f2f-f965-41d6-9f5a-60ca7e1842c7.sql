-- Update trigger function to also set submitted = true
CREATE OR REPLACE FUNCTION public.mark_nav_invoice_paid_on_transaction_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_szamlaszam TEXT;
  v_company_id UUID;
BEGIN
  IF NEW.matched_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.matched_invoice_id IS NOT DISTINCT FROM NEW.matched_invoice_id THEN
    RETURN NEW;
  END IF;

  SELECT szamlaszam, company_id INTO v_szamlaszam, v_company_id
  FROM invoices WHERE id = NEW.matched_invoice_id;

  IF v_szamlaszam IS NOT NULL AND v_company_id IS NOT NULL THEN
    UPDATE nav_invoices
    SET paid = true, submitted = true
    WHERE invoice_number = v_szamlaszam
      AND company_id = v_company_id
      AND (paid IS NULL OR paid = false OR submitted IS NULL OR submitted = false);
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: set submitted = true for existing cross-matched NAV invoices
UPDATE nav_invoices ni
SET submitted = true
FROM invoices i
JOIN transactions t ON t.matched_invoice_id = i.id
WHERE ni.invoice_number = i.szamlaszam
  AND ni.company_id = i.company_id
  AND (ni.submitted IS NULL OR ni.submitted = false);