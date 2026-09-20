# A-130: NAV Automatikus Szinkronizáció Hajnali Idő-ablakos Terheléselosztása (Load Staggering)

> **Státusz:** Decided  
> **Dátum:** 2026-09-20  
> **Szerző:** ThinkAI / Morfi  
> **Érintett komponensek:** `nav-auto-sync` (Edge Function), `supabase/migrations/20260920140000_nav_auto_sync_staggered_cron.sql`, pg_cron  
> **Kapcsolódó:** [ADR A-129](./A-129-partner-history-majority-categorization.md), [BRD 016](../../business/decisions/016-nav-sync-strategy.md), [BRD 059](../../business/decisions/059-partner-history-majority-categorization.md)

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
  * `01:00 UTC` $\rightarrow$ **Slot 0**
  * `02:00 UTC` $\rightarrow$ **Slot 1**
  * `03:00 UTC` $\rightarrow$ **Slot 2**
  * `04:00 UTC` $\rightarrow$ **Slot 3**

### 2. Determinisztikus és Egyenletes Kvótaelosztás (UUID Hex Modulo 4)
A cégek elosztása a cégazonosító (`company.id` UUID) első hexadecimális karaktere alapján történik:
```typescript
const firstChar = company.id.replace(/-/g, '')[0].toLowerCase();
const hexVal = parseInt(firstChar, 16);
const companySlot = hexVal % 4;
```
* **Slot 0:** hex `0`, `4`, `8`, `c` (~25% a cégeknek)
* **Slot 1:** hex `1`, `5`, `9`, `d` (~25% a cégeknek)
* **Slot 2:** hex `2`, `6`, `a`, `e` (~25% a cégeknek)
* **Slot 3:** hex `3`, `7`, `b`, `f` (~25% a cégeknek)

Ez a mechanizmus teljesen determinisztikus (minden cég mindig ugyanabban a hajnali órában szinkronizál), statisztikailag egyenletesen terít (~13-14 cég óránként az 53-ból), és semmilyen adatbázis sémamódosítást (pl. külön slot oszlopot) nem igényel.

### 3. Edge Function Vezérlés és Bypass Szabályok (`nav-auto-sync`)
Az Edge Function inteligensen kezeli a manuális és automatikus hívásokat:
* **Automatikus stagger szűrés:** Ha a hívás `staggering: true` (alapértelmezett a cronból), a függvény kiszámolja a jelenlegi UTC órához tartozó slotot (0..3), és csak az oda tartozó cégeket futtatja le.
* **Bypass feltételek:**
  * **Egyedi cég szinkron (`companyId` megadva):** Azonnal lefut a megadott cégre slot szűrés nélkül (pl. frontendről manuálisan indított szinkron esetén).
  * **Teljes kényszerített szinkron (`forceSync: true` vagy `staggering: false`):** Mind az 53+ cég azonnal szinkronizál (pl. manuális adminisztratív karbantartáskor).
  * **Nappali hívások:** Ha a függvényt 01:00-04:00 UTC idősávon kívül hívják meg slot megadása nélkül, nem szűr, hanem minden aktív cégre lefut.
  * **Célzott slot tesztelés (`slot: 0..3`):** Manuálisan bármelyik slot meghívható tesztelési céllal a payloadban átadva.

### 4. Hibaszigetelés és Naplózás
* Minden cég szinkronizációja szigorúan izolált `try/catch` blokkban történik. Egyetlen cég NAV hitelesítési hibája (pl. lejárt technikai felhasználó jelszó) nem akasztja meg a többi cég szinkronját.
* A válasz JSON részletesen riportálja az aktuális slotot (`slot: 0..3`), a feldolgozott cégek számát (`processed`), az átugrott cégeket (`skipped`), és az egyes cégek részeredményeit.

---

## Consequences (Következmények)

### Pozitív
- **75%-kal alacsonyabb csúcsterhelés:** Egy adott pillanatban a NAV API-t és a Supabase adatbázist a korábbi 53 helyett csak ~13 cég terheli.
- **Nulla Edge Function Timeout kockázat:** A 13 cég szinkronja bőven a 150 másodperces futási limit alatt végez.
- **Rugalmas növekedési pálya:** A rendszer több száz cégig lineárisan skálázódik a hajnali órákban anélkül, hogy a NAV szerverei blokkolnák a kéréseket.
- **Teljes transzparencia:** A cégek tudják, hogy minden hajnalban (legkésőbb reggel 06:00 CET-re) a legfrissebb számláik elérhetőek.

### Negatív / Kötöttségek
- Néhány cég számlái 02:00 CET-kor, míg másoké 05:00 CET-kor frissülnek. Mivel a könyvelők és a vezetők reggel 08:00 előtt nem kezdik meg a munkát, ez semmilyen üzleti hátránnyal nem jár.
