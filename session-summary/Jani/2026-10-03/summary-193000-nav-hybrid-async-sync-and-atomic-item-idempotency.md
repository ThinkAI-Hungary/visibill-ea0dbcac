# Session Summary — 2026-10-03 19:30

```text
feat(nav, worker): hibrid aszinkron NAV számlaszinkronizáció, PGMQ háttér-tételfeldolgozás (nav_item_jobs), atomi idempotens mentés (RPC) és NAV 503 karbantartási reziliencia (A-193, ADR-077)

- Fast-Path Fejléc-Szinkronizáció és 504 Timeout Védelem (ADR A-193)
  - Probléma: manuális catch-up szinkronizációkor vagy nagyobb számlamennyiségnél (50-100 számla) a szinkron tétellekérés (fetchDetailedItems: true) 60-150 mp-ig tartott, ami Vercel/Edge Function 504 Gateway Timeout-hoz és a szinkronizáció elbukásához vezetett. Emellett a számlák beérkezéséig a banki tranzakciópárosítás is blokkolva volt.
  - Gyökérok: a NAV queryInvoiceData végpontjának számlánkénti szekvenciális hívása és XML parszolása meghaladta az Edge Function 100-150 mp-es futásidejét.
  - Megoldás: Kétütemű hibrid feldolgozás:
    1. Fast-Path (1. ütem): a nav-auto-sync és a nav-query-outbound-invoices Edge Functionök kizárólag a fejléceket mentik (nav_invoices, invoices), ami 3-5 másodperc alatt lefut, a banki tranzakciópárosítás (invoice_rematch) azonnal lefuthat.
    2. Background-Path (2. ütem): a tételsorok letöltését az Edge Function háttérfeladatként feladja az új nav_item_jobs PGMQ sorba (VT = 300s, kötegelve: 20 számla / chunk).
    3. Időkeret-védelem: a nav-auto-sync 100 mp-es futásidőnél kíméletesen megszakítja a ciklust (status: 'deferred'), megelőzve az 504-es gateway hibát.
    4. Visszatekintési ablak harmonizáció: alapértelmezett 7 napos hajnali időablak a cronban, de jelszó/hitelesítő adat mentésekor automatikus 30 napos catch-up trigger a felületről.

- PGMQ Háttér Tételfeldolgozó és NAV 503 Karbantartási Reziliencia (worker/nav_item_processor.py, ADR-077)
  - Új PGMQ queue: nav_item_jobs létrehozása és regisztrációja a pgmq_queues táblában 300s Visibility Timeouttal.
  - Worker bővítés: 7. konkurens queue listener indítása a worker.py-ban (NAV_ITEM_QUEUE), amely a nav_item_processor.py-n keresztül 20-as chunkokban hívja meg a nav-fetch-details Edge Functiont (max 50 chunk / 1000 tétel jobonként).
  - NAV 503 Maintenance elnapolás (JobPostponedException & public.pgmq_set_vt):
    - Probléma: a NAV rendszeres karbantartásakor (HTTP 503) a gyors PGMQ retry-ok kimerítették a 20-as próbálkozási keretet, méregpirulának minősítve a feladatot.
    - Megoldás: 503 hiba esetén a feldolgozó JobPostponedException(delay_seconds=900) kivételt dob, a worker pedig a public.pgmq_set_vt("nav_item_jobs", msg_id, 900) PostgreSQL tárolt eljárással 15 percre elaltatja az üzenetet hiba számlálás és dead-letter nélkül.

- Atomi Idempotens Mentés és Postgres 23505 Védelem (Supabase RPC)
  - Probléma: PostgREST batch .insert([...]) hívásnál egy újrapróbálkozás vagy átfedő szinkronizáció megsértette a nav_invoice_items egyedi megszorítását, elutasítva az egész csomagot.
  - Megoldás: save_nav_invoice_details_and_items PostgreSQL tárolt eljárás (SECURITY DEFINER), amely atomi tranzakcióban menti a számla technikai adatait (details_fetched = true) és ON CONFLICT (nav_invoice_id, line_number) DO UPDATE klauzulával idempotensen frissíti a tételeket.
  - Migrációk:
    - 20261003190000_create_nav_item_jobs_pgmq_queue.sql: nav_item_jobs queue és konfiguráció.
    - 20261003200000_idempotent_nav_invoice_items_and_vt.sql: uq_nav_invoice_items_invoice_line megszorítás, RPC és pgmq_set_vt wrapper.

- Felületi és Kliens Integráció (InvoiceItemsDialog.tsx, NavCredentialsForm.tsx)
  - NavCredentialsForm.tsx: NAV technikai jelszó vagy kulcs mentésekor automatikusan elindít egy 30 napos manuális catch-up szinkronizációt (nav-query-outbound-invoices meghívásával).
  - InvoiceItemsDialog.tsx:
    - On-demand fallback: ha a felhasználó megnyitja a tételes dialógust egy olyan számlánál, ahol details_fetched === false, a dialógus közvetlenül meghívja a nav-fetch-details Edge Functiont az adott egyedi számlára, azonnal betöltve a sorokat.
    - Kétirányú iker-szinkronizáció (findTwinItems): a tételek módosításakor (főkönyvi szám, projekt, ÁFA-kód) a belső tételek (invoice_items) és a NAV tételek (nav_invoice_items) szinkronban frissülnek.

- Minőségbiztosítás, Éles Validáció és DevOps Tesztek
  - Frontend Vitest: src/test/navSyncOrchestration.test.ts (19/19 passed).
  - Python Worker Unit Tesztek: python run_tests.py (119/119 passed).
  - TypeScript build: npm run build hibamentes (21.99s, code 0).
  - Éles érvényesítés a DigitalOcean szerveren (64.226.83.137):
    - Ván Iroda Kft. (4 103 számla): 110 db számla (90 kimenő + 20 bejövő) fast-path szinkronizációja 32.8 mp alatt lefutott, a banki rematch 47 ms alatt összerendelte a tételeket, a worker 2.27 mp alatt letöltötte a tételsorokat (100% lefedettség, 0 hiányzó tétel).
    - PROCONT KFT (872 számla): 90 hiányzó számla 1 229 tételsorának kötegelt háttérfeldolgozása lefutott 5 chunkban, 0 db adatbázishibával.
    - Tételsor integritás: 532 számla 1 599 tételsorának matematikai összegzése 99.4%-ban forintra egyezik a fejléc bruttó összegével (3 db közműszámlánál szabványos ±1 Ft kerekítés).
    - PGMQ állás: 25/25 archivált job, a sorhossz 0.

- Dokumentáció Szinkronizáció (Doc-Sync)
  - Frontend ADR: docs/architecture/decisions/A-193-nav-hybrid-async-sync-and-atomic-item-idempotency.md elkészült, index.md (210 ADR) és A-005-edge-functions.md / edge-functions.md (67 funkció) frissítve.
  - Worker dokumentáció: worker/docs/DECISIONS.md (ADR-077), worker/docs/ARCHITECTURE.md (7 queue, Section 3.11), worker/docs/DATA_FLOW.md (Section 9 diagram), worker/docs/GOTCHAS.md (Section 13) és README fájlok frissítve és pusholva mindkét GitHub tárolóba.
```
