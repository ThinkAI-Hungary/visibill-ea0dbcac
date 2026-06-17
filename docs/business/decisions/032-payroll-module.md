# Decision 032: [Accounty] Payroll (Bérszámfejtés) Modul

**Status:** Decided

**Category:** Accounty & Integrált Modulok

**Question:** Hogyan kezeli az Accounty a könyvelőiroda ügyfeleinek bérszámfejtését?

**Decision:**
- Bérszámfejtés per-ügyfél alapon az Accounty-n belül (`/accounty/payroll/:companyId/*`)
- Alkalmazott nyilvántartás: `payroll_employees` tábla (név, TAJ, adóazonosító, foglalkoztatás típusa, bértípus)
- **Bérciklus workflow** (4 fázis):
  1. `draft` — Hónap kiválasztás, alkalmazottak kijelölése
  2. `calculation` — Bruttó→nettó kalkuláció (SZJA, TB, SZOCHO automatikus)
  3. `approval` — Irodavezető jóváhagyás
  4. `closed` — Lezárt, módosíthatatlan, bevallás generálás
- Adóparaméterek kezelése: SZJA kulcs, TB %, SZOCHO % — cég szinten beállítható (`/accounty/payroll/:id/tax-params`)
- Bevallások generálása: M30, T1041, 08-as bevallás sablon
- Riportok: bérjegyzék lista, havi összesítő, éves összesítő
- Alkalmazott felvétel wizard: lépéses adatbevitel (`/accounty/payroll/:id/employees/new`)

**Rationale:** A bérszámfejtés a könyvelőirodák egyik fő szolgáltatása. A ciklus-alapú workflow biztosítja, hogy a bérszámfejtés audiálható és jóváhagyásos legyen. Az adóparaméterek cég-szinten konfigurálhatók, mert különböző ügyfeleknek eltérő kedvezmények lehetnek.
