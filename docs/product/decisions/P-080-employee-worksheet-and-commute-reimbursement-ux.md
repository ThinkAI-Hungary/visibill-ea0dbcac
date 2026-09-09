# P-080: Dolgozó-Központú Munkalap (Worksheet View) és Munkába Járási Költségtérítés UX

**Státusz:** ✅ Elfogadva (Decided)  
**Dátum:** 2026-09-09  
**Döntéshozók:** Antigravity Architect, Surányi Pál (EB-0082 – Carman-Food Kft. / Várhegyi Zsófi könyvelői visszajelzés alapján)  
**Érintett felületek:** Bérszámfejtési Ciklus Oldal (`PayrollCyclePage.tsx`), Dolgozói Munkalap Nézet (`EmployeeWorksheetView.tsx`), 8. lépés Összesítő (`PayrollStep8.tsx`), Munkavállalói Adatlap (`EmployeeTabSections.tsx`), Új Dolgozó Varázsló (`EmployeeWizardPage.tsx`)  
**Kapcsolódó döntések:** [A-108](../../architecture/decisions/A-108-payroll-commute-reimbursement-and-employee-worksheet.md), [P-033](./P-033-payroll-cycle.md), [P-072](./P-072-payroll-cycle-attendance-manual-entry-and-cafeteria-ux.md), [032-payroll-module](../../business/decisions/032-payroll-module.md)

---

## 1. Felhasználói Igény és Probléma

A bérszámfejtési ciklusok kezelése a korábbi kizárólagos 8-lépéses stepper folyamatban (1. Ciklus adatok → 2. Jelenlét → 3. Órák & Túlórák → 4. Pótlékok & Prémium → 5. Munkába járás & Juttatások → 6. Cafeteria → 7. Levonások → 8. Összesítés) lineárisan, témakörök mentén haladt végig a teljes dolgozói állományon.

Vendéglátóipari egységek, műszakos munkarendek és külső telephelyes cégek (pl. Carman-Food Kft.) könyvelése során azonban a könyvelők dolgozói jelenléti ívek és egyéni havi elszámolólapok alapján dolgoznak:
1. **Személyközpontú adatrögzítés hiánya:** Egy dolgozóhoz tartozó összes havi változó adatot (ledolgozott napok, túlóra, műszakpótlék, borravaló/felszolgálási díj, utazási költség) egyszerre, egyetlen képernyőn kívánják látni és rögzíteni ahelyett, hogy 8 különböző lépés között ugrálnának oda-vissza.
2. **Azonnali kalkulációs visszajelzés szükségessége:** Az adatok beírása közben azonnal látni kell a számfejtési eredményt (élő bérszalvéta: bruttó, adók, levonások, nettó, munkáltatói költség) a hibák és anomáliák azonnali kiszűrésére.
3. **Munkába járási költségtérítés törvényi támogatása (39/2010. Korm. rend.):** Vidékről bejáró munkavállalóknál a saját gépkocsi használat (jogszabályi 30 Ft/km adómentes elszámolás a ledolgozott napok arányában) és a helyközi tömegközlekedési bérlet (86% kötelező vagy 100% önkéntes munkáltatói megtérítés) egyszerű havi és törzsadat-szintű kezelése.

---

## 2. Megoldás és UI/UX Viselkedés

### 2.1 Kettős Nézetváltó Kapcsoló a Ciklusoldalon (`PayrollCyclePage.tsx`)
- A bérszámfejtési ciklus oldal fejlécében, a jobb felső sarokban kapott helyet a kétállású nézetváltó kapcsoló:
  - **„8-lépéses folyamat”** (ListFilter ikon): a hagyományos, lépésről-lépésre haladó horizontális folyamat.
  - **„Dolgozói munkalap”** (UserCheck ikon): az új, 3 oszlopos dolgozó-központú munkaterület.
- **Állapotmegőrzés:** A nézetváltás nem vesz el semmilyen szerkesztett vagy még mentetlen állapotot; a `PayrollCyclePage` mint egyedüli állapot-gazda (single source of truth) szinkronban tartja a jelenléti, pótlék-, utazási és cafeteria adatokat.

### 2.2 A 3 Oszlopos Dolgozói Munkalap (`EmployeeWorksheetView.tsx`)

#### A) Bal Oszlop: Dolgozói Lista és Haladás (`WorksheetSidebar.tsx`)
- **Kereső:** Szűrés névre vagy pozícióra valós időben.
- **Szűrő gombok:** `Mind` (összes), `Függő` (még ellenőrzésre váró), `Kész` (véglegesített dolgozók).
- **Haladási sáv (Progress Bar):** Vizuális folyamatjelző (pl. `2 / 3 kész`, százalékos csík).
- **Dolgozói kártyák:**
  - Név, munkakör, havi nettó bér előnézet.
  - Státusz jelvények:
    - 🟢 *Kész* (a felhasználó késznek jelölte a dolgozót).
    - 🟡 *Adattal* (alapértelmezettől eltérő értékeket tartalmaz).
    - ⚪ *Alapértelmezett* (alapbeállítás szerinti munkanapok).

