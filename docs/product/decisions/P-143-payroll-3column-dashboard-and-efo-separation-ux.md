# P-143: eaisyBooks Bérszámfejtés 3-oszlopos Elrendezés, EFO Szétválasztás és 120-napos Keretfigyelő UX

**Status:** Decided  
**Date:** 2026-09-30  
**Category:** Bérszámfejtés & Munkaügy (`/payroll`, `/employees`)  
**Scope:** `src/pages/Accounty/PayrollDashboardPage.tsx`, `src/pages/Accounty/EmployeesPage.tsx`, `src/hooks/usePayrollData.ts`, `src/test/accounty/payrollEfoSeparation.test.ts`  

---

## 1. Üzleti Háttér és Probléma

A könyvelőirodák és bérszámfejtők mindennapi munkájában a havi fix állományú munkavállalók (teljes vagy részmunkaidős munkaviszony, megbízási jogviszony) és az egyszerűsített foglalkoztatottak (EFO / alkalmi munkavállalók, idénymunka) kezelése gyökeresen eltér egymástól:
1. **Keveredő állományok:** Korábban a bérszámfejtési nyitóoldalon a dolgozók egyetlen ömlesztett listában jelentek meg. A ritkán vagy pár napra belépő alkalmi munkavállalók elnyomták az állandó törzsállományt.
2. **Havi zárási folyamat követhetetlensége:** A bérszámfejtési ciklusok (havi zárások, NAV 08-as bevallások) és az állományi létszámadatok nem voltak egyetlen pillantással áttekinthetőek.
3. **120 napos törvényi limit kockázata:** Az egyszerűsített foglalkoztatásról szóló 2010. évi LXXV. törvény (Efo tv.) szigorúan korlátozza, hogy egy munkavállaló egy naptári évben legfeljebb hány napot tölthet alkalmi munkavégzéssel (fő szabályként legfeljebb 120 nap egyazon munkáltatónál). Ha ezt a cég túllépi, a NAV átminősíti a jogviszonyt rendes munkaviszonnyá, ami súlyos adó- és bírságkockázatot jelent. Korábban a könyvelőnek kézzel kellett összesítenie a napokat a NAV ÜPO felületéről vagy a jelenléti ívekből.

---

## 2. Megoldás és Felületi Működés

### 2.1 3-oszlopos Dashboard Grid (`PayrollDashboardPage.tsx`)
A bérszámfejtés főoldalát egy letisztult, 3 oszlopos responzív gridre szerveztük át:

```
┌──────────────────────────┬──────────────────────────┬──────────────────────────┐
│ 1. Havi Ciklusok         │ 2. Foglalkoztatottak     │ 3. EFO (Alkalmi)         │
│ (Monthly Cycles)         │ (Core / Regular)         │ (Simplified Employment)  │
├──────────────────────────┼──────────────────────────┼──────────────────────────┤
│ • Aktív havi ciklus      │ • Állandó dolgozók list. │ • EFO munkavállalók      │
│ • Státusz (Nyitott/Zárt) │ • Munkakör, bér          │ • Éves napok száma       │
│ • [ + Új bérciklus ]     │ • [ + Új dolgozó ]       │ • [ Keret: 45 / 120 nap ]│
│ • Ciklus megnyitása →    │ • Összes megtekintése →  │ • [ + Új EFO jogviszony ]│
└──────────────────────────┴──────────────────────────┴──────────────────────────┘
```

1. **1. Oszlop — Havi Bérszámfejtési Ciklusok:**
   - Hónapok szerinti időrendi kártyák a ciklus státuszával (`Tervezet`, `Számfejtés alatt`, `Lezárva`).
   - Létszám-összesítő és bruttó bérköltség kimutatás.
   - Közvetlen ugrás a részletes ciklusszerkesztőbe vagy a Dolgozói Munkalapra (`EmployeeWorksheetView`).
   - „+ Új bérciklus” indítása 1 kattintással.
2. **2. Oszlop — Foglalkoztatottak (Állandó törzsállomány):**
   - Kizárólag a határozatlan vagy határozott idejű munkaviszonyban, megbízási vagy vezetői jogviszonyban álló dolgozók listája.
   - Név, pozíció, havi alapbér és jogviszony státusz.
   - „+ Új munkavállaló” gomb, amely automatikusan normál jogviszony sablont kínál fel.
   - Kifejezett navigációs link az `EmployeesPage`-re a `?type=regular` szűrővel.
