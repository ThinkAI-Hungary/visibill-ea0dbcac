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

**Oldal-szintű query params:**
A számlák oldal (`/invoices`) az összes szűrő és nézet-állapotot URL query parameterként szinkronizálja a link megoszthatóság érdekében.

| Param | Szűrő | Példa |
|-------|-------|-------|
| `q` | Keresés | `?q=HRT` |
| `idf` / `idt` | Kibocsátási dátum | `?idf=2026-06-01` |
| `amin` / `amax` | Összeg tartomány | `?amin=100000` |
| `cur` | Pénznem | `?cur=HUF` |
| `paid` | Kifizetve | `?paid=yes` |
| `sub` | Beküldve | `?sub=yes` |
| `proj` / `cat` | Projekt / Kategória | `?proj=uuid` |
| `pm` | Fizetési mód | `?pm=TRANSFER` |
| `kpi` | KPI szűrő | `?kpi=unmatched` |
| `sf` / `sd` | Rendezés | `?sf=invoice_gross_amount&sd=asc` |
| `p` / `ps` | Oldal / Méret | `?p=2&ps=25` |

Csak nem-default értékek jelennek meg az URL-ben. Fájlok: `useInvoiceFilters.ts` (init), `InvoicesPage.tsx` (sync effect).

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

**Tervezett fejlesztés:**
- Globális dátum feltételes megjelenítése: ha default (aktuális év), kihagyni az URL path-ból
