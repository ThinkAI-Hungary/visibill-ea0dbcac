# A-239: PROCONT Főkönyvi Kivonat Export, Hierarchikus Számla-aggregáció és Mérleg-Eredmény Egyezőség-számítás Architektúra

**Status:** Decided  
**Date:** 2026-10-10  
**Utoljára frissítve:** 2026-10-10  

---

## 🏛️ Context
A magyar számviteli gyakorlatban a könyvelőirodák és könyvvizsgálók széles körben használják a PROCONT integrált pénzügyi és főkönyvi rendszert. A könyvelési auditok, évközi zárások és könyvvizsgálatok során az ügyfelek és könyvelők megkövetelik a megszokott, szabványos PROCONT főkönyvi kivonat formátumot, amely sajátos számlaosztály-sorrendet, háromszintű hierarchikus göngyölítést és szigorú kétoldalas (mérleg vs. eredménykimutatás) számszaki egyezőség-számítást alkalmaz.

A korábbi általános főkönyvi exportok egyszerű listázást vagy általános csoportosítást biztosítottak, ami nem elégítette ki a PROCONT-hoz szokott szakemberek igényeit. Olyan exportmotorra volt szükség, amely:
1. Egy az egyben leképezi a hivatalos PROCONT főkönyvi kivonat (`PRCNT FŐKÖNYV.pdf`) struktúráját mind A4 álló formátumú nyomtatható PDF-ben, mind pedig szerkeszthető Excel (.xlsx) formátumban.
2. Kiszámítja és feltünteti a hivatalos PROCONT „EGYEZŐSÉG SZÁMÍTÁS” blokkot (1-4. számlaosztályok mérlegegyenlege vs. 5-9. számlaosztályok eredményegyenlege), garantálva a 0 Ft-os különbséget.
3. Kliensoldalon, azonnal és robusztusan renderel többoldalas dokumentumok esetén is, elkerülve a fejléc-táblázat ütközéseket a 2+ oldalakon.

---

## 💡 Decision

### 1. PROCONT Számlafa Hierarchia és Aggregációs Motor (`src/lib/procontGlData.ts`)
A rendszer önálló, tiszta számítási modult valósít meg, amely a nyers főkönyvi számlákból (`GeneralLedgerAccount[]`) felépíti a PROCONT szabvány szerinti fastruktúrát:
- **Számlaosztályok kezelése és sorrendje:**
  - `1. Befektetett eszközök` (Eszközök)
  - `2. Készletek` (Eszközök)
  - `3. Követelések, pénzeszközök` (Eszközök)
  - `4. Források` (Források)
  - `5. Költségnemek` (Költségek)
  - `8. Ráfordítások` (Ráfordítások)
  - `9. Bevételek` (Árbevétel / Bevételek)
- **Háromszintű göngyölítési fa:**
  - **Osztály szint (1 jegy):** az összes alárendelt számla forgalmának és egyenlegének összege.
  - **Szintetikus szint (3 jegy):** gyűjtőszámlák (pl. `381 Készpénz`, `467 Fizetendő áfa`), amelyek összesítik a hozzájuk tartozó 4+ jegyű analitikus alszámlákat.
  - **Analitikus szint (4+ jegy):** a legmélyebb részletező számlák (pl. `3811 Forint házipénztár`, `4671 Belföldi 27% áfa`).
- **4 Monetáris Oszlop és Számviteli Egyenleg-elhelyezés:**
  - *Tartozik Forgalom* (Turnover Debit)
  - *Követel Forgalom* (Turnover Credit)
  - *Tartozik Egyenleg* (Net Balance Debit)
  - *Követel Egyenleg* (Net Balance Credit)
  - A nettó egyenleg elhelyezése a számla természetes jellege alapján történik (1-3., 5., 8. számlaosztály esetén alapértelmezett T-többlet, 4., 9. esetén K-többlet). A nettó egyenleg kizárólag a megfelelő oldalra kerül, negatív egyenleg nem jelenik meg.
- **Mindösszesen Sor:** az összes számla forgalmának és nettó egyenlegének összege.

### 2. Hivatalos PROCONT „EGYEZŐSÉG SZÁMÍTÁS” Motor
A modul a PROCONT szabályai szerint ellenőrzi és kiértékeli a kettős könyvvitel alapösszefüggését:
$$\text{Egyenleg}_{1-4} = \sum_{c=1}^4 (\text{Tartozik Egyenleg} - \text{Követel Egyenleg})$$
$$\text{Egyenleg}_{5-9} = \sum_{c=5}^9 (\text{Követel Egyenleg} - \text{Tartozik Egyenleg})$$
$$\text{Különbözet} = \text{Egyenleg}_{1-4} - \text{Egyenleg}_{5-9} = 0 \text{ Ft (Mérleg szerinti eredmény)}$$
A blokk a táblázat zárásaként megjeleníti:
1. 1-4. számlaosztály egyenlege (Mérleg)
2. 5-9. számlaosztály egyenlege (Eredménykimutatás)
3. Különbözet (0 Ft esetén zöld / tiszta egyezőség)

