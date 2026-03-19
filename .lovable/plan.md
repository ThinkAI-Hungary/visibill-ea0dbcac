

# NAV Invoices Computed Status — Full Solution

## Problem
The `nav_invoices.paid` boolean is set by a trigger when a transaction match is created, but there is **no reverse trigger** when the transaction is deleted/unmatched. This leaves 10 nav_invoices with stale `paid = true` status and no actual backing transaction.

## Solution Overview
Add `transaction_id` column to `nav_invoices` (same pattern as `salary` and `invoices`), backfill existing data, create a reverse trigger, and update the frontend to derive status from the `transaction_id` relationship.

---

## 1. Database Migration

**a) Add `transaction_id` to `nav_invoices` with FK + ON DELETE SET NULL:**
```sql
ALTER TABLE public.nav_invoices
  ADD COLUMN transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;
```

**b) Backfill `transaction_id` from existing direct matches:**
```sql
-- Direct matches (matched_invoice_id -> nav_invoices.id)
UPDATE nav_invoices ni
SET transaction_id = t.id
FROM transactions t
WHERE t.matched_invoice_id = ni.id
  AND ni.transaction_id IS NULL;
```

**c) Backfill from indirect matches (via submitted invoices bizonylatsorszam):**
```sql
UPDATE nav_invoices ni
SET transaction_id = t.id
FROM transactions t
JOIN invoices i ON t.matched_invoice_id = i.id
WHERE i.bizonylatsorszam = ni.invoice_number
  AND i.company_id = ni.company_id
  AND ni.transaction_id IS NULL;
```

**d) Fix stale `paid` flags — reset where no transaction exists:**
```sql
UPDATE nav_invoices
SET paid = false
WHERE paid = true AND transaction_id IS NULL;
```

**e) Create reverse trigger to reset `paid` when transaction is deleted or unmatched:**
```sql
CREATE OR REPLACE FUNCTION public.reset_nav_invoice_paid_on_unmatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When matched_invoice_id is cleared or transaction deleted
  IF OLD.matched_invoice_id IS NOT NULL THEN
    -- Reset nav_invoices that pointed to this transaction
    UPDATE nav_invoices SET paid = false, transaction_id = NULL
    WHERE transaction_id = OLD.id;
    -- Also reset invoices and salary
    UPDATE invoices SET transaction_id = NULL
    WHERE transaction_id = OLD.id;
    UPDATE salary SET transaction_id = NULL
    WHERE transaction_id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_reset_nav_paid_on_delete
  BEFORE DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION reset_nav_invoice_paid_on_unmatch();
```

**f) Update existing `mark_nav_invoice_paid_on_transaction_match` trigger function to also set `transaction_id`:**
```sql
-- Updated to also populate transaction_id on nav_invoices
```

## 2. Update `useComputedStatus` Hook
Already exists and works. The `getPaymentStatusBadge()` function will be used for nav_invoices too — just pass `invoice.transaction_id` instead of checking `invoice.paid`.

## 3. Update `InvoicesPage.tsx`
- Add `transaction_id` to the NavInvoice interface and fetch query
- Replace all `invoice.paid === true` checks with `!!invoice.transaction_id`
- Row coloring, badge, filter, and export all switch to `transaction_id`-based logic
- Use `getPaymentStatusBadge` from the shared hook

## 4. Update `InvoiceStatusTables.tsx` (Dashboard)
- Replace `paid.is.null,paid.eq.false` filter with `transaction_id.is.null` filter
- Update the payable total calculation

## 5. Update `get_nav_invoice_aggregates` DB function
- Change `paid = true` references to `transaction_id IS NOT NULL` for consistency

## 6. Update Supabase Types
The types file will auto-update after migration, adding `transaction_id` to `nav_invoices`.

---

## Migration Order
1. DB migration (add column, backfill, fix stale data, add reverse trigger)
2. Update `InvoicesPage.tsx` — switch from `paid` boolean to `transaction_id`
3. Update `InvoiceStatusTables.tsx` — same switch
4. Update aggregate DB function

## Risk Notes
- The `paid` boolean column stays in place for backward compatibility but becomes secondary — `transaction_id` is the source of truth
- The reverse trigger ensures cascading cleanup when transactions are deleted
- The `ON DELETE SET NULL` FK handles the `transaction_id` column automatically; the trigger handles the `paid` boolean reset

