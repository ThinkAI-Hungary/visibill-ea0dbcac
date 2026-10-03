# A-193: Hibrid Aszinkron NAV Számlaszinkronizáció, PGMQ Tétel-feldolgozás, Atomi Idempotens Mentés és NAV 503 Reziliencia

**Status:** Decided  
**Date:** 2026-10-03  
**Utoljára frissítve:** 2026-10-03  

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
[ nav-auto-sync / nav-query-outbound-invoices ] ──( 3-5 sec fast-path )──► Fejlécek mentése (nav_invoices)
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
* **Azonnali réteg (Fast-Path):** A `nav-query-outbound-invoices` és a `nav-auto-sync` alapértelmezetten `fetchDetailedItems: false` beállítással fut. A számlák fejlécei, összegei és adószámai 3–5 másodperc alatt bekerülnek az adatbázisba, garantálva a timeout-mentes működést akár több száz számla esetén is.
* **Aszinkron tétel-letöltés:** Ha új számlák érkeznek, a rendszer egy `fetch_nav_items` feladatot helyez el a PostgreSQL-natív `nav_item_jobs` PGMQ sorba.
* **On-Demand Kliens Fallback:** Ha a felhasználó a felületen azonnal megnyitja egy számla tételeit az `InvoiceItemsDialog`-ban, a komponens észleli a hiányzó sorokat, és a dedikált `nav-fetch-details` Edge Function segítségével 1 másodperc alatt lekéri és elmenti a tételeket.

### 2. Atomi Idempotens Tételmentés Tárolt Eljárással (RPC)
* Létrejött az autoritatív PostgreSQL tárolt eljárás: `public.save_nav_invoice_details_and_items(p_invoice_id UUID, p_invoice_updates JSONB, p_line_items JSONB)`.
* **ACID Tranzakció:** Egyetlen tranzakcióban frissíti a fejléc metaadatokat (`details_fetched = true`, címek, pénzforgalmi jelölő, ÁFA összesítő), kitörli a NAV által elhagyott elavult sorokat, és az új tételeket `ON CONFLICT (nav_invoice_id, line_number) DO UPDATE` segítségével versenyhelyzet-mentesen frissíti.
* Létrejött az egyedi index: `idx_nav_invoice_items_unique_line ON public.nav_invoice_items (nav_invoice_id, line_number)`.

### 3. PGMQ Láthatóság-Elhalasztás NAV 503 Karbantartás Esetén (`public.pgmq_set_vt`)
* Létrejött a `public.pgmq_set_vt(queue_name text, msg_id bigint, vt integer)` wrapper eljárás.
* A Python worker `nav_item_processor.py` modulja felismeri a HTTP 503 állapotkódot és a NAV karbantartási üzeneteit.
* 503 esetén nem engedi növelni az instant hiba-számlálót (`read_ct`), hanem 15 percre (**vt = 900 másodperc**) elhalasztja az üzenet láthatóságát a sorban, majd dob egy `JobPostponedException`-t, megakadályozva az üzenet korai dead-letter státuszba kerülését.

### 4. Kötelező 30 Napos Catch-Up Garancia Mentéskor
* A `NavCredentialsForm.tsx` jelszójavítás vagy hitelesítő adat mentésekor felülbírálja a szűk (2 napos) visszatekintést, és **legalább 30 napos catch-up szinkronizációt** kényszerít ki (`dateTo - 30 nap`), így a lejárt jelszó miatt korábban kimaradt számlák maradéktalanul bekerülnek.

---

## Consequences

### Pozitív
* **Zéró Timeout Veszély:** A manuális és automatikus szinkronizáció soha többé nem fut futási idő limitbe, a képernyő másodpercek alatt megjeleníti az új számlákat.
* **Azonnali Tranzakció-Párosítás:** Mivel a számla fejlécek (bruttó összeg, partner, számlaszám) azonnal rendelkezésre állnak, a banki tranzakció-párosító algoritmus (`job_type: 'rematch'`) azonnal le tud futni anélkül, hogy a lassú tétellekérdezésre kellene várnia.
* **Tökéletes Adatintegritás:** Az adatbázis szintű egyedi index és az atomi RPC miatt lehetetlen duplikált tételsorokat létrehozni.
* **Karbantartás-Tűrő Háttérmunkás:** A NAV éjszakai és hétvégi karbantartásai nem eredményeznek hibajegyeket vagy beragadt poison-pill üzeneteket.

### Negatív / Költségek
* Új PGMQ queue (`nav_item_jobs`) és új Deno Edge Function (`nav-fetch-details`) üzemeltetési és monitorozási feladata.
* A számlák tételsorai nem azonnal, hanem 10–60 másodperces késleltetéssel jelennek meg a háttérben (kivéve on-demand megnyitáskor, ahol azonnali).

---

## Kapcsolódó
* [A-004: PGMQ mint aszinkron queue](./A-004-pgmq-queue.md)
* [A-005: Edge Functions katalógus](./A-005-edge-functions.md)
* [A-006: Python Worker architektúra](./A-006-python-worker.md)
* [A-012: NAV Online Számla API v3 integráció](./A-012-nav-integration.md)
* [A-096: Hivatalos NAV Tételsor Védőháló](./A-096-authoritative-nav-line-items-crosscheck-and-sync-guard.md)
* [A-130: NAV Auto-Sync Hajnali Időablakos Terheléselosztás](./A-130-nav-auto-sync-dawn-load-staggering.md)
