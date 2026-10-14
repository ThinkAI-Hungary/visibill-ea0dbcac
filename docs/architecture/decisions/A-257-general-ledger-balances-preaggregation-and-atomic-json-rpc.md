# A-257: Főkönyvi Egyenlegek Előaggregáció és Atomi JSON RPC (Upstream Timeout Felszámolás)

**Status:** Decided  
**Date:** 2026-10-14  
**Utoljára frissítve:** 2026-10-14  
**Kapcsolódó döntések:**  
- [A-150: Főkönyvi Lekérdezés Teljesítmény, Hibakezelési Reziliencia & DOM/Layout Védelem](./A-150-gl-performance-resilience-and-layout-hardening.md)  
- [A-151: Eredménykimutatás és Mérleg Lekérdezési Vihar Megszüntetése](./A-151-pnl-and-balance-sheet-query-storm-elimination.md)  
- [A-152: Analitikai és Jelentéskészítő RPC Stabilitás (STABLE)](./A-152-rate-limiter-rpc-stability-and-realtime-leak-hardening.md)  
- [A-256: Könyvelési Napló (JournalView) Szerveroldali Lapozás és Window Aggregációk](./A-256-general-ledger-journal-view-server-side-pagination-and-window-aggregates.md)  

---

## Context

A VisiBill kettős könyvviteli és főkönyvi moduljában a főkönyvi kivonat (`GeneralLedgerTable`) és az összehasonlító főkönyvi táblázat (`GeneralLedgerComparisonTable`) a `public.get_gl_balances` tárolt eljárást hívja meg az egyenlegek és tételszámok lekérdezéséhez.

Nagyobb könyvelőirodai és ERP számlatükör sablonok esetén (például a Mandala Fogadó Kft által használt RLB sablonban, ahol **8 770 főkönyvi számla** van regisztrálva) az alábbi súlyos teljesítmény- és skálázhatósági szűk keresztmetszetek alakultak ki:

1. **Kliensoldali 9-kéréses lapozási hurok:**
   A PostgREST alapértelmezésben 1 000 sorra vágja le a `RETURNS TABLE` típusú függvények válaszát. A kliensoldali `fetchAllGlBalances` segédfüggvény egy `while (hasMore)` ciklusban `.range(0, 999)`, `.range(1000, 1999)` hívásokkal, **9 egymást követő szekvenciális HTTP kéréssel** próbálta letölteni a teljes listát.
2. **PostgREST Range Pushdown hiánya:**
   Mivel a PostgREST nem tolja le a `LIMIT / OFFSET` feltételt a tárolt eljárás belsejébe, a PostgreSQL motor a `get_gl_balances` teljes SQL lekérdezését mind a 9 alkalommal a nulláról lefuttatta, minden alkalommal 8 770 sort számolva ki.
3. **N+1 Join & Aggregáció Terhelés:**
   A `get_gl_balances` belső sémájában a `preset_accounts` és az összesített `raw_items` joinolása számlánként zajlott. Bár a 8 770 számlából mindössze 8–55 számlának volt tényleges mozgása/egyenlege, a lekérdezés 7 000 ms feletti futásidőt produkált hívásonként.
4. **Upstream Request Timeout (504) és Adatbázis Torlódás:**
   A 9 kérés × 7 másodperc = **63 másodperces összesített futási idő** messze meghaladta a Cloudflare és a PostgREST upstream időkorlátját. Emiatt a felület 504 Gateway Upstream Timeout hibát jelzett, a párhuzamos lekérdezések pedig felélték a PostgreSQL kapcsolatkészletét, dominó-hatásként statement timeoutot (57014) okozva a többi képernyőn is (pl. `filteredNavInvoices`).

---

## Decision

A probléma végleges elhárítására kétlépcsős adatbázis- és kliensoldali architektúrális optimalizálást vezettünk be a `20261014150000_optimize_gl_balances_preaggregation_and_json_rpc.sql` migrációban:

### 1. PostgreSQL Belső Előaggregáció (`grouped_items` CTE)
A `get_gl_balances` törzsében a számlákhoz kapcsolás előtt egy önálló, aggregált CTE-be csoportosítjuk az összes nyers tételt (`raw_items`):

