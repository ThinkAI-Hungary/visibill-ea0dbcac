# A-108: Bérszámfejtési Munkába Járás Költségtérítés és Dolgozó-Központú Munkalap (Employee Worksheet View)

**Státusz:** ✅ Elfogadva (Decided)  
**Dátum:** 2026-09-09  
**Döntéshozók:** Antigravity Architect, Surányi Pál (EB-0082 – Carman-Food Kft. / Várhegyi Zsófi igény alapján)  
**Érintett komponensek:** `taxEngine.ts`, `usePayrollData.ts`, `payslipGenerator.ts`, `payrollAutoPoster.ts`, `PayrollStep8.tsx`, `EmployeeWizardPage.tsx`, `EmployeeTabSections.tsx`, `EmployeeWorksheetView.tsx`, `PayrollCyclePage.tsx`, `accounty_employments`, `accounty_tax_profiles`  
**Kapcsolódó döntések:** [A-094](./A-094-payroll-cycle-render-stability-and-attendance-persistence.md), [A-102](./A-102-eaisybooks-dual-mode-modular-architecture.md), [A-106](./A-106-pensioner-tax-exemption-and-service-charge-taxation.md), [P-080](../../product/decisions/P-080-employee-worksheet-and-commute-reimbursement-ux.md), [032-payroll-module](../../business/decisions/032-payroll-module.md)

---

## 1. Kontextus és Üzleti Igény

Az EB-0082 számú támogatási jegyben a Carman-Food Kft. könyvelője (Várhegyi Zsófi) két kulcsfontosságú bérszámfejtési fejlesztési igényt jelzett:
1. **Munkába járási utazási költségtérítés**: Vidékről bejáró dolgozók esetén törvényi kötelezettség a munkába járás támogatása a 39/2010. (II. 26.) Korm. rendelet és a Szja tv. 25. § (2) bek. alapján:
   - Gépkocsi használat: km alapon 18–30 Ft/km adómentes elszámolás a tényleges munkanapok arányában.
   - Közösségi közlekedés (helyközi bérlet / jegy): 86% kötelező vagy 100% önkéntes munkáltatói térítés.
   - Az összeg adó- és járulékmentes (0% SZJA, 0% TB, 0% SZOCHO), a dolgozónak nettóban kifizetendő, és a könyvelésben személyi jellegű egyéb kifizetésként (**T 551 — K 471**) kell szerepelnie.
2. **Dolgozó-központú munkalap nézet (Employee Worksheet)**: A korábbi kizárólagos 8-lépéses stepper folyamat helyett (ahol az adatok témakörök szerint oszlottak meg külön lépésekre) a vendéglátóipari és gyors bérszámfejtési folyamatokhoz elengedhetetlen egy dolgozói fókuszú felület, ahol egy kiválasztott dolgozó minden havi változó adata (jelenlét, órák, pótlékok, felszolgálási díj, munkába járás, letiltások) egyben áttekinthető és módosítható, azonnali élő bérszalvétával.

---

## 2. Döntések és Architektúra

### D-1: Munkába Járás Törzsadatok és Adatbázis Séma (`accounty_employments`, `accounty_tax_profiles`)
- Az `accounty_employments` táblához hozzáadásra kerültek az alábbi mezők:
  - `commute_type`: `'none' | 'car' | 'public_transit'` (alapértelmezett: `'none'`).
  - `commute_distance_km`: napi oda-vissza távolság km-ben (`numeric(8,2)`).
  - `commute_monthly_pass_cost`: bérlet/jegy havi költsége Ft-ban (`numeric(10,2)`).
  - `commute_reimbursement_pct`: megtérítési arány %-ban (`numeric(5,2)`, alapértelmezett: 86.00).
- Az `accounty_tax_profiles` táblához hozzáadásra került a cégszintű km díj paraméter:
  - `commute_car_rate_per_km`: adómentes km díj Ft/km-ben (`numeric(6,2)`, alapértelmezett: 30.00).

