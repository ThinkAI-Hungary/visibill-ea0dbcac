# Session Summary — 2026-10-17 08:32

```text
perf(invoices, kpis, transactions, fx): 57014 statement timeout hibák teljeskörű elhárítása (cockpitReceivables, invoiceKpis, cockpitBankTransactions, fxDifferences), funkcionális és deviza részleges indexálás, CTE dátumpushdown és előtöltési debounce

- PostgreSQL 57014 Statement Timeout Hibák Feltárása és Architektúrális Elemzés:
  - Hibaazonosítás: Mandala Fogadó Kft (4,931 számla, 5,920 tranzakció) teljes éves szűrésénél (2026-01-01 – 2026-12-31) a számlalista és a UnifiedFinancialCockpit dashboard 4 párhuzamos lekérdezése összeakadt és 57014 statement timeoutot dobott:
    1. cockpitReceivablesInvoices (kimenő számlák listaoldal)
    2. invoiceKpis (számla státusz összefoglaló KPI kártyák)
    3. cockpitBankTransactions (még nem párosított banki tranzakciók)
    4. fxDifferences (devizás árfolyam-különbözetek lekérdezése és havi összesítése)
  - Gyökérok:
    1. A nav_invoices és invoices táblákon a COALESCE(invoice_delivery_date, invoice_issue_date) kifejezésre nem létezett index, így teljesítmény-igényes szekvenciális táblapásztázás (Seq Scan) futott le.
    2. A useInvoiceFilters.ts azonnal, várakozás nélkül lőtte ki a lapozás előtöltését (prefetchQuery 2. és 3. oldal), amely az 1. oldal lekérdezésével együtt telítette a kapcsolatkészletet (connection pool saturation) és CPU-t.
    3. A get_invoice_kpis RPC a courier_reports táblára minden egyes sornál duplán futtatott korrelált EXISTS allekérdezést, ami 3,852 kimenő számla esetén 31,929 puffer-olvasást generált.
    4. A transactions táblán a párosítatlan tranzakciók szűrése (WHERE matched_invoice_id IS NULL) 5,920 index-sort olvasott be, amiből 1,040 sort utólagosan dobott el a szűrő.
    5. A get_fx_differences RPC a cég teljes élettörténetének összes párosított tranzakcióját összekapcsolta a devizás számlákkal a 4 belső CTE-ben, lefuttatott 2 LATERAL JOIN-t a daily_exchange_rates táblán, és a dátumszűrőt csak a legvégén alkalmazta. A nav_invoices / invoices táblákon hiányzott az index a devizanemre (currency != 'HUF'), a transaction_invoice_matches táblán pedig az (invoice_source, invoice_id) index.

- Adatbázis & Backend Optimalizációk (Dev & Prod DB):
  - Migráció 1 (20261017080000_optimize_nav_invoices_filter_timeout.sql):
    - Funkcionális összetett B-tree indexek:
      - idx_nav_invoices_company_dir_coalesce_delivery ON nav_invoices (company_id, invoice_direction, COALESCE(invoice_delivery_date, invoice_issue_date) DESC)
      - idx_invoices_company_dir_coalesce_delivery ON invoices (company_id, invoice_direction, COALESCE(teljesites_datuma::date, kibocsatas_datuma::date) DESC)
    - get_filtered_nav_invoices és get_filtered_submitted_invoices RPC optimalizáció: felesleges duplikált JOIN-ok megszüntetése, futárriportok előzetes materializálása.
  - Migráció 2 (20261017083000_optimize_invoice_kpis_and_transactions_unmatched_index.sql):
    - Részleges index a párosítatlan tranzakciók azonnali kiszolgálására:
      - idx_transactions_company_unmatched_date ON transactions (company_id, transaction_date DESC) WHERE (matched_invoice_id IS NULL)
    - get_invoice_kpis RPC átírása:
      - MATERIALIZED CTE-k (courier_full_nav, courier_full_refs, all_tx_distinct, all_tx_matches, sub_matches) a korrelált allekérdezések felszámolására.
      - Dupla JOIN megszüntetése a végső státusz kiértékelésben.
      - Kis-/nagybetű független irányillesztés (UPPER(invoice_direction) = UPPER(p_direction)).
      - STABLE SECURITY DEFINER beállítás, anonim jogok megvonása (REVOKE FROM public, anon).
  - Migráció 3 (20261017084500_optimize_fx_differences_and_foreign_indexes.sql):
    - Részleges indexek a devizás számlákra (currency != 'HUF'):
      - idx_nav_invoices_company_foreign_currency ON nav_invoices (company_id, currency) WHERE (currency IS NOT NULL AND currency != 'HUF')
      - idx_invoices_company_foreign_currency ON invoices (company_id, penznem) WHERE (penznem IS NOT NULL AND penznem != 'HUF')
    - Összetett index a kapcsolótáblán a szekvenciális pásztázás (Seq Scan) ellen:
      - idx_tim_source_invoice ON transaction_invoice_matches (invoice_source, invoice_id)
    - get_fx_differences RPC CTE dátumpushdown:
      - A p_date_from és p_date_to szűrők közvetlen beágyazása mind a 4 CTE-be (nav_matched_direct, nav_matched_via_link, submitted_matched_direct, submitted_matched_via_link), elkerülve a teljes történeti feldolgozást.
      - STABLE SECURITY DEFINER beállítás és anonim végrehajtási jogok visszavonása.

- Frontend Lekérdezés-Optimalizáció (useInvoiceFilters.ts, useDashboardData.ts):
  - Lapozási előtöltési vihar (prefetch query storm) elhárítása:
    - 800 ms-os debounce időzítő bevezetése az előtöltési logikára (useRef alapú timer és cancelPrevious).
    - Betöltés alatti blokkolás: amíg az elsődleges lista lekérdezése folyamatban van (navLoading || navFetching), a rendszer felfüggeszti a háttérbeli lapozási előtöltést, megvédve az adatbázis kapcsolatkészletét.
  - fxDifferences lekérdezés védelme:
    - staleTime: 60000 (1 perc) beállítása a useDashboardData.ts-ben, megelőzve az ablakfókusz és tab-váltás alatti felesleges azonnali újraindulásokat.

- Élő Adatbázis Teljesítmény-mérések (Bizonyított Gyorsulás a Prod DB-n):
  - cockpitReceivablesInvoices (kimenő számlák): >8,000 ms timeout -> 373.79 ms (stabil, azonnali válasz).
  - cockpitBankTransactions (banki tranzakciók): 30.38 ms -> 8.13 ms (73%-os futásidő csökkenés / 3.7x sebesebb), Index Scan: 4.54 ms -> 0.26 ms (17x gyorsulás!), memóriapuffer-olvasások: 1,892 -> 718 (62%-os csökkenés), eldobott sorok: 1,040 -> 224.
  - get_invoice_kpis OUTBOUND: memóriapuffer-műveletek: 31,929 -> 8,872 (72.2%-os terheléscsökkenés!).
  - get_invoice_kpis INBOUND: 91.74 ms -> 75.27 ms, memóriapuffer-műveletek: 15,018 -> 9,350 (38%-os csökkenés).
  - get_fx_differences: 950.86 ms (csúcsidőben >8,000 ms timeout) -> 33.33 ms (96.5%-os gyorsulás / 28.5x sebesebb!), memóriapuffer-olvasások: 8,809 -> 5,122, fizikai lemezről olvasott blokkok: 372 -> 10 (97%-os I/O csökkenés!).
  - Adatintegritás: 100.000% egyezés (17 rekord, szum: -33,153.12 HUF).

- Minőségbiztosítás (QA) & Verifikációs Kapuk:
  - Unit tesztek hozzáadva: src/test/rpcPerformanceAndResilience.test.ts (előtöltési debounce, betöltés alatti blokkolás, get_invoice_kpis invariáns, részleges tranzakció index feltételilleszkedés, get_fx_differences szerződés és árfolyam-különbözet képlet-invariánsok).
  - Vitest tesztfuttatás: 26/26 sikeresen lefutott teszt (0 hiba).
  - TypeScript típusellenőrzés: tsc --project tsconfig.app.json --noEmit hibamentes (0 hiba).
  - PostgreSQL statikus elemzés: plpgsql_check Dev és Prod DB-n 0 hiba, 0 figyelmeztetés.

- DevOps, Környezeti Izoláció & Élesítés:
  - Dev DB (qhvcdqkqpgpdxogqqvyr) tesztelés és mérés az élesítés előtt.
  - Célzott, szelektív hotfix ágak (hotfix/kpi-and-unmatched-tx-perf, hotfix/fx-differences-perf) nyitása a main-ből, cherry-pickelve a migrációkat és a teszteket a develop-on lévő többi félkész feladat izolálására.
  - Migrációk sikeres élesítése a Production adatbázison (vxxgvdlqvvchtlmqnrqf).
  - Git push mindkét távoli ágra (origin/main: e78304c1, origin/develop: 1ccccd27).
  - config.toml project_id invariáns ellenőrizve és megtartva (main: vxxgvdlqvvchtlmqnrqf, develop: qhvcdqkqpgpdxogqqvyr).
  - Graphify kódbázis tudásgráf frissítve és tárolva (28,190 node, 48,540 edge).
```
