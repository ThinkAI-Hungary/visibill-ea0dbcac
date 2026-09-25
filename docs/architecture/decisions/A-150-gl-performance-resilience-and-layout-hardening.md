# A-150: Főkönyvi Lekérdezés Teljesítmény, Hibakezelési Reziliencia & DOM/Layout Védelem

**Státusz:** Elfogadva  
**Dátum:** 2026-09-25  
**Érintett modulok:** `src/components/general-ledger/JournalView.tsx`, `src/pages/JournalsPage.tsx`, `src/pages/Accounty/AccountantManagementPage.tsx`, `supabase/migrations/`  

---

## 1. Kontextus és Technikai Kihívások

A rendszer auditja és a frontend hibavadászat során négy kritikus hiányosság/rendellenesség került feltárásra:
1. **Főkönyvi RPC Lekérdezési Késleltetés:** A `get_gl_categorized_items` és `get_gl_balances` RPC függvények nagy adatbázis-rekordszám és több évre kiterjedő könyvelési időszakok esetén aggregációs és szűrési indexhiány miatt késleltetést mutathattak.
2. **JournalView Hibaállapot és Telemetria:** A főkönyvi napló tételes nézet (`JournalView`) backend vagy hálózati hiba esetén nem rendelkezett explicit felhasználói visszajelzéssel (Alert banner, retry akció) és a hiba nem került rögzítésre a központi telemetriában (`frontend_error_logs`).
3. **JournalsPage Felső Sáv Összeomlás (Height Collapse):** A vízszintes naplóválasztó sáv (`w-full flex items-center gap-1.5 overflow-x-auto pb-2`) vertikális mérete `flex-col` szülő alatt `offsetHeight = 8px`-re omlott össze. A 48px magas gombok `items-center` igazítás miatt függőlegesen kiléptek a konténerből, és az `overflow-x-auto` implicit `overflow-y` levágása miatt a gombok felső és alsó 20px-e csonkolódott.
4. **React DOM Nesting Hiba:** Az `AccountantManagementPage` komponensben a könyvelői kártya sora egy `<button>` elembe volt csomagolva, amely belső gyermekként egy Radix UI `<Switch>` komponenst tartalmazott. Mivel a `<Switch>` a HTML-ben `<button role="switch">`-ként renderelődik, a böngésző és a React `validateDOMNesting: <button> cannot appear as a descendant of <button>` figyelmeztetést dobott.

---

## 2. Architektúra és Implementációs Döntések

### 1. RPC Teljesítmény & Realtime Publikáció Optimalizáció
- **Migrációk:**
  - `20260925013000_add_missing_realtime_tables.sql`: A Realtime publikáció kiegészítése a hiányzó operatív táblákkal.
  - `20260925014000_optimize_get_gl_balances_performance.sql`: `get_gl_balances` lekérdezési tervének és indexeinek finomhangolása.
  - `20260925015000_optimize_get_gl_categorized_items_performance.sql`: A `get_gl_categorized_items` RPC szerveroldali aggregációjának és összetett indexeinek optimalizálása a tételes főkönyvi adatok villámgyors kiszolgálásához.

### 2. Failure Modes & Resilience a JournalView Komponensben
- A `JournalView.tsx` explicit hibaállapot-kezelőt kapott:
  - Hálózati vagy SQL kivétel esetén a felület egyértelmű, lokalizált figyelmeztető bannert és újratöltési (`Újrapróbálkozás`) lehetőséget jelenít meg.
  - A hiba részletei (üzenet, kontextus, companyId, presetId) automatikusan rögzítésre kerülnek a `frontend_error_logs` adatbázis-táblában, megkönnyítve a hibakeresést és a rendszerfelügyeletet.
  - Unit tesztekkel verifikálva a `JournalView.test.tsx`-ben.

### 3. Vízszintes Scroll Sávok Méretvédelme (`overflow-x-auto`)
- A [JournalsPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/JournalsPage.tsx) naplóválasztó konténere explicit védőosztályokat kapott:
  ```tsx
  <div className="w-full flex items-center gap-1.5 overflow-x-auto py-1 min-h-[3.5rem] scrollbar-none select-none shrink-0">
  ```
  - `min-h-[3.5rem]` (56px): Megakadályozza a konténer összeroskadását, elegendő teret adva a 48px-es gomboknak.
  - `shrink-0`: Garantálja, hogy a `flex-col` szülő soha ne nyomja össze függőlegesen a görgethető sávot.
  - `py-1`: Szimmetrikus belső margó a vertikális középvonalhoz.

### 4. Szabványos DOM Struktúra és Akadálymentesítés
- Az [AccountantManagementPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Accounty/AccountantManagementPage.tsx) kártyafejlécét `<button>` helyett egy akadálymentesített `<div>`-re cseréltük:
  - `role="button"` és `tabIndex={0}` a billentyűzetes fókuszhoz.
  - `onKeyDown` kezelő az `Enter` és `Szóköz` billentyűkhöz, megkülönböztetve a sor fókuszát a belső `<Switch>` fókuszától.
  - `e.stopPropagation()` a kapcsoló körül a véletlen kinyitás/összecsukás ellen.
  - Ezzel a `<button>` beágyazási anomália véglegesen megszűnt.

---

## 3. Minőségbiztosítás és Eredmények

- **TypeScript Ellenőrzés:** `npx tsc --noEmit` 0 hibával lefutott.
- **Böngészős Ellenőrzés:**
  - Journals felső sáv: Teljes magasság, levágásmentes címek és badge-ek, production paritás igazolva.
  - Accountant Management: A konzolban 0 db `validateDOMNesting` figyelmeztetés.
