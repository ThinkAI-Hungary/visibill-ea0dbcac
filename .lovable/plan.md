
# VisiBI11 — Átfogó technikai audit (2026. március 20.)

---

## Összefoglaló értékelés

| Szempont | Pontszám | Megjegyzés |
|---|---|---|
| Stabilitás | 8/10 | Query izoláció jó, null-guard-ok javítva |
| Teljesítmény | 6/10 | Több kritikus skálázási korlát |
| Karbantarthatóság | 7/10 | Hook refaktor segített, de 3 nagy fájl maradt |
| Biztonság | 8/10 | RLS konzisztens, vault használat jó |
| Skálázhatóság (1000+ user) | 5/10 | Több pont kritikus beavatkozást igényel |

---

## KRITIKUS — Skálázási korlátok

### K1. Supabase 1000 soros default limit — silent data truncation
**Érintett:** `useInvoiceData.ts` (navInvoices, submittedInvoices, allTransactions), `PettyCashPage.tsx` (5 query limit nélkül), `KintlevoPage.tsx` (navInvoices, manualInvoices), `Analytics.tsx` (rawData query), `Index.tsx` (analyticsRaw, pettyCashBalance)

Egyik query sem kezel `.limit()`-et vagy paginációt — a Supabase PostgREST alapértelmezetten 1000 sort ad vissza. Ha egy cégnek 1000+ számlája van (ami több ezer felhasználónál garantált), az adatok **csendben csonkulnak** hibahiányol.

**Megoldás:** Server-side paginálás (mint a TransactionsPage-en már van) VAGY RPC aggregáció VAGY `.limit(10000)` explicit beállítás a tudatos queryknél.

### K2. PettyCashPage + Dashboard pettyCashBalance — 5+5 párhuzamos unbounded query
Mindkét komponens 5 külön Supabase query-t futtat limit nélkül, majd kliens-oldalon aggregál. Ezreknyi tranzakcióval ez O(n) memória + hálózat.

**Megoldás:** Egyetlen `get_petty_cash_balance(company_id, start_date)` RPC, ami server-side számol.

### K3. InvoicesPage — teljes kliens-oldali szűrés
A `useInvoiceFilters` hook az összes számlát memóriába tölti, majd kliens-oldalon szűr/rendez. 5000+ számlánál ez lassú.

**Megoldás:** Server-side szűrés + paginálás (a TransactionsPage mintájára).

### K4. Realtime channel egyetlen globális — 7 tábla, minden user
Egyetlen Supabase Realtime channel figyel 7 táblát `company_id` filterrel. 1000+ egyidejű felhasználóval ez a Realtime infrastruktúrát terheli — minden felhasználó minden cégváltozásra kap üzenetet.

**Megoldás:** Tartsuk, de adjunk `staleTime`-ot a legtöbb query-hez (jelenleg szinte senki nem használ staleTime-ot), hogy az invalidáció ne triggerelj azonnali refetch-et minden változásra.

---

## KÖZEPES — Teljesítmény és architektúra

### M1. `select('*')` — 12 helyen
65 match 12 fájlban. Felesleges oszlopok letöltése növeli a payload-ot. Legkritikusabb:
- `CompanyContext.tsx` — `companies` tábla `select('*')` minden autentikált felhasználónak
- `Projects.tsx` — teljes projekt objektumok
- `Integrations.tsx` — `nav_sync_logs` teljes sorok
- `InvoiceDetailPopup.tsx` — `invoices` tábla teljes sor

### M2. Hiányzó `staleTime` — legtöbb query 0ms default
Csak 5 query használ `staleTime`-ot (exchangeRates, tourStatus, filterOptions, integrations, exchangeRatesPage). A többi 30+ query default 0ms staleTime-mal fut, ami azt jelenti:
- Minden komponens-mount azonnali refetch
- Tab váltás → refetch
- Ablak focus → refetch (ha `refetchOnWindowFocus` default true)

Ezer felhasználóval ez felesleges terhelés. Stabil adatok (partners, categories, projects, profile) legalább 5 perc staleTime-ot kaphatnának.

