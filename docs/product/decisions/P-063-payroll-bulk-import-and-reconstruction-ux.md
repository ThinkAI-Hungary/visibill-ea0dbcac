# P-063: Bérszámfejtés Gyors Rekonstrukció és Dolgozói Tömeges Import (Excel & NAV 08) UX

**Status:** Decided  
**Category:** eaisyBooks / Bérszámfejtés  
**BRD Reference:** REQ-8b.3 (Bérszámfejtés portfólió)  

---

## 1. Question
Hogyan biztosítható a könyvelők számára a dolgozói törzsadatok és a tárgyév korábbi, lezárt havi bérszámfejtéseinek gyors, zökkenőmentes importálása és rekonstruálása az eaisyBooks felületen?

---

## 2. Decision
Két kiegészítő felhasználói felületet alakítottunk ki:
1. **Dolgozói Tömeges Import Felület (`/accounty/payroll/:id/import`):** 2-füles nézet Excel/CSV sablonnal és NAV 08 ÁNYK XML feltöltéssel.
2. **Kötegelt Számfejtés Rekonstrukciós Modál (`PayrollReconstructionDialog`):** Több havi NAV 08 ÁNYK XML egyidejű bedobása a bérszámfejtés főoldaláról.

---

## 3. Current Implementation

### 3.1. Dolgozói Tömeges Import Oldal (`EmployeeImportPage.tsx`)
- **Route:** `/accounty/payroll/:companyId/import`
- **Fülek:**
  1. *Excel / CSV Sablon:*
     - Sablon letöltési menü: `.xlsx` és `.csv` formátumok (UTF-8 BOM-mal).
     - Drag & Drop feltöltő zóna.
     - Dinamikus oszlopillesztés: ékezet- és kis/nagybetű-függetlenül felismeri a magyar és angol oszlopneveket (Vezetéknév, Keresztnév, Születési dátum, TAJ-szám, Adóazonosító, Jogviszonykód, Belépés, FEOR, Heti óraszám, Alapbér).
  2. *NAV 08 (2608 / 2508 / 2408) ÁNYK XML:*
     - Kinyeri az M-lapokból (08M) a dolgozók személyi adatait, jogviszonyait és a számfejtési alapokat.
- **Előnézeti Fázis (Preview):**
  - Státusz kártyák: Érvényes sorok, Hibás sorok, Ciklus opció.
  - Táblázatos előnézet zöld/piros érvényességi jelzéssel és hibaüzenetekkel (pl. hiányzó TAJ/Adóazonosító).
  - Ha 08-as XML-ből származik az adat, megjelenik a havi bérszámfejtési ciklus lezártként való azonnali létrehozásának opciója (`createCycleOption`).

### 3.2. Gyors Rekonstrukciós Modál (`PayrollReconstructionDialog.tsx`)
- Elérhető a bérszámfejtés főoldalának (`/accounty/payroll/:companyId`) fejlécéből a **"Számfejtés Rekonstrukció"** gombbal, valamint az onboarding beüzemelési kártyáról (amikor még nincsenek ciklusok).
- **Funkciók:**
  - Több havi XML fájl egyidejű kiválasztása vagy drag-and-drop behúzása.
  - Automatikus kronológiai rendezés (év, hónap szerint).
  - Év/hónap duplikációvédelem (új fájl felülírja az azonos hónap korábbi előnézetét).
  - Összesített KPI sáv: beolvasott hónapok száma, összes érintett dolgozó, összesített bruttó bér, nettó bér, adók és járulékok.
  - Áttekintő lista hónaponkénti bontásban (dolgozók száma, bruttó összeg, törlés gomb).
  - **"Rekonstrukció Végrehajtása"** gomb: automatikusan legenerálja az összes hiányzó dolgozót, az aktív jogviszonyokat, a lezárt havi ciklusokat és a kalkulációs tételeket.

---

## 4. Rationale
- Az Excel és a NAV 08 ÁNYK XML támogatás lefedi a könyvelők valós munkamenetét, amikor egy ügyfelet év közben vesznek át.
- A többhavi kötegelt feldolgozás percekre csökkenti az akár többnapos kézi adatrögzítést.
- A visszamenőleges havi adatok lezárt (`closed`) státusszal kerülnek mentésre, így az adózási és kifizetési kimutatások azonnal pontosak lesznek anélkül, hogy a folyó havi számfejtési folyamatot zavarnák.

---

## 5. Kapcsolódó
- [P-033: Bérszámfejtési Ciklus Workflow](./P-033-payroll-cycle.md)
- [A-081: NAV 08 XML Feldolgozás és Tömeges Rekonstrukciós Motor](../../architecture/decisions/A-081-nav-08-payroll-reconstruction-and-bulk-import.md)
