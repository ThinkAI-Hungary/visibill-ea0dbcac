# A-185: Bérjegyzék Megjelenítés, FEOR-08 Munkakör Szótár és Költséghely Architektúra

**Status:** Decided  
**Date:** 2026-09-30  
**Utoljára frissítve:** 2026-09-30  
**Category:** Frontend / eaisyBooks / Bérszámfejtés  

---

## 1. Context

A bérszámfejtési modulban generált dolgozói fizetési jegyzékekkel és a NAV 08-as havi bevallásokból történő adatimporttal kapcsolatban a valós könyvelői használat során (különösen az `EB-0230` hibajegyben és a VBV Vision Kft. visszajelzéseiben) több lényeges elméleti és gyakorlati korlát merült fel:

1. **Szöveges munkakörök hiánya a NAV 08M ÁNYK XML-ben:**  
   A hivatalos NAV 08M bevallások a dolgozók biztosítási jogviszonyát kizárólag a 4-jegyű KSH FEOR-kóddal azonosítják a 0F lap `0520AA` mezőjében (`0F0001D0520AA`). Szöveges munkakör megnevezést a NAV nyomtatvány egyáltalán nem tárol. Emiatt az importált dolgozók `job_title` értéke üresen maradt, és a bérjegyzékeken kötőjel (`–`) jelent meg munkakörként.
2. **Levonások előjelének dolgozói félreértése:**  
   A fizetési jegyzékeken a levonási tételek (SZJA 15%, TB járulék 18.5%, végrehajtói letiltások, munkabérelőleg) korábban negatív előjellel (`-`) jelentek meg. Számos munkavállaló ezt tévesen úgy értelmezte, mintha levonás helyett jóváírást vagy további tartozást jelezne.
3. **Munkáltatói bérköltség (szuperbruttó) kitakarási igény:**  
   A bérjegyzék tájékoztató szekciójában korábban szerepelt a munkáltató által fizetendő "Teljes bérköltség" (bruttó bér + SZOCHO / KIVA). A cégvezetők és bérszámfejtők kifejezett kérése, hogy a dolgozók felé átadott fizetési jegyzék ne tartalmazza a vállalat teljes bérköltségét, mivel az a dolgozói példányokon felesleges bérfeszültséget és félreértéseket szül.
4. **Költséghely (Cost Center) hiánya a bérlapon:**  
   Vállalkozásoknál a dolgozók szervezeti egységhez (iroda, telephely, projekt, vezetés) tartozása elengedhetetlen a bérköltségek analitikus szétbontásához és a bérjegyzékek fizikai elosztásához. Bár a DB sémában létezett a `cost_center` mező, a felület nem biztosított beviteli mezőt és a bérjegyzék nem jelenítette meg.

---

## 2. Decision

### 2.1. FEOR-08 Szótár és Munkakör Feloldó Motor (`feorCodes.ts`)
- Létrehoztuk a hivatalos KSH FEOR-08 nomenklatúra szótárat (`FEOR_DICTIONARY`) a leggyakoribb ~65 KKV foglalkozással (vezetők, mérnökök, IT, ügyintézők, adminisztrátorok, könyvelők, bolti eladók, vendéglátás, szakmunkák, EFO alkalmi és idénymunka).
- **`getFeorTitle(code)`**: Whitespace-toleráns kereső, amely a 4-jegyű kód alapján azonnal visszaadja a hivatalos szöveges megnevezést.
- **`formatJobTitleWithFeor(jobTitle, feorCode)`**: 
  - Ha van explicit egyedi munkakör, azt jeleníti meg.
  - Ha nincs, de van FEOR kód, a szótári megnevezést és a kódot kombinálja (pl. `Könyvelő (számviteli ügyintéző) (FEOR 4121)`).
  - Ha a kód nem szerepel a szótárban, elegáns `FEOR: XXXX` fallbacket alkalmaz a korábbi üres kötőjel helyett.
- **NAV 08 XML parser integráció (`nav08XmlParser.ts` és `useBulkImportPayroll.ts`)**: Az XML beolvasásakor mindkét parser ág azonnal kitölti a `jobTitle` mezőt a `getFeorTitle` segítségével.

### 2.2. Bérjegyzék Generátor Redesign (`payslipGenerator.ts`)
- **Hero Dolgozónév:** `.employee-name-hero` stílus (15px félkövér Outfit betűtípus, felső sarokba igazítva).
- **Levonások előjelmentesítése:** Az SZJA, TB járulék, letiltások és előlegek értéke pozitív formázással (`${fmt(...)}`) kerül kiírásra a Levonások oszlopban.
- **Teljes bérköltség törlése:** A munkáltatói tájékoztató dobozból a `Teljes bérköltség` sor véglegesen törlésre került; kizárólag a tájékoztató SZOCHO (13%) vagy KIVA (10%) sor jelenik meg.
- **Fizetési mód intelligens megjelenítése:**
  - Átutalás esetén a belföldi számlaszám és nemzetközi IBAN kerül feltüntetésre.
  - Készpénz esetén a bankszámla sorok rejtve maradnak, és letisztult „Készpénz” státusz jelenik meg.
- **Költséghely:** Kitöltöttség esetén automatikusan megjelenik a `Költséghely: <név>` sor.

### 2.3. Költséghely és Munkakör Kezelés a Felületen
- **Munkavállaló Törzsadat (`EmployeeTabSections.tsx`):** A Munkaviszonyok fülön közvetlen szerkesztési lehetőség a munkakörre és a költséghelyre, mentéssel az `accounty_employments` táblába.
- **Havi Bérszámfejtési Munkalap (`WorksheetEmployeeForm.tsx`, `EmployeeWorksheetView.tsx`):** Inline költséghely beviteli mező és mentés gomb azonnali toast visszajelzéssel és React Query cache invalidációval.
- **Élő Bérjegyzék Előnézet (`WorksheetLivePayslip.tsx`):** Valós időben mutatja a formázott munkakört, költséghelyet és előjelmentes levonásokat.

---

## 3. Consequences

### Pozitív:
- **Nulla Manuális Utómunka 08 Import Után:** A NAV 08 beolvasásakor a dolgozók automatikusan megkapják a hivatalos munkakörüket, nincs szükség kézi átírásra.
- **Bérfeszültség és Félreértések Megelőzése:** A dolgozók nem látják a cég szuperbruttó terhét, és a levonások sem tévesztik meg őket mínuszjelekkel.
- **Pontos Analitika:** A költséghely rögzíthetősége lehetővé teszi a bérköltségek osztályok és telephelyek szerinti szétbontását.

### Kockázatok és Kezelésük:
- *Nem szótári FEOR kódok:* A ritka FEOR kódoknál `FEOR: XXXX` jelenik meg, amelyet a könyvelő a Munkaviszonyok fülön egy kattintással átírhat egyedi munkakörre.

---

## 4. Kapcsolódó Dokumentáció
- [P-148: Bérjegyzék Redesign, Költséghely Kezelés és FEOR Munkakör UX](../../product/decisions/P-148-payslip-redesign-cost-center-and-feor-job-title-ux.md)
- [A-081: NAV 08 XML Feldolgozás és Tömeges Rekonstrukciós Motor](./A-081-nav-08-payroll-reconstruction-and-bulk-import.md)
- [P-063: Bérszámfejtés Gyors Rekonstrukció és Dolgozói Tömeges Import UX](../../product/decisions/P-063-payroll-bulk-import-and-reconstruction-ux.md)
- [P-033: Bérszámfejtési Ciklus Workflow](../../product/decisions/P-033-payroll-cycle.md)
