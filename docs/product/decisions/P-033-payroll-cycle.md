# P-033: [eaisyBooks] Bérszámfejtési Ciklus Workflow

**Status:** Decided  
**Category:** eaisyBooks  
**BRD Reference:** Decision 032 (Payroll modul)

**Question:** Hogyan néz ki a bérszámfejtési ciklus UI workflow-ja?

**Decision:** Stepper-alapú workflow a `PayrollCyclePage`-en belül, 4 fázissal.

**Current Implementation:**
- Route: `/accounty/payroll/:id/cycle/new` (új ciklus) és `/accounty/payroll/:id/cycle/:cycleId` (meglévő)
- **Stepper fázisok:**
  1. **Draft** — Hónap kiválasztás, alkalmazottak kijelölése (checkbox lista)
  2. **Számítás** — Bruttó→nettó kalkuláció (SZJA, TB, SZOCHO automatikus az adóparaméterekből)
  3. **Jóváhagyás** — Összesítő táblázat, irodavezető approve gomb
  4. **Lezárt** — Módosíthatatlan, bérjegyzék és bevallás generálás
- Kapcsolódó oldalak és komponensek:
  - `PayrollDashboardPage.tsx` — bérszámfejtési áttekintő, aktív ciklusok, előzmények, gyors rekonstrukció
  - `EmployeeImportPage.tsx` — 2-füles tömeges dolgozói és jogviszony import (Excel/CSV sablon + NAV 08 XML)
  - `PayrollReconstructionDialog.tsx` — több havi 2608/2508 XML kötegelt felolvasása és visszamenőleges bérszámfejtési ciklus generálása
  - `EmployeesPage.tsx` — alkalmazott lista, szűrők, keresés
  - `EmployeeWizardPage.tsx` — lépéses adatbevitel (személyes adatok, foglalkoztatás, bér)
  - `EmployeeDetailsPage.tsx` — alkalmazott részletek, bértörténet
  - `TaxParametersPage.tsx` — adóparaméterek beállítása (SZJA, TB, SZOCHO kulcsok)
  - `FilingsPage.tsx` — bevallások kezelése (M30, T1041, 08-as)
  - `PayrollReportsPage.tsx` — bérjegyzékek, összesítők, exportok

- **Tömeges Import & Rekonstrukciós Motorok:**
  - `nav08XmlParser.ts`: Hivatalos NAV ÁNYK XML (2608, 2508, 2408) és szemantikus XML parser. Kinyeri az M-lapokból a dolgozókat, jogviszonyokat és a havi bérjövedelmi/járulék adatokat.
  - `payrollReconstructionEngine.ts`: Összeveti a beolvasott adatokat a meglévő DB állapotokkal (duplicate check TAJ/Adóazonosító alapján), és előkészíti a zárt (`closed`) havi bérszámfejtési ciklusokat és kalkulációs tételeket.
  - `useBulkImportPayroll.ts`: Reaktív kötegelt mentő hook tranzakció-szerű beszúrással (`accounty_employees`, `accounty_employments`, `accounty_payroll_cycles`, `accounty_payroll_calculations`).

**Rationale:** A stepper-alapú workflow vizuálisan vezeti a könyvelőt a bérszámfejtés lépésein. A lezárt fázis biztosítja az audit trail-t és megakadályozza a utólagos módosítást. Az új 08-as XML és Excel importáló motor pedig azonnali áttérést biztosít korábbi bérprogramokból az évközi számfejtések 1-kattintásos rekonstruálásával.
