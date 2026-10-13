# A-253: RLB-60 Főkönyvi Kivonat Alap és Bővített (Vevő-Szállító) Sablonok és Export Motor Architektúra

**Status:** Decided  
**Date:** 2026-10-13  
**Category:** General Ledger / Reporting / Client-side Architecture  
**Kapcsolódó döntések:** [P-187](../../product/decisions/P-187-rlb-general-ledger-basic-and-extended-templates-ux.md) · [A-239](./A-239-procont-general-ledger-export-and-reconciliation-architecture.md) · [A-248](./A-248-agora-statutory-financial-reports-export-architecture.md)

---

## 🎯 Kontextus és Problémafelvetés
A felhasználók és könyvelők hitelfelvételkor, banki adatszolgáltatáskor vagy könyvvizsgálat során gyakran kérik a magyar könyvelői piacon elterjedt RLB-60 rendszer formátumával egyező főkönyvi kivonatot.
A követelmény kétféle üzemmódot kíván:
1. **Alap (banki):** Szintetikus és analitikus számlák a számlatükör szerint, partner-bontás nélkül.
2. **Bővített (könyvvizsgálói):** A vevő követelések (311, 312, 317) és a szállítói kötelezettségek (4541, 4542) alatt tételes partner-analitika, determinisztikus RLB stílusú (10/11 jegyű) számlaszámokkal és egyedi forgalommal/egyenleggel.

---

## 🏗️ Architektúrális Döntések

### 1. Kétszintű Adataggregáció (`rlbGlData.ts`)
- **Tiszta bemeneti interfész:** `RlbAccountInput` (főkönyvi számlák egyenleggel és forgalommal) és opcionális `RlbPartnerItemInput` (partnerenkénti forgalmak számlaszámhoz kötve).
- **Hierarchia építés:**
  - Hiányzó 1 jegyű osztályok (`HUNGARIAN_GL_CLASSES`) és 2 jegyű csoportok (`HUNGARIAN_GL_GROUPS`) automatikus regisztrálása.
  - Prefix-alapú forgalom roll-up a levelekről a szülő számlákra.
  - Számlaosztály-specifikus egyenleg-meghatározás:
    - Eszközök (1, 2, 3) és Költségek (5, 8): Tartozik normál egyenleg (`turnoverDebit - turnoverCredit`).
    - Források (4) és Bevételek (9): Követel normál egyenleg (`turnoverCredit - turnoverDebit`).
- **Partner sorok injektálása (Bővített mód):**
  - A 31-es és 454-es számlák alatt az aggregált partnerek rendezve kerülnek beillesztésre.
  - Partner számlaszám képzés: `glAccountNumber + String(index).padStart(7, '0')` (pl. `3110000001`, `45410000001`), amely pontosan követi a mintafájl numerikus struktúráját.
- **Mérlegegyezőségi Számítás:**
  - `classes1to4` (Mérleg) vs `classes5to9` (Eredmény) aggregáció.
  - `grandTotal`: Forgalom T = Forgalom K ellenőrzés (< 1 Ft tolerancia).

### 2. Többoldalas jsPDF + AutoTable Megvalósítás (`rlbGlPdf.ts`)
- **Fix A4 Álló Méretezés:** 210mm × 297mm, 10mm margók, 190mm hasznos szélesség.
- **Ismétlődő Fejléc (Header Protection):** `didDrawPage` hook nyomtatja a sötétszürke sávot (`#5a5f69`) és a címet a `startY: 24` feletti védett zónában, megakadályozva a 2+ oldali táblázat-átfedést.
- **Cellastílusok (`didParseCell`):**
  - Osztályfejlécek: háttér `#e4e7ec`, félkövér.
  - Partner sorok: 7pt méret, 3.5mm-es indentáció a megnevezésnél.
  - Összesítő és Mindösszesen sorok: duplavonalas kiemelés és automatikus `colSpan: 2`.
- **Lábléc:** Minden oldalon elválasztó vonal, oldalszámozás és audit időbélyeg a lap alján (290mm-nél).

### 3. ExcelJS Munkafüzet Export (`rlbGlExcel.ts`)
- Pénzügyi számformátum: `#,##0;(#,##0);"-"`.
- Kétszintes fejlécek összevont cellákkal (`A4:A5`, `C4:D4`, `E4:F4`).
- Záró mérlegegyezőségi blokk a táblázat alján.

---

## 🛡️ Minőségbiztosítás és Verifikáció
- **Tesztek:** `src/lib/__tests__/rlbGlData.test.ts` (5 teszt) és `src/lib/__tests__/rlbGlPdfAndExcel.test.ts` (2 teszt) 100%-os lefedettséggel igazolja az adathierarchiát, az egyezőséget és a PDF oldalszám-kalkulációt.
- **Típusbiztonság:** `npx tsc --noEmit` hibátlanul lefut (0 hiba).
- **Linter:** `npx oxlint` 0 hibával fut le az összes érintett fájlra.
