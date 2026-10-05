# Session Summary — 2026-10-05 07:25

```text
feat(payroll, worksheet): EB-0245 hibajegy megoldása — prémium gépelési versenyhelyzet & PGRST116 duplikáció védelem, szakképzési tanulói 45 napos szabadságkeret (Szkt. 84. §), távollét dátumintervallum modál átfedésvédelemmel, bérlap szinkronizáció

- EB-0245 Ügyfélszolgálati Hibajegy Kivizsgálása & Élő Adatreparáció (Mandala Fogadó Kft. / Ruzsa Teréz)
  - Ügyféli hibajelzés: Ferenc Deák munkavállalónál a prémium/jutalom mező beragadt az első leütött számjegyre (2 Ft a 225 475 Ft helyett), és nem engedte a módosítást
  - Gyökérok: a `WorksheetEmployeeForm` mezője minden egyes karakterleütésre azonnali aszinkron Supabase `maybeSingle()` lekérdezést és mentést indított. A gyors gépelés párhuzamos lekérdezései futásversenyt idéztek elő, így 25 duplikált sor keletkezett az `accounty_payroll_items` táblában, ami miatt a PostgREST `PGRST116` hibát dobott ("JSON object requested, multiple rows returned")
  - Élő adatbázis reparáció (`supabase-visibill` MCP): a 25 párhuzamosan beragadt prémium tételt kitakarítottuk, és 1 darab helyes rekordot rögzítettünk `amount = 225475` értékkel
  - Élő séma & RLS ellenőrzés: az `accounty_leaves` és `accounty_payroll_items` táblák oszlopai és cég-hozzárendelés alapú RLS szabályai fizikailag ellenőrizve és sértetlenek

- Munkalapi Input Gépelési Versenyhelyzet Felszámolása (`WorksheetEmployeeForm.tsx`, `EmployeeWorksheetView.tsx`)
  - Dedikált lokális Controlled/Uncontrolled string draft állapotok (`bonusDraft`, `serviceChargeDraft`, `homeOfficeDraft`, `deductionsDraft`) bevezetése a `WorksheetEmployeeForm.tsx`-ben
  - Numerikus szanitizáció: `inputMode="numeric"` és `replace(/[^0-9]/g, '')` szűrés, kizárva a hibás karaktereket
  - Mutex / Commit védelem: az adatbázisba történő írás kizárólag `onBlur` (fókusz elhagyása) és `Enter` billentyű leütésére fut le, megszüntetve a szerver felesleges terhelését és a párhuzamos kéréseket
  - Dinamikus dolgozóváltás: a kiválasztott dolgozó váltásakor a draft állapotok automatikusan szinkronizálódnak az új dolgozó adataival
  - PGRST116 védelem & Duplikáció-takarítás: az `EmployeeWorksheetView.tsx` `handleItemChange` függvényét `maybeSingle()`-ről lista lekérdezésre alakítottuk át; az első tételt frissíti, az esetleges extra duplikált sorokat automatikusan törli, 0 Ft összegnél pedig az összes tételt eltávolítja
  - Felhasználóbarát hibajelzés: a `handleItemChange` catch ágában Toast hibaüzenet jelenik meg, ha hálózati kiesés miatt nem sikerül a mentés

- Szakképzési Tanulói 45 Napos Szabadságkeret Támogatás (`leaveCalculator.ts`, `WorksheetSidebar.tsx`, `WorksheetEmployeeForm.tsx`)
  - Szkt. 84. § (6) szerinti jogszabályi alapszabadság logika: a szakképzési munkaszerződéssel rendelkező tanulók (1131-es FEOR, 120-as NAV 08 import kód, `szakkep`/`szakkepzes` típusok) automatikusan évi 45 munkanap szabadságkeretet kapnak életkori pótszabadság nélkül
  - Munkakör megnevezés fallback: ha a NAV 08 importból hiányzik a megnevezés, a felület automatikusan "Szakképzési tanuló"-ként jeleníti meg a munkakört
  - Vizuális tanulói indikátorok: kiemelt lila "Tanuló" jelvény a bal oldali dolgozólistában (`WorksheetSidebar.tsx`) és "Szakképzési munkaszerződés (45 nap szabi)" kitűző a fejrészben (`WorksheetEmployeeForm.tsx`)

- Szabadság Dátumtartomány Rögzítő Modál & Átfedésvédelem (`WorksheetLeaveModal.tsx`)
  - Új integrált modális ablak létrehozása: a munkalapon a "Dátumok (tól-ig)" gombra kattintva konkrét naptári napok szerint rögzíthető a távollét
  - Távollét jogcímek támogatása: fizetett szabadság (alapbér), betegszabadság (70%), fizetés nélküli, tanulmányi és szülői szabadság
  - Automatikus munkanap-kalkuláció: a `calculateWorkingDays` algoritmus automatikusan kiszűri a szombatokat és vasárnapokat
  - Átfedés- és duplikációvédelem (`hasLeaveOverlap`): a modál mentés előtt megvizsgálja a megadott intervallumot a már rögzített szabadságokhoz képest; átfedés vagy duplikáció esetén a mentés leáll, és figyelmeztető hibaüzenet tájékoztatja a könyvelőt
  - Kétirányú szinkronizáció: új szabadság felvételekor vagy törlésekor a modál automatikusan frissíti az `accounty_leaves` táblát és a munkalapi összesített `leaveDays` számlálót

- Nyomtatott Bérlap (Payslip) Szabadságkeret Integráció (`PayrollCyclePage.tsx`)
  - A `buildPayslipData` függvényben bekötöttük a dinamikus `resolveEmployeeLeaveInput` és `calculateLeaveBalance` motort a korábbi merev `|| 20` fallback helyett
  - A nyomtatott és PDF bérlap mostantól a valós, jogszabályi keretet tünteti fel a tanulóknál (45 nap) és a Munka Törvénykönyve hatálya alá tartozó munkavállalóknál (életkor szerinti 20–30 nap)

- Morfi Implementation Review, Surgical Auto-Fix & Minőségbiztosítás (QA)
  - `/morfi-implementation-review` autonóm mélyaudit lefolytatása (8 fázisú downstream pipeline trace, 6-tengelyes megbízhatósági elemzés)
  - Surgical Auto-Fix: a `leaveCalculator.ts` `ResolveLeaveInputParams` interfészének kiegészítése a hiányzó típusmezőkkel (`job_code`, `employment_type`, `job_title`) a szemantikus típusbiztonság érdekében
  - Mély szemantikus TypeScript típusellenőrzés: `npx tsc -b` hibátlan (0 hiba)
  - Linter kódminőségi kapu: `npx oxlint` hibátlan (0 hiba)
  - Új egységtesztek: `WorksheetLeaveModal.test.ts` (14/14 passed) és `leaveCalculator.test.ts` (35/35 passed) — összesen 49/49 zöld teszt
  - Teljes bérszámfejtési tesztcsomag: `src/lib/payroll/` 208/208 sikeres teszt (13 tesztcsomag)
  - Production bundle build: `npm run build` sikeresen lefordult (19.96s)
```
