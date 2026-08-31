# 06 — Állapotkezelés & Kontextusok

> React Context-ek, React Query, URL state, localStorage patternek.

---

## Context Hierarchia

```
ThemeContext           ← Téma (light/dark)
  └── AuthContext      ← Auth session, user, signOut, SessionGuard
    └── CompanyContext  ← Cégválasztás, cégek listája, cégváltás
      └── DateRangeContext ← Globális dátum szűrő (dateFrom, dateTo)
```

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

### Moduláris Query Key & Cache Rendszer

**Fő modulok:**
- `src/lib/cache/keys/` — Domain-szeletelt query kulcs gyárak (`invoices`, `transactions`, `partners`, `payroll`, `gl`, `accounty`)
- `src/lib/cache/invalidations.ts` — Koordinált, atomi invalidációs dispatcherek (`invalidateInvoiceQueries`, `invalidateTransactionQueries`, stb.)
- `src/lib/queryKeys.ts` — 100%-ban visszafelé kompatibilis re-export a teljes alkalmazás számára

**Előnyök és garanciák:**
- Konzisztens, atomi cache invalidáció kaszkád-kérések és race condition nélkül
- Multi-tenant, cég-szintű (`companyId`) és dátumtartomány-alapú hatókör
- Szigorú TypeScript `as const` tuple típusbiztonság a kulcsokban
- 0 beragadt szellem-állapot az inkonzisztens elnevezések felszámolásával

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

### Invoice Feature State & URL Sync (`src/features/invoices/context/InvoiceContext.tsx`)

**Fájlok:** `src/features/invoices/context/InvoiceContext.tsx` + `src/features/invoices/InvoicesFeature.tsx`

A számla oldal állapotkezelését a moduláris `<InvoiceProvider>` compound context fogja össze. Az összes szűrőt, rendezést, lapozást és dialógus-állapotot URL query paraméterekkel szinkronizálja:

| Elem | Kezelés |
|------|---------|
| **Initializálás** | `InvoiceContext`: `useState(() => searchParams.get(...))` — URL-ből olvas |
| **Szinkronizálás** | `InvoiceContext`: egységes debounced `useEffect` → `setSearchParams(..., { replace: true })` |
| **Nem-default only** | Csak az alapértéktől eltérő értékek kerülnek az URL-be |
| **Param kulcsok** | Rövid kulcsok: `q`, `cur`, `idf`, `idt`, `kpi`, `sf`, `sd`, `p`, `ps`, `paid`, `sub`, `proj`, `cat`, `pm`, `cont` |
| **Exportált konstansok** | `FILTER_URL_KEYS`, `defaultFilters` (`src/features/invoices/types`) |
| **KPI filter** | Kattintható KPI kártyák: `?kpi=matched\|suggested\|unmatched` |
| **KPI paginálás** | KPI aktív → **kliens-oldali** paginálás a teljes adathalmazból (`navInvoicesLookup`). KPI inaktív → szerver-oldali paginálás. |
| **KPI totalPages** | `kpiFilteredNavTotalPages` / `kpiFilteredSubmittedTotalPages` — KPI szűrt darabszámból számolt oldalszám |
| **KPI tab váltás** | KPI szűrő **megmarad** tab váltásnál; csak explicit user action törli |
| **Deep-linkek** | `?invoice=<id>` (sor kinyitás) és `?action=items\|view\|edit\|files` (modális ablak automatikus megnyitása) |

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
