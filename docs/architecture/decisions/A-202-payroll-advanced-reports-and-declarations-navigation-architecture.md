# A-202: Bérszámfejtés Haladó Riportok Motor, Kliensoldali Aggregáció és Nyilatkozatok Scoped Navigációs Architektúra

**Status:** Decided  
**Date:** 2026-10-05  
**Utoljára frissítve:** 2026-10-05  
**Kapcsolódó döntések:** [A-013: Scoped URL Routing](./A-013-scoped-routing.md) · [A-081: NAV 08 Bérszámfejtés Rekonstrukciós Motor](./A-081-nav-08-payroll-reconstruction-and-bulk-import.md) · [A-108: Dolgozó-Központú Munkalap](./A-108-payroll-commute-reimbursement-and-employee-worksheet.md) · [A-166: TB Bérszámfejtési Adómotor](./A-166-tb-social-security-minimum-base-and-pensioner-payroll-engine.md) · [A-186: Pótszabadságok és Távollétek](./A-186-payroll-leave-entitlements-resolution-engine.md) · [P-161: Bérszámfejtés Haladó Riportok és Nyilatkozatok UX](../../product/decisions/P-161-payroll-advanced-reports-and-declarations-workflow-ux.md)

---

## Context

Az eaisyBooks bérszámfejtési moduljában (`/payroll`) három kritikus stabilitási és használhatósági probléma merült fel:

1. **Haladó Riportok Működésképtelensége (`PayrollAdvancedReportsPage.tsx`):**
   A bérszámfejtés haladó riportok felületén a riportok generálása gombok nem indítottak semmilyen lekérdezést vagy számítást; a felület statikus maradt, hiányoztak a KPI összegzők, a részletes táblázatok és a kiexportálható fájlformátumok.
2. **Dolgozói Munkalap Váltás Crash (`WorksheetSidebar.tsx`):**
   A bérszámfejtési ciklusban a dolgozói munkalapok közötti váltáskor bizonyos alkalmazotti rekordoknál nem várt futásidejű hiba keletkezett (`TypeError: Cannot read properties of undefined (reading 'base_salary')`), ami megállította az egész komponenst.
3. **Nyilatkozatok "Hozzáférés megtagadva" Jogosultsági Hiba & Navigációs Végtelen Hurok (`*DeclarationPage.tsx`):**
   - Amikor a könyvelő rákattintott egy adóelőleg-nyilatkozatra (pl. NETAK, 25 év alattiak kedvezménye, személyi kedvezmény), majd megnyomta a "Vissza" gombot, a rendszer "Hozzáférés megtagadva" hibát dobott. Ennek oka az volt, hogy a navigációs hivatkozás nem adta át a cég hatókörét (`companyId`) és a kiválasztott dátumtartományt (`dateRange`), így az alkalmazás céges kontextus nélküli útvonalra navigált.
   - A családi kedvezmény nyilatkozatnál a sima böngésző-előzmény visszaléptetés (`navigate(-1)`) miatt a vissza gomb kétszeri megnyomásakor az oldal visszadobta a felhasználót a családi nyilatkozatra a bérszámfejtés főoldal helyett.

---

## Decision

