
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

### Fázis 3 — InvoicesPage + Settings nagy refaktor
7. **`InvoicesPage.tsx`** — `fetchInvoiceData` useState/useEffect eltávolítva, helyette 7 db `useQuery` hook (`navInvoices`, `submittedInvoices`, `linkedInvoices`, `partners`, `categories`, `projects`, `invoiceTransactions`). Saját realtime channel eltávolítva, `useRealtimeInvalidation` gondoskodik a frissítésről. `setInvoices` inline mutációk lecserélve `invalidateInvoiceData()` hívásokra.
8. **`Settings.tsx`** — `CompanyMembersCard` `useEffect`/`useState` lecserélve `useQuery`-re (`settingsMembers` query key), `removeMember` után `invalidateQueries`.

## 🔲 Fennmaradó feladatok

Nincs — az audit összes pontja implementálva.
