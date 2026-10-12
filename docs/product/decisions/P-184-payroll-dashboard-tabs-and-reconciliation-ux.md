# P-184: Bérszámfejtési Irányítópult Tabosítás, Bérkontroll és Letisztult Menükezelés UX

**Status:** Decided  
**Category:** UI / Navigation / Ergonomics / Payroll  
**Date:** 2026-10-12  

---

## Question
Hogyan konszolidáljuk az eaisyBooks bérszámfejtési modulját (Module 14) egy letisztult, átlátható felületbe anélkül, hogy a bal oldali főmenü túlterheltté válna, elkerülve a zavaró szakmai kódokat a főcímekben, a menüpontok kettős aktív kijelölését, valamint az indokolatlan görgetési levágásokat?

---

## Decision

### 1. Belső Tab-rendszer a `PayrollDashboardPage`-en
* A korábbi önálló oldalsáv menüpontok (`Bérkontroll & Bank`, `NAV bevallások`) eltávolításra kerültek a bal oldali `ClientNav` navigációból.
* A [PayrollDashboardPage.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/PayrollDashboardPage.tsx) egy egységes, 3 füles Radix Tabs architektúrát kapott a lap tetején:
  * **🧮 Áttekintés & Ciklusok (`overview`):** Havi bérszámfejtési ciklusok, 3 oszlopos KPI cockpit, állandó és EFO egyszerűsített foglalkoztatottak kezelése, gyorsműveleti gombtár (Számfejtés Rekonstrukció, Importálás, Osztalék, Beállítások, Új dolgozó, Új havi ciklus).
  * **⚖️ Bérkontroll & Bank (`reconciliation`):** Beágyazott főkönyvi egyeztető felület (`<PayrollReconciliationPage embedded />`), 4 analitikai KPI kártya (471. Főkönyvi Egyenleg, Számfejtett Kifizetendő, Teljesített Kifizetések, Függő Bértartozás), banki automatikus párosító dialógus, GIRO XML export és kockázati eltéréslista.
  * **📋 NAV bevallások (`filings`):** Beágyazott havi 08-as és egyéb foglalkoztatói adóbevallások kezelőfelülete (`<FilingsPage embedded />`).
* **Header gombok hatóköre:** A gyorsműveleti gombok (Új ciklus, Új dolgozó, Rekonstrukció) csak az `overview` tabon jelennek meg, így a Bérkontroll és NAV bevallások lapok fejsora tiszta és fókuszált marad.

### 2. URL Szinkronizáció és Deep-Linking (`?tab=...`)
* A kiválasztott fül szinkronizálva van a böngésző URL query paraméterével:
  * Alapértelmezett: `.../payroll` (megfelel az `overview`-nak, a cím tiszta marad)
  * Bérkontroll: `.../payroll?tab=reconciliation`
  * NAV bevallások: `.../payroll?tab=filings`
* A korábbi közvetlen útvonalak (`.../payroll/reconciliation` és `.../payroll/filings`) az `accountyRoutes.tsx` segítségével zökkenőmentesen a megfelelő tabra nyílnak meg a `defaultTab` tulajdonságon keresztül.

### 3. Főcímek Tisztítása ("471" prefix eltávolítása)
* A felhasználói visszajelzés alapján a száraz számviteli számlaszám ("471") eltávolításra került a főcímekből:
  * eaisyBooks: `471. Bérkontroll & Főkönyvi Egyeztető` $\to$ **`Bérkontroll & Banki Egyeztető`**
  * Visibill: `Bérkontroll & 471` $\to$ **`Bérkontroll`**
* A számviteli egyensúly szakmai jellegét egy elegáns zöld státuszjelvény és alcím őrzi meg: `Sztv. 471 Egyezik (0 Ft)` és `Béranalitika ↔ Sztv. 471 Jövedelemelszámolási Főkönyv ↔ Banki/Pénztári kifizetések automatikus egyeztetése`.

### 4. ClientNav Egyedi Kijelölés (Zero Dual-Active)
* A menüben a naiv `startsWith` logikát felváltotta a leghosszabb prefix algoritmus.
* Bármilyen alútvonalra navigál a felhasználó a bérszámfejtésen belül, a bal oldali sávban kizárólag a **Bérszámfejtés** menüpont kap aktív zöld kiemelést, soha nem jelenik meg két kijelölt menüpont egyszerre.

### 5. Rugalmas Konténermagasság és Görgetésvédelem
* A [ScopedLayout.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/ScopedLayout.tsx) és a bérszámfejtési lapok külső konténereinél a merev `h-full overflow-hidden` helyett a rugalmas `min-h-full flex flex-col flex-1 pb-32` struktúrát alkalmazzuk.
* Ennek köszönhetően a nagy táblázatok alsó sorai, a paginációk és az akciógombok kisebb kijelzőkön (laptop, tablet) sem vágódnak le, hanem természetesen és simán görgethetők.

---

## Current Implementation
* **Irányítópult:** [PayrollDashboardPage.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/PayrollDashboardPage.tsx)
* **Bérkontroll beágyazható komponens:** [PayrollReconciliationPage.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/PayrollReconciliationPage.tsx)
* **Bevallások komponens:** [FilingsPage.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/Accounty/FilingsPage.tsx)
* **Navigáció:** [ClientNav.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/accounty/layout/ClientNav.tsx)
* **Visibill bérkontroll:** [SalariesPage.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/SalariesPage.tsx)
* **Útvonalkezelés:** [accountyRoutes.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/routes/accountyRoutes.tsx)

---

## Rationale
A bérszámfejtés önmagában is összetett feladat. Ha a kapcsolódó munkafolyamatok (ciklusok, banki egyeztetés, adóbevallások) szétszórtan, külön menüpontokban találhatók, az növeli a kognitív terhelést és rontja a használhatóságot. Az integrált tabos megközelítés egyetlen helyre gyűjti a bérügyeket, miközben az URL szinkronizáció fenntartja a közvetlen hivatkozhatóságot.

---

## Kapcsolódó
* [A-250: 14. Bérszámfejtés és Főkönyvi Bérfeladás Modul Architektúra, GIRO Motor és Tab Konszolidáció](../../architecture/decisions/A-250-payroll-module-14-reconciliation-giro-and-tab-architecture.md)
* [071: Bérszámfejtés, Sztv. 471 Főkönyvi Egyeztetés Szabályzata](../../business/decisions/071-payroll-statutory-reconciliation-and-bank-giro-policy.md)
* [P-143: 3-Oszlopos Bérszámfejtés és EFO Elkülönítés UX](./P-143-payroll-3column-dashboard-and-efo-separation-ux.md)