1. **Haladó Riportok Kliensoldali Aggregációs Motorja (`PayrollAdvancedReportsPage.tsx`):**
   - A bérszámfejtési ciklusok (`payroll_runs`), bérjegyzékek (`payslips`) és dolgozói jogviszonyok (`payroll_employees`) adataiból egy dedikált, reaktív aggregációs motort építettünk fel.
   - 8 specializált riporttípust támogat:
     1. `payroll_cost`: Bérköltség és járulékok összesítő (Bruttó bér, SZOCHO, KIVA, Szakképzési, Munkáltatói összes teher).
     2. `employee_income`: Dolgozói jövedelemkimutatás (Törzsbér, pótlékok, jutalom, egyéb juttatás).
     3. `tax_relief`: SZJA és adókedvezmények analitika (Családi, NETAK, 25 év alatti, Személyi, Első házasok).
     4. `absence_allowance`: Távollét és pótlék kimutatás (Fizetett szabadság, betegszabadság, táppénz, műszakpótlékok).
     5. `employer_total`: Munkáltatói összköltség (Supergross) és költség/dolgozó arány.
     6. `net_disbursement`: Nettó kifizetési lista és banki utalási előkészítő (IBAN és kifizetési mód szerint).
     7. `cost_center`: Költséghelyi és szervezeti egység szerinti bontás.
     8. `headcount_turnover`: Fluktuáció, belépők/kilépők és statisztikai átlagos állományi létszám.
   - **Többcsatornás Export Motor:**
     - Excel (`.xlsx`) export a `xlsx` könyvtár segítségével, formázott fejléc- és összegző sorokkal.
     - Vesszővel tagolt (`.csv`) export UTF-8 BOM karakterkészlettel.
     - Nyomtatóbarát PDF kimenet natív CSS nyomtatási stílusokkal (`@media print`).

2. **Null-Safe Dolgozói Munkalap Kezelés (`WorksheetSidebar.tsx`):**
   A munkalap oldalsávban szigorú opcionális láncolást és alapértelmezett értéket vezettünk be a dolgozói bérek és pótlékok renderelésénél:
   `employee?.active_employment?.base_salary ?? employee?.base_salary ?? 0`, megelőzve az undefined hozzáférést még inicializálás alatt lévő dolgozóknál is.

3. **Invariáns Scoped Navigáció a Nyilatkozatok Hierarchiájában (`*DeclarationPage.tsx`):**
   - Minden nyilatkozat-komponensben (`GenericDeclarationPage`, `FamilyDeclarationPage`, `DeclarationsOverviewPage`, `DeclarationArchivePage`) dinamikusan feloldjuk a kontextusban lévő `companyId`-t és `dateRange`-et:
     `const declarationsBase = `/eaisybooks/${targetCompanyId}/${dateRange}/payroll/declarations`;`
     `const payrollUrl = `/eaisybooks/${targetCompanyId}/${dateRange}/payroll`;`
   - A nem-determinisztikus `navigate(-1)` visszalépést lecseréltük explicit célútvonalakra, megszüntetve a hibás előzmény-hurkokat és garantálva a védett céges kontextus megtartását.

4. **Light Mode Ikon Kontraszt Javítás:**
   A beállítási és riportkészítő oldalakon (`CompanyPayrollSettingsPage`, `CustomReportBuilderPage`, `OfficeSettingsPage`) a hardkódolt fehér hátterek/ikonok helyett `text-foreground` és `text-muted-foreground` szemantikus osztályokat alkalmaztunk, biztosítva a tökéletes láthatóságot világos témában is.

---

## Consequences

### Pozitív
- A bérszámfejtési haladó riportok azonnal generálhatóak, 8 különböző szakmai dimenzióban elemezhetőek és 3 formátumban exportálhatóak.
- A dolgozói munkalapok közötti lapozás stabil, robusztus és crash-mentes.
- A nyilatkozatok modulból történő visszalépés nem dob jogosultsági hibát, és nem ragad be az előzményekben.

### Negatív
- Nagyobb dolgozói létszám (több száz fő) esetén a kliensoldali riport-aggregáció CPU-igényes lehet; jövőbeli optimalizációként szerveroldali RPC aggregáció bevezetése mérlegelendő.

---

## Kapcsolódó
- [P-161: Bérszámfejtés Haladó Riportok és Nyilatkozatok UX](../../product/decisions/P-161-payroll-advanced-reports-and-declarations-workflow-ux.md)
- [A-108: Dolgozó-Központú Munkalap](./A-108-payroll-commute-reimbursement-and-employee-worksheet.md)
- [A-013: Scoped URL Routing](./A-013-scoped-routing.md)
