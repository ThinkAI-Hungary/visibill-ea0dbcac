# A-027: Partner Ranking & Treemap — NAV-only + külföldi partner + dátumszűrő logika

**Status:** Decided
**Date:** 2026-07-04
**Utoljára frissítve:** 2026-07-22

## Context

A Partnertörzs oldalon megjelenő Top 10 beszállító / vevő rangsor és treemap vizualizáció
az összes számlaforrást (NAV + beküldött) összegzi. Ez dupla-számoláshoz vezetett magyar
partnereknél, ahol a beküldött számla és a NAV számla is megjelent (pl. díjbekérő + végszámla).

**Felmerült kérdések:**
- Egy díjbekérő (beküldött) és a hozzá tartozó végszámla (NAV) duplázza az összegeket
- A beküldött számlák HU-prefixes adószámai nem egyeztek a NAV 8-jegyű formátumával
- A treemap arányai nem tükrözték a tényleges értékeket (sor-relatív szélesség)
- A rangsor korábban nem követte a globális dátumválasztót (mindig az összes időszaki adatot mutatta)

## Decision

### 1. Rangsor adatforrás szabály

| Partner típus | Számla forrás | Indoklás |
|---|---|---|
| **Magyar** (8-jegyű adószám) | Csak **NAV** (`nav_invoices`) | NAV a hivatalos forrás, beküldött duplikálná |
| **Külföldi** (nem 8-jegyű) | Csak **Beküldött** (`invoices`) | NAV-ban nem szerepelnek, nincs magyar adószámuk |

**Külföldi felismerés SQL-ben:**
```sql
AND NOT (regexp_replace(replace(vat_id, '-', ''), '^HU', '', 'i') ~ '^[0-9]{8}$')
```

### 2. Globális dátumszűrés (`p_date_from`, `p_date_to`)

A `get_partner_ranking` RPC függvény elfogadja a `p_date_from` és `p_date_to` (opcionális `date`) paramétereket:
- `nav_invoices`: `n.invoice_issue_date` alapján szűr
- `invoices`: `i.kibocsatas_datuma::date` alapján szűr

A `PartnersPage.tsx` a `@/contexts/DateRangeContext` `useDateRange()` hookjából kapott `dateFromFormatted` és `dateToFormatted` értékeket adja át a query-ben, és a szekció fejlécében, valamint a rangsor kártyákon vizuális időszak indikátort (`periodLabel` badge, pl. `2026. jan 01. – 2026. dec 31.`) jelenít meg.

### 3. VAT normalizáció (mindkét oldalon)

A `get_partner_ranking` RPC és a frontend `PartnersPage.tsx` is ugyanazt a normalizációt alkalmazza:
1. Kötőjel eltávolítás: `replace('-', '')`
2. HU prefix strip: `replace(/^HU/i, '')`
3. Első 8 karakter: `substring(0, 8)`

### 4. Treemap layout

- **Flex-wrap** layout: minden cella szélessége `value / totalTop10 * 100%`
- A cellák automatikusan sorba rendeződnek a flex-wrap miatt
- Magasság rangsor-tier alapú: top 3 = 48px, 4-6 = 40px, 7-9 = 34px, 10 = 28px
- Mindkét treemap (beszállító / vevő) azonos magasságú (fix rowHeights)

### 5. Treemap szín paletta (light/dark mode aware, 2026-07-05)

A cellák szövegszíne a `useTheme()` hook alapján vált light és dark mód között:
- **Dark mode:** pasztell szövegszínek (pl. `#93c5fd`, `#c4b5fd`) — jól olvasható sötét háttéren
- **Light mode:** szaturált szövegszínek (pl. `#2563eb`, `#7c3aed`) — erős kontraszt világos háttéren

A háttérszín (alacsony opacitású rgba) mindkét módban azonos marad.

## Consequences

**Pozitív:**
- Pontos összegek az adott időszakra vonatkozóan — igazodik a globális dátumválasztóhoz (pl. "Előző hónap")
- Egyértelmű vizuális visszajelzés (Badge / Subtitle) a rangsor időszaki hatóköréről
- Pontos összegek — nincs dupla-számolás magyar partnereknél
- Vizuálisan helyes arányok a treemapben

**Érintett fájlok:**

- **RPC & Migration:** `get_partner_ranking` (`supabase/migrations/20260722173000_partner_ranking_date_filter.sql`)
- **Frontend:** `src/pages/PartnersPage.tsx` (useDateRange integration, queryKey invalidation, periodLabel badge)
- **UI:** `src/components/partners/PartnerRankingCard.tsx` (periodLabel subtitle display)

## Kapcsolódó

- [P-040: Partnertörzs Dual-table számlák](../../product/decisions/P-040-partners-invoice-panel.md)
- [A-024: Partner Upsert Strategy](./A-024-partner-upsert-strategy.md)
- [A-016: PostgreSQL Query Strategy](./A-016-postgresql-query-strategy.md)

