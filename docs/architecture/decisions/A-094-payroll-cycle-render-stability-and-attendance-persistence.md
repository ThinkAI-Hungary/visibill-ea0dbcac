# A-094: Bérszámfejtési Ciklus Végtelen Re-render Védelem, Stabil Függőségi Kulcsok és Kézi Jelenlét Perzisztencia

**Status:** Decided  
**Date:** 2026-09-05  
**Utoljára frissítve:** 2026-09-05  

## Context
Az eaisyBooks bérszámfejtési moduljában a 8-lépéses havi bérszámfejtési varázsló (`PayrollCyclePage.tsx`) használata során a felhasználó (EB-0073) azt tapasztalta, hogy a 3. lépésről (Jelenléti ív / munkanapok kézi beírása) a 4. lépésre (Cafeteria és telefon juttatások) továbblépve a képernyő hevesen, stroboszkópszerűen villódzott és folyamatosan újratöltött, megakadályozva a felület használatát és a továbblépést.

A technikai audit az alábbi összetett architektúra-problémákat tárta fel:
1. **Unmemoized Array Derived State:** A szülő komponensben a `const activeEmployees = employees.filter(e => e.status === 'active')` sor nem használt `useMemo`-t, így minden egyes komponens-renderelés során új tömbreferenciát hozott létre a memóriában.
2. **Cascading Infinite `useEffect` Loop:** A szülő `useEffect`-je, amely az aktív jogviszonyokhoz tartozó cafeteria tételeket kérdezi le az `accounty_cafeteria` táblából, függőségként a nyers `[activeEmployees, allEmployments]` tömbökre támaszkodott. Amikor a lekérés lefutott és meghívta a `setCafeteriaItems(data)`-t, a szülő újrarétegződött, új `activeEmployees` referenciát generált, ami újraindította a lekérést egy végtelen hurokban.
3. **Párhuzamos Lekérés & Layout Thrashing a Gyermekben:** A `PayrollStep4.tsx` szintén párhuzamosan lekérte ugyanezeket az adatokat, és minden újrendereléskor a teljes nézetet kicserélte a `<Loader2 />` spinnerre (`setLoading(true)`). A szülő másodpercenként többszöri re-renderje miatt a DOM folyamatosan fel- és leépült, meghiúsítva az eseménykezelést és a gombok megnyomását.
4. **Kézi Jelenléti Adatvesztés:** A Step 3-ban kézzel rögzített munkanapok, túlórák és táppénzes napok csupán lokális React állapotban éltek, lépésváltáskor nem perzisztálódtak az `accounty_timesheets` táblába.
5. **Hibás Táblanév Cikluslezáráskor:** A ciklus lezárásakor az update query a nem létező `payroll_cycles` táblára hivatkozott az `accounty_payroll_cycles` helyett, ami TypeScript és runtime hibát okozott.

## Decision
1. **Tömbreferenciák Memózása és Determinisztikus Kulcsképzés:**
   - A szülőben az `activeEmployees` állapot `useMemo(() => employees.filter(...), [employees])` burkolást kap.
   - Az aszinkron lekérések függőségeként tömbreferenciák helyett stabil, rendezett azonosító-string kulcsot használunk:
     ```tsx
     const activeEmploymentIdsKey = useMemo(() => {
       return allEmployments
         .filter(e => activeEmployees.some(emp => emp.id === e.employee_id))
         .map(e => e.id)
         .sort()
         .join(',');
     }, [allEmployments, activeEmployees]);
     ```
     Ez garantálja, hogy ha az érintett jogviszonyok azonosítói nem változnak, a `useEffect` soha nem fut le feleslegesen.

2. **Hierarchikus State Megosztás (Single Source of Truth):**
   - A `PayrollCyclePage` átadja a betöltött `cafeteriaItems` és `setCafeteriaItems` propokat a `PayrollStep4`-nek és `PayrollStep8`-nak.
   - Ha a gyermek megkapja a propot, teljesen kihagyja a párhuzamos hálózati lekérést (`if (propCafeteriaItems !== undefined) return;`).
   - A gyermekben a `loading` állapot kizárólag a legelső, független betöltésnél aktiválódik (`propCafeteriaItems === undefined && loading && cafeteriaItems.length === 0`), kiküszöbölve a villódzást (FOUC / layout thrashing).

3. **Lépésváltási Kézi Jelenlét Perzisztencia:**
   - A `handleStepChange` folyamatban a 3. lépésből történő elnavigáláskor a rendszer automatikusan kiírja az `attendanceData` állapotot az `accounty_timesheets` táblába (tranzakciós törlés + beszúrás), biztosítva az adatok megmaradását újratöltés esetén is.

4. **Sémakonform Cikluslezárás:**
   - A ciklus lezárási query expliciten az `accounty_payroll_cycles` táblára mutat: `supabase.from('accounty_payroll_cycles').update({ status: 'closed', current_step: 8 })`.

## Consequences
**Pozitív:**
- Teljes mértékben megszűnik a képernyő villódzása és az ismétlődő hálózati kérések áradata.
- A 8-lépéses varázsló minden fázisa stabilan kattinthatóvá és bejárhatóvá válik.
- A kézzel beírt jelenléti napok nem vesznek el sem lépésváltáskor, sem böngésző újratöltéskor.
- A cikluslezárás típusbiztos és runtime-hibamentes.

**Negatív / Figyelembe veendő:**
- Lépésváltáskor aszinkron mentés történik az `accounty_timesheets` táblába, amely hálózati hibakezelést igényel (lekezelve try/catch blokkal).

## Kapcsolódó
- [P-033: Bérszámfejtési Ciklus Workflow](../../product/decisions/P-033-payroll-cycle.md)
- [P-072: Bérszámfejtési Ciklus Jelenlét Kézi Rögzítés és Cafeteria UX Stabilitás](../../product/decisions/P-072-payroll-cycle-attendance-manual-entry-and-cafeteria-ux.md)
- [A-016: PostgreSQL Query Strategy](./A-016-postgresql-query-strategy.md)
- [A-083: Rules of Hooks Invariáns Garantálása](./A-083-rules-of-hooks-invariance-and-test-telemetry-guard.md)
