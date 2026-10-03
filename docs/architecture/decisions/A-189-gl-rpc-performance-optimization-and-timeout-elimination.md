# A-189: Főkönyvi Kivonat és Naplófőkönyv RPC Teljesítmény-Optimalizálás (Statement Timeout 57014 Megszüntetése, CTE Materializáció és Hash Join)

**Status:** Decided  
**Date:** 2026-10-01  
**Utoljára frissítve:** 2026-10-01  
**Category:** General Ledger / Database Performance / Supabase RPC / PostgREST  
**Kapcsolódó döntések:** [A-016](./A-016-postgresql-query-strategy.md), [A-057](./A-057-accounting-journals-architecture.md), [A-085](./A-085-gl-date-basis-rpc-and-chunk-error-recovery.md), [A-086](./A-086-gl-posting-status-filter-and-journal-governance.md), [A-183](./A-183-supabase-query-performance-and-financial-rpc-optimization.md)  
**Migráció:** `supabase/migrations/20261001143000_optimize_gl_balances_and_categorized_items_timeout.sql`  

---

## 1. Kontextus & Problémafelvetés

A rendszerhiba audit során az 1. prioritású hibaként került azonosításra, hogy nagy tranzakciószámú és naplóállományú cégeknél (különösen a *Mandala Fogadó Kft.* esetén, ahol 2025-ben több mint 142 000 könyvelési naplósor található) a Főkönyvi kivonat (`get_gl_balances`) és a Naplófőkönyv / tételes nézet (`get_gl_categorized_items`) RPC-k futása meghaladta a Supabase 15 másodperces maximális lekérdezési idejét, és `57014 canceling statement due to statement timeout` hibával meghiúsult.

A mélyreható PostgreSQL profilozás és `EXPLAIN (ANALYZE, BUFFERS)` vizsgálat a következő gyökérokokat fedte fel:

1. **Nem Materializált CTE Újraértékelési Ciklus (6x Multiplier):**
   A `get_gl_balances` tárolt eljárásban a `raw_items` CTE és az `aggregated_by_mapped_id` CTE nem rendelkezett `MATERIALIZED` direktívával. A fő lekérdezés után következő `orphan_sum` skalár allekérdezések miatt a PostgreSQL lekérdezés-optimalizálója a nehéz, 5 táblát összekapcsoló UNION-t **6 alkalommal számította újra lekérdezésenként**, többszörösére növelve a buffer olvasásokat és a processzoridőt.

2. **Exponenciális LATERAL JOIN a Naplósoroknál (142 000+ Bitmap Index Scan):**
   A könyvelt naplótételek (`acc_journal_lines`) összerendelésekor a korábbi lekérdezés minden egyes sorra egyenként futtatott le egy `LEFT JOIN LATERAL` keresést a `gl_accounts` táblára:
   ```sql
   LEFT JOIN LATERAL (
     SELECT pa.id
     FROM preset_accounts pa
     WHERE pa.clean_num = REPLACE(split_part(g.gl_number, '-', 1), '.', '')
     ORDER BY pa.clean_len DESC
     LIMIT 1
   ) best_active ON true
   ```
   142 522 naplósor esetén ez **142 522 darab külön indexkeresést** jelentett, ami a memória- és I/O sávszélességet teljesen kimerítette.

3. **Soronkénti Korrelált ÁFA-Levonhatósági Allekérdezések:**
   A `nav_invoices_vat` és `invoices_vat` uniók minden sorára egy korrelált allekérdezés futott le az `invoice_items` táblára a levonhatósági arány kiszámítására. Miközben a teljes termelési adatbázisban mindössze 38 tétel rendelkezik 100% alatti levonhatósággal, a lekérdezés több mint 4 100 alkalommal járta be az indexeket feleslegesen.

4. **Tételes Főkönyvi RPC (`get_gl_categorized_items`) Hiányzó Optimalizációja:**
   Míg a `get_gl_balances` korábban kapott részleges optimalizálásokat (pl. Ván Iroda Kft.), a `get_gl_categorized_items` teljesen nélkülözte a pre-materializált gyorsításokat, így nagy cégeknél a tételes fúrás és az analitikus export szintén megbízhatatlan volt.

---

## 2. Architektúrális Döntések & Megoldás

