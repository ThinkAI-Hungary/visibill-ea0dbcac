# A-186: Munkavállalói Pótszabadságok Dinamikus Feloldó Motorja (Mt. 116–122. §)

**Status:** Decided  
**Date:** 2026-10-01  
**Utoljára frissítve:** 2026-10-01  
**Category:** Frontend / eaisyBooks / Bérszámfejtés  
**Ticket Reference:** EB-0223  

---

## 1. Context

A bérszámfejtési modulban az `EB-0223` ügyfélkérdés során a könyvelő azt kérdezte, hol kell rögzíteni a munkavállalók pótszabadságait (életkori, gyermekek utáni, megváltozott munkaképességű) a törzsbe a havi bérszámfejtés során.

A kódbázis auditja során feltártuk, hogy:
1. A háttérkalkulátor (`src/lib/payroll/leaveCalculator.ts`) `calculateLeaveBalance` függvénye már támogatta az életkori (`ageSupplement`), a gyermekek utáni (`childSupplement`), a fogyatékos gyermek utáni (`disabledChildSupplement`) és a rendkívüli pótszabadság (`extraLeaveDays`) számítását.
2. Ugyanakkor az `EmployeeDetailsPage.tsx` felületi vezérlőben a `leaveBalance` számításakor az input objektumban a gyermekek és pótszabadságok értéke fixen 0-ra volt hardkódolva (`childrenUnder16: 0`, `disabledChildren: 0`, `extraLeaveDays: 0`).
3. Bár az `accounty_dependents` (eltartottak) tábla és az `accounty_declarations` (adóelőleg-nyilatkozatok) léteztek az adatbázisban és a felületen rögzíthetőek voltak, a dolgozói szabadságmérleg nem kapcsolta össze ezeket az adatforrásokat, így a Szabadság fülön a gyermekek utáni pótszabadság és egyéb keretek tévesen 0 napként jelentek meg.

---

## 2. Decision

### 2.1. Tiszta Architektúrájú Feloldó Motor (`resolveEmployeeLeaveInput`)
A `src/lib/payroll/leaveCalculator.ts` modulban létrehoztuk a `resolveEmployeeLeaveInput` függvényt és a `ResolveLeaveInputParams` interfészt, amely több forrásból, determinisztikusan állítja elő a szabadságmérleg bemeneti paramétereit:

```typescript
export interface ResolveLeaveInputParams {
  employee: { birth_date?: string | null } | null;
  dependents?: Array<{ birth_date?: string | null; is_fetus?: boolean | null; is_disabled?: boolean | null; disabled?: boolean | null }>;
  declarations?: Array<{ declaration_type: string; status: string; parameters?: any }>;
  leaves?: Array<{ leave_type: string; status: string; days: number | string }>;
  primaryEmployment?: { start_date?: string | null; end_date?: string | null; weekly_hours?: number | string | null } | null;
  targetYear?: number;
}
```

### 2.2. Jogszabályi Szabályok Leképezése (Mt. 116–122. §)
1. **Mt. 117. § (Életkori pótszabadság):** A munkavállaló születési éve és a tárgyév különbségéből képződik. 25 éves kortól 1 nap, 28-tól 2 nap, 31-től 3 nap… 45 éves kortól 10 nap.
2. **Mt. 118. § (Gyermekek utáni pótszabadság):** Az Mt. 118. § (4) bekezdése szerint a gyermeket először a születésének évében, utoljára abban az évben kell figyelembe venni, amelyben a 16. életévét betölti. A feloldó motor kiszűri a még meg nem született magzatokat (`is_fetus = true`), és csak azokat a gyermekeket veszi figyelembe, akiknél `targetYear - birthYear <= 16`. (1 gyermek = 2 nap, 2 gyermek = 4 nap, 3+ gyermek = 7 nap).
3. **Adatbázis & Nyilatkozat Kettős Forrás (Fallback):** Ha az `accounty_dependents` rekordok még nincsenek feltöltve, a motor automatikusan beolvassa az aktív `family` deklaráció paramétereiben rögzített gyermekeket vagy a `children_count` mezőt.
4. **Mt. 118. § (2) (Fogyatékos gyermek):** Gyermekenként további +2 munkanap pótszabadság.
5. **Mt. 120. § (Megváltozott munkaképesség / Személyi kedvezmény):** Aktív `personal` típusú adóelőleg-nyilatkozat megléte esetén automatikusan évi 5 munkanap pótszabadságot ad az `extraLeaveDays` mezőhöz.
6. **Munkaidő és Időarányosítás:** A munkaviszony kezdetét (`employmentStartDate`), végét (`employmentEndDate`) és a heti munkaórákat (`weekly_hours`) figyelembe véve kalkulálja a napi munkaórákat (`dailyHours`) és az időarányos tört évi napokat.
7. **Jóváhagyott Szabadságok Szummázása:** Az `annual` és az `additional_*` típusú, `approved` státuszú tételeket összegzi.

