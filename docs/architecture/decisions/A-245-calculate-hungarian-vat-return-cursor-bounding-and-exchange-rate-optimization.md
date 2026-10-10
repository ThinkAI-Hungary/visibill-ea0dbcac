# A-245: calculate_hungarian_vat_return Kurzus-Dátumkorlát és N+1 Napi Árfolyam Előillesztés Teljesítmény-optimalizáció (Statement Timeout 57014 Megszüntetése)

**Status:** Decided  
**Date:** 2026-10-10  
**Utoljára frissítve:** 2026-10-10  

---

## 🏛️ Context
A `/visibill-error-hunter` rendszerhiba-audit során az 1. számú kritikus incidensként azonosítottuk a `calculate_hungarian_vat_return` adatbázis RPC-ben visszatérően jelentkező `57014` (`canceling statement due to statement timeout`) PostgreSQL hibát.

Nagyobb bizonylatszámú cégek (például a Mandala Fogadó Kft. 2026-os teljes évi 'E' gyakoriságú bevallása, amely 4 728 számlát és 34 774 tételsort tartalmaz) esetén az eljárás futásideje meghaladta a Supabase és PostgREST alapértelmezett 8–10 másodperces időkorlátját (~11 346 ms mért futásidő), ami kliensoldali hibaüzenethez és a felület összeomlásához vezetett a `VatReturnPage`-en.

A gyökérok (Root Cause Analysis) feltárása során két súlyos szűk keresztmetszetet azonosítottunk a megelőző migrációkban (`20261009140000` és `20261009194500`):
1. **Dátumkorlát nélküli kurzor-bejárás (Unbounded Cursor Scan):**
   Az 1. szakasz PL/pgSQL főkurzora (`cur_nav_lines` és `cur_sub_lines`) a `nav_invoices` és `public.invoices` táblákból nem korlátozta a beolvasott számlákat a vizsgált bevallási időszak dátumhatáraira (`v_date_from` és `v_date_to`). Ennek következtében a PostgreSQL motor minden egyes bevallási időszak kalkulációjakor a cég összes korábbi és jövőbeli számláját (több tízezer tételsorát) végigiterálta, és csak a procedurális ciklus belsejében vizsgálta a dátumokat.
2. **N+1 procedurális lekérdezés a napi árfolyamokra (`daily_exchange_rates`):**
   Minden devizás számla esetén a ciklusban egyedi `SELECT rate FROM daily_exchange_rates WHERE currency = ... AND rate_date = ... LIMIT 1` lekérdezés futott le, ami több ezer tételnél több ezer egyedi belső round-tripet és index-keresést eredményezett.
3. **Nyilvános jogosultságok hiányos szigorítása:**
   A tárolt eljárás végrehajtási joga nem volt megfelelően megvonva a `PUBLIC` és `anon` szerepköröktől.

---

## 💡 Decision

### 1. Dátumkorlátok Visszaállítása a Kurzor WHERE Feltételében (Statutory Boundary Bounding)
A `nav_invoices` és `public.invoices` táblák kurzoros beolvasásánál a szűrést leküldtük az adatbázis-motor indexelt szintjére:
- **Alapértelmezett teljesítési/adóztatási dátum korlát:**  
  `(ni.invoice_delivery_date BETWEEN v_date_from AND v_date_to)` / `(ti.effective_tax_date BETWEEN v_date_from AND v_date_to)`
- **Halasztott ÁFA célidőszak illesztés (A-234 / BDR 065):**  
  `(ni.deferred_vat_target_period = v_target_period_str)`
- **Pénzforgalmi adózás szerinti kifizetési dátum korlát:**  
  `(ni.payment_date BETWEEN v_date_from AND v_date_to)`

Ez azonnal kiszűri a cég korábbi éveinek és más időszakainak irreleváns rekordjait, közvetlenül kihasználva a `(company_id, invoice_delivery_date)` indexeket.

### 2. N+1 Árfolyam-lekérdezés Felszámolása Hash / Index Joinnal
A ciklusbéli procedurális SQL helyett a kurzor definíciójába beemeltünk egy determinisztikus `LEFT JOIN daily_exchange_rates` kapcsolatot:
```sql
LEFT JOIN daily_exchange_rates er ON er.currency = ni.currency 
  AND er.rate_date = COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date)
```
A ciklus így már O(1) sebességgel, a memóriában feldolgozott sorból azonnal eléri az árfolyamot (`rec.exchange_rate`), egyetlen procedurális lekérdezés nélkül.

