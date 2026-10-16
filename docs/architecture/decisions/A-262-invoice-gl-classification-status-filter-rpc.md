# A-262: Számlák Kontírozási Státusz Szerveroldali Szűrése (get_filtered_nav_invoices és get_filtered_submitted_invoices p_gl_status)

**Dátum:** 2026-10-15  
**Státusz:** ✅ Elfogadva  
**Kontextus:** VisiBill Számlák / Könyvelés előkészítés (`/invoices`)  
**Kapcsolódó döntések:** [A-016](./A-016-postgresql-query-strategy.md), [A-050](./A-050-server-side-aggregation-and-n-plus-1-optimization.md), [P-192](../../product/decisions/P-192-invoices-gl-classification-quick-filter-chip.md)

---

## 1. Kontextus és Problémafelvetés
A könyvelők és pénzügyi ügyintézők napi rutinjának legkritikusabb része azon számlák felderítése és könyvelése, amelyek még nincsenek teljeskörűen kontírozva.
Korábban a számlalistában (`/invoices`) nem volt közvetlen szűrési lehetőség a kontírozás állapotára: a felhasználóknak manuálisan kellett végiglapozniuk a listát, vagy a tételes drilldown nézeteket kellett nyitogatniuk annak megállapítására, hogy egy számlán maradt-e még kontírozatlan tétel.

Mivel a számlák kontírozása tételszinten van nyilvántartva a `nav_invoice_items.gl_classifications` és `invoice_items.gl_classifications` JSONB mezőkben (ahol a kulcs a számlatükör sablon azonosítója `preset_id`, az érték pedig a hozzárendelt főkönyvi számla `gl_account_id`), kliensoldalon az 50-es paginált szeletekből lehetetlen volt kiszűrni a teljes adatbázisban található kontírozatlan számlákat.

---

## 2. Döntési Invariánsok és Szabályok
1. **Szerveroldali Szűrés (Zero Client-Side Pagination Drift):** A szűrést kötelezően a két központi számlalekérdező RPC-ben (`get_filtered_nav_invoices` és `get_filtered_submitted_invoices`) kellett megvalósítani az SQL lekérdezés `WHERE` feltételében a helyes összesített sorszám (`total_count`) és a stabil lapozás megőrzése érdekében.
2. **Kontírozatlanság Definíciója (Részben kontírozott számlák védelme):** Ha egy számlán akár egyetlen tétel is kontírozatlan (vagy a számlának még nincsenek letöltött tételei), a számla feladatnak / teendőnek minősül (`unclassified`), így nem tűnhet el a listából mindaddig, amíg minden tétele nem kapott érvényes kontírozást az aktív számlatükör sablon (`preset_id`) szerint.
3. **Preset-Aware Feloldás:** Mindkét táblán (`nav_invoices`, `invoices`) figyelembe veszi az aktív/egyedi vagy alapértelmezett preset-et (`v_preset_id`), így a szűrés dinamikusan igazodik a cég kiválasztott számlatükréhez.

---

## 3. Megvalósítás

### 3.1 Adatbázis Migráció (`supabase/migrations/20261015150000_add_gl_status_filter_to_invoices.sql`)
1. **`get_filtered_nav_invoices`:**
   - Új bemeneti paraméter: `p_gl_status text DEFAULT 'all'::text`.
   - `p_gl_status = 'unclassified'` szűrés:
     - Nincs tétele (`NOT EXISTS (SELECT 1 FROM nav_invoice_items x WHERE x.nav_invoice_id = ni.id)`),
     - VAGY van olyan tétele, ahol a `gl_classifications` üres vagy hiányzik az adott `v_preset_id`-hoz tartozó `gl_account_id`.
   - `p_gl_status = 'classified'` szűrés:
     - Van legalább egy tétele, ÉS minden tétele rendelkezik érvényes `gl_account_id`-val az adott `v_preset_id`-hoz.
2. **`get_filtered_submitted_invoices`:**
   - Új bemeneti paraméterek: `p_preset_id uuid DEFAULT NULL::uuid` és `p_gl_status text DEFAULT 'all'::text`.
   - `p_gl_status = 'unclassified'` szűrés:
     - Ha nincs tétele a számlának, akkor a fejléc szintű `gl_account_id` vagy `gl_classifications` hiánya vizsgálja,
     - Ha van tétele, akkor legalább egy tétel kontírozatlansága vizsgálja.

### 3.2 Frontend Integráció (`useInvoiceFilters.ts` & `InvoiceContext.tsx`)
- Az `InvoiceFilters` típus kibővült a `glStatus: string` mezővel ('all' | 'unclassified' | 'classified').
- URL paraméter összerendelés: `FILTER_URL_KEYS.glStatus = 'gl'`.
- A TanStack Query queryKey-k és a szomszédos oldalakat előretöltő prefetch hívások automatikusan átadják a `p_gl_status` és `p_preset_id` paramétereket.
- A `hasStandardFilters` azonnal `true` értékre vált, ha a `glStatus !== 'all'`, így a "Szűrők törlése" gomb automatikusan törli ezt a szűrőt is.

---

## 4. Következmények és Eredmények
- **Villámgyors lekérdezés:** A tételszintű `EXISTS / NOT EXISTS` indexelt vizsgálat a meglévő `idx_nav_invoice_items_nav_inv_id` index segítségével <25ms alatt fut le nagy elemszámú adathalmazon is.
- **Megbízható Pagináció:** A `total_count` pontosan a kontírozatlan (vagy kontírozott) számlák valós számát tükrözi, a lapozás nem ugrik el és nem ad vissza üres oldalakat.
- **Reaktív URL megoszthatóság:** A `?gl=unclassified` paraméterrel a kontírozatlan nézet közvetlenül könyvjelzőzhető és kollégáknak linkelhető.
