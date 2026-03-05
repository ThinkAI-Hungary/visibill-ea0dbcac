

## Plan: Cross-link NAV invoices and submitted invoices via invoice_number matching

### What the user wants

When a NAV invoice (`nav_invoices.invoice_number`) matches a submitted invoice (`invoices.szamlaszam`), AND that submitted invoice has a matched transaction (`transactions.matched_invoice_id`), then:
1. The **Bejövő (NAV)** row should appear green (as if paid=true & submitted=true)
2. The **Beküldött (Bejövő)** row should also appear green

### Implementation

**File: `src/pages/InvoicesPage.tsx`**

#### 1. Build a cross-reference set in `fetchData()`

After fetching both `matchedInvoiceIds` (submitted invoice IDs with transactions) and the submitted invoices data, create a new set `matchedNavInvoiceNumbers` containing `invoice_number` values from NAV invoices that match a submitted invoice with a transaction:

```typescript
// Build set of szamlaszam values that have matched transactions
const matchedSzamlaszamSet = new Set(
  (submittedData || [])
    .filter(inv => matchedInvoiceIdsSet.has(inv.id))
    .map(inv => inv.szamlaszam)
    .filter(Boolean)
);
```

Store this as state: `matchedNavInvoiceNumbers: Set<string>`.

Also build reverse: a set of submitted invoice IDs whose `szamlaszam` matches a NAV invoice number (to make submitted rows green even if they don't directly have a transaction, but indirectly through NAV matching). Actually, re-reading the request -- the user wants:
- If NAV invoice_number matches invoices.szamlaszam AND that invoice has a transaction -> NAV row green, submitted row green.

The submitted row is already green if it has a matched transaction (existing logic). So we only need the **forward** direction: make NAV rows green when their `invoice_number` exists in the set of `szamlaszam` values that have matched transactions.

#### 2. Update NAV row coloring (~line 1414-1415)

Add the cross-reference check as an additional green condition for INBOUND NAV rows:

```typescript
// Current green condition: invoice.paid === true && invoice.submitted === true
// New green condition: ALSO green if matchedNavInvoiceNumbers has this invoice_number
!selectedInvoiceIds.has(invoice.id) && activeTab === 'INBOUND' && 
  (invoice.paid === true && invoice.submitted === true || matchedNavInvoiceNumbers.has(invoice.invoice_number)) 
  && "bg-success/10 hover:bg-success/15",

!selectedInvoiceIds.has(invoice.id) && activeTab === 'INBOUND' && 
  !(invoice.paid === true && invoice.submitted === true) && !matchedNavInvoiceNumbers.has(invoice.invoice_number) 
  && "bg-destructive/10 hover:bg-destructive/15",
```

### Summary of changes

- **1 new state variable**: `matchedNavInvoiceNumbers: Set<string>`
- **fetchData()**: After fetching matched transaction IDs and submitted invoices, compute the set of `szamlaszam` values that have matched transactions, store as `matchedNavInvoiceNumbers`
- **NAV INBOUND row**: Green if `paid && submitted` OR if `invoice_number` is in `matchedNavInvoiceNumbers`
- No changes needed for Beküldött (Bejövő) -- already green via existing `matchedInvoiceIds` logic

