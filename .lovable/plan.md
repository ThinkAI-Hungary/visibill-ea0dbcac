

# Persistent Layout & Zero-Flicker Cache Refaktor

## Jelenlegi állapot

### Layout probléma
A `ProtectedLayout` már jól tartalmazza az `AppSidebar`-t + `Outlet`-et, DE a `ProtectedRoute` (amit minden egyes route child-jába be van csomagolva) **minden navigációnál újra futtatja** a profil-ellenőrzést (`checkProfile`), ami `profileLoading = true` → `<LoadingSpinner />` → **teljes képernyős spinner a sidebar fölött**. Ez okozza a villanást.

### Loading anti-patternek
- **Index.tsx (77. sor):** `if (companyLoading || metricsLoading) return <LoadingSpinner />;` — teljes oldalcsere
- **SalariesPage.tsx (39. sor):** `if (loading) return <LoadingSpinner />;` — teljes oldalcsere
- **TransactionsPage.tsx:** `loading` prop a `TransactionTable`-nek → az már `TableSkeleton`-t használ (jó!)
- **InvoicesPage.tsx:** `loading` összevonás → valószínűleg hasonló full-page spinner

### Query cache
A globális `staleTime: 5 min` már be van állítva. A `placeholderData: keepPreviousData` viszont **sehol sincs** alkalmazva.

---

## Implementációs terv

### 1. ProtectedRoute profil-check cache-elése (fő villanás ok)

A `ProtectedRoute` minden mount-nál Supabase `select`-et indít és `profileLoading = true`-ra áll. Ezt **TanStack Query-re** kell cserélni fix `staleTime`-mal, így navigáció közben a cache-ből jön az adat, nincs loading.

**`src/components/ProtectedRoute.tsx`:**
- `useState + useEffect + checkProfile()` → `useQuery` a profil lekérésre, `staleTime: 5 * 60 * 1000`
- `if (isLoading && !data)` → spinner; ha `data` megvan → azonnal renderel
- A profil query key: `['profile-check', user.id]`

### 2. Index.tsx — Skeleton a spinner helyett

**77. sor cseréje:**
```tsx
// Régi:
if (companyLoading || metricsLoading) return <LoadingSpinner />;

// Új:
if (companyLoading || (metricsLoading && !metrics)) {
  return <DashboardSkeleton />;
}
```

A `DashboardSkeleton` már létezik (`MetricsGridSkeleton`, `VatChartSkeleton`, `RevenueChartSkeleton`). Egy összerakott `DashboardSkeleton` wrapper kell, ami ezeket kombinálja.

### 3. SalariesPage — Skeleton a spinner helyett

**39. sor cseréje:**
```tsx
// Régi:
if (loading) return <LoadingSpinner />;

// Új:  
if (loading && salaryItems.length === 0) return <SalaryPageSkeleton />;
```

Új `SalaryPageSkeleton` komponens: KPI kártyák skeleton + accordion placeholder.

### 4. InvoicesPage — Skeleton a spinner helyett

Hasonló minta: `if (loading && !paginatedNavInvoices.length)` → `InvoicesPageSkeleton`.

### 5. `placeholderData: keepPreviousData` alkalmazása

A következő query-kben:
- `useTransactionData.ts` — fő tranzakció query (92. sor)
- `useSalaryData.ts` — salary query (23. sor)
- `useInvoiceData.ts` — submitted invoices query (94. sor)
- `useInvoiceFilters.ts` — NAV invoice RPC query

Hozzáadni: `placeholderData: keepPreviousData` — így lapozáskor/szűréskor a régi adat kint marad, amíg az új betölt.

### 6. Összefoglaló skeleton komponens

Új fájl: `src/components/dashboard/DashboardPageSkeleton.tsx` — kombinálja a meglévő skeleton elemeket egy teljes dashboard elrendezéssé.

---

## Érintett fájlok

| Fájl | Változás |
|---|---|
| `src/components/ProtectedRoute.tsx` | profil-check → useQuery cache |
| `src/pages/Index.tsx` | LoadingSpinner → DashboardPageSkeleton, `!metrics` guard |
| `src/pages/SalariesPage.tsx` | LoadingSpinner → SalaryPageSkeleton, `!data` guard |
| `src/pages/InvoicesPage.tsx` | loading logika → skeleton, `!data` guard |
| `src/hooks/useTransactionData.ts` | `placeholderData: keepPreviousData` |
| `src/hooks/useSalaryData.ts` | `placeholderData: keepPreviousData` |
| `src/hooks/useInvoiceData.ts` | `placeholderData: keepPreviousData` |
| `src/hooks/useInvoiceFilters.ts` | `placeholderData: keepPreviousData` (ha van paginated query) |
| `src/components/dashboard/DashboardPageSkeleton.tsx` | ÚJ — full dashboard skeleton wrapper |
| `src/components/salaries/SalaryPageSkeleton.tsx` | ÚJ — salary page skeleton |

