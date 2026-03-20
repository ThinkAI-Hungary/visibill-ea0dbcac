

# Teljes menüátfogó audit — Inkonzisztenciák + Optimalizálatlanságok

---

## A. INKONZISZTENCIÁK (adatbázis ↔ frontend szinkron)

### A1. Index.tsx Dashboard — Hibrid useState + useQuery minta (MAGAS)
**Fájl:** `src/pages/Index.tsx` (140-165, 200-217, 505-718)

A Dashboard TanStack Query wrapper-t használ (`dashboardData`, `dashboardAnalytics` kulcsokkal), de a tényleges adatot **15+ db `useState`**-ben tárolja (profile, categories, invoices, metrics, navVatData, rawInvoices, rawSalaries, outboundVatCategories, stb.). A `useQuery` queryFn-je `await fetchDashboardData()` majd `return true` — tehát a query cache csak egy boolean-t tartalmaz, az adat a lokális state-ben él.

**Következmény:** A `useRealtimeInvalidation` invalidálja a `dashboardData` query-t, ami ugyan újrafuttatja a `fetchDashboardData`-t, de:
- Ha a fetch közben hiba lép fel, a state-ek részben frissülhetnek
- A query cache nem tartalmazza az adatot → nincs `placeholderData`, nincs stale-while-revalidate
- A `fetchDashboardData` belül 5+ párhuzamos query fut (profile, categories, invoices, aggregates, petty cash) — ha egy fail-el, az egész exception-nel áll le

**Javítás:** A dashboard adatokat szétbontani önálló `useQuery` hívásokra (profile, metrics, navVatData, analyticsRaw, pettyCash).

### A2. Index.tsx — `salary` lekérdezés `select("*")` és kliens-oldali szűrés (KÖZEPES)
**Fájl:** `src/pages/Index.tsx` (280-292)

A `fetchRawData` `select("*")`-ot használ a `salary` táblára, majd kliens-oldalon szűri `transaction_id`-re. Ez az összes béradatot letölti (beleértve a kifizetetlen tételeket is), felesleges sávszélességet használva.

**Javítás:** `.not("transaction_id", "is", null)` hozzáadása a query-hez (ahogy az Analytics.tsx-ben már megtörtént) és `.select("dátum, összeg, statusz, transaction_id")` a `select("*")` helyett.

### A3. KintlevoPage — Nincs `useRealtimeInvalidation` (KÖZEPES)
**Fájl:** `src/pages/KintlevoPage.tsx`

A Kintlévőségek oldal `useQuery`-t használ (helyes!), de **NEM hívja meg a `useRealtimeInvalidation` hookot**. Bár a realtime hook más oldalakon invalidálja a `kintlevo-nav` és `kintlevo-manual` kulcsokat, ha a user közvetlenül erre az oldalra navigál és nincs más oldal mountolva, a realtime subscription NEM aktív.

**Javítás:** `useRealtimeInvalidation(selectedCompany?.id)` hozzáadása.

### A4. Integrations oldal — useEffect/useState, nincs TanStack Query, nincs realtime (ALACSONY)
**Fájl:** `src/pages/Integrations.tsx` (35-70)

A `syncLogs` state `useEffect`-tel töltődik, nincs query cache, nincs realtime frissítés. Ha az auto-sync cron fut a háttérben, a log lista nem frissül.

### A5. UploadHistory — useEffect/useState, 3 db saját realtime channel (KÖZEPES)
**Fájl:** `src/components/UploadHistory.tsx`

Három különálló realtime subscription-t hoz létre (`upload-history-*`, `invoice-processed-*`, `salary-processed-*`), nem TanStack Query-t használ, és nem veszi igénybe a centralizált `useRealtimeInvalidation` hookot. Ha más komponens is figyeli ugyanazokat a táblákat, duplikált subscription-ok keletkeznek.

### A6. useRealtimeInvalidation — Hiányzó kulcsok (KÖZEPES)
**Fájl:** `src/hooks/useRealtimeInvalidation.ts`

