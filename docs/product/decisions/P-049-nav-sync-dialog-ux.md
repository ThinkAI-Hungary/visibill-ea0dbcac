# P-049: NAV Szinkronizálás Dátumtartomány Választó Modal UX

**Status:** Decided
**Category:** UI / Workflow
**Date:** 2026-07-29
**Question:** Hogyan választhassa ki a felhasználó a manuális NAV szinkronizáció dátumtartományát?
**Decision:** Modal dialog preset gombokkal + egyéni dátumválasztóval, chunk-onkénti progress visszajelzéssel.

## Korábbi viselkedés

A Számlák oldal "Szinkronizálás" gombja azonnal, kattintásra **90 napos** hardcoded tartományt szinkronizált háttérben, toast visszajelzéssel a végén. A felhasználó nem tudta befolyásolni a dátumtartományt.

## Új viselkedés

### Trigger
A "Szinkronizálás" gomb (`InvoicesPage.tsx`) egy **Dialog modalt** nyit meg.

### Modal felépítés (`NavSyncDialog.tsx`)

```
┌────────────────────────────────────────────────┐
│  NAV Szinkronizálás                            │
│  Válaszd ki a dátumtartományt...               │
│                                                │
│  [30 nap] [60 nap] [90 nap] [Teljes év]       │  ← preset gombok
│                                                │
│  ── vagy egyéni tartomány ──                   │
│                                                │
│  Dátum -tól               Dátum -ig            │  ← Calendar popovers
│  [2026-01-01  📅]         [2026-07-29  📅]     │
│                                                │
│  ⚠️ 90+ nap: több percig eltarthat            │  ← csak 90+ napnál
│                                                │
│  ┌──────────────────────────────────────┐      │
│  │ ⟳ 2/6 köteg feldolgozva             │      │  ← progress (sync közben)
│  │   423 számla eddig                   │      │
│  │ ████████░░░░░░░░░  33%              │      │  ← progress bar
│  └──────────────────────────────────────┘      │
│                                                │
│  2026.01.01 → 2026.07.29  (210 nap)           │
│                             Mégse  Szinkronizálás
└────────────────────────────────────────────────┘
```

### Preset gombok

| Preset | Dátum range | Default |
|---|---|---|
| **30 nap** | today - 30 → today | ✅ Alapértelmezett |
| **60 nap** | today - 60 → today | |
| **90 nap** | today - 90 → today | |
| **Teljes év** | jan 1 → today | |

Preset kattintás → automatikusan beállítja a dateFrom/dateTo értékeket.
Egyéni dátum választáskor a preset kijelölés törlődik.

### Validáció

| Szabály | Viselkedés |
|---|---|
| dateFrom > dateTo | Szinkronizálás gomb disabled + piros hiba |
| Tartomány > 365 nap | Szinkronizálás gomb disabled + piros hiba |
| Tartomány > 90 nap | Sárga figyelmeztető szöveg (nem blokkoló) |
| dateTo > today | Calendar disabled (jövőbeli dátum nem választható) |

### Progress feedback (sync közben)

A `handleSync` hook chunk-onként (35 napos kötegek) hívja a `onProgress` callback-et:
- **Köteg állapot:** `x/y köteg feldolgozva`
- **Számla szám:** `z számla eddig`
- **Progress bar:** vizuális (szélesség %-ban)

### Async Modal UX

- Sync közben a modal **nem escapable** (sem kattintás kívül, sem ESC)
- Szinkronizálás gomb → Loader2 spinner + "Szinkronizálás..." felirat
- Modal CSAK AKKOR záródik, ha a sync teljesen befejeződik vagy hibára fut
- Sikeres sync → modal zár → toast

### Érintett fájlok

| Fájl | Változás |
|---|---|
| `src/components/nav/NavSyncDialog.tsx` | **Új** — Dialog komponens |
| `src/hooks/useInvoiceMutations.ts` | `handleSync(dateFrom?, dateTo?, onProgress?)` |
| `src/pages/InvoicesPage.tsx` | Gomb onClick → modal open + NavSyncDialog render |

## Rationale

1. A felhasználók eddig nem tudták kiválasztani a sync tartományt → a 90 napos limit nem fedte az év elejét
2. A progress feedback csökkenti a "ragadt?" érzést nagy tartományoknál
3. A preset gombok gyors UX-et adnak a gyakori use case-ekre
4. A "Teljes év" preset megoldja a backfill igényt új felhasználóknál

## Kapcsolódó
- [A-012: NAV Online Számla API v3 Integráció](../../architecture/decisions/A-012-nav-integration.md) — sync chunk mechanizmus, EF registry
