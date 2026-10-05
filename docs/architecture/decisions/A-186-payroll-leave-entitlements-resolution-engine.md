# A-186: Munkavállalói Pótszabadságok Dinamikus Feloldó Motorja (Mt. 116–122. §) és Szakképzési Tanulói Keret (Szkt. 84. §)

**Status:** Decided  
**Date:** 2026-10-01  
**Utoljára frissítve:** 2026-10-05  
**Category:** Frontend / eaisyBooks / Bérszámfejtés  
**Ticket Reference:** EB-0223, EB-0245  

---

## 1. Context

A bérszámfejtési modulban az `EB-0223` és `EB-0245` ügyfélkérések során felmerült problémák:
1. Az `EB-0223` során a könyvelő azt kérdezte, hol kell rögzíteni a munkavállalók pótszabadságait (életkori, gyermekek utáni, megváltozott munkaképességű) a törzsbe a havi bérszámfejtés során.
2. Az `EB-0245` hibajegyben (Mandala Fogadó Kft.) a könyvelő jelezte, hogy a szakképzési munkaszerződéssel foglalkoztatott diákoknál a rendszer az Mt. szerinti 20 napot vette alapul az évi 45 napos tanulói keret helyett, és a nyomtatott bérlapon is tévesen 20 nap szerepelt a jogszabályi keret helyett.

---

## 2. Decision

### 2.1. Tiszta Architektúrájú Feloldó Motor (`resolveEmployeeLeaveInput`)
A `src/lib/payroll/leaveCalculator.ts` modulban a `resolveEmployeeLeaveInput` függvény és a `ResolveLeaveInputParams` interfész több forrásból, determinisztikusan állítja elő a szabadságmérleg bemeneti paramétereit:

```typescript
export interface ResolveLeaveInputParams {
  employee: { birth_date?: string | null } | null;
  dependents?: Array<{ birth_date?: string | null; is_fetus?: boolean | null; is_disabled?: boolean | null; disabled?: boolean | null }>;
  declarations?: Array<{ declaration_type: string; status: string; valid_from?: string | null; created_at?: string | null; parameters?: any }>;
  leaves?: Array<{ leave_type: string; status: string; days: number | string }>;
  primaryEmployment?: {
    start_date?: string | null;
    end_date?: string | null;
    weekly_hours?: number | string | null;
    job_code?: string | null;
    employment_type?: string | null;
    job_title?: string | null;
  } | null;
  targetYear?: number;
}
```

### 2.2. Jogszabályi Szabályok Leképezése (Mt. 116–122. § és Szkt. 84. §)
1. **Mt. 117. § (Életkori pótszabadság):** A munkavállaló születési éve és a tárgyév különbségéből képződik. 25 éves kortól 1 nap, 28-tól 2 nap, 31-től 3 nap… 45 éves kortól 10 nap.
2. **Mt. 118. § (Gyermekek utáni pótszabadság):** Az Mt. 118. § (4) bekezdése szerint a gyermeket először a születésének évében, utoljára abban az évben kell figyelembe venni, amelyben a 16. életévét betölti. A feloldó motor kiszűri a még meg nem született magzatokat (`is_fetus = true`), és csak azokat a gyermekeket veszi figyelembe, akiknél `targetYear - birthYear <= 16`. (1 gyermek = 2 nap, 2 gyermek = 4 nap, 3+ gyermek = 7 nap).
3. **Adatbázis & Nyilatkozat Kettős Forrás (Fallback):** Ha az `accounty_dependents` rekordok még nincsenek feltöltve, a motor automatikusan beolvassa az aktív `family` deklaráció paramétereiben rögzített gyermekeket vagy a `children_count` mezőt.
4. **Mt. 118. § (2) (Fogyatékos gyermek):** Gyermekenként további +2 munkanap pótszabadság.
5. **Mt. 120. § (Megváltozott munkaképesség / Személyi kedvezmény):** Aktív `personal` típusú adóelőleg-nyilatkozat megléte esetén automatikusan évi 5 munkanap pótszabadságot ad az `extraLeaveDays` mezőhöz.
6. **Munkaidő és Időarányosítás:** A munkaviszony kezdetét (`employmentStartDate`), végét (`employmentEndDate`) és a heti munkaórákat (`weekly_hours`) figyelembe véve kalkulálja a napi munkaórákat (`dailyHours`) és az időarányos tört évi napokat.
7. **Jóváhagyott Szabadságok Szummázása:** Az `annual` és az `additional_*` típusú, `approved` státuszú tételeket összegzi.
8. **Szkt. 84. § (6) (Szakképzési tanulók alapszabadsága):** A szakképzésről szóló 2019. évi LXXX. törvény alapján a tanulót évi 45 munkanap szabadság illeti meg. A rendszer automatikusan észleli a jogviszonyt (`job_code === '1131'`, `job_code === '120'`, `employment_type === 'szakkep'` vagy `'szakkepzes'`, illetve ha a megnevezés szakképzést jelöl), és 45 napos keretet állít be az Mt. szerinti életkori pótszabadság mellőzésével.