Jelenlegi hiányok:
- `invoices` tábla változáskor NEM invalidálja: `linkedInvoices` (bár most már ott van — ellenőrizve: OK)
- `nav_invoices` tábla változáskor NEM invalidálja: `projects` (ha projekt hozzárendelés változik)
- `salary` tábla változáskor NEM invalidálja: `pettyCashEntries` (ha bértétel törlődik, a pettyCash nem frissül)
- Nincs `dunning-sends` invalidáció sehol

---

## B. OPTIMALIZÁLATLANSÁGOK

### B1. InvoicesPage — `select('*')` a nav_invoices-ra (MAGAS)
**Fájl:** `src/pages/InvoicesPage.tsx` (306-314)

A `navInvoices` useQuery `select('*')`-ot használ, ami a `nav_invoices` tábla összes mezőjét letölti (29 oszlop), beleértve a ritkán használtakat is (ai_categorization_reason, fetched_at, stb.). Több ezer számla esetén ez jelentős sávszélesség.

**Javítás:** Csak a szükséges mezőket select-elni (id, invoice_number, invoice_direction, invoice_issue_date, stb.).

### B2. TransactionsPage — filterOptions minden tranzakciót letölt (MAGAS)
**Fájl:** `src/pages/TransactionsPage.tsx` (177-191)

A `transactionFilterOptions` query `.select('currency, type')` **az ÖSSZES tranzakcióra** fut dátumszűrés NÉLKÜL, csak azért hogy distinct currency/type értékeket kapjon. Ha 10 000 tranzakció van, mind letöltődik.

**Javítás:** PostgreSQL RPC függvényt használni: `SELECT DISTINCT currency FROM transactions WHERE company_id = $1`, vagy `select('currency, type').limit(1000)` + kliens-oldali distinct.

### B3. Index.tsx Dashboard — Összes adat egyetlen useQuery-ben (KÖZEPES)
**Fájl:** `src/pages/Index.tsx` (200-217)

A `fetchDashboardData` egyetlen async függvényben 8+ lekérdezést futtat (profile, categories, invoices, invoice aggregates, nav aggregates, hp_settings, withdrawals, deposits, cash sales, cash expenses). Ha bármelyik fail-el, az egész dashboard nem töltődik be (catch végső `setLoading(false)`).

**Javítás:** Szétbontani 3-4 önálló useQuery-re (profile, metrics/aggregates, pettyCash, analytics).

### B4. InvoicesPage — linkedInvoices rekurzív query (KÖZEPES)
**Fájl:** `src/pages/InvoicesPage.tsx` (335-384)

A `linkedInvoicesPool` query rekurzívan keresi a bizonylatlánc elemeit (max 20 iteráció), minden iterációban új Supabase query-t futtatva. Normál esetben ez 1-2 iteráció, de pathologikus esetben 20 query-t is futtathat.

**Javítás:** Ezt egy RPC/DB function-nel lehetne megoldani (recursive CTE).

### B5. Duplikált helper függvények (ALACSONY)
- `getInitials()` és `getAvatarColor()` definiálva van **mind** az `InvoicesPage.tsx`-ben (52-77), **mind** a `PartnersPage.tsx`-ben (71-105). Ezen felül a `formatCurrency` is kétszer van definiálva: egyszer a `src/lib/utils.ts`-ben, egyszer lokálisan a `SalariesPage.tsx`-ben (74-79).

**Javítás:** Közös utility fájlba kiszervezni.

### B6. Console.log a renderben (ALACSONY)
**Fájl:** `src/pages/Index.tsx` (749)

```typescript
console.log('Index render - companyLoading:', companyLoading, ...);
```

Ez MINDEN renderkor lefut (beleértve a state változásokat is). Felesleges terhelés production-ben.

**Javítás:** Eltávolítani vagy `process.env.NODE_ENV === 'development'` mögé tenni.

### B7. ExchangeRates oldal — Nincs TanStack Query (ALACSONY)
**Fájl:** `src/pages/ExchangeRates.tsx` (51-53)

