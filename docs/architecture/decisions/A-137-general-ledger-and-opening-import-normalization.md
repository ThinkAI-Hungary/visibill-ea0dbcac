# A-137: Rugalmas Főkönyvi Kivonat és Nyitó Egyenleg Import Normalizáció (Microfox Fejlécek és Excel 2003 XML / SpreadsheetML Támogatás)

**Státusz:** Elfogadva  
**Dátum:** 2026-09-21  
**Érintett komponensek:** `openingImportParser.ts`, `OpeningCSVImportModal.tsx`, `UploadChartOfAccountsModal.tsx`, `openingImportParser.test.ts`  
**Kapcsolódó döntések:** [A-090](./A-090-safe-chart-of-accounts-preset-deletion-and-remapping.md), [P-055](../../product/decisions/P-055-accounting-journals-ux.md), [P-102](../../product/decisions/P-102-general-ledger-and-opening-balance-import-ux.md)

---

## 1. Kontextus és Problémafelvetés

1. **Magyar Könyvelőszoftverek (Microfox, RLB, Kulcs-Soft) Különleges Exportjai:**
   - A hazai könyvelőirodák rendszerváltáskor gyakran nem szabványos CSV vagy XLSX formátumban kapják meg a korábbi évek lezárt főkönyvi kivonatait és számlatükreit, hanem:
     - Microsoft Office 2003 SpreadsheetML XML formátumban (`urn:schemas-microsoft-com:office:spreadsheet`), amely `.xml` vagy `.xls` kiterjesztéssel bír.
     - Egyedi, rövidített magyar oszlopfejlécekkel (pl. `FKSZ` a főkönyvi szám helyett, `MEGNEV` a megnevezés helyett, `ZT` a Záró Tartozik, `ZK` a Záró Követel helyett, vagy közvetlen `EGYENLEG` oszloppal).
2. **Karakterszennyezés a Számlaszámokban:**
   - A Microfox és hasonló programok a főkönyvi számlaszámok végére gyakran kötőjelet vagy elválasztó szóközöket fűznek (pl. `113  -`, `123  -`, `413 - 17`), ami a hagyományos regexeknél és a numerikus azonosítóknál join hibákat vagy számlaszám-elcsúszást okozott.
3. **XML Fájlok Elutasítása a Böngészőben:**
   - Az import dialógusok (`OpeningCSVImportModal`, `UploadChartOfAccountsModal`) korábban csak `.xlsx, .xls, .csv, .json, .txt` kiterjesztéseket engedélyeztek. Amikor a felhasználó a Microfoxból kimentett `.xml` kiterjesztésű fájlt próbálta behúzni, a fájlválasztó elutasította, a parser pedig CSV szövegként próbálta soronként szétbontani, ami azonnali szintaktikai hibához vezetett.

---

## 2. Döntések és Megvalósítás

### 2.1 Excel 2003 XML (SpreadsheetML) Natív Dekódolás
- A SheetJS (`xlsx`) könyvtár natívan támogatja az Excel 2003 XML (`urn:schemas-microsoft-com:office:spreadsheet`) struktúra dekódolását, amennyiben bináris `arrayBuffer`-ként kapja meg a bemenetet.
- Az [`openingImportParser.ts`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/features/journals/services/openingImportParser.ts#L361) fájlban kiterjesztettük a formátumvizsgálatot:
  ```typescript
  // Excel (.xlsx, .xls, .xml)
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.xml')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    ...
  ```
- Ezzel a `.xml` kiterjesztésű SpreadsheetML fájlok pontosan ugyanabba az auditált, lapozható sorfeldolgozó pipeline-ba kerülnek, mint a bináris XLS vagy XLSX táblázatok.

### 2.2 Intelligens Fejléc és Számlaszám Tisztítás
- **Főkönyvi Szám (FKSZ):** A keresési kulcsok közé felvettük az `fksz`, `főkönyvi szám`, `főkszám`, `fők.szám` regex mintákat.
- **Kötőjelek és szóközök normalizálása:**
  ```typescript
  const glNumber = String(rawGlNumber).trim().replace(/\s*-\s*$/, '').replace(/\s*-\s*/g, '-');
  ```
  Ez a szabály a záró kötőjeleket levágja (`113  -` → `113`), míg az alábontásokat egységes kötőjeles formátumra hozza (`413 - 17` → `413-17`).
- **Egyenleg és Záró oszlopok felismerése:**
  - `egyenlegKey`: felismeri az `'egyenleg'`, `'zaro_egyenleg'` oszlopokat (pozitív = Tartozik, negatív = Követel).
  - `debitKey`: kibővítve a `ZT` (Záró Tartozik) mintával.
  - `creditKey`: kibővítve a `ZK` (Záró Követel) mintával.

### 2.3 UI Fájlmaszkok Bővítése
- Az [`OpeningCSVImportModal.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/journals/OpeningCSVImportModal.tsx#L198) és az [`UploadChartOfAccountsModal.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/general-ledger/UploadChartOfAccountsModal.tsx#L402) komponensekben az `accept` attribútumot kiegészítettük az `.xml, text/xml, application/xml` típusokkal.

---

## 3. Következmények és Minőségbiztosítás

- **Zéró Konverziós Teher:** A könyvelőirodáknak és a support csapatnak nem kell többé Excelben manuálisan megnyitniuk és átmenteniük a Microfoxból kimentett XML listákat; a fájl közvetlenül behúzható a felületre.
- **Automatizált Regressziós Védelem:** A [`openingImportParser.test.ts`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/features/journals/services/__tests__/openingImportParser.test.ts) fájlban automatizált egységtesztek ellenőrzik mind a valós Microfox XLS fájl feldolgozását, mind a szintetikus SpreadsheetML `.xml` fájl beolvasását és mérlegegyezőségét (5/5 teszt zöld).
