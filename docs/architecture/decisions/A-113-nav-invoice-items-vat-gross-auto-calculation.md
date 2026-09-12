# A-113: NAV Invoice Items VAT & Gross Auto-Calculation

## Status
Accepted

## Context
In Hungarian electronic invoicing and the NAV Online Számla 3.0 XSD schema, `<lineAmountsNormal>` marks `<lineNetAmount>` and `<vatPercentage>` as required elements, but `<lineVatAmount>` and `<lineGrossAmountNormal>` are optional (`minOccurs="0"`).

Several major enterprise and utility issuers (such as MVM Next Energiakereskedelmi Zrt., telecommunications providers, and SAP-based billing systems) report line items with net amount and VAT rate (e.g. `0.27`), but omit the explicit `lineVatAmount` and `lineGrossAmountNormal` at the line level, providing the total tax summary only at the `<invoiceSummary>` header level.

Previously:
1. `supabase/functions/_shared/nav/xml-parser.ts` parsed missing `<lineVatAmount>` and `<lineGrossAmountNormal>` as `NaN`, which resolved to `undefined`.
2. `supabase/functions/_shared/nav/nav-ingestion-service.ts` defaulted undefined amounts to `0`.
3. As a result, rows in `nav_invoice_items` had `net_amount > 0` and `vat_rate = '0.27'`, but `vat_amount = 0` and `gross_amount = 0`.
4. In `src/components/InvoiceItemsDialog.tsx`, `getGrossAmount` checked `item.gross_amount !== null`, which evaluated to `true` when `item.gross_amount === 0`, displaying `0 Ft` for both VAT and Gross in the line items table and bottom totals.
5. In downstream features such as VAT analytics and drill-downs (`VatRowDrillDown.tsx`), line items with `vat_amount = 0` distorted line-level deduction calculations.

## Decision
We implemented a robust 4-layer architecture with strict mathematical and financial guards:

1. **Ingestion Layer (`supabase/functions/_shared/nav/xml-parser.ts`):**
   - When `vatAmount` and `grossAmount` are missing/NaN, but `netAmount > 0` and a valid numeric `vatRate` (e.g. `'0.27'`) is provided, automatically calculate:
     - `vatAmount = Math.round(netAmount * normalizedRate)`
     - `grossAmount = netAmount + vatAmount`
   - Handle reciprocal cases (e.g. if gross and VAT are present but net is missing).

2. **Frontend Fallback Layer (`src/components/InvoiceItemsDialog.tsx`):**
   - Introduced `getVatAmount(item)` with strict fallback guards: if `vat_amount === 0` and `gross_amount === 0`, but `net_amount > 0` and `vat_rate` is numeric > 0, compute fallback dynamically for rendering and totals.
   - Refined `getGrossAmount(item)` to only accept non-zero gross or calculate from net + VAT.

3. **Database Trigger Layer (`supabase/migrations/20260912113000_calc_nav_invoice_item_vat_gross.sql`):**
   - Added `BEFORE INSERT OR UPDATE` trigger `trg_calc_nav_invoice_item_vat_gross` with strict guard:
     - Only executes when `(gross_amount IS NULL OR gross_amount = 0)` AND `(vat_amount IS NULL OR vat_amount = 0)` AND `net_amount > 0` AND `vat_rate ~ '^[0-9]+(\.[0-9]+)?$'` AND `vat_rate::numeric > 0`.
     - Completely bypasses tax-exempt codes (`AAM`, `TAM`, `FAD`, `EU`, `KBAET`), 0% rates, and any row where either VAT or Gross was explicitly provided.

4. **Historical Backfill Layer:**
   - Backfilled all existing rows in `nav_invoice_items` that matched the strict guard criteria, ensuring historical utility invoices (such as MVM invoice `101220301447`) have exact line-level VAT and gross amounts matching the invoice header.

## Consequences
- **Positive:**
  - Invoices from MVM, telekoms, and utilities immediately display correct line-level VAT and Gross amounts in "Számlatételek".
  - Dialog totals match the main invoice table header down to the exact forint.
  - VAT drilldowns and deductions accurately reflect line-item tax distributions.
  - Zero risk of modifying exempt or zero-rated items.
- **Negative:**
  - Rounding differences: In multi-line utility invoices with small fraction amounts, sum of rounded lines may occasionally differ by ±1 Ft from the header summary due to standard integer rounding. In tested invoices (e.g. MVM `101220301447`), the sum matched the header 100% identically (15 477 Ft VAT, 72 800 Ft gross).
