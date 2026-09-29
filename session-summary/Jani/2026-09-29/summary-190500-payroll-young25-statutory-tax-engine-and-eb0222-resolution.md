# Session Summary — 2026-09-29 19:05

```text
feat(payroll): alanyi jogú 25 év alatti SZJA-mentesség motor (Szja tv. 29/F. §), NAV 08 import nyilatkozat-auto-generálás és EB-0222 bérszámfejtési újraszámolás

- EB-0222 Support Ticket Vizsgálat & Élő Adatbázis Helyreállítás (VBV Vision Kft.)
  - Ügyfélbejelentés (Szvatek-Német Tünde): Bozóki Klaudia Kitti és Nagy Gréta 2026. 01–03. havi nettó bére bérszámfejtési újraszámoláskor 304.158 Ft-ról 248.178 Ft-ra esett vissza (pontosan 55.980 Ft levonás, ami a 373.200 Ft-os 25 év alatti adóalap-kedvezmény 15%-os SZJA terhe)
  - Gyökérok: a munkavállalókhoz nem tartozott aktív `young_25` rekord az `accounty_declarations` táblában, így a korábbi bérszámfejtési logika explicit nyilatkozat hiányában nem érvényesítette a kedvezményt újraszámoláskor
  - Élő adatbázis javítás és auditált helyreállítás:
    - Aktív `young_25` nyilatkozatok beszúrása mindkét munkavállalóhoz az `accounty_declarations` táblába
    - `has_age_concession = true` állapot beállítása az `accounty_employees` táblában
    - Visszamenőleges kalkuláció javítás a 2026/01, 2026/02 és 2026/03 bérszámfejtési ciklusokban (`accounty_payroll_calculations`): `szja_base = 0`, `szja_amount = 0`, `net_salary = 304158`, `under25_credit = 373200`, `deductions = {"tb": 69042, "szja": 0, "total": 69042}`

- Törvényi Alanyi Jogú 25 Év Alatti Kedvezmény Motor (Szja tv. 29/F. §, Opció A)
  - Törvényi szabályozás érvényesítése: az Szja tv. 29/F. § (1) bekezdése alapján a 25 év alatti fiatalok kedvezménye alanyi jogon, kötelező nyilatkozat nélkül jár; kizárólag írásbeli lemondó nyilatkozat (`waived: true`) esetén hagyható figyelmen kívül
  - Törvényi időhatár kezelése: a 29/F. § (2) bekezdésnek megfelelően a kedvezmény a 25. életév betöltésének hónapjára még a teljes naptári hónapban jár
  - Új központi segédfüggvény implementálása: `isEligibleForYoung25(birthDate, cycleYear, cycleMonth)` a `taxEngine.ts`-ben, re-exportálva a `lib/payroll/index.ts`-ből
  - Bérszámfejtő motor (`taxEngine.ts` `calculateTaxes`) frissítése: születési dátum és bérszámfejtési év/hónap alapján automatikusan megállapítja a kedvezményre való jogosultságot

- Frontend és Hook Integráció
  - `usePayrollData.ts`:
    - A havi bérszámfejtési újraszámolási folyamatba és a vázlat (draft) generálásba beépítve a születési dátum és ciklus év/hónap alapú alanyi jogú vizsgálat
    - Többféle nyilatkozat-típus támogatása (`'under_25'`, `'young_25'`, `'young'`)
    - TypeScript diagnosztikai javítás: `accounty_leaves` lekérdezésénél `is_suspension` mező típusillesztése (`((leaveRows || []) as any[])`), megszüntetve az IDE fordítási hibát
  - `EmployeeWorksheetView.tsx`: egyéni bérlap és kalkuláció újraszámolásnál `isEligibleForYoung25` integráció bérszámfejtési ciklus év/hónap paraméterekkel
  - `EmployeeDetailsPage.tsx`: dolgozói adatlap kedvezmény-összegző paneljének felkészítése az alanyi jogú születési dátum ellenőrzésre
  - `useBulkImportPayroll.ts`: NAV 08 XML havi járulékbevallás importálásakor a 25 év alatti dolgozókhoz automatikus `has_age_concession: true` jelölés és `young_25` nyilatkozat-generálás

- Minőségbiztosítás és Tesztlefedettség (QA)
  - Unit tesztek bővítése (`src/lib/payroll/__tests__/taxEngine.test.ts`):
    - Alanyi jogú érvényesülés tesztelése nyilatkozat nélkül
    - Kifejezett lemondó nyilatkozat (`waived: true`) felülbírálatának ellenőrzése
    - 25. életév betöltési hónap határesetének (hónap utolsó napjáig való jogosultság) verifikációja
  - Vitest tesztfuttatás: 11 tesztfájl, 167/167 sikeres teszt (100% zöld)
  - TypeScript típusellenőrzés: `npx tsc --noEmit` 0 hibával lefutott (exit code 0)
  - Kódbázis tudásgráf szinkronizáció: `graphify update .` (23093 csomópont, 38603 él)
```
