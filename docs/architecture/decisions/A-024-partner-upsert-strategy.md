# A-024: Partner Upsert Strategy — Prefix Matching, Foreign Partners, Both Upgrade

**Status:** Decided
**Date:** 2026-06-29
**Utoljára frissítve:** 2026-09-27

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
| `worker/partner_upsert.py` | D1 + D2 + D3 + D4 + D5 implementáció |
| `supabase/migrations/20260720180000_nav_partner_upgrade_trigger.sql` | D6: DB trigger |
| `supabase/functions/nav-auto-sync/index.ts` | D1 + D3 implementáció |
| `supabase/functions/nav-query-outbound-invoices/index.ts` | D1 + D3 implementáció + address fill |
| `src/pages/PartnersPage.tsx` | D2 frontend kezelés + D4 név-alapú matching + D7 EU-prefix mergeKey fix |
| `worker/test/unit_test/test_partner_upsert.py` | 20 unit teszt (D4, D5 lefedve) |

## Backfill (2026-06-29)

Egyszeri SQL script hozta létre a hiányzó külföldi partnereket a meglévő számlákból (13 partner, 3 cég). A jövőben a worker automatikusan hozza létre őket.

## 2026-07-20 bővítések

### D4: Név-alapú fallback matching (worker)

Ha sem exact, sem prefix match nem talál partnert, a worker lekéri a cég összes partnerét és
`normalize_company_name()` alapján (jogi formák eltávolítása, kisbetűsítés, írásjel-strip) hasonlítja
a számlán szereplő nevet a partnernévhez. Ez megelőzi az ismert cég FOREIGN: ↔ valós adószám duplikátumait.

```python
# Pass B in partner_upsert.py
norm_name = normalize_company_name(name)
for p in all_partners:
    p_norm = normalize_company_name(p.get("name", ""))
    if p_norm and (p_norm == norm_name or p_norm in norm_name or norm_name in p_norm):
        existing = p; break
```

### D5: Automatikus FOREIGN: → valós adószám upgrade (worker)

Ha egy meglévő partner `FOREIGN:xxx` szintetikus adószámmal rendelkezik, és egy új számla
azonos névre érkezik **valós adószámmal** → a partner `tax_number`-je automatikusan frissül.

```python
# In partner_upsert.py step 4
if existing_tax.startswith("FOREIGN:") and not tax_number.startswith("FOREIGN:"):
    updates["tax_number"] = tax_number  # FOREIGN: → real upgrade
```

### D6: DB Trigger — NAV invoice INSERT → FOREIGN: partner upgrade

A Python worker csak a feltöltött (CSV/PDF) számlákat kezeli. A NAV szinkronizáció Edge Function-ön
fut (Deno, nincs Python runtime) — ezért a FOREIGN: upgrade-t DB trigger valósítja meg:

- **Trigger:** `trg_upgrade_foreign_partner_on_nav_invoice` — AFTER INSERT ON `nav_invoices`
- **Trigger function:** `upgrade_foreign_partner_on_nav_invoice()` — SECURITY DEFINER
- **Helper:** `normalize_partner_name_for_match(text)` — SQL replikája a Python `normalize_company_name()`-nek
- **Logika:** Ha az inserált sor `supplier_tax_number` nem üres és nem FOREIGN:, keres egy
  matching nevű `FOREIGN:` partnert a cégben → frissíti annak `tax_number`-jét.

```sql
-- Ha megtalálja a FOREIGN: partnert névegyezés alapján:
UPDATE partners SET tax_number = v_tax_number WHERE id = v_partner_id;
```

### D7: EU-prefix false merge fix (frontend)

A `PartnersPage.tsx` useMemo logikája `normTax.substring(0, 6)` merge key-t használt
minden nem-FOREIGN: partnernél. Ez az EU-s adószámoknál (EU372041, EU372088, EU372062)
hibásan `EU3720` kulcsra mergelt különböző cégeket (OpenAI + Ynoox + Eleven Labs = 1 entry).

**Fix:** `getMergeKey()` most különbséget tesz:
- Tisztán numerikus → 6 karakter (HU-prefix dedup)
- Betű-prefixes (EU, GB, ATU stb.) → teljes 8 karakter (különböző cégek!)
- FOREIGN: → teljes kulcs

```typescript
const getMergeKey = (normTax: string): string => {
  if (normTax.startsWith('FOREIGN:')) return normTax;
  if (/^\d+$/.test(normTax)) return normTax.substring(0, 6); // HU-style
  return normTax; // EU372041, GB123456, etc. — full key
};
```

## 2026-09-27 bővítések

### D8: Idempotens Upsert és Versenyhelyzet Védelem (Worker / ADR-074)

Párhuzamos kötegelt számlafeltöltések (PDF/ZIP, IMAP sync) során több worker szál egyidejűleg észlelhette úgy, hogy az adott adószámú partner még nem létezik a cégben. A közvetlen `.insert()` végrehajtásakor a második szál elbukott:
`ERROR: duplicate key value violates unique constraint "partners_company_id_tax_number_key" (PostgreSQL 23505)`.

