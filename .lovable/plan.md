
# Teljes menüátfogó audit — Implementáció státusz

## ✅ Elvégzett javítások

### Fázis 1 — Realtime hook + type cleanup
1. **`useRealtimeInvalidation.ts`** — `nav_invoices` tábla figyelés hozzáadva + összes hiányzó query key (`pettyCashEntries`, `pettyCashSettings`, `analyticsRaw`, `analyticsVat`, `projects`, `invoiceTransactions`, `linkedInvoices`)
2. **`PettyCashPage.tsx`** — `useRealtimeInvalidation` hook bekötve
3. **`types/invoices.ts`** — `fizetve` boolean eltávolítva a `BaseInvoice`-ból
4. **`InvoiceDetailPopup.tsx`** — `fizetve` eltávolítva a `FullInvoice` interfészből

### Fázis 2 — Analytics + Projects TanStack Query migráció
5. **`Analytics.tsx`** — Teljes átírás `useQuery`-re (`analyticsRaw` + `analyticsVat` query key-ek), `useRealtimeInvalidation` hozzáadva
6. **`Projects.tsx`** — Teljes átírás `useQuery`-re (`projects` query key), `useRealtimeInvalidation` hozzáadva

## 🔲 Fennmaradó feladatok

### Fázis 3 — Nagy refaktor (jövőbeli)
7. **`InvoicesPage.tsx`** — 2300+ soros fájl, `fetchInvoiceData` useState/useEffect → useQuery migráció. Már van saját realtime channel + `useRealtimeInvalidation`, tehát a valós idejű frissítés működik, de a TanStack Query cache előnyei hiányoznak.
8. **`Settings.tsx`** — `CompanyMembersCard` useQuery migráció (alacsony prioritás)
