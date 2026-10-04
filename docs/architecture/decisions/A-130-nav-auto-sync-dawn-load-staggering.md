# A-130: NAV Automatikus Szinkronizáció Hajnali Idő-ablakos Terheléselosztása (Load Staggering)

> **Státusz:** Decided  
> **Dátum:** 2026-09-20  
> **Utoljára frissítve:** 2026-10-04 (kódhoz igazítva; időkeret, deferred, worker-átadás: [A-193](./A-193-nav-hybrid-async-sync-and-atomic-item-idempotency.md))  
> **Szerző:** ThinkAI / Morfi  
> **Érintett komponensek:** `nav-auto-sync` (Edge Function), `supabase/migrations/20260920140000_nav_auto_sync_staggered_cron.sql`, pg_cron  
> **Kapcsolódó:** [ADR A-193](./A-193-nav-hybrid-async-sync-and-atomic-item-idempotency.md), [ADR A-129](./A-129-partner-history-majority-categorization.md), [BRD 016](../../business/decisions/016-nav-sync-strategy.md), [BRD 059](../../business/decisions/059-partner-history-majority-categorization.md)

---

## Context (Kontextus)

Az eaisybill-prod rendszerben dinamikusan növekszik a kezelt cégek száma (jelenleg 53 aktív cég a platformon, a cél több száz cég bevonása).

A korábbi működés szerint:
1. **Egyszerre lefutó cron job:** Minden cég NAV szinkronja egyetlen időpontban indult el hajnalban (02:00 UTC / 03:00 CET).
2. **Csúcsterhelés és NAV rate limiting:** Amikor 53+ cég egyszerre kérdezi le a NAV Online Számla API-t, a NAV szerverek hálózati túlterhelést vagy időszakos 429 / 503 hibákat adhatnak vissza.
3. **Edge Function Timeout kockázat:** A Supabase Edge Functionök alapértelmezett maximális futásideje 150 másodperc. Több tucat cég szekvenciális vagy párhuzamos feldolgozása egyetlen Edge Function invocation keretében a cégek számának növekedésével elkerülhetetlenül timeout hibához és befejezetlen szinkronokhoz vezet.
4. **Adatbázis I/O terheléscsúcs:** A több ezer új számla, tételsor és partner egyidejű mentése, valamint az automatikus kategorizálási triggerek lefutása felesleges I/O tüskéket okozott a hajnali órákban.

---

## Decision (Döntés)

Bevezettük a **Hajnali Idő-ablakos Terheléselosztást (Dawn Load Staggering - 1. Lépcső)** a NAV automatikus szinkronizációjára.

### 1. Négy Hajnali Idősáv (pg_cron ütemezés)
A cron job nem egyetlen hajnali időpontban fut, hanem óránként a 01:00 és 04:00 UTC (02:00 - 05:00 CET) közötti idősávban:
* **Cron kifejezés:** `0 1,2,3,4 * * *`
* **Slot hozzárendelés UTC óra alapján:**
  * `01:00 UTC` → **Slot 0**
  * `02:00 UTC` → **Slot 1**
  * `03:00 UTC` → **Slot 2**
  * `04:00 UTC` → **Slot 3**

### 2. Determinisztikus és Egyenletes Kvótaelosztás (UUID Hex Modulo 4)
A cégek elosztása a cégazonosító (`company_id` UUID) alapján történik (`getCompanySyncBucket`, `nav-auto-sync/index.ts`):
```typescript
const cleanHex = companyId.replace(/[^0-9a-fA-F]/g, '').slice(0, 8);
const bucket = parseInt(cleanHex, 16) % 4;
```
Mivel 16 ≡ 0 (mod 4), az eredményt gyakorlatilag a kötőjelek nélküli UUID **8. hex karaktere** határozza meg:
* **Slot 0:** hex `0`, `4`, `8`, `c` (~25% a cégeknek)
* **Slot 1:** hex `1`, `5`, `9`, `d` (~25% a cégeknek)
* **Slot 2:** hex `2`, `6`, `a`, `e` (~25% a cégeknek)
* **Slot 3:** hex `3`, `7`, `b`, `f` (~25% a cégeknek)

Ez a mechanizmus teljesen determinisztikus (minden cég mindig ugyanabban a hajnali órában szinkronizál), statisztikailag egyenletesen terít (~13-14 cég óránként az 53-ból), és semmilyen adatbázis sémamódosítást (pl. külön slot oszlopot) nem igényel.

