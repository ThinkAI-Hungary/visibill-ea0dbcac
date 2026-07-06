# 06 — Állapotkezelés & Kontextusok

> React Context-ek, React Query, URL state, localStorage patternek.

---

## Context Hierarchia

```
ThemeContext           ← Téma (light/dark)
  └── AuthContext      ← Auth session, user, signOut
    └── CompanyContext  ← Cégválasztás, cégek listája
      └── DateRangeContext ← Globális dátum szűrő
        └── SubscriptionContext ← Előfizetési szint, limit-ek
```

---

## ThemeContext

**Fájl:** `contexts/ThemeContext.tsx`

| API | Típus | Leírás |
|-----|-------|--------|
| `theme` | `"light" \| "dark"` | Jelenlegi téma |
| `setTheme(theme)` | function | Téma beállítás |

**Megvalósítás:**
- localStorage-ból olvassa a `eaisybill_theme` kulcsot
- `document.documentElement.classList.add/remove("dark")` — HTML element szinten
- `useMemo` + `useCallback` a stabil context value-ért (megakadályozza felesleges consumer re-rendereket)
- `no-transitions` class: tiltja a per-element transition-öket témaváltás alatt
- `theme-switching` class: pauseolja az animációkat (`animation-play-state: paused`) — NEM reseteli, megakadályozza a page-animate újraindulását
- Double `requestAnimationFrame` a transition/animation újraengedélyezéséhez

---

## AuthContext

**Fájl:** `contexts/AuthContext.tsx`

| API | Típus | Leírás |
|-----|-------|--------|
| `user` | `User \| null` | Supabase user objektum |
| `session` | `Session \| null` | Auth session |
| `isLoading` | `boolean` | Auth állapot betöltődik |
| `isSigningOut` | `boolean` | Kijelentkezés folyamatban |
| `isPasswordRecovery` | `boolean` | Jelszó recovery flow |
| `clearPasswordRecovery()` | function | Recovery flag törlése |
| `signOut()` | function | Kijelentkezés |
| `sessionGuard` | object | Idle timeout state |

**Session Guard:**
- `sessionGuard.showWarning` — IdleWarningModal megjelenítése
- `sessionGuard.secondsLeft` — Hátralévő másodpercek
- `sessionGuard.stayActive()` — Session meghosszabbítás

---

## CompanyContext

**Fájl:** `contexts/CompanyContext.tsx`

| API | Típus | Leírás |
|-----|-------|--------|
| `companies` | `Company[]` | User összes cége |
| `selectedCompany` | `Company \| null` | Kiválasztott cég |
| `setSelectedCompany(company)` | function | Cég kiválasztás |
| `isInitialLoading` | `boolean` | Cégek betöltődnek |

**Cég perzisztencia:** `selectedCompanyId` localStorage kulcs.

---

## DateRangeContext

**Fájl:** `contexts/DateRangeContext.tsx`

| API | Típus | Leírás |
|-----|-------|--------|
| `dateFrom` | `Date` | Kezdő dátum |
| `dateTo` | `Date` | Záró dátum |
| `dateFromFormatted` | `string` | `YYYY-MM-DD` formátum |
| `dateToFormatted` | `string` | `YYYY-MM-DD` formátum |
| `setDateFrom(date)` | function | Kezdő dátum beállítás |
| `setDateTo(date)` | function | Záró dátum beállítás |
| `setThisMonth()` | function | Aktuális hónap preset |
| `setPreviousMonth()` | function | Előző hónap preset |
| `setThisYear()` | function | Aktuális év preset |

**Perzisztencia:** `eaisybill_date_range` localStorage kulcs.

---

## SubscriptionContext

**Fájl:** `contexts/SubscriptionContext.tsx`

| API | Típus | Leírás |
|-----|-------|--------|
| Előfizetési szint | string | Free / Pro / Enterprise |
| Limitek | object | Használati korlátok |

---

