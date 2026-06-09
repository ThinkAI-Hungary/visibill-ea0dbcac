# A-014: React Query Cache Stratégia

**Status:** Decided  
**Date:** 2025-10

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

## Consequences

**Pozitív:**
- 5 perces staleTime → navigálás oldalak között instant (cached adat)
- companyId/dateRange a kulcsban → természetes invalidáció
- Deduplikáció — azonos query-t nem hívja meg kétszer párhuzamosan

**Negatív:**
- 5 perces staleTime → a felhasználó elavult adatot láthat (feldolgozás után)
- A query key pattern manuálisan karbantartandó (`queryKeys.ts`)
- Komplex invalidáció — mutation után a kapcsolódó query-ket manuálisan kell invalidálni