### D-2: Adómotor Számítási Logika (`taxEngine.ts`)
- A `TravelReimbursementInput` kibővült a munkába járási mezőkkel (`commuteType`, `commuteKm`, `commuteDays`, `commuteCarRate`, `commuteTransitPassCost`, `commuteReimbursementPct`).
- Számítás:
  - Gépkocsi: `commuteKm * commuteDays * commuteCarRate`
  - Közösségi közlekedés: `Math.round(commuteTransitPassCost * commuteReimbursementPct / 100)`
- **Adózási szabály:** 0% SZJA, 0% TB járulék, 0% SZOCHO. A bruttó bér alapot nem növeli, de a nettó kifizetéshez hozzáadódik:
  `netWage = max(0, grossWage - totalTax - garnishTotal) + taxFreeReimbursementTotal`.

### D-3: Főkönyvi Feladás és Kettős Könyvelési Egyensúly (`payrollAutoPoster.ts`, `PayrollStep8.tsx`)
- Az adómentes utazási költségtérítés a vegyes naplóban az alábbi tétellel könyvelődik:
  - **T 551 (Egyéb személyi jellegű kifizetések)** — összege: `totalCommute`
  - **K 471 (Nettó jövedelemelszámolás)** — megnövelve `totalCommute` összegével
- A könyvelési invariáns szigorúan teljesül: a Tartozik és Követel oldal mindkettő pontosan `totalCommute` értékkel nő, a mérleg egyensúlya fennmarad ($T = K$).

### D-4: Kettős Nézetváltó és Állapotmegőrzés (`PayrollCyclePage.tsx`)
- A bérszámfejtési ciklus fejlécében helyet kapott a `'stepper' | 'worksheet'` nézetváltó.
- A `PayrollCyclePage` megmaradt a központi állapot felelősének (`attendanceData`, `activeEmployees`, `employments`, `items`, `cafeteriaItems`, `calculations`), így a nézetek közötti váltás pillanatszerű és adatvesztés-mentes.

### D-5: Dolgozó-Központú Munkalap és Élő Bérszalvéta (`EmployeeWorksheetView.tsx`)
- **Bal oldali Sidebar (`WorksheetSidebar.tsx`)**:
  - Szűrők: `Mind`, `Függő`, `Kész`.
  - Haladási indikátor (`X / Y kész`).
  - Dolgozói kártyák státusz badge-ekkel (`🟢 Kész`, `🟡 Adattal`, `⚪ Alapért.`) és élő nettó összeggel.
- **Középső Űrlap (`WorksheetEmployeeForm.tsx`)**:
  - 1. Munkaidő & Jelenlét (napok, ledolgozott órák órabéres dolgozóknál, túlóra, táppénz, szabadság).
  - 2. Munkába járás (gépkocsi / bérlet, visszamentési lehetőséggel a törzsadatokba).
  - 3. Bérpótlékok, Bónusz & Felszolgálási díj (Szja tv. szerinti 15% SZJA mentes és 18.5% TB kezeléssel).
  - 4. Cafeteria & Home Office átalány.
  - 5. Letiltások & Levonások.
  - Gyorsbillentyűk és navigáció (Előző / Kész toggle / Következő).
- **Jobb oldali Élő Bérszalvéta (`WorksheetLivePayslip.tsx`)**:
  - Minden űrlapváltoztatásra azonnal lefutó szinkron bérkalkuláció.
  - Bruttó, adók, levonások, térítések és a munkáltatói szuperbruttó részletezése.
  - Kiemelt nettó kifizetés kártya és közvetlen bérlap nyomtatás.

---

## 3. Következmények és Migráció

- Migráció: `20260909140000_add_commute_reimbursement_fields.sql` sikeresen lefutott a Supabase adatbázison.
- Tesztek: 135 bérszámfejtési egységteszt és a teljes 1294 projekttesztes csomag hibátlanul lefutott.
- A vendéglátóipari és műszakos dolgozókat foglalkoztató partnerek (Carman-Food Kft., éttermek, telephelyek) percek alatt képesek elvégezni a havi zárást.