## React Query Konfiguráció

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 perc — adat „friss" marad
      gcTime: 10 * 60 * 1000,         // 10 perc garbage collection
      refetchOnWindowFocus: false,     // Nem frissít ablakfókuszra
      retry: 1,                        // 1 retry hiba esetén
    },
  },
});
```

### Query Key Rendszer

**Fájl:** `lib/queryKeys.ts`

Centralizált query key factory az összes Supabase lekérdezéshez, biztosítva:
- Konzisztens cache invalidation
- Company-scoped cache-elés
- Date-range-scoped lekérdezések

---

## localStorage Kulcsok

**Fájl:** `lib/constants.ts`

### Security-Sensitive (törlődik sign-out-kor)

| Kulcs | Leírás |
|-------|--------|
| `selectedCompanyId` | Kiválasztott cég ID |
| `sb-vxxgvdlqvvchtlmqnrqf-auth-token` | Supabase auth token |
| `supabase.auth.token` | Legacy auth token |

### UX Preferences (megmarad sign-out után)

| Kulcs | Leírás |
|-------|--------|
| `eaisybill_theme` | Téma preferencia |
| `eaisybill_date_range` | Dátum szűrő |
| `eaisybill_dashboard_show_brutto` | Bruttó/nettó megjelenítés |
| `eaisybill_dashboard_chart_lines` | Chart vonal beállítások |
| `eaisybill_last_active` | Utolsó aktivitás timestamp |
| `sidebar:state` | Sidebar expand/collapse |

### Safe Storage

**Fájl:** `lib/storage.ts`

Wrapper a localStorage körül, ami try/catch-el kezeli a storage kvóta és privacy mode hibákat:

```tsx
safeStorage.getItem(key)     // → string | null
safeStorage.setItem(key, v)  // → boolean (sikerült-e)
safeStorage.removeItem(key)  // → boolean
safeStorage.key(index)       // → string | null
safeStorage.length           // → number
```

---

## Realtime State — LiveNotificationProvider

**Fájl:** `components/LiveNotificationProvider.tsx` (~38KB)

Globális Supabase Realtime listener a `ProtectedLayout`-ban mountolva:

### Figyelt Táblák (19)

| Tábla | Esemény | Akció |
|-------|---------|-------|
| `salary` | INSERT | Toast + cache invalidation |
| `salary_files` | UPDATE (→completed) | Toast + cache invalidation |
| `invoices` | INSERT | Toast (upload ID-ként deduplikálva) |
| `invoice_uploads` | UPDATE (→completed/processed) | Toast |
| `invoice_uploads` | UPDATE (→cmr_attached) | Toast (Truck) |
| `invoice_uploads` | UPDATE (→cmr_escalated) | Toast (AlertTriangle, destructive) |
| `nav_invoices` | * | Cache invalidation |
| `transactions` | INSERT | Toast + azonnali cache frissítés |
| `transaction_uploads` | UPDATE (→completed) | Toast + force invalidation |
| `partners` | * | Cache invalidation |
| `categories` | * | Cache invalidation |
| `projects` | * | Cache invalidation |
| `dunning_sends` | * | Cache invalidation |
| `nav_invoice_items` | * | GL cache invalidation |
| `invoice_items` | * | GL cache invalidation |
| `nav_sync_logs` | * | Cache invalidation |
| `report_uploads` | UPDATE (→completed/processed) | Toast (30s replay protection) |
| `courier_reports` | * | Cache invalidation (nincs toast) |
| `shipments` | * | Cache invalidation |
| `shipment_matches` | * | Cache invalidation |
| `transport_documents` | INSERT + UPDATE | Toast (matched/orphaned/escalated) + Cache |

### Invalidation Stratégia

```tsx
// Debounced invalidation — 500ms, company-scoped
const invalidate = (...keys: string[]) => {
  keys.forEach(key => {
    queryClient.invalidateQueries({ queryKey: [key, companyId] });
  });
};
```

### Tab Visibility — Feltételes Cache Invalidáció

A `visibilitychange` event-re a provider **feltételesen** invalidálja a cache-t:

```
Tab háttérbe kerül (hidden) → timestamp mentése
Tab visszajön (visible) →
  ├─ Csatorna leszakadt (state ≠ joined) → Reconnect + MINDIG invalidál
  ├─ Csatorna aktív ÉS távollét > 2 perc → Invalidál (browser throttle kockázat)
  └─ Csatorna aktív ÉS távollét ≤ 2 perc → SKIP (nincs felesleges re-render)