3. **3. Oszlop — EFO (Egyszerűsített Foglalkoztatás):**
   - Dedikált oszlop az alkalmi munkavállalók számára (jogviszonykódok: `1138`, `81-83`, `efo_alkalmi`).
   - Munkavállalónként megjelenített éves kumulált munkanap-számláló és vizuális progress bar (pl. `42 / 120 nap`).
   - „+ Új EFO jogviszony” gomb, amely azonnal egyszerűsített foglalkoztatási űrlapot nyit meg.
   - Kifejezett link a dolgozók listájára a `?type=efo` szűrővel.

### 2.2 120-napos Éves Keretfigyelő és Küszöbérték-Jelvények
Az EFO munkavállalóknál a rendszer dinamikusan számolja az adott naptári évben regisztrált napok számát (a lokális jelenléti adatok, a havi NAV 08 ÁNYK 0L import és a NAV ÜPO M2M szinkronizált napok egyesítésével):
- **Normál tartomány (0 – 90 nap):** Letisztult szürke/zöld számláló badge (`bg-emerald-500/10 text-emerald-600`), biztonságos keret.
- **Figyelmeztető sáv (91 – 119 nap):** Sárga/borostyán kiemelés (`bg-amber-500/15 text-amber-700 border-amber-300`) figyelmeztető háromszög ikonnal: *"Figyelem: A dolgozó megközelítette a 120 napos éves EFO korlátot!"*
- **Kritikus túllépés (120+ nap):** Piros vészjelzés (`bg-rose-500/15 text-rose-700 border-rose-300 font-semibold`) tiltó ikonnal: *"Kritikus: A törvényi 120 napos EFO limit kimerült!"*

### 2.3 Dolgozók Szűrése és Kétirányú URL Szinkronizáció (`EmployeesPage.tsx`)
A dolgozói törzsadat oldalon (`/client/:id/payroll/employees`) lapfüles szűrősávot vezettünk be:
- `Mind (All)` — Az összes munkavállaló megjelenítése.
- `Állandó foglalkoztatottak` — Csak a normál munkaviszonyos és megbízási szerződéses dolgozók (`?type=regular`).
- `Egyszerűsített foglalkoztatás (EFO)` — Csak az alkalmi munkavállalók (`?type=efo`).
- **URL szinkronizáció:** A tab-váltás azonnal frissíti az URL-t, így a könyvelők közvetlenül könyvjelzőzhetik vagy megoszthatják kollégáikkal a célzott EFO vagy állandó listát.
- **Automatikus Típus Előválasztás:** Ha a felhasználó az "EFO" fülön kattint az "Új munkavállaló" gombra, az űrlap automatikusan `EFO` foglalkoztatási típussal inicializálódik.

---

## 3. Minőségbiztosítás és Tesztlefedettség

A funkcióhoz dedikált automatizált egységteszt csomag készült (`src/test/accounty/payrollEfoSeparation.test.ts`):
1. `should classify employees as regular vs EFO correctly based on employment code`: Helyesen különválasztja a `1138`, `81`, `82`, `83` kódokat a `20`, `21`, `40` kódoktól.
2. `should calculate annual EFO days and trigger warning thresholds at 90 and 120 days`: Ellenőrzi a zöld, sárga és piros határértékeket.
3. `should synchronize URL query parameter ?type=regular and ?type=efo with active tab`: Validálja a keresési és navigációs szűrőket.
4. `should filter employees in payroll cycles based on employment validity dates`: Biztosítja, hogy az inaktív vagy már kilépett EFO dolgozók ne zavarják a havi számfejtést.

---

## 4. Kapcsolódó
- [BDR 032: Bérszámfejtési Modul és eaisyBooks Integráció](../../business/decisions/032-payroll-module.md)
- [PRD P-063: Bérszámfejtés Gyors Rekonstrukció és Dolgozói Tömeges Import UX](./P-063-payroll-bulk-import-and-reconstruction-ux.md)
- [ADR A-081: NAV 08 XML Feldolgozás és Tömeges Bérszámfejtés Rekonstrukciós Motor](../../architecture/decisions/A-081-nav-08-payroll-reconstruction-and-bulk-import.md)
- [ADR A-094: Bérszámfejtési Ciklus Végtelen Re-render Védelem és Kézi Jelenlét Perzisztencia](../../architecture/decisions/A-094-payroll-cycle-render-stability-and-attendance-persistence.md)
- [ADR A-166: Magyar Társadalombiztosítási (TB) Adómotor és 2608 M-lap](../../architecture/decisions/A-166-tb-social-security-minimum-base-and-pensioner-payroll-engine.md)
- [ADR A-174: Bérfeladás Idempotencia-védelem és Lezárt Ciklus Adatbiztonság](../../architecture/decisions/A-174-payroll-auto-poster-idempotency-and-closed-cycle-immutability.md)
