
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

### Fázis 3 — Nagy refaktorok
13. **`Index.tsx` Dashboard** — Teljes `fetchDashboardData` szétbontás 7 önálló useQuery-re:
    - `profile` — profil adatok
    - `tourStatus` — product tour állapot
    - `categories` — kategóriák
    - `recentInvoices` — legutóbbi számlák
    - `dashboardData` (metrics) — `get_invoice_aggregates` RPC
    - `dashboardAnalytics` (navVatData) — `get_nav_invoice_aggregates` RPC
    - `dashboardPettyCash` — házipénztár egyenleg (5 párhuzamos query)
    - `analyticsRaw` — nyers számla + bér adatok a grafikonhoz
    - `analyticsVat` — ÁFA bontás `nav_invoice_items`-ből
    → 15+ useState eltávolítva, minden adat a TanStack Query cache-ben
    → Minden query önállóan töltődik, egy hiba nem blokkolja a többit
14. **`UploadHistory.tsx`** — TanStack Query migráció + központi realtime:
    - 3 manuális realtime channel eltávolítva
    - Egyetlen `useQuery` hívás (records + processedIds + userNames)
    - `useRealtimeInvalidation` hookra épít
    - 389 → ~190 sor (51% csökkenés)
15. **`useRealtimeInvalidation.ts`** — 3 új tábla listener:
    - `invoice_uploads` → `uploadHistory` invalidáció
    - `salary_files` → `uploadHistory` invalidáció
    - `transaction_uploads` → `uploadHistory` invalidáció
    - Új kulcsok: `recentInvoices`, `dashboardPettyCash`, `uploadHistory`

## 🔲 Fennmaradó feladatok

### Fázis 4 — Jövőbeli optimalizációk (külön ütemezendő)
- **`InvoicesPage.tsx`** — linkedInvoices rekurzív query → RPC/recursive CTE (B4)
- **`InvoicesPage.tsx`** — server-side szűrés/paginálás (B8)
