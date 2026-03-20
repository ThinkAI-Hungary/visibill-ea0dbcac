
# VisiBI11 — Skálázási optimalizáció terv

## Elvégzett fázisok

### ✅ 1. fázis — QueryClient konfiguráció
- `staleTime: 5 * 60 * 1000`, `gcTime: 10 * 60 * 1000`, `refetchOnWindowFocus: false`, `retry: 1`

### ✅ 2. fázis — select('*') eltávolítása (12 fájl)
- CompanyContext, Projects, Integrations, SubscriptionContext, EmailAliasManager, InvoiceDetailPopup, EmailPreferences, PettyCashPage, Onboarding, Index, InvoiceItemsDialog, TransactionDetailsDialog

### ✅ 3. fázis — PettyCash RPC aggregáció
- `get_petty_cash_balance(p_company_id)` RPC létrehozva
- Index.tsx dashboardPettyCash: 5 query → 1 RPC hívás

### ✅ 4. fázis — queryKeys + realtime
- KintlevoPage: 4 inline key → queryKeys factory
- Integrations: syncLogs → queryKeys factory
- PartnersPage: queryKeys factory + useRealtimeInvalidation + select('*') eltávolítás
- useRealtimeInvalidation: partners tábla hozzáadva

### ✅ 5. fázis — InvoicesPage server-side szűrés
- `get_filtered_nav_invoices()` RPC létrehozva (szűrés + rendezés + paginálás SQL-ben)
- `get_filtered_submitted_invoices()` RPC létrehozva
- Indexek hozzáadva: `idx_nav_invoices_company_direction_date`, `idx_invoices_company_direction_date`
- `useInvoiceFilters` átírva server-side módra (useDeferredValue debounce)
- `useInvoiceData` egyszerűsítve: bulk NAV fetch eltávolítva
- Nincs többé 1000 soros Supabase limit probléma

### ✅ 6. fázis — Nagy fájlok szétbontása

#### ✅ 6.0 — Helper és hook fájlok létrehozva
- `src/lib/kintlevo-helpers.ts` — típusok + segédfüggvények
- `src/hooks/useKintlevoData.ts` — adatlekérés + feldolgozás hook
- `src/lib/salary-helpers.ts` — típusok + segédfüggvények
- `src/hooks/useSalaryData.ts` — adatlekérés + mutációk hook

#### ✅ 6b. KintlevoPage.tsx átírása (778 → ~75 sor)
- `src/components/kintlevo/KintlevoSummaryCards.tsx` — 4 összesítő kártya
- `src/components/kintlevo/KintlevoCompanyTable.tsx` — cégcsoportos tábla
- `src/components/kintlevo/DunningDialog.tsx` — felszólító email dialog

#### ✅ 6c. SalariesPage.tsx átírása (817 → ~85 sor)
- `src/components/salaries/SalaryKpiCards.tsx` — 4 KPI kártya
- `src/components/salaries/EmployeeAccordion.tsx` — dolgozói bontás
- `src/components/salaries/NavSummaryTable.tsx` — NAV összesítő
- `src/components/salaries/SalaryDialogs.tsx` — KP + Edit dialog

#### ✅ 6a. Settings.tsx szétbontása (1045 → ~250 sor)
- `src/components/settings/ProfileSection.tsx`
- `src/components/settings/BusinessSection.tsx`
- `src/components/settings/SystemSection.tsx`
- `src/components/settings/SecuritySection.tsx`
