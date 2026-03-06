

## Plan: Expandable rows with matched invoices/transactions

### What the user wants
Each row in the Invoices table should be expandable (click to toggle). When expanded, a sub-section appears below the row showing all related/matched records:
- For **Bejövő (NAV)** rows: show matching submitted invoices (via `invoice_number = szamlaszam`) and their linked transactions (via `transactions.matched_invoice_id`)
- For **Beküldött** rows: show matching NAV invoices and linked transactions
- Each matched item should have a "Megtekintés" (view) action

### Implementation

**File: `src/pages/InvoicesPage.tsx`**

#### 1. Add expandable row state
- New state: `expandedRowId: string | null` — tracks which row is currently expanded (one at a time)
- Click on a row toggles expansion (not the checkbox or action buttons)

#### 2. Fetch transactions data
- In `fetchData()`, also fetch all transactions for the company (with `matched_invoice_id` not null) and store them in state
- This gives us the full picture: NAV invoice → submitted invoice (via invoice_number/szamlaszam) → transaction (via matched_invoice_id)

#### 3. Build match lookup maps
- `navToSubmittedMap`: Map from `invoice_number` → array of submitted invoices with that `szamlaszam`
- `submittedToTransactionsMap`: Map from `invoice.id` → array of transactions with that `matched_invoice_id`
- `submittedToNavMap`: Map from `szamlaszam` → array of NAV invoices with that `invoice_number`

#### 4. Expandable row UI
After each `<TableRow>`, if `expandedRowId === invoice.id`, render an additional `<TableRow>` with a single `<TableCell colSpan={...}>` containing:

```
┌─────────────────────────────────────────────────┐
│ 🔗 Kapcsolódó tételek                           │
│                                                 │
│ Párosított számla(k):                           │
│  ┌──────────────────────────────────────────┐   │
│  │ INV-2024-001 | Eladó Kft | 100,000 HUF  │ 👁│
│  └──────────────────────────────────────────┘   │
│                                                 │
│ Párosított tranzakció(k):                       │
│  ┌──────────────────────────────────────────┐   │
│  │ 2024.01.15 | -100,000 HUF | Leírás...   │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│ (Ha nincs kapcsolódó tétel: "Nincs párosítás")  │
└─────────────────────────────────────────────────┘
```

- Submitted invoice cards: show szamlaszam, partner, amount, date + Eye icon to open `InvoiceDetailPopup` or `InvoiceImageDialog`
- Transaction cards: show date, amount, description, type
- Row click toggles expand with a subtle ChevronDown/ChevronUp indicator in the first column

#### 5. Row click handler
- Add `onClick` to `<TableRow>` that toggles `expandedRowId`
- Exclude clicks on checkboxes, selects, buttons (use `e.target` check or stopPropagation)
- Add a small chevron indicator on the row to signal expandability

#### 6. Apply to all tabs
- NAV tabs (OUTBOUND/INBOUND): show matched submitted invoices + their transactions
- Submitted tabs (SUBMITTED_INBOUND/SUBMITTED_OUTBOUND): show matched NAV invoices + linked transactions

### Files to modify
- `src/pages/InvoicesPage.tsx` — all changes in this single file (state, data fetching, UI rendering)

