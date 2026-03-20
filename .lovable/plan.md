
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

---

## Hátralévő fázisok

### 5. fázis — InvoicesPage server-side szűrés
- `get_filtered_nav_invoices()` RPC + useInvoiceFilters átírás

### 6. fázis — Nagy fájlok szétbontása
- Settings.tsx (1045 sor), KintlevoPage (777 sor), SalariesPage (817 sor)
