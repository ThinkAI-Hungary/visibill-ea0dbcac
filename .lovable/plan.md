
# Teljes menüátfogó audit — Implementáció státusz

## ✅ Elvégzett javítások

### Fázis 1 — Gyors javítások
1. **`KintlevoPage.tsx`** — `useRealtimeInvalidation` hook hozzáadva
2. **`useRealtimeInvalidation.ts`** — hiányzó kulcsok pótolva: `pettyCashEntries` salary-ból, `projects`+`projectsList` nav_invoices-ból
3. **`Index.tsx`** — salary query `select("*")` → explicit select + server-side `transaction_id` szűrés (`.not("transaction_id", "is", null)`)
4. **`Index.tsx`** — console.log eltávolítva renderből + duplikált return statement javítva
5. **`InvoicesPage.tsx`** — `select('*')` → explicit select a nav_invoices query-re (29 → 27 szükséges oszlop)

### Fázis 2 — Optimalizációk
6. **`TransactionsPage.tsx`** — filterOptions `.limit(500)` + staleTime 10 perc (korábban az összes tranzakciót letöltötte)
7. **`src/lib/helpers.ts`** — Közös utility fájl: `getInitials`, `getAvatarColor`, `decodeHtmlEntities`
8. **`InvoicesPage.tsx`** — duplikált `getInitials`/`getAvatarColor` lecserélve importra
9. **`PartnersPage.tsx`** — duplikált `getInitials`/`getAvatarColor`/`decodeHtmlEntities` lecserélve importra
10. **`SalariesPage.tsx`** — lokális `formatCurrency` lecserélve `@/lib/utils` importra
11. **`ExchangeRates.tsx`** — Teljes TanStack Query migráció (useEffect/useState → useQuery, 1 óra staleTime cache)
12. **`Integrations.tsx`** — syncLogs useEffect/useState → useQuery (2 perc staleTime cache)

## 🔲 Fennmaradó feladatok

### Fázis 3 — Nagy refaktorok (magas kockázat, külön ütemezendő)
- **`Index.tsx` Dashboard** — `fetchDashboardData` szétbontása 4 önálló useQuery-re (A1/B3). Jelenleg hibrid useState + useQuery minta, 15+ state variable, 200+ soros monolitikus fetch. Túl nagy egy incremental edit-hez, dedikált refaktor szükséges.
- **`UploadHistory.tsx`** — TanStack Query + központi realtime migráció (3 saját channel eltávolítása)
- **`InvoicesPage.tsx`** — linkedInvoices rekurzív query → RPC/recursive CTE (B4)
- **`InvoicesPage.tsx`** — server-side szűrés/paginálás (B8)
