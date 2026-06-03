# 14 — Teljesítmény Optimalizáció

> Code splitting, prefetch stratégiák, memoizáció, React Query cache, rendering optimalizáció.

---

## Code Splitting

### Route-Level Splitting

Minden page `React.lazy()` + dynamic `import()`:

```tsx
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));  // 80KB
const ManualUpload = lazy(() => import("./pages/ManualUpload"));  // 65KB
const Auth = lazy(() => import("./pages/Auth"));                   // 65KB
// ... 28 lazy page összesen
```

### Legnagyobb Chunk-ok

| Page | Méret | Oka |
|------|-------|-----|
| `InvoicesPage` | 80KB | Komplex tábla + szűrők + inline editing |
| `Auth` | 65KB | Többlépéses form + Google/email flow |
| `ManualUpload` | 65KB | Drag & drop + OCR preview |
| `AnnualReportPage` | 71KB | PDF generálás + összetett form |
| `VatReturnPage` | 69KB | ÁFA kalkuláció + XML export |
| `ManagementDashboard` | 49KB | Admin overview + statisztikák |

---

## Prefetch Stratégiák

### 1. Idle Prefetch (Háttérben, Mount Után)

**Fájl:** `AppLayout.tsx` — `useIdleRoutePrefetch()`

```tsx
useEffect(() => {
  const idle = (cb) => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(cb, { timeout: 2000 });
    } else {
      setTimeout(cb, 1500);
    }
  };

  idle(() => {
    void import("@/pages/Index");
    void import("@/pages/InvoicesPage");
    void import("@/pages/TransactionsPage");
    void import("@/pages/SalariesPage");
    void import("@/pages/PartnersPage");
    void import("@/pages/GeneralLedgerPage");
  });
}, []);
```

> **Mikor?** Böngésző idle time-ban (2s timeout), vagy `setTimeout(1500)` fallback.
> **Mit?** A 6 leggyakrabban használt route chunk-ot.

### 2. Hover/Focus Prefetch (Sidebar Navigáció)

**Fájl:** `AppSidebar.tsx` — `prefetchMap`

```tsx
<Link
  onMouseEnter={() => handlePrefetch(item.url)}
  onFocus={() => handlePrefetch(item.url)}
  onTouchStart={() => handlePrefetch(item.url)}
>
```

> **Trigger:** Egér hover, keyboard focus, touch start
> **Hatás:** Kattintásra a chunk már a cache-ben van

---

## React Memoizáció

### Memoizált Komponensek

| Komponens | Módszer | Indoklás |
|-----------|---------|----------|
| `AppSidebar` | `React.memo()` | Sidebar nem renderelődik újra page navigációkor |
| `TopBar` | `memo()` | Role/query változás nem ripple-ezi a shell-t |
| `ContentArea` | `memo()` | Navigáció nem rendereli újra a containert |

### useMemo Használat

```tsx
// Sidebar nav items — role change-kor számolódik újra
const visibleNavItems = useMemo(() => {
  const items = isEmployee
    ? navigationItems.filter((item) => item.employeeVisible)
    : navigationItems;
  return items.map((item) => ({
    ...item,
    to: item.url === "/" ? basePath : `${basePath}${item.url}`,
  }));
}, [isEmployee, basePath]);
```

### useCallback Használat

```tsx
// Prefetch handler — stabil referencia
const handlePrefetch = useCallback((url: string) => {
  const loader = prefetchMap[url];
  if (loader) void loader();
}, []);
```

---

## React Query Cache Konfiguráció

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 perc — nem kér újra friss adatot
      gcTime: 10 * 60 * 1000,         // 10 perc — cache törlés
      refetchOnWindowFocus: false,     // Tab váltáskor nincs refetch
      retry: 1,                        // Max 1 retry
    },
  },
});
```

### Centralizált Query Keys

**Fájl:** `lib/queryKeys.ts`

Biztosítja:
- Company-scoped cache invalidation
- Date-range-scoped lekérdezések
- Konzisztens kulcs generálás

---

## Layout Stabilitás

### Fix Magasságú Sorok

```css
.compact-table tr { height: 45px; max-height: 45px; }
.compact-table td { height: 45px; max-height: 45px; overflow: hidden; }
```

> Megelőzi a CLS-t (Cumulative Layout Shift) — a sorok magassága nem változik a tartalom szerint.

### Stable Suspense Fallback

```tsx
const StableFallback = () => <div className="h-full w-full" aria-busy="true" />;
```

> Üres div, ami fenntartja a layout magasságot chunk betöltés közben. Nincs vizuális „villanás".

### Sidebar Stability

A sidebar a `ProtectedLayout` szintjén renderelődik, a `ScopedLayout` (route tartalma) BELÜL van. Így:
- Company váltás → sidebar NEM mount-ol újra
- Page navigáció → sidebar NEM mount-ol újra
- Csak az `<Outlet />` (ContentArea belseje) renderelődik újra

### ScopedLayout Sync Without Flash

```tsx
const isSyncing = !isCompanySynced || !isDateSynced;

return (
  <div style={isSyncing ? { opacity: 0, pointerEvents: 'none', minHeight: '50vh' } : undefined}>
    <Outlet />
  </div>
);
```

> URL ↔ Context szinkronizáció közben a tartalom láthatatlan de mountolva marad. Ez megelőzi a unmount/remount flash-t.

---

## Font Betöltés Optimalizáció

```html
<!-- Preconnect (DNS + TCP) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Preload (korai letöltés, nem blokkoló) -->
<link rel="preload" as="style" href="...Montserrat...">

<!-- Non-render-blocking (media trick) -->
<link rel="stylesheet" href="..." media="print" onload="this.media='all'">
```

---

## Initial Load Performance

### HTML-Level Optimalizációk

1. **Theme script** — `<head>`-ben, PAINT előtt fut → nincs dark mode flash
2. **CSS variables** — `--initial-bg` hardcode → azonnali háttérszín
3. **HTML spinner** — Zero JS dependency → azonnal látható
4. **Font preload** — Non-render-blocking betöltés

### React-Level Optimalizációk

1. **ProtectedLayout gate** — semmi nem renderelődik amíg nem kész
2. **Initial loader fade** — sima átmenet HTML → React
3. **Idle prefetch** — háttérben töltődnek a gyakori route-ok
4. **Hover prefetch** — kattintás előtt töltődik a chunk

---

## Scrollbar Performance

```css
* {
  scrollbar-width: thin;  /* Firefox: vékony scrollbar */
}

::-webkit-scrollbar {
  width: 8px;  /* Webkit: 8px scrollbar */
}
```

> Vékony scrollbar = kevesebb layout space + simább scrolling.

---

## Print Performance

```css
@media print {
  html, body, #root {
    height: auto !important;
    overflow: visible !important;
  }
}
```

> Print módban a `overflow: hidden` eltávolítása biztosítja, hogy a teljes tartalom kinyomtatható legyen.

---

## Összefoglaló: Teljesítmény Checklist

| Kategória | Pattern | Státusz |
|-----------|---------|---------|
| Code splitting | Route-level lazy | ✅ |
| Idle prefetch | Top 6 route | ✅ |
| Hover prefetch | All 20 sidebar items | ✅ |
| Component memo | Sidebar, TopBar, Content | ✅ |
| Query cache | 5 min stale, no refetch on focus | ✅ |
| Font loading | Preload + non-blocking | ✅ |
| Theme FOUC | HTML script + CSS vars | ✅ |
| Layout stability | Fix height rows, stable fallback | ✅ |
| Reduced motion | OS preference respected | ✅ |
| Print mode | Overflow visible, landscape | ✅ |
