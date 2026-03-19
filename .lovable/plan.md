

# Computed Status & Realtime Sync Implementation

## Context

Currently:
- **Salaries**: Status is determined by `item.statusz === "Kifizetve"` OR checking if the salary ID exists in `transactions.matched_invoice_id`. This involves a separate query to the transactions table.
- **Invoices (NAV)**: Status uses the `paid` boolean column on `nav_invoices`, set by DB triggers.
- **Transactions**: `getMatchStatus()` checks `matched_invoice_id` presence, plus special cases (bankköltség, cash, no_match_category).
- **No Realtime** on salary or transactions pages. Only InvoicesPage has realtime.
- `salary.transaction_id` is `text` type (not uuid), has no FK constraint.
- `invoices` table has no `transaction_id` column at all.
- `transactions.matched_invoice_id` is a polymorphic uuid pointing to invoices, nav_invoices, or salary — no FK constraint.

## Plan

### 1. Database Migration

**a) Fix `salary.transaction_id` type and add FK:**
```sql
ALTER TABLE public.salary 
  ALTER COLUMN transaction_id TYPE uuid USING transaction_id::uuid;

ALTER TABLE public.salary
  ADD CONSTRAINT salary_transaction_id_fkey 
  FOREIGN KEY (transaction_id) 
  REFERENCES public.transactions(id) 
  ON DELETE SET NULL;
```

**b) Add `transaction_id` column to `invoices` table:**
```sql
ALTER TABLE public.invoices
  ADD COLUMN transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;
```

**c) Backfill `invoices.transaction_id` from existing matches:**
```sql
UPDATE invoices i
SET transaction_id = t.id
FROM transactions t
WHERE t.matched_invoice_id = i.id
  AND i.transaction_id IS NULL;
```

**d) Backfill `salary.transaction_id` from existing matches** (where not already set):
```sql
UPDATE salary s
SET transaction_id = t.id::text
FROM transactions t
WHERE t.matched_invoice_id = s.id
  AND (s.transaction_id IS NULL OR s.transaction_id = '');
```
*(This backfill runs before the type change, or we do it after with uuid type.)*

> Note: We will NOT add a FK on `transactions.matched_invoice_id` because it's polymorphic (points to 3 different tables).

### 2. Create `useComputedStatus` Hook

New file: `src/hooks/useComputedStatus.ts`

A simple utility hook/function that computes status from a record's `transaction_id` or `matched_invoice_id`:

```typescript
// For salary/invoices: Paid if transaction_id is not null
export function computePaymentStatus(transactionId: string | null | undefined) {
  return transactionId ? 'paid' : 'pending';
}

// For transactions: Matched if matched_invoice_id is not null (+ existing special cases)
export function computeMatchStatus(transaction: { matched_invoice_id: string | null, ... }) {
  // preserve existing special-case logic (bankköltség, cash, no_match_category)
  // ...
  return transaction.matched_invoice_id ? 'matched' : 'unmatched';
}
```

Plus badge/style helpers returning label + className.

### 3. Create `useRealtimeInvalidation` Hook

New file: `src/hooks/useRealtimeInvalidation.ts`

A reusable hook that subscribes to Supabase Realtime `postgres_changes` on specified tables and invalidates relevant TanStack Query keys:

```typescript
export function useRealtimeInvalidation(companyId: string | undefined) {
  // Subscribe to salary, invoices, transactions tables
  // On any change → invalidate related query keys
}
```

This will be used in all three pages (and potentially in the dashboard).

### 4. Update SalariesPage

- Replace the separate `salary-matched-ids` query with direct `transaction_id` check from the salary record itself.
- Change `getStatusBadge` to use `computePaymentStatus(item.transaction_id)` instead of checking matchedIds Set.
- Remove the `matchedSalaryIds` query and related useMemo.
- Add `useRealtimeInvalidation` hook call.
- Update metrics calculations to use `item.transaction_id != null` instead of matchedIds.

### 5. Update InvoicesPage

- For submitted invoices (`invoices` table): use new `transaction_id` column. Fetch it in the query, show Kifizetve/Nyitott based on `transaction_id != null`.
- For NAV invoices: keep using `paid` boolean (it's set by DB triggers and is reliable).
- Add `useRealtimeInvalidation` to also cover `transactions` table changes (currently only watches invoices/nav_invoices).

### 6. Update TransactionsPage

- Refactor `getMatchStatus` to use `computeMatchStatus` from the shared hook.
- Add `useRealtimeInvalidation` hook call so transaction rows update when linked invoices/salaries are deleted.

### 7. Update Dashboard Components

- `InvoiceStatusTables` and `Index.tsx` salary filter: update to use `transaction_id`-based logic where applicable.
- Add realtime subscriptions via the shared hook.

## Migration Order

1. DB migration (add column, change type, add FKs, backfill)
2. Create shared hooks (`useComputedStatus`, `useRealtimeInvalidation`)
3. Update SalariesPage (biggest change — remove matchedIds pattern)
4. Update InvoicesPage (add transaction_id to query + status logic)
5. Update TransactionsPage (refactor to shared hook + realtime)
6. Update Dashboard components

## Risk Notes

- The `salary.transaction_id` type change from `text` to `uuid` will fail if any existing values aren't valid UUIDs. We'll check first and clean up bad data.
- The polymorphic `matched_invoice_id` on transactions stays as-is (no FK) since it references 3 tables.
- The `ON DELETE SET NULL` ensures that when a transaction is deleted, the `transaction_id` on salary/invoices automatically becomes NULL, and the UI (via realtime) will reflect the status change immediately.