```sql
grouped_items AS (
  SELECT
    r.mapped_id,
    COALESCE(SUM(r.amount), 0)::numeric AS total_balance,
    COALESCE(SUM(CASE WHEN NOT r.is_temporary THEN r.amount ELSE 0 END), 0)::numeric AS final_balance,
    COALESCE(SUM(CASE WHEN r.is_temporary THEN r.amount ELSE 0 END), 0)::numeric AS temp_balance,
    COALESCE(SUM(r.sub_count), 0)::bigint AS item_count
  FROM raw_items r
  WHERE r.mapped_id IS NOT NULL
  GROUP BY r.mapped_id
)
SELECT
  pa.id AS gl_account_id,
  pa.gl_number::text,
  pa.short_name::text,
  COALESCE(gi.total_balance, 0)::numeric AS total_balance,
  COALESCE(gi.final_balance, 0)::numeric AS final_balance,
  COALESCE(gi.temp_balance, 0)::numeric AS temp_balance,
  COALESCE(gi.item_count, 0)::bigint AS item_count
FROM preset_accounts pa
LEFT JOIN grouped_items gi ON gi.mapped_id = pa.id
WHERE NOT p_only_active OR gi.mapped_id IS NOT NULL;
```

* **Eredmény:** A `grouped_items` mindössze ~8–55 sort tartalmaz. A 8 770 preset számla egyetlen, villámgyors memóriabeli `Hash Left Join`-nal kapcsolódik a pre-aggregált adathoz.
* **Futási idő:** 7 000 ms-ról **~140 ms-ra csökkent** (50× gyorsulás).
* **Opcionális szűrés:** Bevezetésre került a `p_only_active boolean DEFAULT false` paraméter, amellyel a 0 egyenlegű és forgalommentes számlák kiszűrhetők.

### 2. Atomi JSON RPC (`get_gl_balances_json`)
Létrehoztunk egy dedikált wrapper RPC-t, amely `RETURNS jsonb`:

```sql
CREATE OR REPLACE FUNCTION public.get_gl_balances_json(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_posting_status text DEFAULT 'ALL'::text,
  p_only_active boolean DEFAULT false::boolean
)
RETURNS jsonb ...
```

* **PostgREST bypass:** A JSONB visszatérési értéket a PostgREST nem vágja le 1 000 sornál, hanem egyetlen atomi HTTP válaszban továbbítja a kliensnek (tömörítve mindössze ~130 KB méretben).
* **Kliensoldali egyszerűsítés:** A `src/lib/glData.ts:fetchAllGlBalances` elsődlegesen ezt az atomi RPC-t hívja meg 1 kérésben.
* **Reziliens Fallback:** Amennyiben a wrapper RPC valamilyen régebbi környezetben nem elérhető, a kliens automatikusan és transzparensen visszavált a paginált `get_gl_balances` táblázatos hívásra.
* **Visszafelé kompatibilitás:** A meglévő SQL függvények (`get_bs_report`, `get_pnl_report`) és riportok változatlanul a táblázatos `get_gl_balances`-t hívhatják, élvezve a 140 ms-os belső előaggregáció előnyeit.

---

## Consequences

### Pozitív
* **9× kevesebb hálózati kérés:** 9 szekvenciális HTTP kérés helyett 1etlen atomi kérés.
* **99%-os sebességnövekedés:** A 8 770 számlás sablon betöltési ideje 63 másodpercről **~150–250 ms-ra** csökkent.
* **Gateway Upstream Timeout elhárítva:** A Cloudflare / PostgREST 504 timeout hiba véglegesen megszűnt.
* **DB Connection Pool tehermentesítés:** A háttérbeli lockok és kapcsolat-túlfoglalások megszűnésével a párhuzamos funkciók (pl. `filteredNavInvoices`, banki tranzakció pipeline) sem futnak időtúllépésre.

### Negatív / Költségek
* Két párhuzamos függvényaláírás fenntartása (`get_gl_balances` és `get_gl_balances_json`), amelyeket séma-módosításkor szinkronban kell tartani.