Klasszikus `useEffect` + `useState` minta API híváshoz. Nincs cache — ha a user oda-vissza navigál, minden alkalommal újratölt.

### B8. InvoicesPage — Teljes kliens-oldali szűrés és rendezés (KÖZEPES)
**Fájl:** `src/pages/InvoicesPage.tsx` (680-790)

Az összes NAV számla letöltődik az adott dátumtartományra, majd a szűrés (keresés, összeg, pénznem, projekt, kategória, fiz. mód) és rendezés kizárólag kliens-oldalon történik. Ez 5000+ számla esetén lassú lehet.

Összehasonlításul a `TransactionsPage.tsx` server-side szűrést és paginációt használ (214-234), ami hatékonyabb minta.

---

## C. ÖSSZEFOGLALÓ TÁBLA

| # | Fájl | Típus | Probléma | Súlyosság |
|---|------|-------|----------|-----------|
| A1 | `Index.tsx` | Inkonzisztencia | Hibrid useState + useQuery, nem valódi cache | MAGAS |
| A2 | `Index.tsx` | Inkonzisztencia | salary `select("*")` + kliens szűrés | KÖZEPES |
| A3 | `KintlevoPage.tsx` | Inkonzisztencia | Nincs `useRealtimeInvalidation` | KÖZEPES |
| A4 | `Integrations.tsx` | Inkonzisztencia | useEffect/useState, nincs cache/realtime | ALACSONY |
| A5 | `UploadHistory.tsx` | Inkonzisztencia | 3 saját realtime channel, nincs useQuery | KÖZEPES |
| A6 | `useRealtimeInvalidation.ts` | Inkonzisztencia | Hiányzó kulcsok (projects nav-ból, pettyCash salary-ból) | KÖZEPES |
| B1 | `InvoicesPage.tsx` | Optimalizáció | `select('*')` nav_invoices | MAGAS |
| B2 | `TransactionsPage.tsx` | Optimalizáció | filterOptions az összes tranzakciót letölti | MAGAS |
| B3 | `Index.tsx` | Optimalizáció | 8+ query egyetlen fetchDashboardData-ban | KÖZEPES |
| B4 | `InvoicesPage.tsx` | Optimalizáció | linkedInvoices rekurzív query | KÖZEPES |
| B5 | Több fájl | Optimalizáció | Duplikált helper függvények | ALACSONY |
| B6 | `Index.tsx` | Optimalizáció | console.log renderben | ALACSONY |
| B7 | `ExchangeRates.tsx` | Optimalizáció | Nincs TanStack Query | ALACSONY |
| B8 | `InvoicesPage.tsx` | Optimalizáció | Teljes kliens-oldali szűrés/rendezés | KÖZEPES |

---

## D. JAVASOLT IMPLEMENTÁCIÓS SORREND

**Fázis 1 — Gyors javítások (alacsony kockázat):**
1. `KintlevoPage.tsx` — `useRealtimeInvalidation` hook hozzáadás
2. `useRealtimeInvalidation.ts` — hiányzó query key-ek pótlása
3. `Index.tsx` — salary query `select("*")` → explicit select + server-side `transaction_id` szűrés
4. `Index.tsx` — console.log eltávolítás
5. `InvoicesPage.tsx` — `select('*')` → explicit select a nav_invoices query-re

**Fázis 2 — Optimalizációk (közepes kockázat):**
6. `TransactionsPage.tsx` — filterOptions optimalizálás (limit vagy RPC)
7. Duplikált helperek kiszervezése `src/lib/helpers.ts`-be
8. `ExchangeRates.tsx` — TanStack Query migráció

**Fázis 3 — Nagy refaktorok (magas kockázat):**
9. `Index.tsx` — `fetchDashboardData` szétbontása 4 önálló useQuery-re
10. `UploadHistory.tsx` — TanStack Query + központi realtime migráció
11. `InvoicesPage.tsx` — server-side szűrés/paginálás (TransactionsPage mintájára)

