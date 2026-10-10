# P-177: PROCONT Főkönyvi Kivonat A4 PDF és Excel Export, Kétoldalas Egyezőség-számítás és Hibátlan Többoldalas Layout UX

**Status:** Decided  
**Date:** 2026-10-10  
**Category:** UI / Workflow / General Ledger & Financial Reporting  
**Kapcsolódó döntések:** [ADR A-239](../../architecture/decisions/A-239-procont-general-ledger-export-and-reconciliation-architecture.md) · [BDR-021](../../business/decisions/021-general-ledger.md) · [P-105](./P-105-general-ledger-toolbar-and-expand-collapse-ux.md) · [P-113](./P-113-general-ledger-granularity-kontirok-teteles-view.md)

---

## 🎯 Question
Hogyan biztosítsunk a könyvelők, gazdasági vezetők és könyvvizsgálók számára a hagyományos PROCONT könyvelőprogram formátumával (`PRCNT FŐKÖNYV.pdf`) 100%-ban megegyező, hierarchikusan felépített főkönyvi kivonat exportot mind nyomtatható A4 álló PDF-ben, mind pedig szerkeszthető Excel (.xlsx) állományban, az integrált kétoldalas egyezőség-számítás (1-4 vs. 5-9) egyértelmű felületi visszajelzésével?

---

## 💡 Decision

### 1. Főkönyvi Eszköztár Export Menü Bővítés (`GlToolbar.tsx`)
A Főkönyvi kivonat (`/general-ledger`) felső eszköztárának Exportálás lenyíló menüjében önálló csoportban helyeztük el a PROCONT formátumú opciókat:
- **`📄 PROCONT Főkönyvi kivonat (PDF)`**: Vektoros, A4 álló nyomtatvány kép közvetlen letöltése.
- **`📊 PROCONT Főkönyvi kivonat (Excel)`**: Cellánként formázott `.xlsx` táblázat letöltése.
- Az opciók a meglévő általános exportok mellett azonnal elérhetők, anélkül hogy a felületet zsúfolttá tennék.

### 2. A4 Álló PDF Vizuális Kialakítás és Többoldalas Védelem (`procontGlPdf.ts`)
A generált PDF a referenciaként szolgáló `PRCNT FŐKÖNYV.pdf` mintáját követi:
- **Fejléc:** Cég neve, székhelye, adószáma, kivonat időszaka (pl. `2026.01.01 - 2026.12.31`), készítés dátuma és ideje.
- **Táblázat:** 6 oszlopos elrendezés:
  1. Számlaszám (balra zárt)
  2. Számla megnevezése (balra zárt)
  3. Tartozik forgalom (jobbra zárt, ezres tagolás)
  4. Követel forgalom (jobbra zárt, ezres tagolás)
  5. Tartozik egyenleg (jobbra zárt, ezres tagolás)
  6. Követel egyenleg (jobbra zárt, ezres tagolás)
- **Vizuális szintek:**
  - Számlaosztály fejléc: Kiemelt szürke háttér (`#e2e8f0`), sötét betűk, aláhúzás.
  - Szintetika (3 jegy): Vastag betűk (bold), halvány háttér (`#f8fafc`).
  - Analitika (4+ jegy): Finom betűtípus, 4 mm-es indentáció a megnevezésnél.
- **Többoldalas Megbízhatóság:** Az `autotable` paraméterezése (`margin.top: 33`, `startY: 33`) megakadályozza, hogy a 2. oldaltól a táblázat rácsússzon az ismétlődő céges fejlécre.
- **Összesen és Egyezőség Számítás Blokk:**
  - `ÖSSZESEN` sor a forgalmi és egyenlegi oszlopok alatt.
  - Különálló, keretezett `EGYEZŐSÉG SZÁMÍTÁS` doboz a táblázat alján, amely bemutatja az 1-4. számlaosztály és az 5-9. számlaosztály egyenlegét, valamint a 0 Ft-os különbséget.
  - Lábléc oldalszámozással (`1 / 4 oldal`).

### 3. Excel Munkafüzet UX (`procontGlExcel.ts`)
- Megnyitáskor azonnal áttekinthető, rendezett oszlopok automatikus szélesség-igazítással.
- Minden összegcella tényleges számértékként tárolódik magyar pénzügyi formázással (`#,##0 "Ft"`), lehetővé téve a natív Excel képletek és pivot táblák használatát.
- Az `EGYEZŐSÉG SZÁMÍTÁS` blokk az Excel táblázat alján is kiemelten, keretezve jelenik meg.

### 4. Visszajelzés és Hiba-reziliencia
- Letöltés indításakor a felület nem fagy le (aszinkron Blob stream).
- Sikeres generáláskor `toast.success` értesítés jelenik meg az exportált állomány nevével.
- Ha nincs exportálható adat a szűrők miatt, `toast.warning` tájékoztatja a felhasználót.

---

## 🔍 Current Implementation
- `src/lib/procontGlData.ts` (Hierarchia-építő és egyezőség-számító motor)
- `src/lib/procontGlPdf.ts` (A4 PDF motor többoldalas margóvédelemmel)
- `src/lib/procontGlExcel.ts` (ExcelJS munkafüzet generátor)
- `src/components/general-ledger/GlToolbar.tsx` (Eszköztár menügombok)
- `src/components/general-ledger/GeneralLedgerTable.tsx` (Ref metódusok)
- `src/pages/GeneralLedgerPage.tsx` (Oldalszintű vezérlés)

---

## 📈 Rationale
A PROCONT rendszerből érkező könyvelők számára a megszokott elrendezés és számszaki egyezőség azonnali magabiztosságot és hatékonyságot nyújt, kiküszöbölve a kézi Excel formázást és a különbség-keresést.

---

## 🔗 Kapcsolódó
- **ADR:** [A-239: PROCONT Főkönyvi Kivonat Export, Hierarchikus Számla-aggregáció és Mérleg-Eredmény Egyezőség-számítás Architektúra](../../architecture/decisions/A-239-procont-general-ledger-export-and-reconciliation-architecture.md)
- **BDR:** [021: Főkönyvi Rendszer (General Ledger)](../../business/decisions/021-general-ledger.md)
- **PRD:** [P-105: Főkönyvi Kivonat Eszköztár és Hierarchikus Kibontás UX](./P-105-general-ledger-toolbar-and-expand-collapse-ux.md)