#### B) Középső Oszlop: All-in-One Havi Adatlap (`WorksheetEmployeeForm.tsx`)
Egyetlen gördíthető űrlapon csoportosítva:
1. **Munkaidő & Jelenlét:** Munkanapok száma (a hónap munkanapjaihoz igazodva), ledolgozott napok, szabadság, betegszabadság, táppénz, igazolatlan hiányzás napjai.
2. **Munkába járás és utazási költségtérítés (39/2010. Korm. rend.):**
   - Típus választó: *Nincs költségtérítés* / *Saját gépkocsi (km alapon)* / *Helyközi tömegközlekedés (bérlet / jegy)*.
   - Gépkocsi esetén: oda-vissza távolság (km), adómentes km díj (alapértelmezett: 30 Ft/km), ledolgozott napok száma.
   - Bérlet esetén: bérlet ára (Ft), térítési arány (86% vagy 100%).
   - *Intelligens figyelmeztetés:* Ha a ledolgozott napok száma 0, de bérlettérítés van megadva, sárga figyelmeztetés jelenik meg a 0 napos elszámolásról.
   - *Törzsadat szinkronizáció:* **„Mentés törzsadatba”** gombbal az itt megadott értékek közvetlenül átmenthetők a dolgozó állandó jogviszony rekordjába (`accounty_employments`).
3. **Órák & Túlórák:** Teljesítmény- és órabéres dolgozóknál ledolgozott órák, 50%-os és 100%-os túlórák, éjszakai és műszakpótlék órák.
4. **Pótlékok, Bónusz & Felszolgálási díj:** Készpénzes/bankkártyás borravaló és felszolgálási díj rögzítése, célprémiumok.
5. **Cafeteria, Home Office & Levonások:** SZÉP kártya, átalány-költségtérítés, valamint bírósági és egyéb letiltások.
- **Alsó navigációs sáv:** `Előző dolgozó`, `Megjelölés készként / folyamatban`, `Következő dolgozó` gyorsgombok.

#### C) Jobb Oszlop: Valós Idejű Élő Bérszalvéta (`WorksheetLivePayslip.tsx`)
- Bármely középső mező módosításakor azonnal, kliens-oldalon újraszámol a `taxEngine.ts` szinkron motor segítségével.
- Vizuális blokkok:
  - **Bruttó juttatások összesen** (Alapbér + Túlórák + Felszolgálási díj + Prémium).
  - **Kedvezmények:** 25 év alattiak, családi, 30 év alatti anyák stb.
  - **Levonások:** SZJA (15%), TB járulék (18.5%), végrehajtói letiltások.
  - **Adómentes juttatások:** Munkába járás költségtérítés, adómentes cafeteria.
  - **Kiemelt Nettó Kifizetés:** Kártya zöld háttérrel és nagy betűmérettel.
  - **Munkáltatói Költség (Szuperbruttó):** SZOCHO (13%) és egyéb munkáltatói terhek.
  - Közvetlen **Bérlap nyomtatás / PDF előnézet** gyorsakció.

---

### 2.3 Munkába Járási Költségtérítés a Rendszer Többi Pontján

1. **Dolgozói Törzsadatlap (`EmployeeTabSections.tsx`):**
   - A *Munkaviszonyok* fülön, a munkaviszony szerkesztése dialógusban helyet kapott a „Munkába járás utazási költségtérítése” panel.
   - Itt beállítható az állandó utazási mód, a kilométer távolság, vagy a havi bérlet díja és térítési aránya.
2. **Új Dolgozó Varázsló (`EmployeeWizardPage.tsx`):**
   - A 3. lépésben („Munkakör és béradatok”) azonnal rögzíthető az utazási térítés.
3. **8. lépés: Összesítés & Könyvelési Feladás (`PayrollStep8.tsx`):**
   - Külön KPI kártya jelzi a cég havi munkába járási költségtérítésének összegét.
   - A dolgozói összesítő táblázat és a CSV export külön oszlopban tartalmazza a térítési összeget.
   - A vegyes könyvelési feladásban megjelenik az automatikus könyvelési tétel:  
     **T 551 (Egyéb személyi jellegű kifizetések) — K 471 (Nettó jövedelemelszámolás)**.

---

## 3. UI/UX Szabályok és Biztonsági Védőhálók

- **0 napos jelenlét védőháló:** Ha egy dolgozó egész hónapban táppénzen vagy igazolatlanul távol volt (0 ledolgozott nap), gépkocsi költségtérítés nem számolódhat el (távolság × 0 nap = 0 Ft). Bérlet esetén sárga figyelmeztető banner kéri a könyvelőt a bérletelszámolás jogosságának ellenőrzésére.
- **Törzsadat védelem:** A havi munkalapon eszközölt egyszeri módosítás (pl. adott hónapban csak 5 napot járt autóval) nem írja felül a dolgozó állandó munkaszerződését/törzslapját, kivéve ha a könyvelő kifejezetten rákattint a *„Mentés törzsadatba”* gombra.
- **Konzisztencia és Tesztelhetőség:** Minden mezőhöz tartozik `data-testid` vagy egyértelmű azonosító, az élő bérszalvéta pedig szigorúan determinisztikus kerekítési szabályokat használ.
