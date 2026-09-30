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
- **NAV 08 (2608/2508/2408) XML import & Tömeges Rekonstrukció:**
  - Hivatalos ÁNYK 08-as XML bevallásokból történő automatikus dolgozói törzsadat import és havi bérszámfejtési ciklusok tömeges rekonstrukciója lezárt (`closed`) státusszal.
  - Támogatja az egyidejű több havi fájl feltöltést (drag-and-drop auto-populáció), a speciális magyar karakterkódolási sérülések (mojibake) automatikus javítását, valamint a deduplikált, kötegelt dolgozói mentést.
- **Munkába Járási Költségtérítés (39/2010. Korm. rend. & Szja tv. 25. § (2)):**
  - Jogszabályi adó- és járulékmentes (0% SZJA, 0% TB, 0% SZOCHO) utazási költségtérítés vidékről vagy közigazgatási határon kívülről bejáró dolgozóknak.
  - Saját gépkocsi: cégszintű adómentes km-díj (18–30 Ft/km) alapján, a tényleges munkanapok arányában elszámolva (`oda-vissza km × munkanapok × km-díj`).
  - Helyközi közösségi közlekedés: havi bérlet / jegy 86%-os kötelező vagy 100%-os munkáltatói megtérítése.
  - Könyvelési feladás: Tartozik 551 (Egyéb személyi jellegű kifizetések) — Követel 471 (Jövedelemelszámolás) automatikus vegyes könyvelési tétel.
- **Dolgozó-Központú Munkalap (Employee Worksheet View):**
  - A hagyományos 8-lépéses folyamat mellett közvetlenül elérhető all-in-one havi adatrögzítő felület, amely a dolgozó jelenlétét, óráit, pótlékait, utazási térítését és levonásait egy lapon kezeli, valós idejű élő bérszalvétával (Live Payslip) és azonnali törzsadat-szinkronizációval.
- **3-Oszlopos Bérszámfejtési Dashboard & EFO Különválasztás:**
  - A fő bérszámfejtési áttekintő felület (`PayrollDashboardPage`) 3 külön oszlopra tagolódik a könnyebb átláthatóság érdekében:
    1. **Havi ciklusok:** Havi bérszámfejtési ciklusok, 8-lépéses progress bar, státuszok, új ciklus indítása.
    2. **Foglalkoztatottak:** Kizárólag az állandó jogviszonyú munkavállalók (munkaviszony, társas vállalkozó, megbízás stb.), független keresőmezővel és kilépő dokumentumok gyorseléréssel.
    3. **EFO:** Kifejezetten az egyszerűsített foglalkoztatott (alkalmi / mezőgazdasági / turisztikai) dolgozók listája, éves 120 napos keretfelhasználás kijelzéssel (`nap / 120 nap`), küszöbérték-figyelmeztetéssel (>90 nap esetén kiemelt figyelmeztetés) és dedikált keresővel.
  - A foglalkoztatotti részletes listán (`EmployeesPage`) szintén elérhető típus szerinti szűrő (Mind / Állandó / EFO), amely megőrzi az URL paraméteres állapotot (`?type=regular` / `?type=efo`).

**Rationale:** A bérszámfejtés a könyvelőirodák egyik fő szolgáltatása. A ciklus-alapú workflow biztosítja, hogy a bérszámfejtés audiálható és jóváhagyásos legyen. Az állandó dolgozók és az EFO alkalmi munkavállalók szétválasztása elengedhetetlen, mivel az EFO jogviszonyok más adminisztrációs és adózási szabályok (pl. 120 napos éves korlát, egyszerűsített bejelentés) alá esnek, így nem keveredhetnek az állandó állománnyal.

## Kapcsolódó
- ADR: [A-081: NAV 08 Payroll Reconstruction and Bulk Import](../../architecture/decisions/A-081-nav-08-payroll-reconstruction-and-bulk-import.md)
- ADR: [A-108: Bérszámfejtési Munkába Járás Költségtérítés és Dolgozó-Központú Munkalap](../../architecture/decisions/A-108-payroll-commute-reimbursement-and-employee-worksheet.md)
- PRD: [P-063: Payroll Bulk Import and Reconstruction UX](../../product/decisions/P-063-payroll-bulk-import-and-reconstruction-ux.md)
- PRD: [P-080: Dolgozó-Központú Munkalap és Munkába Járási Költségtérítés UX](../../product/decisions/P-080-employee-worksheet-and-commute-reimbursement-ux.md)