```

> **Fix:** `07a1723` (2026-06-11) — korábban feltétel nélkül invalidált ~30 query-t minden tab visszaváltáskor, ami zavaró UI villanást okozott.

---

## URL State Management

### useUrlTab Hook

```tsx
const [tab, setTab] = useUrlTab('invoices', 'outbound_nav', VALID_TABS);
```

| Tulajdonság | Viselkedés |
|-------------|-----------|
| **URL szinkron** | Tab állapot az URL-ben: `/:companyId/:dateRange/invoices/outbound_nav` |
| **Validáció** | Ha az URL-ben érvénytelen tab van, a default-ra esik vissza |
| **Replace** | `navigate({ ... }, { replace: true })` — nem ad history entry-t |
| **Search megőrzés** | `location.search` megmarad tab váltáskor |
| **Microtask defer** | `queueMicrotask()` — megelőzi a mid-render setState hibákat |

### Invoice Filter URL Sync

**Fájlok:** `hooks/useInvoiceFilters.ts` + `pages/InvoicesPage.tsx`

A számla oldal összes szűrőjét URL query params-ként szinkronizálja, lehetővé téve a link megosztást:

| Elem | Kezelés |
|------|---------|
| **Initializálás** | `useInvoiceFilters`: `useState(() => searchParams.get(...))` — URL-ből olvas |
| **Szinkronizálás** | `InvoicesPage`: egységes `useEffect` → `setSearchParams()` |
| **Nem-default only** | Csak az alapértéktől eltérő értékek kerülnek az URL-be |
| **Param kulcsok** | Rövid kulcsok: `q`, `cur`, `idf`, `idt`, `kpi`, `sf`, `sd`, `p`, `ps` stb. |
| **Exportált konstansok** | `FILTER_URL_KEYS`, `defaultFilters` (`useInvoiceFilters.ts`) |
| **KPI filter** | Kattintható KPI kártyák: `?kpi=matched\|suggested\|unmatched` |
| **KPI paginálás** | KPI aktív → **kliens-oldali** paginálás a teljes adathalmazból (`navInvoicesLookup`). KPI inaktív → szerver-oldali paginálás. |
| **KPI totalPages** | `kpiFilteredNavTotalPages` / `kpiFilteredSubmittedTotalPages` — KPI szűrt darabszámból számolt oldalszám |
| **KPI tab váltás** | KPI szűrő **megmarad** tab váltásnál; csak explicit user action törli |
| **Megőrzés** | `?invoice=` és `?action=` parametérek megőrződnek |

### useFilterPersistence Hook

**Fájl:** `hooks/useFilterPersistence.ts`

Szűrő állapot localStorage-ba mentése oldalanként.


## Custom Hookek Áttekintése

| Hook | Felelősség |
|------|-----------|
| `useAppReady` | Auth + company + role resolved gate |
| `useUserRole` | Employee vs owner szerep lekérdezés |
| `useSessionGuard` | Idle timeout + figyelmeztetés |
| `useIdleTimeout` | Inaktivitás detektálás |
| `useDashboardData` | Dashboard KPI-k (26KB hook!) |
| `useInvoiceData` | Számla lekérdezések |
| `useInvoiceFilters` | Számla szűrők állapota + URL query param szinkron |
| `useInvoiceMutations` | Számla CRUD műveletek |
| `useTransactionData` | Tranzakció lekérdezések |
| `useKintlevoData` | Kintlévőség adatok |
| `useSalaryData` | Bér adatok |
| `useFixedAssets` | TENY adatok |
| `useTimeEntries` | Munkaidő bejegyzések |
| `useLeaveRequests` | Szabadság kérelmek |
| `useCompanySettings` | Cég beállítások |
| `useCompanyLocations` | Cég telephelyek |
| `useEmployeeRates` | Alkalmazott óradíjak |
| `useExchangeRates` | Deviza árfolyamok |
| `useCourierReportData` | Futár riport adatok |
| `useActivePreset` | Aktív szűrő preset |
| `useKeyboardShortcuts` | Billentyűparancsok |
| `useCopyToClipboard` | Vágólapra másolás |
| `useUnsavedChanges` | Mentetlen változások figyelmeztetés |
| `useDashboardPreferences` | Dashboard megjelenítési preferenciák |
| `useComputedStatus` | Számított állapot |
| `useDepreciation` | Értékcsökkenés számítás |
| `useProjectList` | Projekt lista |
| `useProjectLaborCosts` | Projekt munkaerő költségek |
| `use-mobile` | Mobil breakpoint detektálás |
| `use-toast` | Toast értesítések |