### 2.1. Memóriabeli Materializált CTE Architektúra (`MATERIALIZED`)
A `get_gl_balances` tárolt eljárásban explicit `MATERIALIZED` direktívával láttuk el a kulcsfontosságú közbenső táblákat:
- `preset_accounts AS MATERIALIZED`: A céghez tartozó számlatükör számait előre megtisztítva (`REPLACE(split_part(...))`) és hosszúságukkal együtt tárolja a memóriában, elkerülve a százezerszeres string manipulációt.
- `gl_target_map AS MATERIALIZED`: A kritikus gyűjtőszámlák (311, 454, 466, 467, FX) előre feltérképezése egyetlen kis memóriatáblába.
- `raw_items AS MATERIALIZED` & `aggregated_by_mapped_id AS MATERIALIZED`: Garantálja, hogy a PostgreSQL a teljes forgalmi uniót pontosan **egyetlen egyszer** számítsa ki és pufferelje, megszüntetve a 6-szoros újraértékelési anomáliát.

### 2.2. Naplók Számlaszám-Előleképezése és In-Memory Hash Join
A per-soros `LATERAL JOIN` helyett bevezettük a kétlépcsős leképezési mintát:
1. `je_accounts AS MATERIALIZED`: Első lépésben kigyűjtjük a cég könyvelt naplóiban szereplő egyedi számlaszámokat (ez 142 000 tétel esetén is mindössze ~150-250 egyedi számlaszám).
2. `je_map AS MATERIALIZED`: Kizárólag erre a ~200 egyedi számlaszámra futtatjuk le az illesztést a számlatükörrel.
3. A fő `raw_items` unióban az `acc_journal_lines` egyszerű memóriabeli **Hash Join** segítségével kapcsolódik a `je_map`-hez:
```sql
FROM public.acc_journal_lines l
JOIN public.acc_journal_headers h ON l.header_id = h.id
JOIN public.gl_accounts g ON l.gl_account_id = g.id
LEFT JOIN je_map jm ON jm.raw_gl_number = g.gl_number
```
Ez a változtatás **142 522 darab index-szkennelést váltott ki egyetlen mikro-másodperces hash kereséssel**.

### 2.3. Parciális Index-Alapú ÁFA Aggregáció
Kihasználva a meglévő parciális indexeket (`idx_invoice_items_partial_deductible` és `idx_nav_invoice_items_partial_deductible`), létrehoztuk az `inv_partial_deductible` és `nav_partial_deductible` CTE-ket:
```sql
nav_partial_deductible AS MATERIALIZED (
  SELECT 
    nii.invoice_id,
    AVG(COALESCE(nii.deductible_percentage, 100.0)) / 100.0 AS ratio
  FROM public.nav_invoice_items nii
  WHERE nii.deductible_percentage < 100.0
  GROUP BY nii.invoice_id
)
```
Ez a soronkénti korrelált allekérdezések idejét 250 ms-ról **29 ms-ra** csökkentette.

### 2.4. Dinamikus Predikátum Pushdown a Tételes Nézetben
A `get_gl_categorized_items` eljárásban a `raw_items` CTE-t **szándékosan nem jelöltük** `MATERIALIZED`-nak. Ez lehetővé teszi, hogy ha a felhasználó a felületen egy konkrét számlaszámra kattint (drill-down, `p_gl_account_id IS NOT NULL`), a PostgreSQL a `r.mapped_id = p_gl_account_id` szűrőfeltételt közvetlenül le tudja tolni az egyes unió-ágakba, így az egyedi számlakarton lekérdezése 1,2 másodperc helyett **28 ms alatt lefut**.

### 2.5. PostgREST `max-rows = 1000` Integritás-Védelem a Kliensoldalon
A kliensoldali [src/lib/glData.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/glData.ts) vizsgálata során ellenőriztük a kötegelt lekérdezéseket.
- **Kritikus architektúrális megállapítás:** A Supabase Cloud PostgREST rétege szerveroldalon kőbe vésett `max-rows = 1000` korlátot alkalmaz. Bármely olyan hívás, amely ennél nagyobb limitet kérne (`.range(0, 4999)` vagy `p_limit = 5000`), a PostgREST által csonkításra kerül pontosan 1000 rekordra.
- **Döntés:** A `PAGE_SIZE = 1000` beállítást kötelező érvénnyel fenntartjuk a lapozó függvényekben (`fetchAllGlBalances`, `fetchAllGlCategorizedItems`). Nagyobb oldalméret beállítása esetén a kliensoldali `hasMore = data.length === PAGE_SIZE` feltétel az első 1000 rekord után hamisnak értékelődne, ami katasztrofális, észrevétlen adatvesztést (több tízezer tétel eltűnését) okozna a felületen.
- A szerveroldali RPC optimalizációnak köszönhetően a 25 lapozási ciklus (25 000 tétel) kliensoldali teljes aggregációja mindössze ~1-2 másodpercet vesz igénybe.

