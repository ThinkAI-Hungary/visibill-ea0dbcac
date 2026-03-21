

# React Performance & Design Pattern Audit - Visibill

## Összefoglaló

A kódbázis vizsgálata három fő fájlra koncentrált: **Index.tsx (1424 sor)**, **TransactionsPage.tsx (655 sor)**, és **SalariesPage.tsx (104 sor)**. A SalariesPage mintaszerűen moduláris. A másik kettő komoly refaktorálást igényel.

---

## 1. COMPONENT MONOLITHS - Kritikus

### Index.tsx (1424 sor) - A fő probléma

Ez a fájl egyetlen komponensben tartalmaz:
- 9 TanStack Query hívást (~200 sor adatlekérés)
- VAT breakdown feldolgozás (~130 sor komplex logika a queryFn-ben)
- Havi chart adat számítás (~70 sor useMemo)
- Devizaváltási logika (~20 sor)
- ~15 useState hook
- Welcome szekció + Nettó/Bruttó toggle
- 8 MetricCard renderelés (~90 sor JSX inline számításokkal)
- ÁFA szekció: bar chart + 2 breakdown tábla (~140 sor JSX)
- Revenue/Expenses chart: Recharts AreaChart + 6 checkbox filter (~200 sor JSX)
- Havi összesítő grid (20 sor)
- RecentInvoices + ProjectBreakdown + SubscriptionUsage
- Profil kártya (~40 sor)
- Quick Actions grid (~50 sor)
- InvoiceImageDialog + ProductTour

**Javasolt feldarabolás:**

```text
src/pages/Index.tsx (orchestrator, ~150 sor)
├── src/hooks/useDashboardData.ts          (összes query + metrics)
├── src/hooks/useDashboardPreferences.ts   (showBrutto, chartLines, currency - localStorage)
├── src/components/dashboard/DashboardWelcome.tsx
├── src/components/dashboard/DashboardMetrics.tsx    (8 MetricCard grid)
├── src/components/dashboard/VatSection.tsx           (ÁFA bar + breakdown táblák)
├── src/components/dashboard/RevenueExpensesChart.tsx  (Recharts AreaChart + filters)
├── src/components/dashboard/ProfileSummary.tsx
└── src/components/dashboard/QuickActions.tsx
```

### TransactionsPage.tsx (655 sor) - Közepes

Nem annyira súlyos, de a szűrő panel (~80 sor JSX), a tábla renderelés (~140 sor JSX), és az üzleti logika (helper függvények, export) egy fájlban van.

**Javasolt feldarabolás:**

```text
src/pages/TransactionsPage.tsx (~200 sor orchestrator)
├── src/hooks/useTransactionData.ts         (queries + filters + pagination)
├── src/components/transactions/TransactionFilters.tsx
├── src/components/transactions/TransactionTable.tsx
└── src/components/transactions/TransactionRow.tsx
```

---

## 2. UNNECESSARY RE-RENDERS - Magas prioritás

### Index.tsx - Minden újrarenderelődik mindenre

Amikor a felhasználó:
- A `showBrutto` toggle-t váltja → az **egész 1424 soros komponens** újrarenderelődik, beleértve a Profil kártyát, Quick Actions-t, RecentInvoices-t, stb.
- A `selectedCurrency`-t váltja → ugyanez
- A `vatSectionOpen` / `revenueSectionOpen` collapsible-t nyitja/zárja → ugyanez

**Javítás:** A feldarabolás után a child komponensek `React.memo`-val burkolhatók. Különösen:
- `RevenueExpensesChart` - nehéz Recharts renderelés, csak `monthlyData` + `chartLines` + `showBrutto` változásakor kell újrarajzolni
- `VatSection` - csak `navVatData` + `selectedCurrency` változásakor
- `ProfileSummary` - szinte soha nem változik
- `QuickActions` - statikus, soha nem változik

### DateRangeContext hatás

A `useDateRange()` hívás az Index.tsx-ben van → bármilyen dátumváltás az egész dashboard-ot újrarendereli. A feldarabolás után csak azok a child-ok renderelődnének újra, amik tényleg használják az adatot (a query-k amúgy is a query key-n keresztül reagálnak).

---

## 3. HOOKS MISUSE

### Derived state useEffect-tel (anti-pattern)

**TransactionsPage.tsx 131-133. sor:**
```typescript
useEffect(() => {
  setFilters(prev => ({ ...prev, dateFrom, dateTo }));
}, [dateFrom, dateTo]);
```
Ez klasszikus derived state anti-pattern. A `filters.dateFrom` és `filters.dateTo` mindig egyenlő kell legyen a context-ből jövő értékekkel, tehát nem kellene külön state-ben tárolni. Javítás: a `dateFrom`/`dateTo`-t közvetlenül a context-ből kell használni, nem a filters objektumból.

**TransactionsPage.tsx 279-281. sor:**
```typescript
useEffect(() => {
  setCurrentPage(1);
}, [filters.search, filters.dateFrom, ...]);
```
Ez elfogadható, mert side-effect (pagination reset), nem derived state.

**Index.tsx 259-263. sor:**
```typescript
useEffect(() => {
  if (tourCompleted === false) {
    setTimeout(() => setShowTour(true), 500);
  }
}, [tourCompleted]);
```
Elfogadható (side-effect), de a `setTimeout` cleanup-ja hiányzik - memory leak potenciál.