### 3. Vektoros A4 Álló PDF Motor és Többoldalas Layout Védelem (`src/lib/procontGlPdf.ts`)
A generálás a kliens böngészőjében fut `jspdf` és `jspdf-autotable` használatával:
- **Fejléc koordináták:** Cégnév, cím, adószám, időszak és generálási időbélyeg (y = 11-27 mm).
- **Többoldalas Margóvédelem:** A `jspdf-autotable` multi-page viselkedéséből fakadó lapszéli ütközések kiküszöbölésére kötelező az explicit `margin: { top: 33, bottom: 15, left: 10, right: 10 }` és `startY: 33` beállítása. Ezzel a 2. és további oldalakon a táblázat pontosan a 33 mm-es biztonsági vonal alatt kezdődik, elkerülve a címsorokra való rácsúszást.
- **Vizuális Hierarchia:**
  - Számlaosztály fejléc: sötétszürke sáv fehér/kontrasztos betűkkel.
  - Szintetikus sorok: vastag betűs (bold) kiemelés, halvány háttér.
  - Analitikus sorok: normál szöveg, vizuális behúzással.
  - Egyezőség számítás blokk: önálló keretes összesítő doboz a táblázat alatt.
  - Lábléc: szabványos oldalszámozás (`X / Y oldal`).

### 4. Excel Munkafüzet Generáló Motor (`src/lib/procontGlExcel.ts`)
- `exceljs` alapú, formázott `.xlsx` generálás:
  - Formázott cellák és magyar pénznem formátum (`#,##0 "Ft"`).
  - Szintek szerinti vizuális színezés (osztály = szürke fejléc, szintetika = félkövér, analitika = behúzott).
  - Automatikus oszlopszélességek és a táblázat alatti formázott Egyezőség Számítás blokk.

### 5. Felhasználói Integráció (`GlToolbar.tsx`, `GeneralLedgerTable.tsx`, `GeneralLedgerPage.tsx`)
- Az Exportálás legördülő gomb alatt új csoportban elérhető:
  - `📄 PROCONT Főkönyvi kivonat (PDF)`
  - `📊 PROCONT Főkönyvi kivonat (Excel)`
- Az exportálás a `GeneralLedgerTable` komponensen definiált imperatív ref metódusokon (`exportProcontPdf`, `exportProcontExcel`) keresztül közvetlenül a képernyőn látható, szűrt és rendezett számlatörzs adatait adja át a generátornak.

---

## ⚡ Consequences

### Pozitív
- **100%-os PROCONT kompatibilitás:** A könyvelők és könyvvizsgálók pontosan azt a formátumot és egyezőség-számítást látják, amit a tradicionális asztali rendszerekben megszoktak.
- **Automatikus Számviteli Integritás Ellenőrzés:** Az Egyezőség Számítás blokk azonnal leleplezi, ha a könyvelési tételek nincsenek egyensúlyban.
- **Kliensoldali Sebesség és Függetlenség:** Mind a PDF, mind az Excel kliensoldalon, másodpercek alatt készül el külső szerverfüggőség vagy adatátviteli késleltetés nélkül.
- **Többoldalas Megbízhatóság:** Az explicit `margin.top` és `startY` szinkronizálás garantálja, hogy 10+ oldalas kivonatok esetén se torzuljon a fejléc.

### Negatív & Kockázatok
- Ha a számlatükörben nem szabványos (pl. 3 jegynél rövidebb nem-osztály vagy hiányos) számlák szerepelnek, az aggregációnak rugalmas fallback logikát kell fenntartania.

---

## 🔗 Kapcsolódó
- **PRD:** [P-177: PROCONT Főkönyvi Kivonat A4 PDF és Excel Export, Kétoldalas Egyezőség-számítás és Hibátlan Többoldalas Layout UX](../../product/decisions/P-177-procont-general-ledger-export-and-reconciliation-ux.md)
- **BDR:** [021: Főkönyvi Rendszer (General Ledger)](../../business/decisions/021-general-ledger.md)
- **ADR:** [A-163: Főkönyv UI/UX Modularizáció és Zajcsökkentés](./A-163-general-ledger-ui-ux-restructuring-and-clutter-reduction.md)
- **Referencia Bizonylat:** `tests/docs/eb0148/PRCNT FŐKÖNYV.pdf`
