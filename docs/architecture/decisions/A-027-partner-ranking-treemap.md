# A-027: Partner Ranking & Treemap — NAV-only + külföldi partner logika

**Status:** Decided
**Date:** 2026-07-04
**Utoljára frissítve:** 2026-07-05

## Context

A Partnertörzs oldalon megjelenő Top 10 beszállító / vevő rangsor és treemap vizualizáció
az összes számlaforrást (NAV + beküldött) összegzi. Ez dupla-számoláshoz vezetett magyar
partnereknél, ahol a beküldött számla és a NAV számla is megjelent (pl. díjbekérő + végszámla).

**Felmerült kérdések:**
- Egy díjbekérő (beküldött) és a hozzá tartozó végszámla (NAV) duplázza az összegeket
- A beküldött számlák HU-prefixes adószámai nem egyeztek a NAV 8-jegyű formátumával
- A treemap arányai nem tükrözték a tényleges értékeket (sor-relatív szélesség)

## Decision

### Rangsor adatforrás szabály

| Partner típus | Számla forrás | Indoklás |
|---|---|---|
| **Magyar** (8-jegyű adószám) | Csak **NAV** (`nav_invoices`) | NAV a hivatalos forrás, beküldött duplikálná |
| **Külföldi** (nem 8-jegyű) | Csak **Beküldött** (`invoices`) | NAV-ban nem szerepelnek, nincs magyar adószámuk |

**Külföldi felismerés SQL-ben:**
```sql
AND NOT (regexp_replace(replace(vat_id, '-', ''), '^HU', '', 'i') ~ '^[0-9]{8}')
```

### VAT normalizáció (mindkét oldalon)

A `get_partner_ranking` RPC és a frontend `PartnersPage.tsx` is ugyanazt a normalizációt alkalmazza:
1. Kötőjel eltávolítás: `replace('-', '')`
2. HU prefix strip: `replace(/^HU/i, '')`
3. Első 8 karakter: `substring(0, 8)`

### Treemap layout

- **Flex-wrap** layout: minden cella szélessége `value / totalTop10 * 100%`
- A cellák automatikusan sorba rendeződnek a flex-wrap miatt
- Magasság rangsor-tier alapú: top 3 = 48px, 4-6 = 40px, 7-9 = 34px, 10 = 28px
- Mindkét treemap (beszállító / vevő) azonos magasságú (fix rowHeights)

### Treemap szín paletta (light/dark mode aware, 2026-07-05)

A cellák szövegszíne a `useTheme()` hook alapján vált light és dark mód között:
- **Dark mode:** pasztell szövegszínek (pl. `#93c5fd`, `#c4b5fd`) — jól olvasható sötét háttéren
- **Light mode:** szaturált szövegszínek (pl. `#2563eb`, `#7c3aed`) — erős kontraszt világos háttéren

A háttérszín (alacsony opacitású rgba) mindkét módban azonos marad.
A megoldás követi a monogram badge-k kontrasztját: erős szín / pasztell háttér a light módban.

## Consequences

**Pozitív:**
- Pontos összegek — nincs dupla-számolás magyar partnereknél
- Vizuálisan helyes arányok a treemapben
- Külföldi partnerek is megjelennek (beküldött számlákon keresztül)

**Negatív:**
- Magyar partnereknél a beküldött-only számlák (pl. díjbekérő NAV nélkül) nem jelennek meg a rangsorban
- Ha egy külföldi partner NAV-ban is megjelenne (ritka eset), az uploaded számlák lennének számolva

## Érintett fájlok

- **RPC:** `get_partner_ranking` (Supabase SQL function)
- **Frontend:** `src/pages/PartnersPage.tsx` (count aggregáció, detail query)
- **UI:** `src/components/partners/PartnerRankingCard.tsx` (treemap render)

## Kapcsolódó

- [P-040: Partnertörzs Dual-table számlák](../../product/decisions/P-040-partners-invoice-panel.md)
- [A-024: Partner Upsert Strategy](./A-024-partner-upsert-strategy.md)
- [A-016: PostgreSQL Query Strategy](./A-016-postgresql-query-strategy.md)
