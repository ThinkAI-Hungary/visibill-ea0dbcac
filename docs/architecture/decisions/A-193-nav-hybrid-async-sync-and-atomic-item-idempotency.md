# A-193: Hibrid Aszinkron NAV Számlaszinkronizáció, PGMQ Tétel-feldolgozás, Atomi Idempotens Mentés és NAV 503 Reziliencia

**Status:** Decided  
**Date:** 2026-10-03  
**Utoljára frissítve:** 2026-10-04  

---

## Context

A Visibill és eaisyBooks rendszerekben a NAV Online Számla szinkronizáció az egyik legkritikusabb bemeneti adatfolyam. Az éles működés és mély audit során három alapvető szűk keresztmetszet és megbízhatósági kockázat azonosításra került:

1. **Szinkronizációs Timeoutok Nagy Tételszám / Több Hónap Esetén:**
   * A manuális és automatikus szinkronizációs folyamatok korábban egyetlen szinkron HTTP kérésben (`fetchDetailedItems: true`) próbálták lekérni az összes számla fejlécét és az összes tételsorát.
   * Egy számla tételsorainak lekérdezése (`queryInvoiceData`) a NAV API-ból ~400–800 ms. 100–300 számla esetén ez 60–200 másodpercet vett igénybe.
   * A böngésző fetch kérése (60–100s) és a Supabase Edge Functions wall-clock limitje (150s) miatt a több hónapos vagy nagy forgalmú cégek szinkronizációja `504 Gateway Timeout` vagy kliensoldali abort hibával megszakadt.

2. **Versenyhelyzetből Fakadó Tétel-duplikációk (Race Conditions):**
   * A számlatételek mentése korábban egy külön fejléc `UPDATE`, majd egy tételsor `DELETE`, majd egy `INSERT` lépésből állt.
   * Párhuzamos szinkronizációk, cron átfedések vagy hálózati megszakadások esetén a `(nav_invoice_id, line_number)` egyedi index hiányában az adatbázisban 280 duplikált tételsor halmozódott fel, torzítva az ÁFA és költség analitikát.

3. **NAV 503 Karbantartási Ablakok és Poison Pill Eszkaláció:**
   * A NAV szerverei rendszeres karbantartást vagy időszakos túlterheltséget tapasztalnak (HTTP 503 Service Temporarily Unavailable).
   * A háttérmunkás (Worker) a korábbi viselkedés szerint normál feldolgozási hibának tekintette a karbantartást, agresszívan növelte a hiba-számlálót (`read_ct`), és pár perc alatt áttette a feladatot a poison-pill (dead letter) archívumba, holott a hiba csak átmeneti volt.

4. **Jelszójavítás Utáni Kimaradt Számlák (Lookback rés):**
   * Ha egy cég NAV technikai felhasználójának jelszava lejárt vagy hibás volt, a korábbi sikeres szinkron logok alapján a rendszer csak 2 napos visszatekintést alkalmazott volna mentés után, kihagyva az elmúlt hetekben keletkezett számlákat.

---

## Decision

A rendszer átállt a **Hibrid Aszinkron NAV Orkesztrációs Modellre**, amely szétválasztja az azonnali üzleti igényeket a számítás- és hálózatigényes háttérfeladatoktól:

```
[ Kliens / Cron ] 
       │ 
       ▼
[ nav-auto-sync / nav-query-outbound-invoices ] ──( fast-path, ~2–34 s / cég )──► Fejlécek mentése (nav_invoices)
       │                                                                            │
       ├────────────────────────────────────────┐                                   ▼
       ▼                                        ▼                       [ Rematch PGMQ Queue ]
[ nav_item_jobs PGMQ Queue ]     [ Felhasználói azonnali válasz ]                   │
       │                                                                            ▼
       ▼                                                              [ Tranzakció Párosítás ]
[ Python Worker (nav_item_processor.py) ]
  • 20-as csomagokban hívja: nav-fetch-details
  • NAV 503 esetén: public.pgmq_set_vt(vt = 900) ──► 15 perc kíméletes várakozás
       │
       ▼
[ PostgreSQL: public.save_nav_invoice_details_and_items ]
  • ON CONFLICT (nav_invoice_id, line_number) DO UPDATE
  • Szigorú egyedi index: idx_nav_invoice_items_unique_line
```