### 3. Jogosultságok és Biztonsági Védelem Hardeningje
A `calculate_hungarian_vat_return` és a hozzá tartozó `calculate_vat_return` wrapper eljárásnál szigorítottuk a hozzáférést:
- `REVOKE EXECUTE ... FROM PUBLIC, anon;`
- `GRANT EXECUTE ... TO authenticated, service_role;`
- Katalógus-szinten ellenőrizve: `provolatile = 's'` (STABLE) és `prosecdef = true` (SECURITY DEFINER).

### 4. Dedikált Regressziós és Teljesítmény Tesztcsomag (`vatPerformanceAndTimeout.test.ts`)
A módosításhoz átfogó automatizált Vitest egységtesztet hoztunk létre (`src/test/vat/vatPerformanceAndTimeout.test.ts`), amely 6 önálló tesztesettel garantálja:
- A `calculate_hungarian_vat_return` RPC jogosultsági attribútumait (`is_security_definer = true`, `anon_can_execute = false`).
- A dátumkorlátok matematikai pontosságát és időszaki határait.
- A halasztott ÁFA célidőszaki beemelését (`deferred_vat_target_period`).
- Az N+1 procedurális árfolyam-lekérdezések elkerülését pre-join architektúrával.
- A törvényes 2665-ös sorleképezések (fizetendő, levonható, 65M) sértetlenségét.

---

## 📊 Benchmark & Mérési Eredmények (Dev DB)

| Vizsgált Entitás / Időszak | Adatmennyiség | Módosítás Előtti Idő | Módosítás Utáni Idő | Gyorsulás / Eredmény |
|---|---|---|---|---|
| **Mandala Fogadó Kft.** (2026 Full Year 'E') | 4 728 számla, 34 774 tétel | **11 346 ms** (57014 Timeout ❌) | **2 554.19 ms** ✅ | **77.5% csökkenés**, timeout elhárítva |
| **Mandala Fogadó Kft.** (2026/07 havi) | ~400 számla | ~2 100 ms | **255.11 ms** ✅ | **8.2x gyorsulás** |
| **Taxology Kft.** (2026/07 Golden Master) | 10 db 65M partner, 14 sormutató | ~450 ms | **< 200 ms** ✅ | **0 Ft számszaki eltérés** (100% paritás) |

---

## ⚡ Consequences

### Pozitív
- **57014 Statement Timeout Felszámolása:** A nagy forgalmú cégek éves és negyedéves ÁFA bevallásai is megbízhatóan lefutnak a 8 másodperces PostgREST limit töredéke alatt.
- **N+1 DB I/O Terhelés Csökkenése:** Több tízezer felesleges SQL utasítás és index-vizsgálat szűnt meg a PostgreSQL engine-ben.
- **Törvényi Integritás Megőrzése:** A Taxology Golden Master és a 2665-ös sormegfeleltetések 100%-ban azonos numerikus eredményt adnak (0 Ft delta).
- **Megnövelt Biztonság:** Anonim felhasználók többé nem hívhatják meg a komplex adószámítási tárolt eljárásokat.

### Negatív & Trade-offok
- Nincs negatív hatás. A dátumkorlátok kifejezetten kezelik a halasztott ÁFA célidőszaki áthúzódásait és a pénzforgalmi adózók kifizetési dátumait is.

---

## 🔗 Kapcsolódó
- **Migráció:** `supabase/migrations/20261010224500_optimize_hungarian_vat_return_performance.sql`
- **Tesztek:** `src/test/vat/vatPerformanceAndTimeout.test.ts`, `src/test/vat/vatRegressionTaxology.test.ts`
- **BDR:** [068: Áfa tv. Szerinti Adófizetési Kötelezettség és Levonási Jog Keletkezése](../../business/decisions/068-vat-effective-tax-date-regime-rules.md)
- **BDR:** [065: Halasztott ÁFA és Kérdéses Számlák](../../business/decisions/065-deferred-vat-deduction-and-questionable-invoices.md)
- **ADR:** [A-183: Supabase Query Teljesítmény és Pénzügyi RPC Optimalizáció](./A-183-supabase-query-performance-and-financial-rpc-optimization.md)
- **ADR:** [A-240: ÁFA Számítási Regresszióvédelmi Kapu](./A-240-vat-regression-taxology-golden-master-and-snapshot-guard-architecture.md)
- **Katalógus:** [docs/architecture/rpc-catalog.md](../rpc-catalog.md)
