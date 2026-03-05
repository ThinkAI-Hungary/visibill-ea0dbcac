

## Plan: Auto-update NAV invoice paid status when cross-matched with transaction

### Problem
Currently, NAV INBOUND rows turn green visually when `matchedNavInvoiceNumbers` matches, but the `paid` toggle still shows "Nyitott" (open). The user wants the status to actually change to "Fizetve" (paid=true) in the database automatically.

### Solution: Two-part approach

#### 1. Database trigger on `transactions` table (new migration)

Create a trigger that fires when a transaction gets a `matched_invoice_id` set. It will:
- Look up the matched invoice's `szamlaszam` from the `invoices` table
- Find matching `nav_invoices` rows where `invoice_number = szamlaszam` and same `company_id`
- Set `paid = true` on those NAV invoices

```sql
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
  -- Only act when matched_invoice_id is newly set
  IF NEW.matched_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.matched_invoice_id IS NOT DISTINCT FROM NEW.matched_invoice_id THEN
    RETURN NEW;
  END IF;

  -- Get the szamlaszam and company_id from the matched invoice
  SELECT szamlaszam, company_id INTO v_szamlaszam, v_company_id
  FROM invoices WHERE id = NEW.matched_invoice_id;

  IF v_szamlaszam IS NOT NULL AND v_company_id IS NOT NULL THEN
    UPDATE nav_invoices
    SET paid = true
    WHERE invoice_number = v_szamlaszam
      AND company_id = v_company_id
      AND (paid IS NULL OR paid = false);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mark_nav_paid_on_match
AFTER INSERT OR UPDATE OF matched_invoice_id ON transactions
FOR EACH ROW
EXECUTE FUNCTION mark_nav_invoice_paid_on_transaction_match();
```

#### 2. One-time backfill (in same migration)

Update existing NAV invoices that should already be marked paid based on current data:

```sql
UPDATE nav_invoices ni
SET paid = true
FROM invoices i
JOIN transactions t ON t.matched_invoice_id = i.id
WHERE ni.invoice_number = i.szamlaszam
  AND ni.company_id = i.company_id
  AND (ni.paid IS NULL OR ni.paid = false);
```

#### 3. Frontend cleanup (optional, minor)

In `InvoicesPage.tsx`, the green row logic for cross-matched NAV invoices (`matchedNavInvoiceNumbers`) becomes redundant since the trigger now sets `paid = true` directly. However, keeping it as a fallback is harmless and provides instant visual feedback before the DB trigger propagates. No frontend changes required.

### Files to modify
- New migration SQL file (trigger + backfill)

