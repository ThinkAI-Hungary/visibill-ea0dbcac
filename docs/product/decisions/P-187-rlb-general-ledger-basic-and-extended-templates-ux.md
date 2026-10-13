# P-187: RLB-60 Főkönyvi Kivonat Alap és Bővített (Vevő-Szállító) Sablonok és Exportok UX

**Status:** Decided  
**Date:** 2026-10-13  
**Category:** UI / Workflow / General Ledger & Financial Reporting  
**Kapcsolódó döntések:** [ADR A-253](../../architecture/decisions/A-253-rlb-general-ledger-basic-and-extended-templates-architecture.md) · [BDR-021](../../business/decisions/021-general-ledger.md) · [P-177](./P-177-procont-general-ledger-export-and-reconciliation-ux.md) · [P-181](./P-181-prc-general-ledger-export-naming-ux.md) · [P-182](./P-182-agora-financial-reports-and-income-statement-export-ux.md)

---

## 🎯 Question
Hogyan biztosítsunk a könyvelők, bankok és könyvvizsgálók számára a széles körben használt RLB-60 könyvelőszoftver (`Főkönyvi kivonat-alap. bankoknak is jó..pdf` és `Főkönyvi kivonat-bővített-vevő-szállító- pl. könyvvizsgálónak.pdf`) formátumával megegyező:
1. **Alap** főkönyvi kivonatot (banki és hitelcélokra szintetikus és analitikus számlákkal, partnerek nélkül), valamint
2. **Bővített (vevő-szállító)** főkönyvi kivonatot (könyvvizsgálói célokra a 311, 312, 317 vevők és a 4541, 4542 szállítók alatti tételes partner-analitikával),
mind a képernyős nézetválasztóban (`GlViewSelectorModal`), mind pedig a felső eszköztár Export lenyíló menüjében (A4 álló PDF és formázott Excel formátumban)?

---

## 💡 Decision

### 1. Két Új Beépített Főkönyvi Nézetsablon (`useGlViewTemplates.ts`)
A `GlViewSelectorModal` sablonválasztóban elérhetővé tettük az RLB-60 szerinti 6 oszlopos sablonokat:
- **`RLB Főkönyvi kivonat (Alap)`** (`rlb_basic_6col`): Fők.szám, Megnevezés, Forgalom T/K, Egyenleg T/K az RLB-60 alap elrendezése szerint.
- **`RLB Főkönyvi kivonat (Bővített - vevő-szállító)`** (`rlb_extended_6col`): Ugyanez a 6 oszlop, de a partner-analitikára felkészített oszlopszélességekkel és megnevezésekkel.

### 2. Export Lenyíló Menü Bővítés (`GlToolbar.tsx`)
A felső eszköztár Exportálás menüjében önálló csoportban jelentek meg az opciók:
- **`📄 RLB Alap kivonat (PDF)`** (Bankoknak, hitelhez — Teljes kivonat / 0-ás sorok nélkül)
- **`📊 RLB Alap kivonat (Excel)`** (Banki táblázat — Teljes kivonat / 0-ás sorok nélkül)
- **`📄 RLB Bővített kivonat (PDF)`** (Könyvvizsgálóknak, vevő-szállító — Teljes kivonat / 0-ás sorok nélkül)
- **`📊 RLB Bővített kivonat (Excel)`** (Audit vevő-szállító analitika — Teljes kivonat / 0-ás sorok nélkül)

### 3. RLB-60 A4 Álló PDF Formátum (`rlbGlPdf.ts`)
- **Felső sáv (Top Banner):** Sötétszürke sáv, balra zárt fehér `FŐKÖNYVI KIVONAT` címmel, jobbra zárt `[Cégnév] ([Adószám]) - [Év]` fejléc felirattal.
- **Alatta:** `Időszak: YYYY.MM.DD-YYYY.MM.DD`.
- **Táblázat:** Kétszintes fejléc (`Fők.szám`, `Megnevezés`, `Forgalom` T/K, `Egyenleg` T/K).
- **Vizuális szintek:**
  - Számlaosztály fejléc: Kiemelt szürke háttér (`#e4e7ec`), félkövér betűk.
  - Számlacsoportok: Félkövér kiemelés.
  - Partner sorok (Bővített módban): Indentált megnevezés, 7-jegyű numerikus azonosító (pl. `3110000001`).
- **Összesítő blokk:**
  - `1-4 számlaosztály összesen` (Mérlegszámlák)
  - `5-9 számlaosztály összesen` (Eredményszámlák)
  - `Mindösszesen` (Forgalom T = Forgalom K hajszálpontos egyensúlyi igazolás).
- **Lábléc minden oldalon:** Oldalszámozás, futási időbélyeg és felhasználó cégnév, vékony elválasztó vonallal védve.

### 4. Formázott Excel Munkafüzet (`rlbGlExcel.ts`)
- Tényleges számformátumok (`#,##0;(#,##0);"-"`), natív Excel képletekkel használható oszlopok.
- Kétszintes formázott fejléc és sötétszürke fejléc sáv.
- Teljes mérlegegyezőségi összesítés duplavonalas kiemeléssel a táblázat alján.

---

## 🔍 Érintett Fájlok
- `src/lib/rlbGlData.ts` (Adatmodell, aggregáció és partner-analitika motor)
- `src/lib/rlbGlPdf.ts` (A4 PDF generáló)
- `src/lib/rlbGlExcel.ts` (ExcelJS munkafüzet generáló)
- `src/lib/__tests__/rlbGlData.test.ts` (Adatmodell tesztek)
- `src/lib/__tests__/rlbGlPdfAndExcel.test.ts` (PDF/Excel tesztek)
- `src/hooks/useGlViewTemplates.ts` (Beépített sablonok)
- `src/components/general-ledger/GlToolbar.tsx` (Eszköztár menü)
- `src/components/general-ledger/GeneralLedgerTable.tsx` (Táblázat ref export metódusok)
- `src/pages/GeneralLedgerPage.tsx` (Oldalszintű vezérlés)
