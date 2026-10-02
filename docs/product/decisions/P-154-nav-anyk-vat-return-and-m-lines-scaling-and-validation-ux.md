# P-154: NAV ÁNYK 2665A/2665M XML Export, M-lapok Kettős Skálája (HUF vs eFt), Webes Konzisztens Forint Nézet és Összefüggés-vizsgálati Validáció UX

**Status:** Decided  
**Category:** eaisyBooks / ÁFA / Export UX  
**Date:** 2026-10-02  
**Kapcsolódó architektúra döntés:** [A-080: NAV ÁNYK 2665 ÁFA-Bevallás (2665A) és 65M Összesítő Jelentés (2665M) Szabványos XML Export](../../architecture/decisions/A-080-nav-anyk-vat-return-xml-standardization.md)  
**Kapcsolódó termékdöntések:** [P-032: ÁFA Bevallás Workflow](./P-032-vat-return-workflow.md), [P-097: NAV 2665 Nyomtatvány Replika és 6/B Analitika](./P-097-nav-2665-replica-steel-analytics-and-anyk-validation-ux.md), [P-119: Törvényi ÁFA Nézetek és Rekonsziliáció](./P-119-statutory-vat-views-upgrade-and-reverse-charge-ux.md)  
**Érintett felületek:** `/vat-return`, `VatReturnViewTab.tsx`, `VatMLineMasterDetail.tsx`, `VatCalculatorView.tsx`, `VatMLineDrillDown.tsx`, `VatXmlExportModal.tsx`

---

## 1. Termékkérdés és Célkitűzés

Az ÁNYK (AbevJava) rendszerbe történő havi és negyedéves ÁFA-bevallás importálása során a könyvelők két kritikus anomáliával szembesültek:
1. **Mértékegységi skála-eltérés (HUF vs eFt) és felületi félreértések:**
   - A korábbi felületen a 65M belföldi összesítő jelentés táblázataiban az adóalap és áfa kerekített ezer forintként (eFt) jelent meg, de a pénznem szimbólumaként megtévesztően a `Ft` szerepelt (pl. `2 219 Ft` a valós `2 219 200 Ft` helyett).
   - Ezzel szemben az ÁNYK 2665M-02 tételes számlarészletező lapján a jogszabály forintra pontos (HUF) adatokat követel meg, míg az M-01 partnerösszesítő lap és a főlap 0F lapja ezer forintra (eFt) kerekítve kéri az adatokat. Ha az M-02 lapra eFt kerekített adatok kerültek volna, az ÁNYK a 37. sor összegét még egyszer elosztotta volna 1000-rel az M-01-hez viszonyítva.
2. **ÁNYK szigorú belső összefüggés-vizsgálati és sablonhibák:**
   - Az ÁNYK AbevJava importáláskor és ellenőrzéskor hibákat dobott:
     - `0C0001C0066DA`: Ismeretlen mezőkód sablonhiba (a 66. sornak csak BA és CA mezője van).
     - `<1087150/R621>` & `<1087151/R622>`: A 36. összesítő sornak fillérre/forintra pontosan egyeznie kell a részletező sorok összegével (Round-then-Sum kerekítési difik megszüntetése).
     - `<1087305/R914>`: A 66. sor levonható adójának (66c) egyeznie kell az adóalap 27%-ával.
     - `<1087248/R767>`: A 76. sor levonható adóalap összesítésnek egyeznie kell a részletező levonható sorok összegével.
     - `<1095069/R975>`: A főlap 109. sorába a törvényi számítási képlet szerinti összegnek kell kerülnie ($64c + 65c + 66c + 68c$), nem pedig az M-lapok adójának.

---

## 2. Termékdöntés

### A. Webes Felület: Egységes Forintpontos Megjelenítés (Opció A)
A felhasználói visszajelzések alapján a felületen teljes forint (HUF) nézet került bevezetésre az összes M-lapos komponensben:
- `VatMLineMasterDetail.tsx`: A partnerlistában és a tételes számlatáblázatban az Adóalap és ÁFA oszlopok egységesen `formatCurrency(val, 'HUF')` formázással, teljes összeggel jelennek meg (pl. `2 219 200 Ft` és `599 184 Ft`).
- `VatCalculatorView.tsx`: A 65M összesítő kártyán és a főlap soraiban megszűnt a kerekített eFt számok forintként való kiírása.
- `VatMLineDrillDown.tsx`: A számlaszintű fúrási nézet forintra pontosan mutatja a könyvelési és NAV OSA tételsorokat.

