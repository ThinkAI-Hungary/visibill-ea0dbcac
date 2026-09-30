# Session Summary — 2026-09-30 23:25

```text
feat(accounty, payroll, xml): NAV 08M 0L lap EFO (egyszerűsített foglalkoztatás) feldolgozás, KIVA SZOCHO mentesség és bérszámfejtési rekonstrukció (EB-0231)

- NAV 2608/2508 ÁNYK XML 0L Lap (Egyszerűsített Foglalkoztatás / EFO) Feldolgozó Motor (nav08XmlParser.ts)
  - Felhasználói hibajelentés (EB-0231, VBV Vision Kft. / Szvatek-Német Tünde): Kádár Laura dolgozónál a 2026.01 havi bérszámfejtés 0 Ft bérrel jött létre, és az EFO napok nem kerültek rögzítésre a NAV 2608 bevallás beolvasásakor
  - Gyökérok: a hivatalos NAV ÁNYK 08M nyomtatványon az EFO-s dolgozóknál a normál lapok (0F, 0B, 0C, 0I) üresek; adataik kizárólag a 0L lapon (0L0001D0700AA..0716FA) szerepelnek. A korábbi parser a 0L lapot figyelmen kívül hagyta, így a dolgozó 0 Ft-os normál munkaviszonyként jött létre, és a bérszámfejtő motor tévesen 30%-os minimális járulékalap-kiegészítést (min_base_diff: 96 840 Ft, min_base_employer_contribution: 17 915 Ft) számolt el
  - Megoldás: extractEfoDataFrom08M független al-elemző beépítése, amely feldolgozza a 0L0001D0700..0715 sorokat (AA ágazat, BA/CA időszak, DA napok, EA bér, FA tételes adó) és a 0716-os összesítő mezőket
  - Automatikus EFO ágazati és FEOR osztályozás: alkalmi munka (06/1138), mezőgazdasági idénymunka (05/81), turisztikai idénymunka (08/82), filmipari statiszta (07/1139)
  - Több időszakos EFO munkavégzés aggregációja: ha a dolgozó a hónapban több külön szakaszban dolgozott, a motor összegzi a napokat, a bért és a közterhet, továbbá kinyeri a legkorábbi kezdő- és legkésőbbi záródátumot
  - EFO adózási invariánsok: netSalary = grossSalary (mentesített kereten belül levonásmentes), az alkalmazotti SZJA és TB levonások, valamint a munkáltatói SZOCHO szigorúan 0 Ft

- KIVA Adózási Mentesség Támogatása a 08-as Importban (nav08XmlParser.ts, payrollReconstructionEngine.ts)
  - Kisvállalati adóalany (KIVA) cégeknél (options.isKiva: true) a munkáltató mentesül a 13%-os SZOCHO fizetési kötelezettség alól
  - A parser és a számfejtési kalkuláció készítő motor a normál dolgozóknál is automatikusan 0 Ft-ra normalizálja a SZOCHO terhet

- Bérszámfejtési Rekonstrukciós Motor és Minimális Alap Felülbírálás (payrollReconstructionEngine.ts)
  - preparePayrollCalculationRecord: egyszerűsített foglalkoztatottaknál kötelezően nullázza a minimális járulékalap különbözetet (min_base_diff = 0), a munkáltatói kiegészítést (min_base_employer_contribution = 0) és a biztosítási napokat (insured_days = 0)
  - EFO kalkulációs metaadat csatolása: is_efo, efo_days, efo_wage, efo_tax, efo_type perzisztálása az accounty_payroll_calculations rekordban

- Csoportos Import Hook és EFO Keretnyilvántartás Szinkronizáció (useBulkImportPayroll.ts)
  - EFO jogviszony létrehozásakor automatikusan beállításra kerül: has_minimum_base = false, is_insured = false
  - accounty_efo_entries automatikus upsert a 120 napos keretkövetéshez (target_year, days_alkalmi, days_total_used, days_total_available)
  - Query cache invalidáció: ['accounty-efo-entries', companyId] automatikus frissítése a bérszámfejtési 3-oszlopos dashboard azonnali szinkronban tartásához

- Élő Adatbázis Helyreállítás (VBV Vision Kft. / Kádár Laura)
  - accounty_employments rekord javítása efo_alkalmi típusra (job_code: 1138, base_salary: 67 176 Ft, has_minimum_base: false, is_insured: false)
  - accounty_efo_entries rekord létrehozása a 2026-os évre (5 nap alkalmi, 115 nap hátralévő keret)
  - accounty_payroll_calculations 2026/01 havi kalkuláció felülírása a valós adatokkal (bruttó: 67 176, nettó: 67 176, szja/tb/szocho: 0, min_base_diff: 0, min_base_employer_contribution: 0, insured_days: 0)

- Dokumentáció Szinkronizáció (/visibill-doc-sync)
  - A-081 ADR frissítve a 0L lapos EFO feldolgozás, KIVA mentesség és minimum alap felülbírálás leírásával
  - P-063 PRD kiegészítve az EFO 0L lapos kötegelt importtal
  - P-143 PRD kiegészítve a NAV 08 import adatforrással és cross-referenciákkal
  - ADR és PRD index.md nyilvántartások frissítve

- Minőségbiztosítás, Tesztek és Verifikáció
  - Új integrációs tesztcsomag (nav08KivaAndEfoImport.test.ts): 12/12 sikeres teszt (38 ms)
  - Teljes bérszámfejtési és accounty tesztcsomag: 62 tesztfájl / 799 sikeres teszt (12.27s)
  - TypeScript típusellenőrzés: npx tsc --noEmit hibamentes (code 0)
  - Production Vite Build: npm run build sikeres (19.61s)
  - Kódbázis Tudásgráf: graphify update . lefutott (23 358 csomópont, 39 068 él szinkronizálva)
```
