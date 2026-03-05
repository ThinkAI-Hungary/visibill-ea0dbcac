

## Plan: Also set `submitted = true` when NAV invoice is cross-matched

### Problem
The existing trigger `mark_nav_invoice_paid_on_transaction_match` only sets `paid = true` when a transaction is matched to an invoice whose `szamlaszam` matches a NAV invoice's `invoice_number`. The user also wants `submitted = true` to be set in the same scenario.

### Implementation

**New migration SQL** -- two changes:

#### 1. Update the existing trigger function
Modify `mark_nav_invoice_paid_on_transaction_match()` to also set `submitted = true`:

```sql
CREATE OR REPLACE FUNCTION public.mark_nav_invoice_paid_on_transaction_match()
...
    UPDATE nav_invoices
    SET paid = true, submitted = true
    WHERE invoice_number = v_szamlaszam
      AND company_id = v_company_id
      AND (paid IS NULL OR paid = false OR submitted IS NULL OR submitted = false);
...
```

#### 2. Backfill existing data
```sql
UPDATE nav_invoices ni
SET submitted = true
FROM invoices i
JOIN transactions t ON t.matched_invoice_id = i.id
WHERE ni.invoice_number = i.szamlaszam
  AND ni.company_id = i.company_id
  AND (ni.submitted IS NULL OR ni.submitted = false);
```

### Files
- New migration SQL file

