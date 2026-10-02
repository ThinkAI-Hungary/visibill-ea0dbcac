# P-153: Dinamikus Törvényes Munkanapkeret és Bérszámfejtési Munkanap Választó UX

- **Státusz:** ✅ Decided
- **Kategória:** UI / Bérszámfejtés (Payroll) / Munkaidő és Távollétek
- **Dátum:** 2026-10-02
- **Kérdés:** Hogyan biztosítsuk a bérszámfejtési ciklusban és a munkavállalói jelenléti íveken, hogy a havi munkanapok száma mindig a hatályos magyar Munka Törvénykönyve és a tárgyhavi munkaszüneti napok szerint automatikusan töltődjön be, megelőzve a manuális számolási hibákat?
- **Döntés:** Bevezetjük a tárgyhavi törvényes munkanapok automatikus naptári felkínálását a bérszámfejtési ciklusban (`PayrollCyclePage`), a dolgozói munkalapon (`WorksheetEmployeeForm`), az élő bérlapon (`WorksheetLivePayslip`) és a kilépő dolgozók varázslójában (`EmployeeExitWizardPage`).

---

## 1. Felhasználói Felület és Működés (UX)

### 1.1 Bérszámfejtési Ciklus és Jelenléti Ív Munkanapkeret
- Amikor a felhasználó megnyit egy bérszámfejtési ciklust (pl. 2026. október):
  - A rendszer a naptári motor segítségével automatikusan megállapítja a tárgyhónap munkanapjainak számát (figyelembe véve a munkaszüneti napokat és az áthelyezett munkanapokat).
  - Az új munkavállalók vagy hiányzó jelenléti ívek esetén a munkanapok beviteli mezője automatikusan a törvényes munkanappal inicializálódik (korábbi beégetett 22 nap helyett).
  - A mező alatt megjelenik a tájékoztató szöveg: *„Havi törvényes keret”*.

### 1.2 Élő Bérlap és Levonások Dinamikus Kalkulációja
- A munkalap jobb oldalán elhelyezkedő élő bérlapon (`WorksheetLivePayslip`):
  - A napi alapbér és órabér a tényleges havi munkanapkeret alapján frissül.
  - A betegszabadság (70%) és a fizetett távollét levonása/pótléka pontosan a havi naptári napok arányában kalkulálódik.

### 1.3 Kilépő Munkavállaló Szabadságmegváltása (`EmployeeExitWizardPage`)
- A dolgozó kilépésekor a megváltandó szabadságnapok pénzbeli értéke a kilépés hónapjának törvényes munkanapjaival kerül kiszámításra:
  - Az űrlapon dinamikusan látható a napi bér és a megváltási végösszeg:
    > *Napi bér: 21 429 Ft | Megváltás: 85 714 Ft* (pl. 21 munkanapos hónap esetén).

---

## 2. Rationale (Indoklás)

A bérszámfejtőknek nem kell fejből tudniuk vagy naptárból kikeresniük, hogy egy adott év adott hónapjában hány munkanap van, illetve mely szombatok minősülnek munkanapnak. A felület automatikusan a helyes törvényes keretet ajánlja fel, ami minimálisra csökkenti a humán adminisztrációs hibákat.

---

## 3. Kapcsolódó
- [A-192: Munka Törvénykönyve Szerinti Magyar Munkanap Motor](../../architecture/decisions/A-192-statutory-hungarian-workday-and-payroll-engine.md)
- [P-080: Dolgozó-Központú Munkalap és Munkába Járás UX](./P-080-employee-worksheet-and-commute-reimbursement-ux.md)
- [P-033: Bérszámfejtési Ciklus Workflow](./P-033-payroll-cycle.md)