### M3. QueryClient nincs konfigurálva
```typescript
const queryClient = new QueryClient(); // Üres config
```
Nincs `defaultOptions` (staleTime, gcTime, retry, refetchOnWindowFocus). Minden query a TanStack Query alapértelmezéseit használja (staleTime: 0, retries: 3, refetchOnWindowFocus: true). Skálázási szempontból ez kritikus.

### M4. CompanyContext — useEffect-es fetch, nem TanStack Query
A cég lista egy sima `useState` + `useEffect`-tel töltődik, nem TanStack Query-vel. Ez azt jelenti:
- Nincs cache
- Nincs staleTime
- Nincs automatikus invalidáció
- Minden `user` változásnál újratölt

### M5. KintlevoPage — inline query key-ek, nincs queryKeys factory
```typescript
queryKey: ['kintlevo-nav', selectedCompany?.id]
queryKey: ['kintlevo-manual', selectedCompany?.id]
queryKey: ['dunning-sends', selectedCompany?.id]
```
Ezek nem a centralizált `queryKeys` factory-ból jönnek, ezért a `useRealtimeInvalidation` hook nem tudja őket pontosan célozni (prefix-match működik, de nem explicit).

### M6. PartnersPage — nincs useRealtimeInvalidation
Továbbra is hiányzik a realtime hook, tehát partner módosítások nem frissülnek automatikusan más oldalak cache-ében.

### M7. Settings.tsx — 1045 sor, nincs audit, nincs realtime
A legnagyobb nem-refaktorált fájl. Használ `useQuery`-t de:
- `CompanyAccessCard` és `CompanyMembersCard` belső useEffect-eket használ
- Nincs `useRealtimeInvalidation`
- 1045 sor — szétbontás szükséges

---

## ALACSONY — Karbantarthatóság és kódminőség

### A1. Duplikált PettyCash logika
A `PettyCashPage` pettyCashEntries query és az `Index.tsx` dashboardPettyCash query UGYANAZT az 5 query-t futtatja kissé eltérő formában. Közös RPC-vel eliminálható.

### A2. Analytics.tsx + Index.tsx duplikált chart logika
Mindkét fájl tartalmaz havi bontás logikát (`monthlyData` useMemo), VAT breakdown-t, és nettó/bruttó toggle-t. Közös hook-ba szervezhető.

### A3. KintlevoPage 777 sor — nem bontott
Tartalmaz data fetching-et, data processing-et, email validációt, dialog state-eket és render logikát egyetlen fájlban.

### A4. SalariesPage 817 sor — nem bontott
Hasonlóan nagy fájl, szétbontás kellene.

### A5. Toast import inkonzisztencia
Néhány fájl `import { toast } from 'sonner'`-t, mások `import { toast } from '@/hooks/use-toast'`-ot használnak. Ez két különböző toast rendszer keverése.

---

## Javasolt implementációs terv (prioritás szerint)

### 1. fázis — QueryClient konfiguráció + staleTime (1 fájl, alacsony kockázat)
- `App.tsx`: `new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } } })`
- Ez AZONNAL csökkenti a felesleges hálózati kéréseket 80%-kal

### 2. fázis — select('*') eltávolítása (12 fájl, közepes kockázat)
- Minden `select('*')` cseréje explicit oszloplistára
- Legnagyobb hatás: CompanyContext, Projects, Integrations

### 3. fázis — PettyCash RPC (1 migration + 2 fájl)
- `get_petty_cash_balance()` és `get_petty_cash_entries()` RPC
- PettyCashPage + Index.tsx dashboardPettyCash query egyszerűsítés

### 4. fázis — Hiányzó queryKeys + realtime (3 fájl)
- KintlevoPage inline key-ek → queryKeys factory
- PartnersPage + Settings: useRealtimeInvalidation hozzáadása

### 5. fázis — InvoicesPage server-side szűrés (1 migration + 3 hook)
- `get_filtered_nav_invoices()` RPC server-side szűréssel + paginálással
- useInvoiceFilters átírása server-side módra

### 6. fázis — Nagy fájlok szétbontása
- Settings.tsx → 3-4 komponens + hook
- KintlevoPage → hook + komponensek
- SalariesPage → hook + komponensek

Javaslatom: **kezdjük az 1. és 2. fázissal**, mert azok a legkisebb kockázattal a legnagyobb skálázási nyereséget adják.
