# A-013: Scoped URL Routing Pattern

**Status:** Decided  
**Date:** 2025-09

## Context

A rendszer multi-company és dátumszűrős. Minden oldal kontextusa tartalmazza melyik cég adatait és milyen időszakot nézünk. A URL-nek tükröznie kell ezt — bookmarkolható, megosztható.

## Decision

**Scoped URL pattern:** `/:companyId/:dateRange/*`

**Format:**
```
/:companyId/:dateRange/:page/:tab?
```

**Példa:**
```
/a1b2c3d4/2026-01-01_2026-12-31/invoices/incoming
  │         │                      │        │
  company   dátum szűrő            oldal    tab
```

**Utility-k:** `src/lib/navigation.ts`
- `generateScopedPath()` — URL generálás
- `parseDateRange()` — dateRange parsing
- `useScopedNavigate()` — hook a scoped navigáláshoz
- `useScopedBasePath()` — base path hook (sidebar link-ekhez)
- `useUrlTab()` — tab szinkronizálás URL-lel

**Kontextus szinkronizálás:** `ScopedLayout.tsx` — URL params ↔ React Context kétirányú szinkron.

## Consequences

**Pozitív:**
- URL-ek bookmarkolhatók és megoszthatók
- Cégváltás és dátumváltás URL-ben tükröződik
- Browser back/forward működik
- A React Query cache kulcsok tartalmazzák a companyId + dateRange-t → automatikus invalidáció

**Negatív:**
- URL-ek hosszúak (UUID + dátum range)
- Legacy URL-ek kezelése szükséges (redirect `/invoices` → `/:companyId/:dateRange/invoices`)
- Komplex routing setup (4 nested kontextus provider)
