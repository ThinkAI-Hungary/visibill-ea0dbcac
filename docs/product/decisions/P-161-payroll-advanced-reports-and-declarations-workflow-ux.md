# P-161: Bérszámfejtés Haladó Riportok és Adóelőleg-Nyilatkozatok Munkafolyamat és Export UX

**Status:** Decided  
**Category:** UI / Payroll Workflow / Navigation  
**Question:** Hogyan tegyük zökkenőmentessé a bérszámfejtési haladó riportok generálását, kiexportálását és az adóelőleg-nyilatkozatok közötti hierarchikus navigációt?  
**Decision:** 8 specializált bérszámfejtési riporttípust aktiváltunk azonnali generálási és KPI összegző felülettel (XLSX, CSV, PDF exporttal), valamint a nyilatkozatok oldalairól való visszalépést dedikált célútvonalakra (`declarationsBase` és `payrollUrl`) kötöttük.  
**Current Implementation:** `PayrollAdvancedReportsPage.tsx`, `GenericDeclarationPage.tsx`, `FamilyDeclarationPage.tsx`, `DeclarationsOverviewPage.tsx`, `WorksheetSidebar.tsx`.  
**Rationale:** A könyvelők és bérszámfejtők számára a riportok gyors áttekinthetősége és a nyomtatásra/továbbküldésre kész fájlexport elengedhetetlen a havi bérszámfejtési zárás során. A nyilatkozatok közötti bolyongás és a "Hozzáférés megtagadva" hiba korábban súlyosan rontotta a munkafolyamat sebességét.  

---

## 1. Felhasználói Igény és Probléma

1. **Haladó Riportok generálás:** A felhasználók a különböző riportok kártyáin a "Riport generálása" gombra kattintva nem kaptak semmilyen eredményt, nem látták a dolgozói és munkáltatói költségek összesítését.
2. **Dolgozói munkalap váltás:** A dolgozói lista elemeire kattintva a felület váratlanul összeomlott és fehér képernyőt adott bizonyos munkavállalóknál.
3. **Navigációs fennakadások a nyilatkozatoknál:**
   - A NETAK (négy vagy több gyermeket nevelő anyák kedvezménye) vagy egyéb adóelőleg-nyilatkozat megtekintése után a visszalépéskor a rendszer "Hozzáférés megtagadva" hibát jelzett, mert az URL elveszítette a cégazonosítót.
   - A családi kedvezmény nyilatkozatból való visszalépéskor a gomb ismételt megnyomása nem a bérszámfejtéshez vitte a könyvelőt, hanem visszahurkolt a családi nyilatkozatra.
4. **Ikonok láthatósága világos módban:** A beállítások menüben fehér hátterű gombokon a fehér ikonok teljesen láthatatlanok voltak.

---

## 2. Megoldás és UI Működés

### 2.1. Haladó Riportok Generálója (`PayrollAdvancedReportsPage.tsx`)
- **Riport Választó:** 8 előre konfigurált szakmai sablon (Bérköltség és járulékok, Dolgozói jövedelemkimutatás, SZJA és kedvezmények analitika, Távollét és pótlék, Munkáltatói összköltség, Nettó kifizetési lista, Költséghelyi felosztás, Fluktuáció és létszám).
- **Azonnali Generálás:** A "Generálás" gombra kattintva az alkalmazás valós időben számítja ki az értékeket a kiválasztott ciklus vagy időszak béradataiból.
- **KPI Metrikák:** Az aktív riport tetején 4 kiemelt összegző kártya mutatja a főbb mutatószámokat (pl. Összes bruttó bér, Munkáltatói terhek, Nettó kifizetés, Létszám).
- **Egykattintásos Export:** Működő gombok az adatok letöltésére:
  - `Excel letöltése (.xlsx)`: formázott fejléc és számformátumok.
  - `CSV letöltése (.csv)`: külső rendszerekhez illeszkedő formátum.
  - `Nyomtatás / PDF`: nyomtatásra optimalizált, felesleges UI elemek nélküli oldalnézet.

### 2.2. Nyilatkozatok Vissza-Navigációja (`*DeclarationPage.tsx`)
- Az adókedvezmény-nyilatkozatok fejlécében lévő "Vissza a nyilatkozatokhoz" gomb mostantól mindig a scoped `declarationsBase` útvonalra (`/eaisybooks/:companyId/:dateRange/payroll/declarations`) navigál, garantálva a cég és dátum kontextus megőrzését.
- A nyilatkozatok áttekintő oldalán a "Vissza a bérszámfejtéshez" gomb determinisztikusan a `payrollUrl` (`/eaisybooks/:companyId/:dateRange/payroll`) célállomásra vezet, megszüntetve a böngésző-előzmény hurkokat.

### 2.3. Stabil Dolgozói Munkalap és Témakontraszt
- A munkalap sidebar biztonságos fallback-kel jeleníti meg az alapbért, megelőzve az inicializálatlan profilok miatti összeomlást.
- Világos témában a státusz- és akciógombok ikonjai kontrasztos, sötétszürke árnyalatot (`text-foreground` / `text-muted-foreground`) kaptak.

---

## Kapcsolódó
- [A-202: Bérszámfejtés Haladó Riportok és Nyilatkozatok Architektúra](../../architecture/decisions/A-202-payroll-advanced-reports-and-declarations-navigation-architecture.md)
- [P-080: Dolgozó-Központú Munkalap UX](./P-080-employee-worksheet-and-commute-reimbursement-ux.md)
- [P-033: Bérszámfejtési Ciklus Workflow](./P-033-payroll-cycle.md)
