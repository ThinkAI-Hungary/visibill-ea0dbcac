

# Fázis 3 — Státusz és terv

## Jelenlegi állapot

A Fázis 3 **még NEM lett implementálva**. A plan.md is megerősíti:

- **InvoicesPage.tsx** (2297 sor) — Továbbra is `useEffect`/`useState` mintát használ a `fetchInvoiceData` függvényben (541-670. sor), ami 7 párhuzamos Supabase lekérdezést futtat egyetlen async függvényben. Van saját realtime channel (317-343), tehát a valós idejű frissítés működik, de NEM TanStack Query-n keresztül.
- **Settings.tsx** `CompanyMembersCard` (202-233. sor) — Továbbra is `useEffect`/`useState`.

---

## Implementációs terv

### 1. InvoicesPage.tsx — `fetchInvoiceData` szétbontása useQuery-kre

A `fetchInvoiceData` (541-670) 7 lekérdezést tartalmaz. Ezeket önálló `useQuery` hívásokra bontjuk:

| Query key | Tábla | Jelenlegi state |
|-----------|-------|-----------------|
| `navInvoices` | `nav_invoices` | `setInvoices` |
| `submittedInvoices` | `invoices` (dátumszűrős) | `setSubmittedInvoices` |
| `linkedInvoices` | `invoices` (lánc) | `setLinkedInvoicesPool` |
| `partners` | `partners` | `setPartners` |
| `categories` | `categories` | `setCategories` |
| `projects` | `projects` | `setProjects` |
| `invoiceTransactions` | `transactions` (matched) | `setAllTransactions` + `setMatchedInvoiceIds` |

**Változások:**
- 7 db `useQuery` hívás létrehozása a `fetchInvoiceData` és a hozzá tartozó `useState`-ek helyett
- `linkedInvoices` query függ a `submittedInvoices` query eredményétől (`enabled` flag)
- Saját realtime channel (317-343) eltávolítása, helyette `useRealtimeInvalidation` (már importálva van, de nincs kihasználva a query cache-hez)
- `loading` state → az egyes query-k `isLoading` kombinálása
- `invalidateInvoiceData()` hívások lecserélése `queryClient.invalidateQueries`-ra (pl. sync után)
- A `matchedInvoiceIds` Set származtatása a `invoiceTransactions` query `data`-jából `useMemo`-val

### 2. Settings.tsx — CompanyMembersCard useQuery migráció

- `useState` + `useEffect` + `fetchMembers` → `useQuery` (`settingsMembers` key)
- `removeMember` után `queryClient.invalidateQueries` hívás

---

## Implementációs sorrend
1. **InvoicesPage.tsx** — 7 useQuery + realtime channel eltávolítás + invalidateInvoiceData refaktor
2. **Settings.tsx** — CompanyMembersCard useQuery migráció
3. **plan.md** frissítés — Fázis 3 lezárás

