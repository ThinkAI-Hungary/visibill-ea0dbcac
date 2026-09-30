# P-148: Bérjegyzék Redesign, Költséghely Kezelés és FEOR Munkakör UX

**Status:** Decided  
**Date:** 2026-09-30  
**Category:** eaisyBooks / Bérszámfejtés  
**Ticket Reference:** EB-0230  

---

## 1. Question

Hogyan alakítható át a bérjegyzék és a bérszámfejtési felület úgy, hogy a dolgozók számára áttekinthető, a cégvezetés elvárásainak megfelelő (szuperbruttó elrejtése, költséghely nyilvántartása), és a NAV 08 importból automatikusan betöltődő munkaköröket jelenítsen meg?

---

## 2. Decision

1. **Bérjegyzék Sablon Redesign (`payslipGenerator.ts`):**
   - **Hero Dolgozónév:** A bérjegyzék bal felső részén a munkavállaló neve kiemelten, 15px félkövér méretben jelenik meg a könnyebb azonosítás érdekében.
   - **Munkakör Megjelenítés:** Automatikusan kombinálja a megnevezést és a FEOR kódot (`formatJobTitleWithFeor`), pl. *Könyvelő (számviteli ügyintéző) (FEOR 4121)*.
   - **Levonások Előjelének Tisztítása:** A dolgozói félreértések elkerülésére az SZJA, TB és egyéb levonások mellől eltávolítottuk a mínuszjelet.
   - **Kifizetés és Bankszámla Intelligens Megjelenítése:** Átutalásos munkavállalónál megjelenik a bankszámlaszám és IBAN, készpénzes kifizetés esetén pedig elegáns „Készpénz” megjelölés látható.
   - **Teljes Bérköltség (Szuperbruttó) Kitakarása:** A fizetési jegyzékről véglegesen eltávolítottuk a munkáltató teljes bérköltségét; kizárólag a tájékoztató jellegű SZOCHO vagy KIVA sor jelenik meg.
   - **Költséghely:** Kitöltött állapotban megjelenik a dolgozó költséghelye a fejlécben.

2. **Költséghely Kezelés Felületei:**
   - **Munkavállaló Törzs (`EmployeeTabSections.tsx`):** A Munkaviszonyok fülön közvetlenül rögzíthető és módosítható a munkakör és a költséghely.
   - **Havi Számfejtési Munkalap (`WorksheetEmployeeForm.tsx`, `EmployeeWorksheetView.tsx`):** A fejlécben elérhető egy gyors inline költséghely beviteli mező azonnali mentés gombbal.
   - **Élő Bérjegyzék Widget (`WorksheetLivePayslip.tsx`):** A számfejtés közben a jobb oldali előnézet valós időben tükrözi az új bérlapi elrendezést.

---

## 3. Current Implementation

### 3.1. Bérjegyzék Fejléc és Adatsorok
- A dolgozó neve a korábbi normál beágyazott sor helyett a `.employee-name-hero` stílussal a blokk tetején kapott helyet.
- A `Költséghely` sor feltételesen renderelődik, ha az `accounty_employments.cost_center` kitöltött.
- A kifizetési mód vizsgálja a készpénzes opciót: készpénznél a számlaszám helyett „Készpénz” jelenik meg.

### 3.2. Munkalap Fejléc
- A dolgozói kártya jobb felső sarkában a gyorsgombok mellett egy kompakt, letisztult költséghely mező és Mentés gomb biztosítja a gyors adatrögzítést a havi számfejtési ciklus elhagyása nélkül.

---

## 4. Rationale
- A dolgozók a bérjegyzék átvételekor elsőként a saját nevüket és a nettó összeget keresik; a hero elrendezés ezt azonnal láthatóvá teszi.
- A mínuszjelek eltávolítása megszünteti a dolgozói panaszokat és a könyvelők felé irányuló felesleges kérdéseket.
- A teljes bérköltség elrejtése megfelel a modern adatvédelmi és bérpolitikai gyakorlatnak.

---

## 5. Kapcsolódó
- [A-185: Bérjegyzék Megjelenítés, FEOR-08 Munkakör Szótár és Költséghely Architektúra](../../architecture/decisions/A-185-payslip-redesign-feor-dictionary-and-cost-center.md)
- [A-081: NAV 08 XML Feldolgozás és Tömeges Rekonstrukciós Motor](../../architecture/decisions/A-081-nav-08-payroll-reconstruction-and-bulk-import.md)
- [P-033: Bérszámfejtési Ciklus Workflow](./P-033-payroll-cycle.md)
- [P-063: Bérszámfejtés Gyors Rekonstrukció és Dolgozói Tömeges Import UX](./P-063-payroll-bulk-import-and-reconstruction-ux.md)
