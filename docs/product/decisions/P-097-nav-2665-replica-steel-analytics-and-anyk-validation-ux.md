# P-097: NAV 2665 Nyomtatvány Replika, 6/B Acélipari Analitika és ÁNYK Validáció UX

**Status:** Decided  
**Category:** eaisyBooks / ÁFA  
**Updated:** 2026-09-20  

---

## Question
Hogyan biztosítja a felhasználói felület a hivatalos NAV 2665 nyomtatványnak megfelelő áttekintést, az Áfa tv. 6/B. melléklete szerinti fordított adózású acélipari tételek kezelését és az ÁNYK XML export előtti hibamegelőzést?

---

## Decision

### 1. Háromállású Al-Tab Nézetváltó a Bevallás Lapfülön
A `VatReturnViewTab.tsx` felületén a korábbi kétállású kapcsoló helyett egy modern, 3-állású tab-navigáció került kialakításra:
1. **Kalkulátor & M-lapok** (`'calculator'`): Interaktív összesítő kártyák, részletes sorszámítások és a 65M partneri összesítők.
2. **NAV 65 Nyomtatvány replika** (`'nav65'`): Hivatalos NAV 2665-A nyomtatványhű struktúra:
   - **05. sor**: Belföldi 5%-os adómérték alá tartozó értékesítés
   - **06. sor**: Belföldi 18%-os adómérték alá tartozó értékesítés
   - **07. sor**: Belföldi 27%-os adómérték alá tartozó értékesítés
   - **08. sor**: Közérdekű vagy speciális jellegére tekintettel adómentes értékesítés (TAM: egészségügy, oktatás, fogorvos, lakóingatlan bérbeadás)
   - **01. sor**: Közösség területén kívülre történő termékértékesítés (3. országos termékexport)
   - **04. sor**: Belföldi fordított adózású értékesítés (kiírása kötelezően `mentes`)
   - **29. sor**: Belföldi fordított adózású beszerzések fizetendő adója
   - **64. / 65. / 66. sorok**: Levonható ÁFA kategóriák (66. sorban az összes 27%-os és fordított adós beszerzés a levonási hányad arányában)
   - **91. és 92. sorok**: ÁFA területi hatályán kívüli ügyleteknél kiemelt felirat: `(SZOLGÁLTATÁSOK)`.
3. **6/B Acélipari kimutatás** (`'steel'`): Célzott analitikai felület az Áfa tv. 6/B. melléklete szerinti vas- és acéltermékek belföldi fordított adózású forgalmához.

### 2. Egységes „mentes” Megjelenítés 0% Helyett
- A felületen sem a replikában, sem az analitikában, sem a kalkulátorban nem jelenik meg megtévesztő „0%” felirat.
- Bármilyen 0-s érték (`0`, `0%`, `0.00`, `AAM`, `TAM`, `FAD`, `FORD`, `EXP`) esetén egységesen és kötelezően a **`mentes`** felirat látható (`formatVatRate` segédfüggvény révén).

### 3. Tételszintű VTSZ és Nettó Tömeg (kg) Kezelés
- **Számlatétel Dialógus (`InvoiceItemsDialog`)**:
  - Minden tétel leírása alatt közvetlenül elérhető az `ItemVtszWeightPopover` gomb.
  - A felugró ablakban megadható a VTSZ/KN kód és a nettó tömeg (kg).
  - Tájékoztató felirat figyelmeztet: a NAV 2665-07/08 nyilatkozat egész kg-ban kéri az adatot (a rendszer kerekíti).
  - Kétoldalú ikertétel-szinkron: a `nav_invoice_items` és `invoice_items` adatai kölcsönösen és automatikusan frissülnek.
- **6/B Acélipari Kimutatás Táblázat (`VatSteelProductsSection`)**:
  - Gyorsszűrők: Irány (Beszerzés 66. sor vs. Értékesítés 04. sor), Teljességi állapot (Minden / Hiányos / Kész), valamint szabadszavas kereső.
  - Közvetlen inline popover szerkesztési lehetőség a táblázat soraiban.

### 4. Hivatalos CSV Export a 2665-07 és 2665-08 Nyilatkozatokhoz
- A 6/B felületről letölthető CSV kimutatás külön oszlopban adja át a kerekített egész kilogrammos értéket:
  - `NAV 2665 Nettó tömeg (egész kg)`: `Math.round(netWeightKg)` — közvetlenül beírható az ÁNYK nyomtatványba
  - `Pontos tömeg (kg)`: pontos mérlegjegy szerinti tizedes érték a könyvelői egyeztetéshez.

### 5. ÁNYK XML Pre-Export Guard Figyelmeztető Dialógus
- Ha a felhasználó a fejléc Export menüjében az **„ÁNYK XML letöltés”** opcióra kattint, a rendszer ellenőrzi a 6/B acélipari tételek teljességét.
- Ha létezik hiányos tétel az időszakban:
  - Megjelenik egy modális figyelmeztető ablak (`AlertDialog`).
  - Felsorolja a hiányos tételek számát és az első érintett számlákat/partnereket a konkrét hiány okával (hiányzó VTSZ vagy hiányzó tömeg).
  - **„Tételek kiegészítése (6/B lap)”** gomb: azonnal átváltja a nézetet a 6/B fülre az adatok pótlásához.
  - **„Letöltés hiányosan is”** gomb: felülbírálási lehetőség, amellyel a könyvelő saját felelősségére letöltheti a félkész XML-t.
- Ha minden tétel hiánytalan, az XML export azonnal lefut.

---

## Current Implementation
- `src/features/vat/components/VatReturnViewTab.tsx`
- `src/features/vat/components/VatSteelProductsSection.tsx`
- `src/features/vat/hooks/useSteelProductsData.ts`
- `src/components/InvoiceItemsDialog.tsx`
- `src/components/vat/VatRowDrillDown.tsx`
- `src/lib/utils.ts` (`formatVatRate`)

---

## Rationale
Az acélipari fordított adózású ügyletek a NAV kiemelt kockázati ellenőrzései közé tartoznak. A VTSZ számok vagy tömegadatok hiánya ÁNYK hibaüzenetet és adóhatósági felszólítást von maga után. A proaktív figyelmeztető kapu és a nyomtatványi replika garantálja, hogy a könyvelő még a bevallás beadása előtt észrevegye a hiányzó adatokat.

---

## Kapcsolódó
- [A-131: NAV 2665 ÁFA Bevallás Sormegfeleltetés, Gyűjtőkódok Tisztítása, 6/B Acélipari Nyilatkozat és Egész Kilogrammos Kerekítés](../../architecture/decisions/A-131-nav-2665-vat-return-restructuring-and-steel-reporting.md)
- [P-032: [eaisyBooks] ÁFA Bevallás Workflow](./P-032-vat-return-workflow.md)
- [Decision 060: NAV 2665 ÁFA Bevallási Szabályok, Gyűjtőkódok és 6/B Acélipari Kötelezettség](../../business/decisions/060-nav-2665-vat-rules-and-steel-reporting.md)
- [A-080: NAV ÁNYK 2665 ÁFA-Bevallás és 65M Összesítő Jelentés Szabványos XML Export](../../architecture/decisions/A-080-nav-anyk-vat-return-xml-standardization.md)
