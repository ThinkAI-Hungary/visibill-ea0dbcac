

# Miért nem frissülnek live-ban a kapcsolt bizonylatok és tételek?

## Két különálló gyökérok

### 1. `linkedInvoicesPool` — versenyhelyzet az invalidálásnál

A `linkedInvoicesPool` query a `submittedInvoices` adataiból épít seed-eket (bizonylatsorszam, reference_number). Amikor egy új számla INSERT történik, a `LiveNotificationProvider` **egyszerre** invalidálja a `submittedInvoices` és `linkedInvoices` kulcsokat.

A probléma: a `linkedInvoices` query újrafuthat a **régi** `submittedInvoices` adatokkal, mert az még nem frissült. Eredmény: az RPC hívás a régi seed-ekkel fut, és nem találja meg az új láncszemet.

**Javítás**: A `linkedInvoicesPool` query-t úgy kell módosítani, hogy a `submittedInvoices` frissülésére is reagáljon — nem egyidejű invalidálással, hanem a `submittedInvoices` adatból levezetett `queryKey`-vel vagy explicit függőséggel.

### 2. `InvoiceItemsDialog` — nincs Realtime, nincs React Query

Az `InvoiceItemsDialog` egy egyszerű `useState` + `useEffect` + `fetchInvoiceItems()` mintát használ. Nincs TanStack Query, nincs Realtime — a tételek csak a dialógus megnyitásakor töltődnek be, és soha nem frissülnek automatikusan.

A `nav_invoice_items` tábla ráadásul **nem szerepel** a `LiveNotificationProvider`-ben.

---

## Javítási terv

### Fájl 1: `src/hooks/useInvoiceData.ts`

A `linkedInvoicesPool` queryKey-be bele kell tenni a `submittedInvoices` egy stabil deriváltját (pl. az id-k hash-ét vagy count-ját), hogy az automatikusan újrafusson, amikor a `submittedInvoices` frissül:

```typescript
const submittedFingerprint = submittedInvoices.map(i => i.id).sort().join(',');

const { data: linkedInvoicesPool = [] } = useQuery({
  queryKey: [...queryKeys.linkedInvoices(companyId, dateFrom, dateTo), submittedFingerprint],
  queryFn: async () => { /* ... existing RPC call ... */ },
  enabled: enabled && !submittedLoading && submittedInvoices.length > 0,
});
```

Így ha a `submittedInvoices` refetch után új id-ket tartalmaz, a `linkedInvoices` automatikusan újrafut.

### Fájl 2: `src/components/InvoiceItemsDialog.tsx`

A `useState`/`useEffect` fetch-et TanStack Query-re cserélni:

```typescript
const { data: items = [], isLoading } = useQuery({
  queryKey: ['navInvoiceItems', invoiceId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('nav_invoice_items')
      .select('...')
      .eq('nav_invoice_id', invoiceId)
      .order('line_number');
    if (error) throw error;
    return data;
  },
  enabled: open && !!invoiceId,
});
```

### Fájl 3: `src/components/LiveNotificationProvider.tsx`

Hozzáadni a `nav_invoice_items` tábla figyelését:

```typescript
.on('postgres_changes', { event: '*', schema: 'public', table: 'nav_invoice_items' },
  (payload) => {
    console.log('[RealtimeSync] nav_invoice_items', payload.eventType);
    invalidate('navInvoiceItems', 'filteredNavInvoices', 'analyticsVat');
  }
)
```

A tab-refocus invalidációs listába is hozzáadni: `'navInvoiceItems'`.

### Összefoglalás

| Fájl | Változás |
|---|---|
| `src/hooks/useInvoiceData.ts` | `linkedInvoicesPool` queryKey-be `submittedFingerprint` derivált |
| `src/components/InvoiceItemsDialog.tsx` | `useState`/`useEffect` → TanStack Query |
| `src/components/LiveNotificationProvider.tsx` | `nav_invoice_items` Realtime listener hozzáadása |

