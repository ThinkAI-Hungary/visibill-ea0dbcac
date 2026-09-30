# P-149: Munkavállalói Pótszabadságok Törzsadat-alapú Feloldása és Szabadság Tájékoztató Kártya UX

**Status:** Decided  
**Date:** 2026-10-01  
**Category:** eaisyBooks / Bérszámfejtés  
**Ticket Reference:** EB-0223  

---

## 1. Question

Hogyan oldható fel és jeleníthető meg átláthatóan a munkavállalókat megillető Munka Törvénykönyve (Mt. 116–122. §) szerinti pótszabadság-keret (életkori, gyermekek utáni, megváltozott munkaképességű) az eaisyBooks felületén úgy, hogy a könyvelők számára azonnal egyértelmű legyen az adatok forrása és a havi számfejtési elszámolás módja?

---

## 2. Decision

1. **Dinamikus Pótszabadság-feloldás a Dolgozói Törzsből (`resolveEmployeeLeaveInput`):**
   - **Életkori pótszabadság (Mt. 117. §):** Nem igényel külön mezőt; a rendszer a munkavállaló születési dátuma (`birth_date`) alapján automatikusan megállapítja az életkori sávok szerint (25 éves kortól 1 nap, 28 éves kortól 2 nap… 45 éves kortól 10 nap).
   - **Gyermekek utáni pótszabadság (Mt. 118. §):** A rendszer az `accounty_dependents` táblában rögzített eltartott gyermekek születési ideje alapján automatikusan feloldja a 16. életévüket a tárgyévben vagy később betöltő gyermekeket (1 gyermek = 2 nap, 2 gyermek = 4 nap, 3+ gyermek = 7 nap). A magzatok (`is_fetus`) kizárásra kerülnek az Mt. 118. § (4) alapján.
   - **Adóelőleg-nyilatkozat Fallback:** Ha az eltartottak táblája üres, a rendszer az aktív családi kedvezmény nyilatkozat (`declaration_type = 'family'`) paramétereiből olvassa be a gyermekeket vagy a megadott gyermekszámot.
   - **Tartósan beteg / fogyatékos gyermek pótszabadság (Mt. 118. § (2)):** Gyermekenként további +2 munkanapot számol a rendszer.
   - **Megváltozott munkaképességű pótszabadság (Mt. 120. §):** Aktív személyi kedvezmény (`personal` nyilatkozat) esetén évi 5 munkanap pótszabadság automatikusan jóváírásra kerül.

2. **Szabadság Nyilvántartás Felületi Útmutató Kártya (`EmployeeLeaveTab.tsx`):**
   - A dolgozó adatlapján a **Szabadság** fülön a *„Részletes Szabadság Nyilvántartás (Mt.)”* táblázat alatt beépítésre került egy jogszabályi tájékoztató kártya (`Info` ikonnal), amely pontokba szedve tisztázza:
     - Az életkori pótszabadság a születési dátumból származik.
     - A gyermekek utáni pótszabadság az Eltartottak és a Nyilatkozatok fül adataiból képződik.
     - A havi bérszámfejtési ciklus 3. lépésében (*Jelenléti ív*) csak a tárgyhónapban ténylegesen kivett napokat kell rögzíteni, amit a rendszer automatikusan levon az éves egyenlegből.

---

## 3. Current Implementation

### 3.1. Dolgozói Adatlap (`EmployeeDetailsPage.tsx`)
- Bekötésre került a `usePayrollDependents(empId)` React Query hook.
- A korábbi hardkódolt `childrenUnder16: 0` és `disabledChildren: 0` helyett a `resolveEmployeeLeaveInput` hívásán keresztül áll elő a pontos `EmployeeLeaveInput` objektum.

### 3.2. Szabadság Tab (`EmployeeLeaveTab.tsx`)
- A részletes táblázat pontosan kimutatja az Alap-szabadságot (20 nap), az Életkori pótszabadságot, a Gyermekek utáni pótszabadságot és az egyéb jogcímeket óraalapú átszámítással együtt.
- Közvetlenül alatta az információs doboz segít a könyvelőnek tájékozódni a szabályokról.

---

## 4. Rationale

- Az `EB-0223` hibajegyben az ügyfél azt kereste a havi számfejtési ciklusban, hogy hová kell a törzsbe felvinni az éves pótszabadságokat.
- A könyvelők számára a magyar bérszámfejtési szoftverekből megszokott elvárás, hogy a gyermekek és az életkor alapján a pótszabadságok automatikusan kalkulálódjanak, felesleges manuális számolgatás és kézi felvitel nélkül.
- Az információs doboz proaktívan megelőzi a jövőbeli support jegyeket.

---

## 5. Kapcsolódó

- [A-186: Munkavállalói Pótszabadságok Dinamikus Feloldó Motorja (Mt. 116–122. §)](../../architecture/decisions/A-186-payroll-leave-entitlements-resolution-engine.md)
- [P-033: Bérszámfejtési Ciklus Workflow](./P-033-payroll-cycle.md)
- [P-072: Bérszámfejtési Jelenléti Ív és Kézi Adatbevitel UX](./P-072-payroll-cycle-attendance-manual-entry-and-cafeteria-ux.md)
