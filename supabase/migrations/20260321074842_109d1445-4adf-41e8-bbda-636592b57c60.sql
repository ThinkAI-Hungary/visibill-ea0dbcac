
-- P1: Reset NAV submitted status when invoice is deleted
CREATE OR REPLACE FUNCTION public.reset_nav_submitted_on_invoice_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE nav_invoices
  SET submitted = false
  WHERE invoice_number = OLD.bizonylatsorszam
    AND company_id = OLD.company_id
    AND submitted = true;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_reset_nav_submitted_on_invoice_delete
  BEFORE DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_nav_submitted_on_invoice_delete();

-- P2: Clear transaction match when invoice is deleted
CREATE OR REPLACE FUNCTION public.clear_transaction_match_on_invoice_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE transactions
  SET matched_invoice_id = NULL, is_verified = false, match_type = NULL, confidence_score = NULL
  WHERE matched_invoice_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_clear_transaction_on_invoice_delete
  BEFORE DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_transaction_match_on_invoice_delete();
