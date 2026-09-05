# A-095: Nemzetközi Kártyaelfogadó Terminál (Europay POS) Clearing Devizafelülírás Védelme és Kártyás Időbélyeg Kinyerés

**Status:** Decided  
**Date:** 2026-09-06  
**Utoljára frissítve:** 2026-09-06  

## Context
A B-Audit Kft. bankszámlakivonatán (Oberbank HUF, 2026. augusztus) a Magyar Telekom online bankkártyás fizetési tranzakcióit (`-15 006,00 HUF` és `-15 169,00 HUF`) a rendszer tévesen EUR devizájúként (`-41.30 EUR` és `-41.54 EUR`) mentette a `public.transactions` táblába (`12ceb96a-979a-4480-870a-9b5b7df6fc87` és `61401a0b-b63e-4c61-9085-c556f0a7397c`). Emiatt a rendszer nem tudta automatikusan párosítani a tranzakciókat a valós forintos Magyar Telekom bejövő számlákkal (`"Nincs matematikailag lehetséges találat az összeg és deviza alapján."`).

A részletes kódvizsgálat feltárta a gyökérokot:
1. **Nemzetközi Elszámolóhálózati Deviza (Clearing Network Artifact):** Amikor a kártyás fizetés nemzetközi elszámolású terminálon keresztül fut (Europay külföldi kereskedői POS), a banki leírás tartalmaz egy technikai elszámoló devizát (`41.30 EUR`).
2. **Eredeti POS Terhelési Metaadat:** A banki leírás pipe-elválasztott POS rekordja expliciten tartalmazza a valós terhelési devizát, összeget és árfolyamot: `|HUF|15006.00|1.000000|Europay külföldi kereskedői POS OBKLHUHB`.
3. **Vak Devizafelülírás az `_extract_foreign_currency`-ben:** A függvény a leírásban talált első `EUR`/`USD` mintát feltétel nélkül eredeti vásárlási devizának tekintette, és felülírta a forintos számlán könyvelt valós összeget és devizát.
4. **Hiányzó Kártyás Vásárlási Dátum:** Az Oberbank POS leírásokban lévő pontos vásárlási időbélyeget (`|2026-08-03 07:33:00|`) az `_extract_charge_date` nem dolgozta fel, így a `terheles_datuma` üres maradt.
5. **Pdfplumber és Folytatólagos Sorbefolyás:** Az Oberbank parser nem volt lap-tudatos (page-aware), így a lapváltásoknál a fejléc mezői (`IBAN:`, `BIC:`, `Devizanem:`) hozzáadódhattak az előző oldal utolsó tételének leírásához.

## Decision
1. **Robusztus POS HUF Metaadat Guard (`_extract_foreign_currency`):**
   - Ha a leírás tartalmazza a pipe/semicolon (`|HUF|`, `;HUF;`) vagy szóköz-elválasztott forintos elszámolási mintát 1.0 árfolyammal (`\bHUF\s+[\d.,]+\s+1[.,]0{1,6}\b`), a függvény azonnal visszatér (guard return). Így a technikai clearing devizák nem írják felül a forintos számlán történt valós terheléseket.
2. **Kártyás Időbélyeg Kinyerés Bővítése (`_extract_charge_date`):**
   - Kiterjesztettük a kulcsszavakat (`pos`, `europay`) és bevezettük a rugalmas időbélyeg-felismerést (`\d{4}[.-]\d{2}[.-]\d{2}\s+\d{2}:\d{2}`), amely kezeli a határolójelek nélküli és a másodpercek közötti tipográfiai szóközöket is. A vásárlás valós napja bekerül a `terheles_datuma` mezőbe (30 napos sanity toleranciával).
3. **Oldal-tudatos Oberbank Parser (`_oberbank_pdfplumber_extract`):**
   - A PDF oldalankénti feldolgozása kizárja a lapfejléceket és lábléceket, megakadályozva azok folytatólagos sorokként történő hozzáfűzését a tranzakció leírásához.
4. **Adatbázis Remediation:**
   - A két érintett tranzakció összege és devizája visszaállításra került `-15006.00 HUF` és `-15169.00 HUF`-ra, összekapcsolva a Magyar Telekom számlákkal a `trg_mark_nav_paid_on_match` trigger segítségével.

## Consequences
**Pozitív:**
- A nemzetközi elszámolású belföldi és online POS tranzakciók megőrzik a könyvelt forintos összeget.
- Az automatikus számlapárosítás 100%-os biztonsággal lefut.
- A kártyás vásárlás tényleges napja bekerül a `terheles_datuma` mezőbe, segítve a könyvelést.
- A valódi külföldi valutás vásárlások (pl. Anthropic USD, bécsi hotel EUR) továbbra is helyesen felülíródnak eredeti devizájukra.

## Kapcsolódó
- [A-091: Bankszámlakivonat Határoló Logika és Záróösszesítő Guard](./A-091-bank-statement-boundary-and-summary-artifact-guard.md)
- [A-039: Transaction Matcher Performance Optimization](./A-039-transaction-matcher-performance-optimization.md)
- [A-059: Transaction Matching Core & Modular UI](./A-059-transaction-matching-core-and-modular-ui.md)
