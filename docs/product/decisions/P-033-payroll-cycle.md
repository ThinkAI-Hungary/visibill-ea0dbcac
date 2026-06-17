# P-033: [Accounty] Bérszámfejtési Ciklus Workflow

**Status:** Decided  
**Category:** Accounty  
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
- Kapcsolódó oldalak:
  - `PayrollDashboardPage.tsx` — bérszámfejtési áttekintő, aktív ciklusok, előzmények
  - `EmployeesPage.tsx` — alkalmazott lista, szűrők, keresés
  - `EmployeeWizardPage.tsx` — lépéses adatbevitel (személyes adatok, foglalkoztatás, bér)
  - `EmployeeDetailsPage.tsx` — alkalmazott részletek, bértörténet
  - `TaxParametersPage.tsx` — adóparaméterek beállítása (SZJA, TB, SZOCHO kulcsok)
  - `FilingsPage.tsx` — bevallások kezelése (M30, T1041, 08-as)
  - `PayrollReportsPage.tsx` — bérjegyzékek, összesítők, exportok

**Rationale:** A stepper-alapú workflow vizuálisan vezeti a könyvelőt a bérszámfejtés lépésein. A lezárt fázis biztosítja az audit trail-t és megakadályozza a utólagos módosítást.
