# A-192: Munka Törvénykönyve (Mt.) Szerinti Magyar Munkanap és Törvényes Bérszámfejtési Keret Motor

- **Státusz:** ✅ Decided
- **Dátum:** 2026-10-02
- **Utoljára frissítve:** 2026-10-02
- **Érintett területek:** Bérszámfejtés (Payroll), Munka Törvénykönyve (Mt.), Magyar Naptár, Táppénz & Szabadság, Kilépő Elszámolás, TypeScript Domain Engine

---

## 1. Kontextus és Problémafelvetés

A havidíjas és óradíjas munkavállalók bérszámfejtésekor a napi- és órabérek, a fizetett ünnepek, a táppénzes munkanap-kiesések, valamint a munkába járási költségtérítések számításának alapja az adott hónap **törvényes általános munkarend szerinti munkanapjainak száma**.

### A korábbi hiányosság (Root Cause)
A bérszámfejtési modul korábban statikusan egy fix 22 napos havi osztóval kalkulált:
```typescript
// Korábbi statikus implementáció:
dailyRate = baseSalary / 22;
hourlyRate = baseSalary / (dailyHours * 22);
```
Ez számviteli és munkajogi hibákhoz vezetett:
1. A magyar naptárban a munkanapok száma hónapról hónapra 19 és 23 nap között változik.
2. A statikus 22-es osztó miatt egy 19 vagy 20 munkanapos hónapban (pl. december) a munkavállaló napi alapbére alulértékelt volt, míg egy 23 munkanapos hónapban (pl. július) felülértékelt.
3. Nem kezelte a hivatalos magyar munkaszüneti napokat, a mozgó egyházi ünnepeket (Húsvét, Pünkösd), sem az éves kormányrendeletekben kihirdetett áthelyezett munkanapokat és szombati ledolgozásokat.

---

## 2. Döntések és Architektúra

### D-1: Tiszta Naptári Kalkulátor Motor (`src/lib/payroll/workdayCalculator.ts`)
Létrehoztunk egy önálló, tiszta domaint megvalósító számítási motort:
- **Hivatalos rögzített ünnepek:** Január 1., Március 15., Május 1., Augusztus 20., Október 23., November 1., December 25-26.
- **Mozgó ünnepek számítása:** Meeus/Jones/Butcher Gauss-algoritmus alapján futásidőben kalkulálja a Húsvéthétfőt és Pünkösdhétfőt bármely évre.
- **Kormányrendeleti áthelyezett munkanapok (2024–2027):** Pontos naptári térkép tartalmazza a szombati ledolgozott napokat (amikor a szombat munkanap) és a pénteki/hétfői pihenőnapokat (amikor a munkanap munkaszüneti nap).
- **Publikus API:**
  - `getStatutoryWorkDays(year: number, month: number): number`: Visszaadja a hónap törvényes munkanapjainak számát.
  - `isStatutoryWorkDay(date: Date): boolean`: Eldönti egy adott naptári napról, hogy az hivatalos munkanap-e.

### D-2: Dinamikus Törvényes Osztó a Bérszámfejtési Pipeline-ban (`src/hooks/usePayrollData.ts`)
A `useRunBatchPayroll` mutációban a bérszámfejtési kalkuláció a ciklus évének és hónapjának megfelelő törvényes munkanapot alkalmazza:
```typescript
const statutoryWorkDays = getStatutoryWorkDays(input.year, input.month);
const effectiveWorkDays = attendance.workDays || statutoryWorkDays;
dailyRate = baseSalary / effectiveWorkDays;
hourlyRate = baseSalary / (dailyHours * effectiveWorkDays);
```

### D-3: Munkába Járás és Távollétek Keretének Frissítése
A munkába járási napok (`commuteDays`) és a munkalapon ténylegesen ledolgozott napok számítása a havi törvényes keretből vonja le a távolléteket:
```typescript
commuteDays: Math.max(0, (attendance.workDays || statutoryWorkDays) - (attendance.sickDays || 0) - (attendance.leaveDays || 0))
```

### D-4: UI Komponensek és Varázslók Integrációja
A felületek dinamikusan átvették az új motort:
- `PayrollCyclePage.tsx`: Ciklus betöltésekor automatikusan kiszámítja és beállítja a `defaultWorkDays` értéket.
- `WorksheetEmployeeForm.tsx` & `WorksheetLivePayslip.tsx`: Az alapértelmezett munkanap a törvényes havi keret, de a bérszámfejtő szükség esetén egyedileg módosíthatja.
- `EmployeeExitWizardPage.tsx`: A kilépő munkavállaló szabadságmegváltását a kilépés napjának (`lastDay`) hónapjára érvényes törvényes munkanapszámmal számolja ki.

---

## 3. Következmények és Eredmények

- ✅ **Munkajogi és számviteli precizitás:** A napi bér, órabér és szabadságmegváltás összege pontosan megfelel a Munka Törvénykönyve előírásainak.
- ✅ **Automatikus naptárkezelés:** Nincs szükség manuális munkanap-számlálásra a bérszámfejtő részéről.
- ✅ **Tesztlefedettség:** 10 célzott unit teszt (`src/lib/payroll/__tests__/workdayCalculator.test.ts`) ellenőrzi a 2026-os és 2027-es ünnepnapokat és szombati ledolgozásokat.

---

## 4. Kapcsolódó
- [A-094: Bérszámfejtési Ciklus Végtelen Re-render Védelem és Jelenlét Perzisztencia](./A-094-payroll-cycle-render-stability-and-attendance-persistence.md)
- [A-108: Bérszámfejtési Munkába Járás Költségtérítés](./A-108-payroll-commute-reimbursement-and-employee-worksheet.md)
- [A-186: Munkavállalói Pótszabadságok Dinamikus Feloldó Motorja](./A-186-payroll-leave-entitlements-resolution-engine.md)
- [P-153: Dinamikus Törvényes Munkanapkeret és Bérszámfejtési Munkanap Választó UX](../../product/decisions/P-153-dynamic-statutory-workday-framework-and-payroll-ux.md)
