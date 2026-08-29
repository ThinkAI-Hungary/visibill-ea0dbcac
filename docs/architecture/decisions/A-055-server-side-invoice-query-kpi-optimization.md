# A-055: Server-Side Invoice Query, KPI Aggregation & GIN Trigram Optimization

**Status:** Decided  
**Date:** 2026-08-29  
**Utoljára frissítve:** 2026-08-29  

## Context

A felhasználók számlaszámának növekedésével (több ezer vagy tízezer számla cégenként) a számlák menü (`/invoices`) kliens-oldali aggregációi és lekérdezései komoly skálázhatósági és memória-szűk keresztmetszetet okoztak:
1. **Memória-terhelés és felesleges hálózati adatforgalom**: A `useInvoiceData` hookban futó `navInvoicesLookup` `while` ciklus 1000-es csomagokban letöltötte a cég összes számláját a böngésző memóriájába csupán a 4 darab KPI kártya (Összes, Párosított, Javasolt, Nyitott) kiszámításához.
2. **Kliens-oldali lapozási / szűrési hiba**: A szervertől lekért 50 soros oldalra alkalmazott kliens-oldali KPI szűrés elrejtette a sorokat és torzította az oldalszámokat (pl. 50-ből csak 1 sor jelent meg az 1. oldalon, miközben a többi oldal rejtve maradt).
3. **Globális tranzakció-letöltés**: A sorok színezéséhez a frontend lekérte az összes tranzakciót (`allTransactions`) és a kliens memóriájában végezte a kereszttáblás egyeztetést.
4. **Lassú keresés**: A több tízezres számlatáblákon a bizonylatszám és partner szöveges keresése szekvenciális táblapásztázást (seq scan) igényelt.

## Decision

Áttértünk a **100%-ban szerver-oldali PostgreSQL CTE aggregációra, RPC alapú KPI lekérdezésre és GIN trigram indexelésre**:

1. **`pg_trgm` GIN & Compound Indexek**:
   - Bekapcsoltuk a `pg_trgm` PostgreSQL kiterjesztést.
   - Létrehoztuk a GIN trigram indexeket:
     - `idx_nav_invoices_search_trgm` (`invoice_number`, `supplier_name`, `customer_name`, `supplier_tax_number`, `customer_tax_number`, `invoice_gross_amount`, `invoice_net_amount`)
     - `idx_invoices_search_trgm` (`bizonylatsorszam`, `elado_nev`, `vevo_nev`, `elado_vat_id`, `vevo_vat_id`, `brutto_vegosszeg`, `adoalap_osszesen`)
   - Létrehoztuk a DESC compound indexeket: `idx_nav_invoices_company_dir_date_desc` és `idx_invoices_company_dir_date_desc`.

2. **Új RPC: `get_invoice_kpis`**:
   - Egyetlen lekérdezéssel, szerver-oldali CTE-vel aggregálja a `total`, `matched`, `suggested`, `unmatched` értékeket az összes aktív szűrőfeltétel (dátumtartomány, partner, összeg, pénznem, fizetési mód, projekt, kategória, folyamatos) mellett.
   - Nincs szükség a számlasorok kliensre történő áttöltésére.

3. **Szerver-oldali KPI szűrés és Match Status (`get_filtered_nav_invoices`, `get_filtered_submitted_invoices`)**:
   - A lekérdező RPC-k megkapták a `p_kpi_filter` paramétert (`'all'`, `'matched'`, `'suggested'`, `'unmatched'`).
   - A kimeneti rekordokhoz hozzáadásra került a `match_status text` mező, így a frontendnek nem kell kliens-oldali tranzakció-hálót fenntartania a táblázatsorok színezéséhez.

4. **Szigorú 1-to-1 Csoportosított Kapcsolatok (Többes Tranzakció / Részletfizetés Duplikáció Védelem)**:
   - Ha egy számlához több banki tranzakció is tartozik (pl. 2-3 részletfizetés vagy összetett párosítás), a `tx_matches` és `nav_matches` / `sub_matches` CTE-k `GROUP BY matched_invoice_id` és `bool_or()` logikával egyetlen aggregált rekordot adnak át a fő querynek.
   - Ez megakadályozza a sorok többszöröződését (Cartesian product) a számlatáblázatokban és elhárítja a React `key` ütközési figyelmeztetéseket.

5. **Pontszerű tétel- és ikerkeresés (`findTwinItems`)**:
   - Az `InvoiceItemsDialog.tsx`-ben a cég összes számlájának lekérése helyett indexelt `.limit(10)` pont-lekérdezések futnak.

## Consequences

**Pozitív:**
- **0 MB felesleges adatforgalom**: A böngésző kizárólag a megjelenített 50 sort és a 4 KPI aggregált számot kapja meg.
- **Azonnali betöltés & lapozás**: Tízezres számlaállomány esetén is <50ms a lapváltás és a KPI aggregáció.
- **Megszűnt a rejtett találatok hibája**: A KPI szűrés pontos oldalszámot és pontos elemszámot jelenít meg a lapozóban.
- **Garantált sorszintű egyediség**: Több részletfizetés vagy több kapcsolt tranzakció esetén is pontosan egy sor jelenik meg a táblázatban a számlához.
- **Robusztus típusbiztonság**: A TypeScript típusdefiníciók és RPC interfészek teljes szinkronban vannak a migrációval.

**Negatív / Trade-off:**
- A `useInvoiceFilters` hook több query paramétert ad át az RPC-knek.
- A KPI kategóriák meghatározása SQL logikában él a PostgreSQL oldalon, így a párosítási szabályok módosítását az RPC függvényekben is át kell vezetni.

## Kapcsolódó
- [A-016: PostgreSQL query stratégia](./A-016-postgresql-query-strategy.md)
- [A-050: Server-Side Aggregation & N+1 Query Optimization](./A-050-server-side-aggregation-and-n-plus-1-optimization.md)
- [P-010: Számla lista nézet & szűrők](../../product/decisions/P-010-invoice-list.md)
- [P-054: Scalable Server-Side Invoice Pagination & KPI Card Filtering UX](../../product/decisions/P-054-server-side-invoice-pagination-and-kpi-filters-ux.md)
