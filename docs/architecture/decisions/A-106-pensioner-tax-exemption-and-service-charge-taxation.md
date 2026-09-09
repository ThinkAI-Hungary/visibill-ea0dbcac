# A-106: Saját Jogú Nyugdíjas Járulékmentesség, Megbízási Munkaidő Rugalmasság és Vendéglátóipari Felszolgálási Díj Adózás

**Státusz:** ✅ Elfogadva (Decided)  
**Dátum:** 2026-09-08  
**Döntéshozók:** Antigravity Architect, Várhegyi Zsófi (B-Audit Kft. / Carman-Food Kft. könyvelői visszajelzés alapján)  
**Érintett komponensek:** `taxEngine.ts`, `usePayrollData.ts`, `PayrollCyclePage.tsx`, `EmployeeWizardPage.tsx`, `PayrollStep3.tsx`, `PayrollStep4.tsx`, `PayrollStep5.tsx`  
**Kapcsolódó döntések:** [A-094](./A-094-payroll-cycle-render-stability-and-attendance-persistence.md), [P-072](../../product/decisions/P-072-payroll-cycle-attendance-manual-entry-and-cafeteria-ux.md)

---

## 1. Kontextus és Problémafelvetés

Az eaisyBooks bérszámfejtési moduljának éles használata során a könyvelő (Carman-Food Kft. vendéglátóipari ügyfél bérszámfejtése során) négy kritikus hiányosságot és jogszabályi eltérést tapasztalt:

1. **Saját jogú nyugdíjas dolgozó jogtalan járulékterhe:**
   A jogviszonynál bejelölt `is_pensioner: true` (öregségi nyugdíjas) opció ellenére a rendszer 18,5% TB járulékot és 13% SZOCHO-t számfejtett a dolgozónak és a munkáltatónak. A hatályos Tbj. (2019. évi CXXII. tv. 6. §) és Szocho tv. (2018. évi LII. tv. 5. § (1) f)) szerint a saját jogú nyugdíjas munkavállaló mentesül a társadalombiztosítási járulék alól, a kifizető pedig nem köteles szociális hozzájárulási adót fizetni utána.

2. **Megbízási jogviszony merev munkaidő kötelezettsége:**
   Új dolgozó felvitelekor (`EmployeeWizardPage.tsx`), tartós megbízási szerződés esetén a rendszer kötelező heti óraszámot követelt meg (alapértelmezett 40 óra), holott vendéglátásban és rugalmas megbízásoknál a felek előre nem rögzítenek fix napi/heti óraszámot, a kifizetés elszámolási időszaki teljesítmény/óra alapján történik.

3. **Órabéres dolgozók havi óraszámának hiánya a számfejtésben:**
   A 3. lépésben (Jelenléti ív) a felhasználó csak munkanapot tudott rögzíteni. Órabéres dolgozóknál a rendszer fix napi 8 órával (`munkanap × 8h`) szorozta fel az órabért, ami ellehetetlenítette az egyenetlen vagy tört műszakos órák (pl. havi 128 óra) pontos elszámolását.

4. **Vendéglátóipari felszolgálási díj elszámolása és sajátos adózása:**
   A vendéglátásban kritikus felszolgálási díj (71/2005. (IX. 27.) GKM rendelet) nem szerepelt a rendszerben. A felszolgálási díj bérjellegű kifizetés, de speciális adózású:
   - **SZJA:** 0% (Szja tv. 1. sz. melléklet 4.38. pont alapján adómentes jövedelem).
   - **TB járulék:** 18,5% terheli a munkavállalót (kivéve saját jogú nyugdíjasnál, ahol 0%).
   - **SZOCHO:** 0% (Szocho tv. 5. § (1) m) pont alapján nem keletkezik adófizetési kötelezettség).

---

## 2. Döntések és Architektúra

### D-1: Nyugdíjas Járulékmentesség a Tiszta Adómotorban (`taxEngine.ts`)

A `taxEngine.ts` `calculatePayroll` függvényében a TB és SZOCHO alapok meghatározását garanciális feltételekhez kötöttük:

```typescript
// TB járulék alap: csak biztosított ÉS NEM nyugdíjas dolgozó esetén
const tbBase = (input.isInsured && !input.isPensioner) ? grossSalary : 0;
const rawTbAmount = Math.round(tbBase * params.tb_rate);

// SZOCHO alap: KIVA cég vagy nyugdíjas esetén 0 Ft;
// Normál dolgozónál a felszolgálási díj levonandó a szocho alapból
let szochoBase = (input.isKiva || input.isPensioner) ? 0 : Math.max(0, grossSalary - serviceCharge);
```

Továbbá nyugdíjas esetén a járulékkedvezmények (TB kompenzáció) nem érvényesülhetnek (értékük 0 Ft), hiszen nincs levont TB.

### D-2: Vendéglátóipari Felszolgálási Díj Modellezése és Adózási Logikája

- A `GrossSalaryInput` kiegészült az opcionális `serviceCharge?: number` mezővel.
- A bruttó kifizetés tartalmazza a felszolgálási díjat: `grossSalary = baseSalary + ... + serviceCharge`.
- Az SZJA alapot képező bruttó bérből a felszolgálási díj levonásra kerül:
  ```typescript
  const szjaEligibleGross = Math.max(0, grossSalary - serviceCharge);
  ```
