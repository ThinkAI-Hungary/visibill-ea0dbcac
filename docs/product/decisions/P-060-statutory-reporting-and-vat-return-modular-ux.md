# P-060: Modular UX for Statutory Reporting, VAT 2665 Calculator/Replica and Reusable Popover DatePicker

> **Státusz:** ✅ Decided  
> **Dátum:** 2026-09-01  
> **Típus:** UI/UX & Feature Architecture  
> **Érintett oldalak:** `/annual-report`, `/vat-return`, Reusable UI Components  
> **Kapcsolódó ADR:** [A-076](../../architecture/decisions/A-076-statutory-reporting-and-vat-return-monolith-modularization.md)  
> **Kapcsolódó PRD:** [P-032](./P-032-vat-return-workflow.md), [P-045](./P-045-pdf-export-ux.md)

---

## 1. Felhasználói Igény & Háttér

A Visibill és Accounty modulokban az Éves Beszámoló és az ÁFA Bevallás a legfontosabb hivatalos kötelezettségek közé tartoznak. A felhasználói élmény és stabilitás növelése érdekében a monolitikus képernyőket tiszta felbontású, specializált nézetekké alakítottuk, miközben modernizáltuk a felület űrlapjain a dátumkiválasztást is.

---

## 2. Termék & UX Döntések

### A. Éves Beszámoló 6-Lépéses Varázsló UX (`/annual-report`)
1. **Lépés 1 (Alapadatok & Cégadatok)**:
   - Cégazonosító, székhely, képviselő és beszámoló dátuma, modern `<DatePicker />` komponenssel.
2. **Lépés 2 (Adatimport & Zárás)**:
   - Befagyasztott Mérleg és Eredménykimutatás adatok összefoglaló kártyái, szinkronizációs RPC trigger.
3. **Lépés 3 (Validáció & Ellenőrzés)**:
   - Számviteli egyezőségi szabályok (pl. Eszközök = Források, Adózott eredmény átvezetések), interaktív ugrás az érintett lépésre.
4. **Lépés 4 (Kiegészítő Melléklet Szövegező & Sablonok)**:
   - Rich text szerkesztő beágyazott sablonváltozókkal (`{{cegnev}}`, `{{merlegfoosszeg}}`, stb.), automatikus HTML táblázat generálás és osztott képernyős élő PDF előnézet.
5. **Lépés 5 (Osztalékelhatárolás & Veszteség)**:
   - Adózott eredmény szinkron, osztalékfizetési korlátok és Sztv. szerinti 50%-os elhatárolt veszteség számítás.
6. **Lépés 6 (Export & Hivatalos Véglegesítés)**:
   - Véglegesítési viaszpecsét lezárás, 4-irányú export kártyák (PDF, e-Beszámoló CSV, OBR XML, Archívum).

### B. ÁFA Bevallás (NAV 2665) Kettős Nézet UX (`/vat-return`)
1. **Időszak & Frekvencia Választó Sáv**:
   - Havi (`H`), Negyedéves (`N`), Éves (`E`) gyorsváltás, automatikus beadási határidő visszaszámláló figyelmeztetéssel (5 napon belül piros/pulzáló).
2. **Kalkulátor & M-lapok Nézet**:
   - KPI kártyák, 12 hónapos gördülő ÁFA trend diagram, 82. sor áthozott követelés kezelés, A-lap harmonika fúrási lehetőségekkel (`VatRowDrillDown`), M-lap tételes számlák táblázat.
3. **NAV 65 Nyomtatvány Replika Nézet**:
   - A hivatalos NAV 2665 nyomtatvány vizuális ikertestvére valós idejű cellaértékekkel a könyvelői átláthatóságért.
4. **ÁNYK XML Validátor Dialógus & Export**:
   - Helyi XML fájl és generált bevallás validáció szerkezeti és számszaki hibák azonnali kiemelésével.

### C. Egységesített Lebegő Popover Dátumválasztó (`<DatePicker />`)
- **Probléma**: A böngészők natív `<input type="date">` elemei fehér felugró naptárat jelenítettek meg, ami sötét témában zavarta a vizuális harmóniát.
- **Megoldás**: Újrafelhasználható `src/components/ui/date-picker.tsx` komponens, amely Radix `Popover`-t és DayPicker `Calendar`-t használ magyar formátummal (`yyyy. MM. dd.`), sötét téma kompatibilitással, beépített naptár ikonnal és törlési lehetőséggel.

---

## 3. Hatás a Felhasználói Élményre

- **Gyors és Átlátható Munkafolyamat**: A lépésekre bontott felület csökkenti a hibázási lehetőséget.
- **Sötét Téma Koherencia**: Egységes design nyelv az egész platformon a naptárak és űrlapok szintjén is.
- **Megbízható Hivatalos Export**: Azonnali validáció ÁNYK és OBR benyújtás előtt.
