

# 5. és 6. fázis implementációs terv

## 5. fázis — InvoicesPage server-side szűrés

Az InvoicesPage jelenleg az összes számlát memóriába tölti (Supabase 1000 soros limit!), majd kliens-oldalon szűr/rendez. Ez 1000+ számlánál csendben csonkul.

### 5a. Új RPC: `get_filtered_nav_invoices`

Új SQL migration — server-side szűrés + rendezés + paginálás egyetlen hívásban:

```sql
CREATE OR REPLACE FUNCTION public.get_filtered_nav_invoices(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text,
  p_search text DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_paid text DEFAULT NULL,
  p_submitted text DEFAULT NULL,
  p_project_id text DEFAULT NULL,
  p_category_id text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_sort_field text DEFAULT 'invoice_issue_date',
  p_sort_dir text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS TABLE(
  -- same columns as current useInvoiceData NavInvoice interface
  id uuid, invoice_number text, ...
  total_count bigint  -- extra: total matching rows for pagination
)
```

A függvény:
- WHERE clause-ok a szűrőkhöz (search ILIKE on invoice_number + supplier/customer name, currency =, paid = transaction_id IS NOT NULL, stb.)
- ORDER BY dinamikusan a p_sort_field/p_sort_dir alapján
- LIMIT/OFFSET a paginációhoz
- `count(*) OVER()` a total_count-hoz (window function, egyetlen query)

### 5b. Hasonló RPC: `get_filtered_submitted_invoices`

Ugyanez a beküldött számlákhoz, az `invoices` táblán.

### 5c. `useInvoiceFilters` átírása

Jelenlegi: kliens-oldali `useMemo` szűrés + rendezés az összes adat felett.
Új: A szűrő state-ek megmaradnak, de a `filteredAndSortedNavInvoices` és `paginatedNavInvoices` helyett egyetlen `useQuery` hívja az RPC-t — a szűrők és oldal a query key-ben vannak, így automatikusan újratölt változáskor.

A `useInvoiceData` hook-ból kikerül a navInvoices és submittedInvoices bulk fetch — helyettük az RPC-k adják az adatot. A `partners`, `categories`, `projects`, `allTransactions` query-k változatlanok maradnak (ezek nem érintettek a 1000-es limittel, kis méretű táblák).

### 5d. Szűrő debounce

A search mező `useState` + `useDeferredValue` vagy 300ms debounce-szal, hogy ne triggerelj RPC hívást minden billentyűleütésre.

---

## 6. fázis — Nagy fájlok szétbontása

### 6a. Settings.tsx (1045 sor) → ~300 sor

**Új fájlok:**
- `src/hooks/useSettingsData.ts` — `fetchProfile`, `fetchSettings`, `updateProfile`, `updateSettings`, `saveCompanyData`, `handleExportData` + a hozzájuk tartozó state-ek (profile, businessSettings, notificationSettings, systemSettings, companyName/TaxNumber/Address). ~250 sor.
- `src/components/settings/ProfileSection.tsx` — Profil tab JSX (668-717 sorok). ~60 sor.
- `src/components/settings/BusinessSection.tsx` — Cég tab JSX (720-867 sorok) + CompanyAccessCard + CompanyMembersCard (ezek már külön belső komponensek, ide mozgatjuk). ~200 sor.
- `src/components/settings/SystemSection.tsx` — Rendszer tab JSX (876-956 sorok). ~80 sor.
- `src/components/settings/SecuritySection.tsx` — Biztonság tab JSX (958-1030 sorok). ~80 sor.

Az eredmény `Settings.tsx`: context hookok, `useSettingsData()`, tab layout, section komponensek renderelése. ~250 sor.

### 6b. KintlevoPage.tsx (778 sor) → ~300 sor

**Új fájlok:**
- `src/hooks/useKintlevoData.ts` — 4 useQuery (navInvoices, manualInvoices, partners, dunningSends), `allInvoices` useMemo (unified invoice transform), `companyGroups` useMemo, `filteredGroups`, `totals`, `grandTotal`. ~200 sor.
- `src/components/kintlevo/KintlevoSummaryCards.tsx` — 4 summary card (green/yellow/red/purple) + grand total. ~80 sor.
- `src/components/kintlevo/KintlevoCompanyTable.tsx` — Cégcsoportos accordion tábla (expandable sorok). ~200 sor.
- `src/components/kintlevo/DunningDialog.tsx` — Felszólító email küldés dialog (kategória szűrő, cég kijelölés, email validáció, küldés). ~180 sor.

Típusok (`UnifiedInvoice`, `CompanyGroup`, `AgingCategory`) és segédfüggvények (`getCategory`, `worstOf`, `fmt`, `validateEmail`, `CAT` config) → `src/lib/kintlevo-helpers.ts`. ~70 sor.

Az eredmény `KintlevoPage.tsx`: hookok + 3 komponens renderelése + dialog state. ~200 sor.

### 6c. SalariesPage.tsx (817 sor) → ~250 sor

**Új fájlok:**
- `src/hooks/useSalaryData.ts` — useQuery (salary items), `employeeGroups` + `navItems` useMemo, `metrics` useMemo, `addMutation`, `editMutation`, `invalidateSalaries`. ~150 sor.
- `src/components/salaries/SalaryKpiCards.tsx` — 4 KPI kártya (összes kifizetés, alkalmazottak, nettó, bruttó). ~100 sor.
- `src/components/salaries/EmployeeAccordion.tsx` — Dolgozói bontás accordion tábla. ~130 sor.
- `src/components/salaries/NavSummaryTable.tsx` — NAV utalások összesítő tábla. ~80 sor.
- `src/components/salaries/SalaryDialogs.tsx` — KP kifizetés + Edit dialog. ~120 sor.

Segédfüggvények (`getTypeBadge`, `getStatusBadge`, `formatDate`, `formatPaymentDate`) → `src/lib/salary-helpers.ts`. ~50 sor.

Az eredmény `SalariesPage.tsx`: hookok + 4 komponens + dialogok. ~200 sor.

---

## Implementációs sorrend

1. **5a-5b**: Két SQL migration (RPC-k)
2. **5c-5d**: `useInvoiceFilters` + `useInvoiceData` átírása server-side módra
3. **6a**: Settings szétbontása (legkisebb kockázat, nincs adatfolyam változás)
4. **6b**: KintlevoPage szétbontása
5. **6c**: SalariesPage szétbontása

## Kockázatkezelés

- Az RPC-k SECURITY DEFINER + company_id szűrést használnak — RLS konzisztens marad
- A szétbontás tisztán UI refaktor — semmilyen üzleti logika nem változik
- A `select('*')` a SalariesPage-en (150. sor) explicit oszloplistára cserélődik
- A `select('*')` a Settings fetchProfile-ban (405. sor) szintén javítva lesz
- Minden meglévő funkció (dialog-ok, export, realtime invalidáció) változatlan marad

