# A-014: React Query Cache Stratégia

**Status:** Decided  
**Date:** 2025-10  
**Utolsó frissítés:** 2026-06-11

## Context

A frontend-nek gyorsnak kell lennie — a felhasználó nem vár 2 másodpercet minden oldal betöltéskor. Szükségünk van intelligens cache stratégiára.

## Decision

**React Query (TanStack Query v5)** — szerver-state cache a frontend-en:

**Konfiguráció:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 perc — adat friss marad
      gcTime: 10 * 60 * 1000,       // 10 perc — cache-ben marad
      retry: 1,
      refetchOnWindowFocus: false,   // Nincs refetch tab-váltáskor
    }
  }
});
```

**Query Key Pattern:**
```typescript
// src/lib/queryKeys.ts
export const queryKeys = {
  invoices: (companyId: string, dateRange: string) => 
    ['invoices', companyId, dateRange],
  dashboard: (companyId: string, dateRange: string) => 
    ['dashboard', companyId, dateRange],
  // ...
};
```

**A companyId és dateRange benne van a cache kulcsban** → cégváltás automatikusan új lekérdezést triggerel.

**Prefetch:**
- `AppSidebar.tsx` → hover/focus → `prefetchMap` → chunk preload
- Nagyobb lekérdezések (dashboard KPI-k) eager prefetch-elve

### Realtime Cache Invalidáció

A `LiveNotificationProvider.tsx` komponens kezeli a cache frissítést:

**1. Supabase Realtime channel** — hallgatja a DB táblákat (invoices, nav_invoices, transactions, stb.) és debounced invalidálja a kapcsolódó query-ket (500ms debounce).

**2. Tab focus invalidáció** — feltételes, a Realtime csatorna állapota és a távollét ideje alapján:

```
Tab háttérbe kerül → mentjük az időt (hiddenAt)
Tab visszajön (visible) →
  ├─ Csatorna leszakadt (state ≠ joined) → MINDIG invalidál (pótolni kell az esetleg elmaradt eseményeket)
  ├─ Csatorna aktív ÉS távollét > 2 perc   → Invalidál (böngésző throttle-olhatta a WS-t)
  └─ Csatorna aktív ÉS távollét ≤ 2 perc   → SKIP (Realtime tartotta a lépést, nincs villanás)
```

**Miért 2 perc küszöb?**
- Gyors tab-váltás (< 30 mp): a Realtime csatorna biztosan aktív → nincs felesleges re-render
- Böngésző throttle határ: Chrome ~5 perc háttér után throttle-olja a WebSocket-et → 2 perc biztonságos
- Kompromisszum az adat-frissesség és az UX villanás között

> **Fix:** `07a1723` (2026-06-11) — az eredeti implementáció feltétel nélkül invalidált MINDEN query-t tab visszaváltáskor, ami zavaró UI villanást okozott.

### Cache Reset vs. Invalidation Mutációk Után (Eviction Pattern)

A mutációs műveletek (mint például adatok törlése, újraküldése, státuszfrissítés, jogosultságok módosítása vagy impersonation leállítása) után az `invalidateQueries` használata nem elegendő, mert az csupán elavultnak jelöli meg a cache-t, de a memóriában tartja a régi adatokat. Emiatt navigációkor vagy a háttérben futó lekérdezés (background refetch) ideje alatt a felhasználó 1-2 másodpercig még a régi, elavult adatokat láthatja (stale state layout shift).

A konzisztens és tiszsa UX érdekében az alábbi szabályt alkalmazzuk:
- **`queryClient.resetQueries` használata:** Minden olyan mutáció sikeres lefutása után, amely közvetlen hatással van a statisztikákra vagy listákra (pl. `delete-errors`, `retry-errors`, `delete-files`, `update-file-status`, `update-permissions`), az érintett query-ket (`management-overview`, `management-errors`, `management-files`, `worker-status`, `management-user-permissions`, `active-impersonation`) **resetelni** kell invalidálás helyett.
- Ez azonnal kiüríti a gyorsítótárat (visszaállítja `undefined` állapotra), így a felhasználó azonnal egy tiszta betöltési állapotot (loading skeleton/spinner) lát a régi elavult adatok helyett, amíg a friss adatok le nem töltődnek.

## Consequences

**Pozitív:**
- 5 perces staleTime → navigálás oldalak között instant (cached adat)
- A `resetQueries` használata mutációk után megakadályozza a régi elavult adatok villódzását (layout shift) a statisztikai felületeken.
- companyId/dateRange a kulcsban → természetes invalidáció
- Deduplikáció — azonos query-t nem hívja meg kétszer párhuzamosan
- Realtime → azonnali frissítés DB változáskor, toast értesítéssel
- Tab focus → nem villan a UI rövid távollét után

**Negatív:**
- 5 perces staleTime → a felhasználó elavult adatot láthat (feldolgozás után)
- A query key pattern manuálisan karbantartandó (`queryKeys.ts`)
- Komplex invalidáció — mutation után a kapcsolódó query-ket manuálisan kell invalidálni

