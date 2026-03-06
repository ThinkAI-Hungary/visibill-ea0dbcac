

## Plan: Rename `szamlaszam` to `bizonylatsorszam`

### Impact Assessment

This rename touches **3 layers** and has some critical dependencies:

**1. Database (invoices table + sima_szamla_backup table)**
- Column `szamlaszam` -> `bizonylatsorszam` on `invoices`
- Column `szamlaszam` -> `bizonylatsorszam` on `sima_szamla_backup`
- `bankszamlaszam_iban` stays unchanged (different field)

**2. Database functions/triggers (CRITICAL)**
Two SECURITY DEFINER functions reference `NEW.szamlaszam`:
- `mark_nav_invoice_as_submitted()` -- matches `NEW.szamlaszam` against `nav_invoices.invoice_number`
- `mark_nav_invoice_paid_on_transaction_match()` -- reads `szamlaszam` from invoices table

These must be updated in the same migration or the matching logic breaks.

**3. Frontend (6 files)**
- `src/pages/InvoicesPage.tsx` -- interface, queries, display, matching logic
- `src/components/ExpandedInvoiceRow.tsx` -- interface + display
- `src/components/TransactionDetailsDialog.tsx` -- interface, queries, display, search
- `src/components/InvoiceDetailPopup.tsx` -- interface + display label
- `src/components/InvoiceImageDialog.tsx` -- interface + identifier logic
- `src/components/dashboard/RecentInvoices.tsx` -- display
- `src/types/invoices.ts` -- type definitions

**4. Edge functions** -- None reference `szamlaszam` directly; they use `select *` or don't touch this column.

### Migration SQL

Single migration that:
1. Renames column on `invoices` and `sima_szamla_backup`
2. Recreates `mark_nav_invoice_as_submitted()` with `NEW.bizonylatsorszam`
3. Recreates `mark_nav_invoice_paid_on_transaction_match()` with `bizonylatsorszam`

### Frontend Changes

All 7 files above: rename `szamlaszam` -> `bizonylatsorszam` in interfaces, queries, variable references, and change display labels from "Számlaszám" to "Bizonylatsorszám".

### Risk

- **No breaking risk** if migration + triggers + frontend are deployed together (which they will be).
- The `supabase/integrations/supabase/types.ts` auto-regenerates from DB schema, so it will update automatically after migration.

