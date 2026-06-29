# A-024: Partner Upsert Strategy — Prefix Matching, Foreign Partners, Both Upgrade

**Status:** Decided
**Date:** 2026-06-29
**Utoljára frissítve:** 2026-06-29

## Context

A partner upsert logika három független rendszerben fut: Python worker, `nav-auto-sync` Edge Function, `nav-query-outbound-invoices` Edge Function. Három egymással összefüggő probléma került felszínre:

1. **Prefix duplikáció:** A magyar adószám formátuma `XXXXXXXX-Y-ZZ` (törzsszám-ÁFA kód-megye kód). Ugyanaz a cég más formátummal jelenhet meg különböző számlákon (pl. `11223344-2-41` vs `11223344-1-03`). A NAV sync EF-ek exact match-csel dolgoztak → duplikált partner rekordok.

2. **partner_type felülírás:** A NAV sync `ignoreDuplicates: false` upsert-tel dolgozott, ami felülírta a `partner_type` mezőt minden sync során. Ha egy partner először `supplier`-ként jött be, majd `customer`-ként is megjelent, a típus pingpongozott az upsert-ek között, ahelyett hogy `both`-ra frissült volna.

3. **Külföldi partnerek hiánya:** Külföldi cégek (pl. Anthropic, OpenAI) nem rendelkeznek magyar/EU adószámmal → `elado_vat_id = null` → a worker kiszűrte őket a `len(tax_number) < 5` guard-dal → nem jöttek létre a partnertörzsben.

## Decision

### D1: 8 jegyű prefix matching (deduplikáció)

Mindhárom rendszerben (worker + 2 EF) a partner lookup kétlépcsős:
1. **Exact match:** `WHERE company_id = X AND tax_number = Y`
2. **Prefix match (fallback):** Az összes partner fetchelése a céghez, és az adószám első 8 számjegye (törzsszám) alapján keresés

Ez biztosítja, hogy `11223344-2-41` és `11223344-1-03` ugyanannak a partnernek számít.

### D2: Szintetikus adószám külföldi partnereknek (`FOREIGN:<normalized_name>`)

Ahelyett, hogy a `tax_number` mezőt nullable-re módosítanánk (DB schema change + unique constraint módosítás + RLS policy felülvizsgálat), szintetikus azonosítót generálunk:

```
FOREIGN:<lowercase_alphanumeric_name>
```

Példák:
- `"Anthropic, PBC"` → `FOREIGN:anthropicpbc`
- `"OpenAI OpCo, LLC"` → `FOREIGN:openaiopcollc`

A frontend elrejti a `FOREIGN:` prefixes adószámokat és „Külföldi" badge-et mutat helyettük.

### D3: Automatikus `partner_type → 'both'` upgrade

Ha egy meglévő partner eltérő szerepben jelenik meg egy számlán (pl. eddig `supplier`, most `customer` irányú számlán látjuk), a `partner_type` automatikusan `'both'`-ra frissül. Ez mindhárom rendszerben (worker + 2 EF) konzisztensen működik.

Az upgrade idempotens: ha már `both`, nem nyúl hozzá. Ha ugyanaz a típus, nem nyúl hozzá.

## Alternatives Considered

### A1: Nullable `tax_number` (DB schema change)
- **Elvetett** — a `(company_id, tax_number)` unique constraint módosítást igényelt volna, és a külföldi partnerek deduplikálása nem lett volna megoldott (két NULL nem egyenlő PostgreSQL-ben).

### A2: UI-ból manuális `both` beállítás
- **Elvetett** — az éles adatbázisban 1156 partnerből csak 3 volt `both`, ami mutatja, hogy manuálisan senki nem állítja be.

### A3: Külön `is_foreign` boolean mező
- **Elvetett** — felesleges komplexitás, a `FOREIGN:` prefix elég információt hordoz.

## Consequences

**Pozitív:**
- Zero DB migration — nincs schema change
- Konzisztens logika worker + EF-ek között
- Külföldi partnerek automatikusan megjelennek a partnertörzsben
- `both` típus automatikusan kezelve

**Negatív:**
- Egy extra DB query minden partner upsert-nél (az összes partner fetchelése prefix match-hez) — de a partnerek száma cégenként tipikusan < 500, szóval ez elhanyagolható
- A `FOREIGN:` prefix konvenció a frontend-ben is kezelést igényel

## Érintett fájlok

| Fájl | Változás |
|------|----------|
| `worker/partner_upsert.py` | D1 + D2 + D3 implementáció |
| `supabase/functions/nav-auto-sync/index.ts` | D1 + D3 implementáció |
| `supabase/functions/nav-query-outbound-invoices/index.ts` | D1 + D3 implementáció + address fill |
| `src/pages/PartnersPage.tsx` | D2 frontend kezelés (FOREIGN: elrejtése) + D4 név-alapú matching |
| `worker/test/unit_test/test_partner_upsert.py` | 17 unit teszt |

## Backfill (2026-06-29)

Egyszeri SQL script hozta létre a hiányzó külföldi partnereket a meglévő számlákból (13 partner, 3 cég). A jövőben a worker automatikusan hozza létre őket.

## Kapcsolódó
- [A-012: NAV Online Számla API v3 integráció](./A-012-nav-integration.md) — NAV sync partner caching logika
- [P-040: Partnertörzs dual-table számlák](../product/decisions/P-040-partners-invoice-panel.md) — Partner UI
- [P-044: Külföldi partner megjelenítés](../product/decisions/P-044-foreign-partner-display.md) — Frontend FOREIGN: kezelés + név-alapú matching

