
-- 1. Add transaction_id column to nav_invoices
ALTER TABLE public.nav_invoices
  ADD COLUMN transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;

-- 2. Backfill from direct matches (matched_invoice_id -> nav_invoices.id)
UPDATE nav_invoices ni
SET transaction_id = t.id
FROM transactions t
WHERE t.matched_invoice_id = ni.id
  AND ni.transaction_id IS NULL;

-- 3. Backfill from indirect matches (via submitted invoices bizonylatsorszam)
UPDATE nav_invoices ni
SET transaction_id = t.id
FROM transactions t
JOIN invoices i ON t.matched_invoice_id = i.id
WHERE i.bizonylatsorszam = ni.invoice_number
  AND i.company_id = ni.company_id
  AND ni.transaction_id IS NULL;

-- 4. Fix stale paid flags
UPDATE nav_invoices
SET paid = false
WHERE paid = true AND transaction_id IS NULL;

-- 5. Create reverse trigger function for transaction delete/unmatch
CREATE OR REPLACE FUNCTION public.reset_paid_on_transaction_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.matched_invoice_id IS NOT NULL THEN
    UPDATE nav_invoices SET paid = false, transaction_id = NULL
    WHERE transaction_id = OLD.id;
    UPDATE invoices SET transaction_id = NULL
    WHERE transaction_id = OLD.id;
    UPDATE salary SET transaction_id = NULL
    WHERE transaction_id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_reset_paid_on_transaction_delete
  BEFORE DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.reset_paid_on_transaction_delete();

-- 6. Also handle UPDATE (unmatch) on transactions
CREATE OR REPLACE FUNCTION public.reset_paid_on_transaction_unmatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only act when matched_invoice_id is cleared
  IF OLD.matched_invoice_id IS NOT NULL AND NEW.matched_invoice_id IS NULL THEN
    UPDATE nav_invoices SET paid = false, transaction_id = NULL
    WHERE transaction_id = OLD.id;
    UPDATE invoices SET transaction_id = NULL
    WHERE transaction_id = OLD.id;
    UPDATE salary SET transaction_id = NULL
    WHERE transaction_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reset_paid_on_transaction_unmatch
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.reset_paid_on_transaction_unmatch();

-- 7. Update mark_nav_invoice_paid_on_transaction_match to also set transaction_id
CREATE OR REPLACE FUNCTION public.mark_nav_invoice_paid_on_transaction_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bizonylatsorszam TEXT;
  v_company_id UUID;
BEGIN
  IF NEW.matched_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.matched_invoice_id IS NOT DISTINCT FROM NEW.matched_invoice_id THEN
    RETURN NEW;
  END IF;

  SELECT bizonylatsorszam, company_id INTO v_bizonylatsorszam, v_company_id
  FROM invoices WHERE id = NEW.matched_invoice_id;

  IF v_bizonylatsorszam IS NOT NULL AND v_company_id IS NOT NULL THEN
    UPDATE nav_invoices
    SET paid = true, submitted = true, transaction_id = NEW.id
    WHERE invoice_number = v_bizonylatsorszam
      AND company_id = v_company_id
      AND (paid IS NULL OR paid = false OR submitted IS NULL OR submitted = false);
  ELSE
    UPDATE nav_invoices
    SET paid = true, transaction_id = NEW.id
    WHERE id = NEW.matched_invoice_id
      AND (paid IS NULL OR paid = false);
  END IF;

  RETURN NEW;
END;
$$;

-- 8. Update get_nav_invoice_aggregates to use transaction_id
CREATE OR REPLACE FUNCTION public.get_nav_invoice_aggregates(p_company_id uuid, p_date_from date, p_date_to date)
 RETURNS TABLE(invoice_direction text, currency text, total_net numeric, total_gross numeric, total_vat numeric, paid_net numeric, paid_gross numeric, unpaid_net numeric, unpaid_gross numeric, invoice_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ni.invoice_direction::TEXT,
    COALESCE(ni.currency, 'HUF')::TEXT as currency,
    COALESCE(SUM(ni.invoice_net_amount), 0)::NUMERIC as total_net,
    COALESCE(SUM(COALESCE(ni.invoice_gross_amount, COALESCE(ni.invoice_net_amount, 0) + COALESCE(ni.invoice_vat_amount, 0))), 0)::NUMERIC as total_gross,
    COALESCE(SUM(ni.invoice_vat_amount), 0)::NUMERIC as total_vat,
    COALESCE(SUM(CASE WHEN ni.transaction_id IS NOT NULL THEN ni.invoice_net_amount ELSE 0 END), 0)::NUMERIC as paid_net,
    COALESCE(SUM(CASE WHEN ni.transaction_id IS NOT NULL THEN COALESCE(ni.invoice_gross_amount, COALESCE(ni.invoice_net_amount, 0) + COALESCE(ni.invoice_vat_amount, 0)) ELSE 0 END), 0)::NUMERIC as paid_gross,
    COALESCE(SUM(CASE WHEN ni.transaction_id IS NULL THEN ni.invoice_net_amount ELSE 0 END), 0)::NUMERIC as unpaid_net,
    COALESCE(SUM(CASE WHEN ni.transaction_id IS NULL THEN COALESCE(ni.invoice_gross_amount, COALESCE(ni.invoice_net_amount, 0) + COALESCE(ni.invoice_vat_amount, 0)) ELSE 0 END), 0)::NUMERIC as unpaid_gross,
    COUNT(*)::BIGINT as invoice_count
  FROM nav_invoices ni
  WHERE ni.company_id = p_company_id
    AND ni.invoice_issue_date >= p_date_from
    AND ni.invoice_issue_date <= p_date_to
  GROUP BY ni.invoice_direction, COALESCE(ni.currency, 'HUF');
END;
$$;