- A SZOCHO alapból a felszolgálási díj levonásra kerül (SZOCHO mentes).
- A TB járulék alapja a teljes összeg (tartalmazza a felszolgálási díjat, kivéve ha a dolgozó nyugdíjas).

### D-3: Rugalmas Megbízási Jogviszony Felvitel (`EmployeeWizardPage.tsx`)

A megbízási szerződéseknél (`tartos_megbizas`, `megbizas`, `megbizas_nem_onkormanyzati`):
- Tájékoztató jellegű bannert helyeztünk el, jelezve, hogy a heti óraszám rugalmas, és a számfejtés a havi tényleges jelenléti munkaórák alapján történik.
- A beviteli mező címkéje megváltozott: `"Heti munkaidő (óra) — tájékoztató jellegű"`.

### D-4: Közvetlen Ledolgozott Munkaóra Rögzítés (`PayrollStep3.tsx` & `usePayrollData.ts`)

- A `PayrollStep3.tsx` táblázatában új „Munkaóra (h)” oszlop jelent meg.
- Órabéres (`salary_type === 'hourly'`) jogviszony esetén közvetlenül szerkeszthető numerikus input jelenik meg, míg havidíjas dolgozóknál tájékoztató olvasható munkaóra szöveg látható.
- A rögzített `workedHours` érték az `accounty_timesheets.ocr_data` JSONB mezőjébe perzisztálódik nulla séma-migrációs igénnyel.
- A számfejtésnél és bérjegyzék generálásnál:
  ```typescript
  const actualWorkedHours = (attendance.workedHours !== undefined && attendance.workedHours !== null && Number(attendance.workedHours) > 0)
    ? Number(attendance.workedHours)
    : (attendance.workDays || 0) * dailyHours;
  ```

### D-5: Felszolgálási Díj Rögzítése és Tájékoztató Banner (`PayrollStep4.tsx` & `PayrollStep5.tsx`)

- A 4. lépésben (Cafeteria) sárga tájékoztató doboz hívja fel a könyvelő figyelmét, hogy a felszolgálási díj bérjellegű juttatásként a következő (5. Bruttó bér és pótlékok) lépésben rögzítendő.
- Az 5. lépésben új „Felszolgálási díj (Ft)” oszlop és beviteli mező biztosítja a tételes havi megadást.
- A bevitt összeg azonnal elmentődik az `accounty_payroll_items` táblába `item_type: 'service_charge'` típussal.
- A számfejtési kalkuláció (`useRunBatchPayroll`) automatikusan beolvassa ezt az elemet, és beépíti a kalkulációba.

### D-6: Kétlépcsős Újraszámítás (Recalculate) Integráció és Időbélyeg Kijelzés (`PayrollStep6.tsx` & `PayrollStep8.tsx`)

- **Probléma:** Korábban a számfejtést indító `runBatch.mutate` gomb a 8. lépésben egy feltételes `else` ágban rejtőzött, ami azt jelentette, hogy ha egy ciklushoz már létezett elmentett kalkuláció (`calculations.length > 0`), a gomb teljesen eltűnt a felületről. A 6. lépésben (Adó + Járulék) pedig egyáltalán nem volt bekötve az újraszámítás. Így a könyvelő a jelenlét vagy juttatások módosítása után nem tudta a kalkulációt újrafuttatni, és a képernyő az elavult számokat mutatta.
- **Megoldás:**
  - A `PayrollStep6.tsx` fejlécébe kihelyeztünk egy mindig kattintható `<Button variant="outline"><RotateCcw /> Számfejtés újrafuttatása</Button>` gombot, és kiírtuk az utolsó számítás idejét (`calculated_at` alapján). Ha még nincs kalkuláció, üres táblázat helyett kiemelt indítógomb fogadja a felhasználót.
  - A `PayrollStep8.tsx` fejlécébe és a zöld lezáró sávba (az *Összes bérjegyzék* mellé) egyaránt bekerült a mindig látható `Újraszámítás` gomb, animált `Loader2` töltésjelzéssel és dupla kattintás elleni védelemmel.
  - A `PayrollCyclePage.tsx` szülő komponens átadja a `cycle`, `activeEmployees` és `runBatch` propokat a 6. lépésnek is.

---

## 3. Verifikáció és Teszteredmények

1. **Vitest Unit Tesztek (`taxEngine.test.ts`):**
   - 32/32 teszt hiba nélkül lefutott (`PASS`).
   - Fedve: Öregségi nyugdíjas dolgozó garantált bérminimum és 500 000 Ft fizetés mellett (0 Ft TB, 0 Ft SZOCHO, pontos nettó számítás).
   - Fedve: Felszolgálási díj normál dolgozónál (0% SZJA, 18.5% TB, 0% SZOCHO) és nyugdíjas dolgozónál (0% SZJA, 0% TB, 0% SZOCHO).
2. **TypeScript & Rollup Production Build:**
   - `npm run build` lefutott 15.03s alatt, 0 hiba és 0 figyelmeztetés a megváltoztatott modulokban.
3. **Visszafelé Kompatibilitás & Kódhigiénia:**
   - A meglévő havidíjas számfejtések, CSV jelenléti importok és korábbi ciklusok változatlanul működnek. Ha nincs kitöltve `workedHours`, az algoritmus automatikusan a `workDays * dailyHours` képletre esik vissza.
   - Az újraszámítási gombok `React.useMemo` segítségével memózzák a dátumformázást, minimalizálva a felesleges re-rendereket.