### useState túlzott használata

**Index.tsx:** 15 useState hook egyetlen komponensben. A `showBrutto`, `chartLines`, `vatSectionOpen`, `revenueSectionOpen` logikailag összetartoznak (UI preferences). Ezeket egy `useReducer`-be vagy egy dedikált `useDashboardPreferences` hook-ba kellene összevonni.

**TransactionsPage.tsx:** A `filters` objektum jól van kezelve (egyetlen useState objektum), de a `sortField` + `sortDirection` + `currentPage` + `pageSize` lehetne egy `useReducer`.

---

## 4. EXPENSIVE CALCULATIONS

### Hiányzó useMemo / useCallback

**Index.tsx:**
- `convertAmount` (570. sor) és `convertToSelectedCurrency` (576. sor) - ezek minden rendereléskor újra létrejönnek. `useCallback`-be kellene, mert child-oknak is átadhatók.
- `displayedPeriod` (203. sor) - minden rendereléskor újra számolódik. `useMemo`-ba.
- `currencies` tömb (205-216. sor) - statikus konstans, de a komponensen belül van definiálva → minden rendereléskor új referencia. Ki kellene emelni a komponensen kívülre (vagy `useMemo`).

**TransactionsPage.tsx:**
- `getRowBackgroundClass`, `getTypeBgClass`, `isAutoApproved` - ezek jól vannak a komponensen kívül definiálva.
- `handleExport` (301. sor) - nem kap `useCallback`-et, de nem is adják át child-nak, tehát elfogadható.
- `handleSort`, `clearFilters` - szintén inline, de nem kritikus.

### Meglevő jó useMemo használat
- `monthlyData` (589. sor) - helyesen useMemo-ban
- `categoryBreakdownData` (688. sor) - helyesen useMemo-ban
- `filteredTransactions` (225. sor) - helyesen useMemo-ban
- `vatBarData` (677. sor) - helyesen useMemo-ban

---

## 5. DATA FETCHING PATTERNS

### Prop drilling

**Index.tsx 794-870. sor:** A metrics cards renderelése inline-ban történik, ahol `navVatData`, `metrics`, `showBrutto`, `selectedCurrency`, `convertToSelectedCurrency` mind lokálisan számolódik és közvetlenül használódik. Ha ezek child-ba kerülnek, a szükséges adatok props-ként mennek át. Ez nem igazi prop drilling (csak 1 szint mélység), de a `convertToSelectedCurrency` függvény átadása 3+ szintre problémás lenne.

**Javítás:** A `useDashboardData` hook-ot a child-ok is közvetlenül hívhatnák (TanStack Query cache-ből jönne, nem dupla fetch).

### Query staleTime hiányzik

- `recentInvoices`, `categories`, `dashboardData`, `dashboardAnalytics` query-k: nincs explicit `staleTime` → alapértelmezett 0, azaz minden mount-nál refetch. Érdemes lenne `staleTime: 30_000` (30 mp) beállítani a dashboard query-knél.
- Az `exchangeRates` jól van: `staleTime: 60 * 60 * 1000` (1 óra).

---

## Implementációs terv (prioritás szerint)

### 1. fázis: Index.tsx feldarabolása (legnagyobb hatás)
1. **`useDashboardData.ts`** hook létrehozása - az összes query (profile, metrics, navVatData, pettyCash, analyticsRaw, vatBreakdown, categories, invoices, exchangeRates, tourStatus) ide kerül
2. **`useDashboardPreferences.ts`** hook - showBrutto, chartLines, selectedCurrency, vatSectionOpen, revenueSectionOpen, localStorage persistencia
3. **`VatSection.tsx`** komponens - ÁFA bar chart + breakdown táblák (888-1037. sor, ~150 sor JSX) + `React.memo`
4. **`RevenueExpensesChart.tsx`** komponens - Recharts AreaChart + havi összesítő + checkbox filterek (1042-1286. sor, ~245 sor JSX) + `React.memo`
5. **`DashboardMetrics.tsx`** komponens - 8 MetricCard grid (794-890. sor) + `React.memo`
6. **`ProfileSummary.tsx`** és **`QuickActions.tsx`** - statikus szekciók kiemelése + `React.memo`
7. **Index.tsx** visszavágása ~150 soros orchestratorra

### 2. fázis: Anti-pattern javítások
1. TransactionsPage: `filters.dateFrom`/`dateTo` derived state megszüntetése - közvetlenül a context-ből használni
2. Index.tsx: `setTimeout` cleanup hozzáadása a tour useEffect-hez
3. `currencies` konstans kiemelése a komponensen kívülre
4. `convertToSelectedCurrency` → `useCallback`
5. Query-k `staleTime` beállítása (30s dashboard, 5min filter options)

### 3. fázis: TransactionsPage modularizáció
1. **`useTransactionData.ts`** hook (queries + server filters + pagination state)
2. **`TransactionFilters.tsx`** komponens
3. **`TransactionTable.tsx`** + **`TransactionRow.tsx`** komponensek

### Nem szükséges javítani
- **SalariesPage.tsx** - már mintaszerűen moduláris (104 sor, hook-ba kiszervezett logika, child komponensek)
- **useSalaryData.ts** - jól strukturált, aggregation useMemo-ban
- **MetricCard.tsx** - egyszerű, prop-vezérelt, nem igényel memo-t (olcsó renderelés)

