# P-129: Futárriportok és Banki Tranzakciók Teljes Időszaki Exportálása és Szűrt Letöltése UX

**Status:** Decided  
**Date:** 2026-09-28  
**Category:** UI / Exports / Transactions / Ergonomics  
**Kapcsolódó:** [P-016](./P-016-transaction-list.md), [P-058](./P-058-unified-document-engine-ux.md), [P-104](./P-104-transaction-fee-and-invoice-number-export-ux.md)

---

## 1. Context & Problémafelvetés

A Tranzakciók (`/transactions`, `TransactionsPage.tsx`) és a Futárriportok (`CourierReportTab.tsx`) felületen az exportálási lehetőségek nem voltak teljes körűek:
1. **Banki tranzakció fülek export-hiánya:** A detektált bankok fülein (`BankTransactionTab`) a felhasználóknak nem volt közvetlen lehetősége az adott bank forgalmának letöltésére.
2. **Lapozóhoz kötött vs. teljes időszaki letöltés:** Exportáláskor a felület csak az aktuálisan betöltött oldalt tudta volna lementeni, nem a kiválasztott teljes könyvelési időszak (akár több ezer soros) forgalmát.
3. **Futárriportok szűrt és tömeges exportja:** A futárriportoknál hiányzott az egyedi kijelölések vagy az aktuális szűrés (státusz, dátum, utánvét összeg) alapján történő Excel és CSV formátumú letöltés.

---

## 2. Döntés & Felületi Megoldás (UX)

### 2.1 BankTransactionTab Export Dropdown
* Minden detektált banki fül fejlécében elérhetővé vált az **Exportálás** legördülő menü:
  * **Excel export (.xlsx)** — színezett ikonnal és formázott táblázattal.
  * **CSV export (.csv)** — univerzális adatfeldolgozáshoz.
  * **Nyomtatási nézet / PDF** — hivatalos ellenőrzési kimutatáshoz.
* **Intelligens háttér-lekérdezés:** Ha a szűrt rekordok száma meghaladja a lapozó méretét, az exportáló gomb aszinkron módon, progress indikátor mellett lekérdezi a teljes időszak tranzakcióit (`range(0, 49999)`), garantálva, hogy a letöltött fájl a teljes időszakot tartalmazza.

### 2.2 CourierReportTab Tételes és Kijelölt Export
* A futárriportok fejlécébe és a lebegő kijelölési sávba beépült a közvetlen letöltési lehetőség:
  * **Kijelöltek exportálása:** Ha a felhasználó egy vagy több csomagot bejelöl, csak a kiválasztott sorok kerülnek exportálásra.
  * **Teljes szűrt lista exportja:** Kijelölés hiányában az aktuális dátum-, státusz- és összegszűrőknek megfelelő teljes lista generálódik le.
* **Tartalmazott mezők:** Kézbesítés dátuma, Csomagszám/Bizonylat, Hivatkozási szám, Utánvét összege (HUF), Címzett neve és címe, Kapcsolt banki tranzakció státusza, és Párosított NAV számlaszám.

---

## 3. Minőségbiztosítás & Konzisztencia

* Export motor: a központi `exportData` (`lib/exportCsv.ts`) és TanStack Query rétegre épül.
* TypeScript fordítás: `npx tsc --noEmit` hibamentes (code 0).