### 2.3. Frontend Integráció (`EmployeeDetailsPage.tsx`)
- Bekötésre került a `usePayrollDependents(empId)` hook.
- A `leaveBalance` memoizált kalkuláció most egyetlen sorban, a `resolveEmployeeLeaveInput` hívásán keresztül hívja meg a `calculateLeaveBalance`-t.

---

## 3. Consequences

### Pozitív:
- **Automatikus, Null-Input Könyvelői Élmény:** A könyvelőnek semmit sem kell kézzel másolgatnia a bérszámfejtési törzsbe; a születési idő és a gyermekek/nyilatkozatok megadása után a szabadságkeret azonnal és pontosan megjelenik.
- **Tiszta Rétegződés & Tesztelhetőség:** A feloldási logika a UI komponenstől teljesen függetlenül, a `leaveCalculator.ts`-ben lakik, így 100%-ban unit tesztelhető böngésző nélkül is.
- **Rugalmas Adatforrás:** Ha a könyvelő a NAV 08 importból, a varázslóból, vagy a Nyilatkozatok fülről viszi fel a gyermekeket, mindkét forrást egységesen kezeli.

### Kockázatok és Kezelésük:
- *Hiányos születési dátumok:* Ha egy eltartottnál nincs megadva születési dátum, a rendszer megengedően eltartott gyerekként veszi figyelembe, biztosítva, hogy a jogosultság ne vesszen el hiányos törzsadat miatt.

---

## 4. Minőségbiztosítás & Tesztek

A `src/lib/payroll/__tests__/leaveCalculator.test.ts` tesztcsomag 8 új dedikált tesztesettel bővült, amely valamennyi jogszabályi esetet és határértéket ellenőrzi:
- Hiányzó adatok és `null` születési dátum kezelése.
- Mt. 117. § életkori sávok automatikus kiszámítása.
- Mt. 118. § 16 év alatti gyermekek és magzatok szűrése.
- 1, 2 és 3+ gyermekes sávok (2, 4, 7 nap).
- Eltartottak hiányában a családi nyilatkozat gyermeklistájára/számára való támaszkodás.
- Fogyatékos gyermek +2 nap.
- Személyi kedvezmény (Mt. 120. §) miatti +5 nap pótszabadság.
- Jóváhagyott szabadságok szummázása.

**Teszteredmény:** 30/30 teszt zöld (`src/lib/payroll/__tests__/leaveCalculator.test.ts`).  
**TypeScript fordítás:** `npx tsc --noEmit` exit code 0.

---

## 5. Kapcsolódó

- [P-149: Munkavállalói Pótszabadságok Törzsadat-alapú Feloldása és Szabadság Tájékoztató Kártya UX](../../product/decisions/P-149-payroll-leave-entitlements-and-guidance-card-ux.md)
- [A-166: Magyar Társadalombiztosítási (TB) Adómotor, Minimális Járulékalap (Tbj. 27. §), Nyugdíj és 2608 M-lap Architektúra](./A-166-tb-social-security-minimum-base-and-pensioner-payroll-engine.md)
- [A-081: NAV 08 XML Feldolgozás és Tömeges Rekonstrukciós Motor](./A-081-nav-08-payroll-reconstruction-and-bulk-import.md)
