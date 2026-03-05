

## Plan: Green row highlighting for matched/paid invoices

### Understanding

Currently:
- **Bejövő (NAV)** tab: All INBOUND rows are red (`bg-destructive/10`)
- **Beküldött (Bejövő)** tab: All INBOUND rows are red (`bg-destructive/10`)

The user wants:
1. **Beküldött (Bejövő)**: If a submitted invoice has a matched transaction in the `transactions` table, the row should be **green** instead of red
2. **Bejövő (NAV)**: If the NAV invoice has `paid = true` AND `submitted = true`, the row should be **green** instead of red

### Implementation

#### 1. Fetch matched invoice IDs from `transactions` table

In `fetchData()`, add a query to fetch all `matched_invoice_id` values from the `transactions` table for the current company where `matched_invoice_id IS NOT NULL`. Store this as a `Set<string>` in state (`matchedInvoiceIds`).

```typescript
const [matchedInvoiceIds, setMatchedInvoiceIds] = useState<Set<string>>(new Set());

// In fetchData:
const { data: matchedData } = await supabase
  .from('transactions')
  .select('matched_invoice_id')
  .eq('company_id', selectedCompany.id)
  .not('matched_invoice_id', 'is', null);

setMatchedInvoiceIds(new Set((matchedData || []).map(t => t.matched_invoice_id)));
```

#### 2. Update Beküldött (Bejövő) row coloring (~line 1740-1745)

Change the `TableRow` className logic: if the invoice ID exists in `matchedInvoiceIds`, use green (`bg-success/10`) instead of red.

```typescript
// Current:
!selectedSubmittedIds.has(invoice.id) && activeTab === 'SUBMITTED_INBOUND' && "bg-destructive/10 hover:bg-destructive/15"

// New:
!selectedSubmittedIds.has(invoice.id) && activeTab === 'SUBMITTED_INBOUND' && matchedInvoiceIds.has(invoice.id) && "bg-success/10 hover:bg-success/15",
!selectedSubmittedIds.has(invoice.id) && activeTab === 'SUBMITTED_INBOUND' && !matchedInvoiceIds.has(invoice.id) && "bg-destructive/10 hover:bg-destructive/15",
```

#### 3. Update Bejövő (NAV) row coloring (~line 1401-1406)

For INBOUND NAV invoices, if `paid === true` AND `submitted === true`, use green instead of red.

```typescript
// Current:
!selectedInvoiceIds.has(invoice.id) && activeTab === 'INBOUND' && "bg-destructive/10 hover:bg-destructive/15"

// New:
!selectedInvoiceIds.has(invoice.id) && activeTab === 'INBOUND' && invoice.paid === true && invoice.submitted === true && "bg-success/10 hover:bg-success/15",
!selectedInvoiceIds.has(invoice.id) && activeTab === 'INBOUND' && !(invoice.paid === true && invoice.submitted === true) && "bg-destructive/10 hover:bg-destructive/15",
```

### Files to modify
- `src/pages/InvoicesPage.tsx` -- add state, fetch matched IDs, update row coloring in both tabs

