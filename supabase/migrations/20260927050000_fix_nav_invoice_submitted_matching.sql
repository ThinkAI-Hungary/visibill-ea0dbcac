-- Migration: 20260927050000_fix_nav_invoice_submitted_matching.sql
-- Description: Fix match_nav_invoice_on_insert trigger to use whitespace-insensitive matching
--              and backfill submitted status for NAV invoices where a matching uploaded invoice exists.

-- 1. Update trigger function on nav_invoices to handle whitespace differences in invoice numbers
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
  -- Check if a submitted invoice exists with matching normalized bizonylatsorszam
  SELECT id INTO v_invoice_id
  FROM invoices
  WHERE REPLACE(LOWER(bizonylatsorszam), ' ', '') = REPLACE(LOWER(NEW.invoice_number), ' ', '')
    AND (
      (company_id = NEW.company_id)
      OR (company_id IS NULL AND NEW.company_id IS NULL)
    )
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

-- 2. Backfill: mark existing NAV invoices as submitted where a matching submitted invoice exists (whitespace-insensitive)
UPDATE public.nav_invoices ni
SET submitted = true
FROM public.invoices i
WHERE (
  (i.company_id = ni.company_id)
  OR (i.company_id IS NULL AND ni.company_id IS NULL)
)
AND REPLACE(LOWER(i.bizonylatsorszam), ' ', '') = REPLACE(LOWER(ni.invoice_number), ' ', '')
AND (ni.submitted IS NULL OR ni.submitted = false);

-- 3. Backfill: mark existing NAV invoices as paid where a matching transaction exists via submitted invoice
UPDATE public.nav_invoices ni
SET paid = true
FROM public.invoices i
JOIN public.transactions t ON t.matched_invoice_id = i.id
WHERE (
  (i.company_id = ni.company_id)
  OR (i.company_id IS NULL AND ni.company_id IS NULL)
)
AND REPLACE(LOWER(i.bizonylatsorszam), ' ', '') = REPLACE(LOWER(ni.invoice_number), ' ', '')
AND (ni.paid IS NULL OR ni.paid = false);