### 1. Kétfázisú Szétválasztott Szinkronizáció (Fast-Path & Background Queue)
* **Azonnali réteg (Fast-Path):** A `nav-query-outbound-invoices` és a `nav-auto-sync` alapértelmezetten `fetchDetailedItems: false` beállítással fut. A számlák fejlécei, összegei és adószámai cégenként mérten ~2–34 másodperc alatt bekerülnek az adatbázisba (a számlaszámtól függően; pl. 2026-10-04: 1,8 s és 2,1 s, 2026-10-03: Ván Iroda 32,8 s), így a tételsorok letöltése már nem terheli a kérés időkeretét.
* **Aszinkron tétel-letöltés:** Ha új számlák érkeznek, a rendszer egy `fetch_nav_items` feladatot helyez el a PostgreSQL-natív `nav_item_jobs` PGMQ sorba.
* **On-Demand Kliens Fallback:** Ha a felhasználó a felületen azonnal megnyitja egy számla tételeit az `InvoiceItemsDialog`-ban, a komponens észleli a hiányzó sorokat, és a dedikált `nav-fetch-details` Edge Function segítségével 1 másodperc alatt lekéri és elmenti a tételeket.

### 2. Atomi Idempotens Tételmentés Tárolt Eljárással (RPC)
* Létrejött az autoritatív PostgreSQL tárolt eljárás: `public.save_nav_invoice_details_and_items(p_invoice_id UUID, p_invoice_updates JSONB, p_line_items JSONB)`.
* **ACID Tranzakció:** Egyetlen tranzakcióban frissíti a fejléc metaadatokat (`details_fetched = true`, címek, pénzforgalmi jelölő, ÁFA összesítő), kitörli a NAV által elhagyott elavult sorokat, és az új tételeket `ON CONFLICT (nav_invoice_id, line_number) DO UPDATE` segítségével versenyhelyzet-mentesen frissíti.
* Létrejött az egyedi index: `idx_nav_invoice_items_unique_line ON public.nav_invoice_items (nav_invoice_id, line_number)`.

### 3. PGMQ Láthatóság-Elhalasztás NAV 503 Karbantartás Esetén (`public.pgmq_set_vt`)
* Létrejött a `public.pgmq_set_vt(queue_name text, msg_id bigint, vt integer)` wrapper eljárás.
* A Python worker `nav_item_processor.py` modulja felismeri a HTTP 503 állapotkódot és a NAV karbantartási üzeneteit.
* 503 esetén 15 percre (**vt = 900 másodperc**) elhalasztja az üzenet láthatóságát a sorban, majd dob egy `JobPostponedException`-t, amit a listener nem archivál. A `read_ct` minden újraolvasáskor nő, így `MAX_READ_CT = 20` mellett kb. 5 óra folyamatos karbantartás után kerül dead-letterbe.
* *Javítás 2026-10-04 (worker ADR-078):* az első implementáció a `JobPostponedException`-t elnyelte (az üzenete „503”-at tartalmaz) és archiválta a jobot, illetve `_msg_id` helyett `msg_id`-t olvasott. A hosszú jobokhoz chunkonkénti VT lease megújítás került be (`pgmq_set_vt(..., 300)`).

### 4. Kötelező 30 Napos Catch-Up Garancia Mentéskor
* A `NavCredentialsForm.tsx` jelszójavítás vagy hitelesítő adat mentésekor felülbírálja a szűk (2 napos) visszatekintést, és **legalább 30 napos catch-up szinkronizációt** kényszerít ki (`dateTo - 30 nap`), így a lejárt jelszó miatt korábban kimaradt számlák maradéktalanul bekerülnek.

### 5. Automatikus Kategorizálás a Workerben, Tételsorok Után (follow-up, 2026-10-04)
* **Probléma:** a `nav-auto-sync` a cégciklus után szinkron hívta az `auto-categorize-invoices`-t (p50 27 s, max 58 s), a 100 s time-budgeten kívül → 504-es futások. Ráadásul a fejléc-only szinkron miatt az új NAV számlák tételsorok nélkül kerültek kategorizálásra.
* **Döntés:** a `nav-auto-sync` a [`navItemJobPlanner.ts`](../../../supabase/functions/nav-auto-sync/navItemJobPlanner.ts) alapján cégenként egy `nav_item_jobs` üzenetet küld `auto_categorize: true` jelzővel, ha bejövő számla érkezett vagy frissült. A worker a tételek letöltése **után** hívja az `auto-categorize-invoices` EF-et (best-effort: hibánál a job sikeres marad, nincs dupla NAV/AI költség).
* A `pgmq_send_retry` PostgREST hibáját a kód mostantól ellenőrzi (`enqueue_failed` számláló a válaszban); a supabase-js nem dob kivételt.
* **Deploy sorrend:** előbb a worker (visszafelé kompatibilis), utána a `nav-auto-sync`.
* Tesztek: [`navAutoSyncWorkerHandoff.test.ts`](../../../src/test/navAutoSyncWorkerHandoff.test.ts), worker `test/unit_test/test_nav_item_processor.py`.

