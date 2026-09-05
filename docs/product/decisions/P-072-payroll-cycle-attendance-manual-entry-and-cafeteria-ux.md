# P-072: Bérszámfejtési Ciklus Jelenlét Kézi Rögzítés és Cafeteria UX Stabilitás

**Status:** Decided  
**Date:** 2026-09-05  
**Category:** UI / eaisyBooks / Payroll / Stepper Wizard / Resilience  

## Context
Az eaisyBooks bérszámfejtési moduljában a könyvelők a havi számfejtési ciklusokat egy 8-lépéses varázsló (`PayrollCyclePage.tsx`) segítségével vezénylik le. Az EB-0073 számú ügyfélszolgálati hibajegyben a könyvelő jelezte, hogy a 3. lépésben (Jelenléti ív / munkanapok bevitele) a kézzel beírt jelenléti adatokat követően a 4. lépésre (Telefon + Cafeteria) lépve a képernyő hevesen, stroboszkópszerűen villódzott és folyamatosan újratöltött, megakadályozva az adatok ellenőrzését és a folyamat befejezését.

A felhasználói vizsgálat rávilágított, hogy:
1. A könyvelők nem csupán OCR-es jelenléti ív feltöltést vagy CSV importot használnak, hanem közvetlen kézi szerkesztéssel is beírják az egyes dolgozók havi munkanapjait, túlóráit, betegszabadságait.
2. A manuálisan megadott adatok nem rendelkeztek automatikus mentéssel: a felhasználó elvárása az, hogy a lépések közötti navigálás (`Tovább`, `Vissza`, lépéssávra kattintás) automatikusan és észrevétlenül perzisztálja a beírt adatokat.
3. A 4. lépésre érve a párhuzamos szülő-gyermek lekérések és a nem memózott tömbreferenciák miatt layout thrashing alakult ki, ami a teljes nézetet folyamatosan villogó betöltőképernyőre (`Loader2`) cserélte.

## Question
Hogyan biztosítsuk a 8-lépéses bérszámfejtési ciklusban a kézzel bevitt jelenléti adatok zökkenőmentes automatikus mentését, és hogyan szüntessük meg a lépésváltások során tapasztalt villódzást anélkül, hogy a könyvelőt külön mentés gombok nyomogatására kényszerítenénk?

## Decision
1. **8-Lépéses Strukturált Bérszámfejtési Wizard Folyamat:**
   - **1. Adatbekérés:** Havi ciklus inicializálása és email adatbekérő kiküldése a cégvezetőnek.
   - **2. Ellenőrzés:** Beérkezett adatok, dolgozói jogviszonyok és adószámok érvényességének vizsgálata.
   - **3. Jelenléti ív:** Munkaidő, szabadság, táppénz, túlóra rögzítése (CSV import vagy táblázatos kézi adatbevitel).
   - **4. Telefon + Cafeteria:** SZÉP kártya, egyéb juttatások és magáncélú telefonhasználat kezelése.
   - **5. Bruttó + Pótlék:** Alapbérek, műszakpótlékok, készenlét és prémiumok összesítése.
   - **6. Adó + Járulék:** SZJA, TB járulék, SZOCHO automatikus kalkuláció és kedvezmények (családi, 25 év alatti, stb.) érvényesítése.
   - **7. Levonások:** Bírósági letiltások, munkabérelőlegek és egyéb levonások érvényesítése.
   - **8. Számfejtés:** Végleges ellenőrzés, bérjegyzékek nyomtatása, utalási csomag export és ciklus lezárása.

2. **Automatikus Lépésváltási Perzisztencia (Zero Click Save):**
   - A könyvelőnek nem kell külön „Mentés” gombot nyomnia a 3. lépésben.
   - A rendszer a lépésváltási navigációs esemény során (`handleStepChange`) automatikusan felismeri, ha az aktuális lépés a 3. (Jelenléti ív), és a háttérben atomi módon menti az `attendanceData` állapotot az `accounty_timesheets` táblába.
   - Ha a könyvelő később visszatér a ciklusba, vagy frissíti a böngészőt, a kézzel rögzített jelenléti adatok hiánytalanul visszatöltődnek.

3. **Villódzásmentes Felületi Stabilitás (Zero Flicker UX):**
   - A szülő `PayrollCyclePage` biztosítja az egyetlen hiteles forrást (Single Source of Truth) a cafeteria adatokhoz.
   - A 4. és 8. lépések felé propként továbbadott `cafeteriaItems` esetén a gyermek komponensek nem indítanak párhuzamos hálózati lekérést, és nem mutatnak teljes képernyős spinnert.
   - A nézet stabil, azonnal renderelődik, kiküszöbölve a gombok kattinthatatlanságát és a stroboszkóp hatást.

4. **Konzisztens Ciklus Állapotkormányzás:**
   - A varázsló lépéseihez explicit státusztársítás tartozik az adatbázisban (`data_collection` -> `review` -> `calculating` -> `calculated` -> `closed`), így a csapat többi tagja is látja a bérszámfejtés előrehaladását.
   - A 8. lépésben a „Ciklus lezárása” gomb megnyomásakor a státusz megbízhatóan `closed`-ra vált az `accounty_payroll_cycles` táblában.

## Current Implementation
- Varázsló keretrendszer: [src/pages/Accounty/PayrollCyclePage.tsx](../../../src/pages/Accounty/PayrollCyclePage.tsx)
- Lépés komponensek:
  - [src/components/accounty/payroll/PayrollStep3.tsx](../../../src/components/accounty/payroll/PayrollStep3.tsx) (Kézi jelenléti rögzítés és CSV feldolgozás)
  - [src/components/accounty/payroll/PayrollStep4.tsx](../../../src/components/accounty/payroll/PayrollStep4.tsx) (Villódzásmentes cafeteria és juttatás kezelő)
  - [src/components/accounty/payroll/PayrollStep8.tsx](../../../src/components/accounty/payroll/PayrollStep8.tsx) (Bérjegyzék export és ciklus zárás)
- Adattáblák:
  - `accounty_payroll_cycles` (ciklus állapot és aktív lépés)
  - `accounty_timesheets` (jelenléti adatok dolgozónként és ciklusonként)
  - `accounty_cafeteria` (juttatási tételek)

## Rationale
- **Maximális könyvelői kényelem:** A könyvelő munkája nem szakad meg adatvesztés vagy felesleges mentési dialógusok miatt.
- **Megbízható felületi élmény:** Az azonnali és villódzásmentes tabváltás növeli a rendszerbe vetett bizalmat és a prémium termékérzetet.
- **Folyamatbiztonság:** A lépések zárt, lineáris logikája garantálja, hogy a kalkuláció előtt minden szükséges jelenléti és juttatási adat rendelkezésre álljon.

## Kapcsolódó
- [P-033: Bérszámfejtési Ciklus Workflow](./P-033-payroll-cycle.md)
- [P-063: Bérszámfejtés Gyors Rekonstrukció és Dolgozói Tömeges Import UX](./P-063-payroll-bulk-import-and-reconstruction-ux.md)
- [A-094: Bérszámfejtési Ciklus Végtelen Re-render Védelem és Jelenlét Perzisztencia](../../architecture/decisions/A-094-payroll-cycle-render-stability-and-attendance-persistence.md)
- [A-083: Rules of Hooks Invariáns Garantálása](../../architecture/decisions/A-083-rules-of-hooks-invariance-and-test-telemetry-guard.md)