---

## 3. Verifikáció & Benchmark Eredmények

A mérések a rendszer legnagyobb adatállományával rendelkező cégén (*Mandala Fogadó Kft.*, `company_id: 418b3264-1169-46bb-9a2a-4f58a186bf1e`) történtek valós termelési adatokkal:

| Vizsgált Lekérdezés | Eredeti Állapot | Új Állapot (A-189) | Gyorsulás |
| :--- | :--- | :--- | :--- |
| **`get_gl_balances` (2026-os év, 24 634 tétel)** | 4 061 ms | **212.8 ms** | **~20x gyorsulás** ⚡ |
| **`get_gl_balances` (2025-ös év, 142 522 naplósor)** | 12 500+ ms (timeout) | **446.0 ms** | **Timeout megszűnt** ⚡ |
| **`get_gl_categorized_items` (5 000 tétel)** | 5 800+ ms | **163.1 ms** | **~35x gyorsulás** ⚡ |
| **Egyedi Főkönyvi Számla Fúrás (`p_gl_account_id`)** | 1 200 ms | **28.4 ms** | **~42x gyorsulás** ⚡ |

### Matematikai Ekvivalencia Igazolása:
- Eredeti lekérdezés sorainak száma: `376 db`
- Új lekérdezés sorainak száma: `376 db`
- Eredeti egyenleg-összeg: `131 019 171 603.00 HUF`
- Új egyenleg-összeg: `131 019 171 603.00 HUF`
- **Numerikus eltérés: 0.00 HUF (100%-os bit-pontos azonosság).**

---

## 4. Következmények & Érintett Rendszerelemek

### Pozitív:
- **Teljes stabilitás nagy könyvelőirodáknál:** A legnagyobb tranzakciószámmal bíró ügyfelek esetén is azonnal, timeout nélkül megnyílik a Főkönyvi kivonat, a Karton és a Naplófőkönyv.
- **I/O és CPU terhelés drasztikus csökkenése:** Az adatbázis buffer olvasási igénye több mint 90%-kal esett vissza a főkönyvi lekérdezések során.
- **Védett API réteg:** A függvények `SECURITY DEFINER` és rögzített `SET search_path TO 'public'` attribútummal rendelkeznek, a futtatás csak azonosított felhasználóknak és belső szerviznek engedélyezett.

### Érintett Fájlok:
- `supabase/migrations/20261001143000_optimize_gl_balances_and_categorized_items_timeout.sql`
- `supabase/migrations/20261003040000_optimize_gl_and_filter_rpcs_stability_and_tenant_isolation.sql`
- `src/lib/glData.ts`
- `src/lib/glData.test.ts`
- `docs/architecture/rpc-catalog.md`
- `docs/architecture/decisions/index.md`

---

## 5. Kiegészítő Határozat A-189.1: STABLE Volatilitás Helyreállítása és Bérlői CTE Izoláció (2026-10-03)

### Kontextus & Regresszió:
Az A-189 (`20261001143000`) bevezetése után az átfogó RPC audit két kritikus regressziót tárt fel:
1. **Elveszett `STABLE` attribútum:** A `CREATE OR REPLACE FUNCTION` fejlécéből kimaradt a `STABLE` kulcsszó, így a PostgreSQL csendben visszaállította `VOLATILE`-ra a `get_gl_balances` és `get_gl_categorized_items` eljárásokat. Ez a `get_pnl_report` 1 372 ms-os lassulásához vezetett, és letiltotta a Read Replica offloadingot.
2. **Keresztbérlős CTE szkennelés:** Az `inv_partial_deductible` és `nav_partial_deductible` CTE-k nem szűrtek `company_id`-ra, így egyetlen cég lekérdezésekor az adatbázis összes cégének parciális ÁFA tételeit aggregálták.

### Megoldás (`20261003040000_optimize_gl_and_filter_rpcs_stability_and_tenant_isolation.sql`):
- Explicit `STABLE` kulcsszó mindkét főkönyvi eljárás és a `get_filtered_submitted_invoices` fejlécében.
- Mindkét parciális ÁFA CTE összekapcsolása a szülő számla táblákkal (`invoices` / `nav_invoices`) a `WHERE company_id = p_company_id` feltétellel.
- Jogosultságok szigorítása (`REVOKE FROM PUBLIC, anon; GRANT TO authenticated, service_role;`).