### B. ÁNYK 2665M Kettős Mértékegység-kezelés
Az XML generátor (`src/lib/vatReturnXml.ts`) automatikusan biztosítja a kettős skálázást a NAV kitöltési útmutatójának megfelelően:
1. **65M-02 Tételes Számlalapok (01–36. sorok és 37. sor záró összesítés):**
   - Minden belföldi számla nettó adóalapja (`0B{page}C{row}CA`) és levonható áfája (`0B{page}C{row}DA`) **forintra pontosan (HUF)** kerül kiírásra.
   - A 36 tételenként nyíló új oldalak záró sorai (`0B{page}C0037CA` és `DA`) az oldalon szereplő számlák pontos forintösszegét összesítik.
2. **65M-01 Partner Összesítő Lap (0A lap):**
   - Az adatok ezer forintban (eFt) szerepelnek (`Math.round(totalBaseHuf / 1000)` és `Math.round(totalTaxHuf / 1000)`).
   - Az ÁNYK belső számítási motorja a 37. sor Forint összegét 1000-rel elosztva vizsgálja az M-01 laphoz képest, így a bevallás sárga figyelmeztetés és piros hiba nélkül érvényesíthető.

### C. ÁNYK Belső Összefüggések Automatikus Feloldása (Generátori Védőháló)
Az XML generáló motor elébe megy az ÁNYK szigorú matematikai ellenőrzéseinek:
1. **Részletezőkből Számított Összesítők (Round-then-Sum):**
   - **36. sor (0B lap):** Nem az adatbázisbeli nyers összegből kerekít, hanem a ténylegesen kibocsátott 01..35. részletező sorok kerekített összegeként áll elő (`0B0001C0036BA` és `CA`), megelőzve az R621 és R622 hibákat.
   - **76. sor (0D lap):** A levonható sorok (63..75, 111) kibocsátott értékeinek összegeként generálódik (`0D0001C0076BA` és `CA`), elhárítva az R767 hibát.
   - **83., 84. és 85. sorok:** A különbözet (`83c = 36c - 76c - 82c`) és visszaigényelhető adó közvetlenül a számított mezőkből képződik, fenntartva az elszámolási lánc integritását.
2. **Kulcskonzisztencia Kikényszerítése (R914):**
   - A 66. sor levonható adójának (66c) egyeznie kell az adóalap 27%-ával. Ha számlaszintű kerekítések miatt eltérés lenne, a generátor a törvényes `Math.round(base * 0.27)` adóértéket írja ki.
3. **109. sor Törvényi Képlete (R975):**
   - A főlap 109. sorába (`0F0001D0109CA`) az ÁNYK által előírt törvényi képlet alapján számított összeg ($64c + 65c + 66c + 68c$) kerül a korábbi téves `mTotalTax` helyett.
4. **Ismeretlen Sablonmezők Kizárása:**
   - A 0C lapon a 66. sornak kizárólag BA és CA oszlopa létezik, a nem létező `0C0001C0066DA` mező generálása véglegesen törölve lett.

### D. Export Modal UX (`VatXmlExportModal.tsx`)
- Az Export menüből és az ÁNYK letöltés gomb megnyomásakor megjelenő felugró ablak biztosítja az adatok ellenőrzését:
  - Ügyintéző neve és telefonszáma (szükség esetén szerkeszthető és azonnal a céghez mentődik).
  - Sablon-felülbírálás választó (alapértelmezetten `auto`, de szükség esetén régebbi sablonok, pl. 2465 v4.0 is választható).
  - 1-kattintásos export és közvetlen böngészős fájlletöltés.

---

## 3. Következmények és Eredmények

- **Hibamentes ÁNYK Import:** Az exportált XML fájl azonnal, figyelmeztető és hibaüzenetek nélkül importálható és ellenőrizhető (`Ctrl + F9`) az ÁNYK-ban (AbevJava).
- **Egyértelmű Felületi Kommunikáció:** A könyvelő a webes felületen forintra pontosan látja a számlák összegeit, nincs kerekítési félreértés.
- **Teljes Számszaki Összhang:** Az M-02 tételes sorok, az M-01 lapok és a főlap 0F összesítő lapja között teljes körű matematikai konzisztencia érvényesül.
