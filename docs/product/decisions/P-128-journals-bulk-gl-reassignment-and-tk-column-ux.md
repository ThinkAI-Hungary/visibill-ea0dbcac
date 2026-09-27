# P-128: Könyvelési Naplók Tömeges Kontírozása és Vizuális T/K Kontíroszlop UX

**Status:** Decided  
**Date:** 2026-09-28  
**Category:** UI / Accounting / Ergonomics  
**Kapcsolódó:** [P-055](./P-055-accounting-journals-ux.md), [A-169](../../architecture/decisions/A-169-b2c-nav-anonymization-and-submitted-invoice-sync.md)

---

## 1. Context & Problémafelvetés

A Könyvelési Naplók (`/accounting/journals`, `JournalsPage.tsx`) felületen az ügyfelek és könyvelők az alábbi ergonómiai és hatékonysági akadályokba ütköztek:
1. **Hiányzó kontír információ a listanézetben:** A naplótételek listájában nem látszott a hozzárendelt főkönyvi számlaszám. Ha a könyvelő ellenőrizni szerette volna a kontírozást, minden egyes bizonylatba külön bele kellett kattintania és megnyitnia a tételes szerkesztőt.
2. **Tömeges átsorolás hiánya:** Tévesen vagy automatikusan besorolt tételeknél (például kiküldetések, amelyek az 526-os helyett az 529-es egyéb költségre kerültek, vagy pénztári szállítói kiegyenlítések) a könyvelőnek egyesével kellett végiglátogatnia a tételeket, ami több tíz vagy száz bizonylat esetén rendkívül időigényes és hibalehetőségeket rejtő folyamat volt.
3. **Pénztári kiküldetések és számlakiegyenlítések automatikus felismerése:** A házipénztári tételek generálásakor a rendszer nem ismerte fel a kiküldetés/napidíj kulcsszavakat, valamint a kézi leírásban megadott számlaszámokat sem párosította össze a 4541-es szállítói kötelezettséggel.

---

## 2. Döntés & Felületi Megoldás (UX)

### 2.1 Vizuális Kontír (T / K) oszlop a naplólistában
* A táblázat új `Kontír (T / K)` oszlopot kapott.
* A cellában tömör, áttekinthető badge-ek jelenítik meg a könyvelt oldalakat:
  * **T (Tartozik):** Kék tónusú kontírjelölés (pl. `T: 526`).
  * **K (Követel):** Zöld tónusú kontírjelölés (pl. `K: 3811`).
* Több tételsor esetén a főbb érintett számlaszámok jelennek meg, így a könyvelő egyetlen pillantással átlátja a napló kontírozását anélkül, hogy elhagyná a listanézetet.

### 2.2 Tömeges Kontírozás (Bulk GL Reassignment) Akció és Modal
* A naplósorok melletti jelölőnégyzetekkel tetszőleges számú tétel kijelölhető.
* A képernyő alján megjelenő lebegő műveleti sávban elérhetővé vált a **„Tömeges kontírozás”** akciógomb.
* Kattintásra megnyílik a `BulkReassignGlDialog` modál:
  * Kereshető legördülő számlatükör választó (`GlAccountSelect`).
  * Megerősítő összesítés a kijelölt tételek darabszámáról és összegéről.
  * Egyetlen kattintással végrehajtja a kijelölt naplósorok és könyvelési tételek átkötését az új főkönyvi számra.

### 2.3 Intelligens Fallback Szabályok (`draftFallbackGenerator.ts`)
* **Kiküldetések:** A `kiküldetés`, `kikuldet`, `napidíj` kulcsszavak automatikusan az **526** (Kiküldetés és napidíj költségei) főkönyvi számra irányítódnak.
* **Szállítói kiegyenlítések:** Ha a készpénzes kifizetés leírásában a rendszer érvényes szállítói számlaszámot talál, a tétel költség helyett közvetlenül a **4541** (Szállítói kötelezettség) számlára kontírozódik, és összekapcsolódik a számlával.

---

## 3. Felületi Állapotok & Ergonómia

| Elem | Korábbi viselkedés | Új felületi működés |
|---|---|---|
| **Napló lista oszlopok** | Csak dátum, sorszám, partner, leírás, összeg | Kiegészült `Kontír (T / K)` oszloppal |
| **Kontír megtekintése** | Részletező modál megnyitása kötelező | Azonnali vizuális badge a táblázatban |
| **Több tétel átkönyvelése** | Egyesével, 10 kattintás tételenként | Kijelölés + 1 kattintásos `Tömeges kontírozás` |
| **Kiküldetés rögzítése** | 529-es egyéb költség (manuális javítást igényelt) | Automatikus 526-os besorolás |

---

## 4. Minőségbiztosítás & Tesztek

* Automatikus egységtesztek: `src/features/journals/services/__tests__/draftFallbackGeneratorPettyCash.test.ts` (100% sikeres lefutás).
* TypeScript fordítás: `npx tsc --noEmit` hibamentes (code 0).