**Megoldás:**
1. A worker közvetlen `.insert()` helyett PostgREST `.upsert(data, on_conflict="company_id,tax_number", ignore_duplicates=True)` eljárást használ, ami PostgreSQL szinten `INSERT ... ON CONFLICT (company_id, tax_number) DO NOTHING` utasítássá fordul. Így megszűnik a PostgreSQL rendszerszintű ERROR logolása és a tranzakció abortálása.
2. Ha az `ignore_duplicates` miatt 0 sor került beszúrásra vagy hálózati szinten ütközési kivétel keletkezik, a kód azonnal re-fetcheli az adatbázisból a párhuzamosan létrejött partnert (`select id, partner_type, address where company_id = X and tax_number = Y`).
3. Ha szükséges, automatikusan felminősíti a meglévő partner típusát (`partner_type -> 'both'`), ha az újonnan érkezett számla eltérő irányú volt, és pótolja az esetlegesen hiányzó címet.
4. Lásd részletesen: Worker `docs/DECISIONS.md` **ADR-074**.

## 2026-09-29 bővítések

### D9: Belföldi Magyar Partner Adószám Normalizálás (8-1-2 Szabvány), Valós Idejű NAV Gazdagítás és Worker Auto-Upgrade

Korábban a belföldi partnerek adószámai vegyes formátumban kerültek rögzítésre (8 számjegyű törzsszámként, unformatted 11 számjegyként pl. `12345678142`, vagy `HU` előtaggal). A Python worker korábbi OIB-ellenőrzése a kötőjel nélküli 11 jegyű magyar számokat tévesen horvát OIB-nek minősítette, így azok unformatted maradtak és nem egyeztek a meglévő 8 jegyű partnerekkel.

**Megoldás:**
1. **Frontend (`PartnersPage.tsx`):**
   - `formatPartnerTaxNumber`: Megjelenítéskor minden 11 jegyű belföldi adószámot szabványos `XXXXXXXX-Y-ZZ` (8-1-2) formátumban jelenít meg, a `HU` előtagot levágja, a szintetikus `FOREIGN:` azonosítókat elrejti.
   - `handleNavLookup` & `handleSubmit`: Kézi felvitelkor a 8 jegyű adószámot mentés előtt a NAV Online Számla v3 `queryTaxpayer` API-n keresztül lekérdezi, kitölti a 8-1-2 formátumot és a székhelycímet.
   - "✨ NAV 8-1-2" gomb a részletpanelen: Meglévő 8 jegyű partnereknél egyetlen kattintással elérhető a felminősítés.
   - Számla összekapcsolási védelem: `supplier_tax_number.ilike.${cleanTax}%` és `customer_tax_number.ilike.${cleanTax}%` prefix szűrés, megakadályozva, hogy a számlák lekapcsolódjanak a partnerről az adószám felminősítésekor.
2. **Edge Functions (`nav-ingestion-service.ts`, `nav-query-taxpayer`):**
   - Új partnerek szinkronizálásakor a NAV digest-ből felfedezett 8 jegyű adószámokat automatikusan kiegészíti a `queryTaxpayer` segítségével 8-1-2-re, hivatalos cégnevet és székhelycímet mentve.
   - Zero console logging a felhőfüggvényekben.
3. **Python Worker (`partner_upsert.py`):**
   - `is_hungarian_tax_number` & `normalize_hungarian_tax_number`: Felismeri és 8-1-2 formátumra rendezi a 11 jegyű belföldi számokat (validálva az áfakódot [1..5] és a megyekódot [02..20, 41..44, 51]).
   - Az `is_croatian_tax_number()` javítása: nem minősíti horvátnak a magyar 11 jegyű számokat.
   - Step 4 Auto-Upgrade: Meglévő 8 jegyű partnereknél az új számla érkezésekor automatikusan felminősíti a partnert a teljes 8-1-2 adószámra az adatbázisban, és védi az egyidejű 23505 duplikált kulcs ütközéseket.
4. **Backfill Script (`scripts/backfill_partner_tax_numbers.mjs`):**
   - Rate-limittelt, duplikátum-védett Node.js script a meglévő 8 jegyű partnerek kötegelt NAV kiegészítésére.

## Kapcsolódó
- [A-012: NAV Online Számla API v3 integráció](./A-012-nav-integration.md) — NAV sync partner caching logika
- [A-025: Cross-company Invoice Routing](./A-025-cross-company-routing.md) — Duplikátum és cégátirányítási védelem
- [A-027: Partner Ranking & Treemap](./A-027-partner-ranking-treemap.md) — Rangsor logika, NULL-vat LATERAL JOIN
- [A-132: NAV Online Számla v3.0 queryTaxpayer Integráció](./A-132-nav-query-taxpayer-auto-fill.md) — Automatikus adóalanyi adatlekérdezés
- [P-040: Partnertörzs dual-table számlák](../product/decisions/P-040-partners-invoice-panel.md) — Partner UI és 8-1-2 gazdagítás
- [P-044: Külföldi partner megjelenítés](../product/decisions/P-044-foreign-partner-display.md) — Frontend FOREIGN: kezelés
- Worker ADR: `docs/DECISIONS.md` ADR-074 (Idempotens Partner Upsert & Company Router Pre-check)



