# P-102: Főkönyvi Kivonatok és Nyitó Egyenlegek Rugalmas Fájlimportja (Microfox & XML SpreadsheetML) UX

> **Státusz:** Decided  
> **Dátum:** 2026-09-21  
> **Kategória:** UI / UX / Data Import / Interoperability  
> **Érintett komponensek:** `OpeningCSVImportModal.tsx`, `UploadChartOfAccountsModal.tsx`, `openingImportParser.ts`  
> **Kapcsolódó:** [ADR A-137](../../architecture/decisions/A-137-general-ledger-and-opening-import-normalization.md), [PRD P-055](./P-055-accounting-journals-ux.md), [BRD 043](../../business/decisions/043-accounting-journals.md)  

---

## Question (Kérdés)

Hogyan tehető zökkenőmentessé az évnyitási folyamat és a számlatükör felvezetése olyan ügyfelek és könyvelők számára, akik régebbi vagy speciális hazai könyvelőszoftverekből (pl. Microfox) exportált Excel, CSV vagy XML SpreadsheetML fájlokkal érkeznek, és a fájlok fejlécei eltérnek a szabványos elnevezésektől?

---

## Decision (Döntés)

A felhasználói élmény javítása és az importálási akadályok elhárítása érdekében a Nyitó Varázslót (`OpeningCSVImportModal`) és a Számlatükör feltöltőt (`UploadChartOfAccountsModal`) univerzális importfelületté fejlesztettük:

### 1. Kiterjesztett Fájlformátum Támogatás (.xlsx, .xls, .xml, .csv, .json, .txt)
- A drag & drop zónák és a fájlválasztó dialógusok mostantól natívan fogadják a `.xml`, `text/xml`, `application/xml` típusú állományokat is.
- A felhasználónak nem kell a régebbi Excel 2003 XML (SpreadsheetML) fájlokat manuálisan XLSX formátumba mentenie: a rendszer közvetlenül beolvassa és feldolgozza őket.

### 2. Intelligens Magyar Fejléc-felismerés & Normalizálás
- **Főkönyvi számlaszám felismerés:** A parser automatikusan felismeri az `'fksz'`, `'fksz.'`, `'főkönyvi szám'`, `'főkszám'`, `'számlaszám'`, `'gl_number'` oszlopokat.
- **Karaktertakarítás:** A számlaszámok végén található Microfox-féle kötőjeleket és szóközöket (pl. `113  -` → `113`, `413 - 17` → `413-17`) a felület automatikusan letisztítja a megjelenítés és mentés előtt.
- **Egyenleg és Záró oszlopok:** A rendszer felismeri az `'egyenleg'`, `'zaro_egyenleg'`, `'ZT'` (Záró Tartozik) és `'ZK'` (Záró Követel) elnevezéseket, automatikusan megállapítva az előjelet és a Tartozik/Követel irányt.

### 3. Azonnali Mérlegegyezőségi Validáció és Előnézet
- A fájl bedobása után a Nyitó Varázsló azonnal kiszámítja:
  - Az összes Tartozik nyitó összeget.
  - Az összes Követel nyitó összeget.
  - Az esetleges mérlegkülönbözetet (imbalance).
- **Vizuális visszajelzés:**
  - 🟢 **Egyensúlyban:** Zöld badge jelzi, hogy a mérlegkülönbözet 0,00 Ft, a könyvelési gomb aktív.
  - 🔴 **Különbözet esetén:** Figyelmeztető kártya mutatja a differencia összegét.

---

## Rationale (Indoklás)
Az ügyfelek rendszerváltáskor (onboarding során) a leggyakrabban a fájlformátumok inkompatibilitása és a szigorú oszlopelnevezések miatt akadnak el. Azzal, hogy a felület toleránsan kezeli a legelterjedtebb hazai könyvelőprogramok (Microfox, RLB, Kulcs-Soft) sajátos exportjait és közvetlenül megemészti az XML formátumot is, az onboarding idő órákról másodpercekre csökken.

---

## Kapcsolódó
- **ADR**: [A-137: Rugalmas Főkönyvi Kivonat és Nyitó Import Normalizáció](../../architecture/decisions/A-137-general-ledger-and-opening-import-normalization.md)
- **PRD**: [P-055: Könyvelési Napló (Accounting Journals) UX, Nyitó Varázsló és Kézi Rögzítés](./P-055-accounting-journals-ux.md)
- **BRD**: [Decision 043: Könyvelési Naplók és Kettős Könyvviteli Folyószámlák](../../business/decisions/043-accounting-journals.md)
