# P-173: Termékimport és Vámhatározatok Rögzítése és Megjelenítése UX

**Status:** Decided  
**Date:** 2026-10-09  
**Category:** UI / Workflow / VAT & Statutory Reporting  
**Kapcsolódó döntések:** [BDR-066](../../business/decisions/066-import-customs-vat-declarations.md) · [A-235](../../architecture/decisions/A-235-import-customs-vat-declarations-and-return-integration.md) · [P-032](./P-032-vat-return-workflow.md)

---

## 🎯 Question
Hogyan biztosítsuk a harmadik országból történő termékbehozatalhoz kapcsolódó vámhatározatok (EV vámokmány, határozat szabad forgalomba bocsátásról) egyszerű rögzítését, kezelését, és azok közvetlen integrálását az ÁFA bevallásba (NAV 2665 70–72. és 18–20. sorok) a könyvelő számára?

---

## 💡 Decision

### 1. Termékimport Analitikai Szekció (`VatImportCustomsSection.tsx`)
Az ÁFA bevallás (`/vat-return`) felületen egy elkülönített, átlátható vezérlő szekció jelenik meg:
- **Fejléc KPI mutatók:** Időszaki import adóalap (Ft), Levonható import ÁFA (Ft), Fizetendő önadózói import ÁFA (Ft).
- **Akciógomb:** `[ ➕ Új vámhatározat rögzítése ]` kiemelt zöld gomb.
- **Vámhatározat Táblázat:**
  - Vámhatározat iktatószáma (pl. `12345/2026/NAV/VAM`)
  - Vámhivatal megnevezése / kódja
  - Határozat kelte és esedékessége
  - Külföldi exportőr / eladó neve és székhelye
  - Adóalap (vámérték + járulékos költségek)
  - Áfakulcs gyűjtőkód (`IMPORT_27`, `IMPORT_18`, `IMPORT_5`, `IMPORT_MENTES`)
  - Számított és felszámított ÁFA összeg
  - Önadózói státusz badge (`Önadózói import`)
  - Pénzügyi rendezettség jelző (🟢 Megfizetve / 🟡 Függőben)
  - Műveletek: Szerkesztés, Törlés

### 2. Rögzítő és Szerkesztő Dialógus (`ImportCustomsDeclarationDialog.tsx`)
Modális ablak, amely garantálja a hibamentes adatrögzítést:
- **Vámhatározat azonosítók:** Iktatószám (kötelező), Vámhivatal kódja.
- **Dátumok:** Határozat kelte, Jogerőre emelkedés dátuma, Fizetési határidő.
- **Külföldi partner adatok:** Név, ország, cím.
- **Önadózói jelölő (Toggle):** *„Önadózói vámkezelés (ÁFA fizetendő adóként is vallandó a 18–20. sorokban)”*.
- **Pénzügyi adatok:**
  - Adóalap (Ft) — a vámjogi vámérték és a belföldi első rendeltetési helyig felmerülő fuvar/biztosítás összege.
  - Áfakulcs legördülő (27%, 18%, 5%, Mentes) — a választás automatikusan kiszámítja az ÁFA összeget.
  - ÁFA összeg kézi korrekciós mező (ha a vámhatározat kerekítése 1-2 Ft-tal eltér).
  - Vám és egyéb behozatali terhek összege.
- **Fizetési igazolás:** *„Vámhatóságnak megfizetve”* kapcsoló és megfizetés dátuma (kivetéses eljárásnál a levonási jog törvényi feltétele).

### 3. Dinamikus Nyomtatvány Integráció (NAV 2665)
Az elmentett vámhatározatok automatikusan beépülnek a hivatalos 2665-ös digitális replikába és az XML exportba:
- **70–72. sorok:** Termékimport után levonható adóalap és adó (kivetéses és önadózói esetén is).
- **18–20. sorok:** Önadózói import esetén fizetendő termékimport adóalap és adó.
- Valós idejű újraszámolás a nyomtatványon anélkül, hogy az oldalt újra kellene tölteni.

---

## 🔍 Current Implementation
- `src/features/vat/components/ImportCustomsDeclarationDialog.tsx`
- `src/features/vat/components/VatImportCustomsSection.tsx`
- `src/features/vat/components/VatReturnViewTab.tsx`

---

## 📈 Rationale
A külföldi számlák a NAV Online Számla rendszerben nem jelennek meg. A vámhatározatok dedikált beviteli és analitikai modulja nélkül a könyvelő kénytelen lenne kézi Excelben számolgatni az import áfát és kézzel módosítani a bevallási sorokat. Ez a megoldás teljes transzparenciát és auditálhatóságot ad.

---

## 🔗 Kapcsolódó
- **BDR:** [066: Termékimport és Vámhatározatok ÁFA Elszámolása](../../business/decisions/066-import-customs-vat-declarations.md)
- **ADR:** [A-235: Termékimport és Vámhatározatok ÁFA Integrációja](../../architecture/decisions/A-235-import-customs-vat-declarations-and-return-integration.md)
