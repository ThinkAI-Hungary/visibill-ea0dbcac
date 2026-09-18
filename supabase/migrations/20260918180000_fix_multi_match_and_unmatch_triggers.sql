-- ==============================================================================
-- Migration: 20260918180000_fix_multi_match_and_unmatch_triggers.sql
-- Description:
-- 1. Adds an AFTER DELETE trigger on transaction_invoice_matches so that unlinking
--    or removing an invoice from a multi-match properly resets paid = false and
--    transaction_id = NULL if no other active match exists.
-- 2. Updates reset_paid_on_transaction_unmatch() on transactions so that switching
--    matched_invoice_id from one invoice to another properly unlinks and resets
--    the previously matched invoice.
-- ==============================================================================

-- 1. Trigger function for transaction_invoice_matches DELETE
CREATE OR REPLACE FUNCTION public.reset_paid_on_multi_match_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bizonylatsorszam TEXT;
  v_company_id UUID;
BEGIN
  -- Check invoices table (submitted invoices)
  SELECT bizonylatsorszam, company_id INTO v_bizonylatsorszam, v_company_id
  FROM invoices WHERE id = OLD.invoice_id;

  IF v_bizonylatsorszam IS NOT NULL AND v_company_id IS NOT NULL THEN
    -- Check if still matched to another transaction or another multi-match
    IF NOT EXISTS (
      SELECT 1 FROM transactions WHERE matched_invoice_id = OLD.invoice_id
    ) AND NOT EXISTS (
      SELECT 1 FROM transaction_invoice_matches WHERE invoice_id = OLD.invoice_id AND id <> OLD.id
    ) THEN
      UPDATE invoices SET transaction_id = NULL
      WHERE id = OLD.invoice_id AND (transaction_id = OLD.transaction_id OR transaction_id IS NULL);

      UPDATE nav_invoices
      SET paid = false, submitted = false, transaction_id = NULL
      WHERE invoice_number = v_bizonylatsorszam
        AND company_id = v_company_id
        AND (transaction_id = OLD.transaction_id OR transaction_id IS NULL);
    END IF;

    RETURN OLD;
  END IF;

  -- Check nav_invoices table
  IF EXISTS (SELECT 1 FROM nav_invoices WHERE id = OLD.invoice_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM transactions WHERE matched_invoice_id = OLD.invoice_id
    ) AND NOT EXISTS (
      SELECT 1 FROM transaction_invoice_matches WHERE invoice_id = OLD.invoice_id AND id <> OLD.id
    ) THEN
      UPDATE nav_invoices
      SET paid = false, transaction_id = NULL
      WHERE id = OLD.invoice_id
        AND (transaction_id = OLD.transaction_id OR transaction_id IS NULL);
    END IF;

    RETURN OLD;
  END IF;

  -- Check salary table
  IF NOT EXISTS (
    SELECT 1 FROM transactions WHERE matched_invoice_id = OLD.invoice_id
  ) AND NOT EXISTS (
    SELECT 1 FROM transaction_invoice_matches WHERE invoice_id = OLD.invoice_id AND id <> OLD.id
  ) THEN
    UPDATE salary SET transaction_id = NULL
    WHERE id = OLD.invoice_id AND (transaction_id = OLD.transaction_id OR transaction_id IS NULL);
  END IF;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_reset_paid_on_multi_match_delete ON public.transaction_invoice_matches;
CREATE TRIGGER trg_reset_paid_on_multi_match_delete
  AFTER DELETE ON public.transaction_invoice_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_paid_on_multi_match_delete();


-- 2. Update reset_paid_on_transaction_unmatch on transactions
CREATE OR REPLACE FUNCTION public.reset_paid_on_transaction_unmatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bizonylatsorszam TEXT;
  v_company_id UUID;
BEGIN
  -- Fire when matched_invoice_id is cleared OR changed to a different invoice
  IF OLD.matched_invoice_id IS NOT NULL AND (NEW.matched_invoice_id IS NULL OR NEW.matched_invoice_id IS DISTINCT FROM OLD.matched_invoice_id) THEN
    -- Check if OLD.matched_invoice_id is still matched elsewhere
    IF NOT EXISTS (
      SELECT 1 FROM transactions WHERE matched_invoice_id = OLD.matched_invoice_id AND id <> OLD.id
    ) AND NOT EXISTS (
      SELECT 1 FROM transaction_invoice_matches WHERE invoice_id = OLD.matched_invoice_id
    ) THEN
      -- Reset nav_invoices
      UPDATE nav_invoices SET paid = false, transaction_id = NULL
      WHERE (id = OLD.matched_invoice_id OR transaction_id = OLD.id);

      -- Reset submitted invoices
      SELECT bizonylatsorszam, company_id INTO v_bizonylatsorszam, v_company_id
      FROM invoices WHERE id = OLD.matched_invoice_id;

      IF v_bizonylatsorszam IS NOT NULL AND v_company_id IS NOT NULL THEN
        UPDATE nav_invoices SET paid = false, submitted = false, transaction_id = NULL
        WHERE invoice_number = v_bizonylatsorszam AND company_id = v_company_id;
      END IF;

      UPDATE invoices SET transaction_id = NULL
      WHERE (id = OLD.matched_invoice_id OR transaction_id = OLD.id);

      UPDATE salary SET transaction_id = NULL
      WHERE (id = OLD.matched_invoice_id OR transaction_id = OLD.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