### 6. Biztonsági Keményítés: Csak service_role Hívhatja a Belső RPC-ket (2026-10-04)
* Migráció: [`20261003225350_restrict_service_only_queue_and_nav_rpcs.sql`](../../../supabase/migrations/20261003225350_restrict_service_only_queue_and_nav_rpcs.sql).
* `save_nav_invoice_details_and_items`, `pgmq_set_vt`, `pgmq_send_retry`, `peek_queue_items`, `pgmq_metrics_all`, `refresh_company_counts_cache`: `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` + `GRANT ... TO service_role`. Korábban bármely bejelentkezett felhasználó UUID alapján felülírhatta más cég NAV számláját, illetve rejthetett, beszúrhatott vagy olvashatott queue jobokat.
* A `save_nav_invoice_details_and_items` a tételsor `company_id`-ját mindig a szülő számlából veszi (a payloadban kapott értéket figyelmen kívül hagyja → nincs cross-tenant beszúrás).
* Tesztek: pgTAP [`service_only_queue_and_nav_rpcs.test.sql`](../../../supabase/tests/database/service_only_queue_and_nav_rpcs.test.sql) (27 teszt), Vitest [`serviceOnlyRpcGrants.test.ts`](../../../src/test/serviceOnlyRpcGrants.test.ts).

---

## Consequences

### Pozitív
* **Jelentősen csökkent timeout-kockázat:** A tételsor-letöltés (A-193 §1) és az automatikus kategorizálás (§5) a workerben fut, így a `nav-auto-sync` cégenkénti futása csak a fejlécek mentéséből áll. A cégenkénti soros ciklus viszont továbbra is a 150 s-os EF limiten belül fut (lásd Negatív).
* **Azonnali Tranzakció-Párosítás:** Mivel a számla fejlécek (bruttó összeg, partner, számlaszám) azonnal rendelkezésre állnak, a banki tranzakció-párosító algoritmus (`job_type: 'rematch'`) azonnal le tud futni anélkül, hogy a lassú tétellekérdezésre kellene várnia.
* **Tökéletes Adatintegritás:** Az adatbázis szintű egyedi index és az atomi RPC miatt lehetetlen duplikált tételsorokat létrehozni.
* **Karbantartás-Tűrő Háttérmunkás:** A NAV éjszakai és hétvégi karbantartásai nem eredményeznek hibajegyeket vagy beragadt poison-pill üzeneteket.

### Negatív / Költségek
* Új PGMQ queue (`nav_item_jobs`) és új Deno Edge Function (`nav-fetch-details`) üzemeltetési és monitorozási feladata.
* A számlák tételsorai nem azonnal, hanem 10–60 másodperces késleltetéssel jelennek meg a háttérben (kivéve on-demand megnyitáskor, ahol azonnali).
* **Időkeret csak cégindítás előtt:** a `nav-auto-sync` 100 s-os time budgetje egy cég *indítása előtt* ellenőrződik. Egy 99 s-nál induló, ~30 s-os cég a futást 130 s fölé viheti.
* **A „deferred” cégek aznap nem futnak újra:** ha a time budget miatt egy cég kimarad, nincs automatikus újrahívás (a `depth` / `MAX_DEPTH` paraméter létezik, de semmi nem hívja). A bucket UUID alapján fix, így a cég csak másnap ugyanabban az órában kerül sorra ([A-130](./A-130-nav-auto-sync-dawn-load-staggering.md)).

---

## Kapcsolódó
* [A-004: PGMQ mint aszinkron queue](./A-004-pgmq-queue.md)
* [A-005: Edge Functions katalógus](./A-005-edge-functions.md)
* [A-006: Python Worker architektúra](./A-006-python-worker.md)
* [A-012: NAV Online Számla API v3 integráció](./A-012-nav-integration.md)
* [A-096: Hivatalos NAV Tételsor Védőháló](./A-096-authoritative-nav-line-items-crosscheck-and-sync-guard.md)
* [A-130: NAV Auto-Sync Hajnali Időablakos Terheléselosztás](./A-130-nav-auto-sync-dawn-load-staggering.md)