### 2.3. Frontend Integráció (`EmployeeDetailsPage.tsx`)
- Bekötésre került a `usePayrollDependents(empId)` hook.
- A `leaveBalance` memoizált kalkuláció a `resolveEmployeeLeaveInput` hívásán keresztül fut le.

### 2.4. Nyomtatott Bérlap (Payslip) és PDF Szinkronizáció (`PayrollCyclePage.tsx`)
- A `buildPayslipData` függvényben a korábbi merev `(employment as any)?.annual_leave_days || 20` helyett közvetlenül a `resolveEmployeeLeaveInput` és `calculateLeaveBalance` fut le.
- Ennek eredményeként a dolgozóknak kiadott nyomtatott és PDF bérlapon a tanulóknak a valós 45 nap, a normál Mt. munkavállalóknak pedig az életkor szerinti 20–30 nap jelenik meg a szabadság egyenleg fejlécében.

---

## 3. Consequences

### Pozitív:
- **Automatikus, Null-Input Könyvelői Élmény:** A könyvelőnek semmit sem kell kézzel másolgatnia a bérszámfejtési törzsbe; a születési idő és a gyermekek/nyilatkozatok megadása után a szabadságkeret azonnal és pontosan megjelenik.
- **Törvényi Megfelelőség a Szakképzésben:** A vendéglátóipari és egyéb duális képzésben részt vevő diákok törvényes 45 napos kerete automatikusan érvényesül.
- **Konzisztens Bérlap és Munkalap:** A Dolgozói Munkalap, az Adatlap és a nyomtatott Bérlap ugyanazt a kalkulált keretet mutatja.

---

## 4. Minőségbiztosítás & Tesztek

A `src/lib/payroll/__tests__/leaveCalculator.test.ts` tesztcsomag valamennyi jogszabályi esetet és határértéket ellenőrzi:
- Hiányzó adatok és `null` születési dátum kezelése.
- Mt. 117. § életkori sávok automatikus kiszámítása.
- Mt. 118. § 16 év alatti gyermekek és magzatok szűrése.
- 1, 2 és 3+ gyermekes sávok (2, 4, 7 nap).
- Szakképzési tanulói 45 napos keret (1131 és 120 kódok).
- Jóváhagyott szabadságok szummázása.

**Teszteredmény:** 35/35 teszt zöld (`leaveCalculator.test.ts`).  
**TypeScript fordítás:** `npx tsc -b` exit code 0.

---

## 5. Kapcsolódó

- [A-108: Bérszámfejtési Munkába Járás Költségtérítés és Dolgozó-Központú Munkalap](./A-108-payroll-commute-reimbursement-and-employee-worksheet.md)
- [P-149: Munkavállalói Pótszabadságok Törzsadat-alapú Feloldása és Szabadság Tájékoztató Kártya UX](../../product/decisions/P-149-payroll-leave-entitlements-and-guidance-card-ux.md)
- [P-080: Dolgozó-Központú Munkalap és Munkába Járási Költségtérítés UX](../../product/decisions/P-080-employee-worksheet-and-commute-reimbursement-ux.md)
- [A-081: NAV 08 XML Feldolgozás és Tömeges Rekonstrukciós Motor](./A-081-nav-08-payroll-reconstruction-and-bulk-import.md)