### 3. Edge Function Vezérlés és Bypass Szabályok (`nav-auto-sync`)
Az Edge Function a kérés törzse alapján dönt (elsőbbségi sorrendben):
* **Egyedi cég szinkron (`companyId` megadva):** csak a megadott cégre fut, slot szűrés nélkül.
* **Staggering kikapcsolva (`staggering: false` vagy `stagger: false`):** minden aktív cégre lefut.
* **Célzott slot (`bucket: 0..3`):** csak az adott slot cégeit futtatja (tesztelés / dedikált partíció).
* **Kikényszerített szinkron (`forceSync: true`, `bucket` nélkül):** minden aktív cégre lefut, és kihagyja a frekvencia-ellenőrzést (lásd §5).
* **Alapértelmezett cron mód (üres törzs):** 01:00–04:59 UTC között `bucket = UTC óra − 1`; ezen az ablakon kívül **minden aktív cégre** lefut. ⚠️ Teszt hívásnál ezért mindig adj meg `companyId`-t.

### 4. Hibaszigetelés és Naplózás
* Minden cég szinkronizációja szigorúan izolált `try/catch` blokkban történik, a kimenő és bejövő irány is külön. Egyetlen cég NAV hitelesítési hibája (pl. lejárt technikai felhasználó jelszó) nem akasztja meg a többi cég szinkronját.
* A válasz JSON (`summary`) mezői: `staggering`, `bucket`, `total_eligible`, `total_companies`, `successful`, `failed`, `worker_jobs_enqueued`, `auto_categorize_queued`, `enqueue_failed`. A `details[]` cégenkénti státusza: `success` / `partial` / `error` / `skipped` / `deferred`.

### 5. Időkeret, Frekvencia és Worker-átadás (2026-10-04, [A-193](./A-193-nav-hybrid-async-sync-and-atomic-item-idempotency.md))
* **Frekvencia-szabály:** egy cég kimarad (`skipped`), ha mindkét iránya 20 órán belül (heti beállításnál 144 órán belül) sikeresen szinkronizált. A `forceSync` ezt kihagyja.
* **Dátumtartomány irányonként:** az utolsó sikeres szinkron `date_to` − 2 nap, legfeljebb 7 nap visszatekintés; ha nincs sikeres szinkron, 7 nap. A szűrés a számla kiállítási dátuma (`invoiceIssueDate`) szerint történik.
* **100 s-os time budget:** minden cég *indítása előtt* ellenőrződik. Túllépéskor a ciklus leáll, a következő cég `deferred` státuszt kap. A kimaradt cégek **aznap nem futnak újra** (a `depth` / `MAX_DEPTH` paramétert semmi nem hívja), csak másnap ugyanabban a slotban.
* **Worker-átadás:** a cron csak fejléceket ment (`fetchDetailedItems: false`). Cégenként egy `nav_item_jobs` üzenet indul `auto_categorize` jelzővel. A worker letölti a tételsorokat, majd meghívja az `auto-categorize-invoices`-t (A-193 §5). A korábbi szinkron kategorizáló farok, amely 504-eket okozott, megszűnt.

---

## Consequences (Következmények)

### Pozitív
- **75%-kal alacsonyabb csúcsterhelés:** Egy adott pillanatban a NAV API-t és a Supabase adatbázist a korábbi 53 helyett csak ~13 cég terheli.
- **Kisebb timeout-kockázat:** egy slotban ~13 cég fut. A 100 s-os time budget (§5) és a worker-átadás (A-193) után a cégenkénti futás csak fejlécmentés, de a soros ciklus időkorlátos marad: ezt a `deferred` cégek jelzik.
- **Rugalmas növekedési pálya:** A rendszer több száz cégig lineárisan skálázódik a hajnali órákban anélkül, hogy a NAV szerverei blokkolnák a kéréseket.
- **Teljes transzparencia:** A cégek tudják, hogy minden hajnalban (legkésőbb reggel 06:00 CET-re) a legfrissebb számláik elérhetőek.

### Negatív / Kötöttségek
- Néhány cég számlái 02:00 CET-kor, míg másoké 05:00 CET-kor frissülnek. Mivel a könyvelők és a vezetők reggel 08:00 előtt nem kezdik meg a munkát, ez semmilyen üzleti hátránnyal nem jár.
- A time budget miatt `deferred` cégek csak másnap szinkronizálnak (nyitott pont, lásd A-193 Negatív).
