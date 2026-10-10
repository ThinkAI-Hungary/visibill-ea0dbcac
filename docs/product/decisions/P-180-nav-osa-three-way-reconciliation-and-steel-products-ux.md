# P-180: NAV OSA Háromirányú Egyeztetés (Three-Way Reconciliation) és Fordított ÁFA Acéltermékek UX

**Status:** Decided  
**Category:** UI / Workflow  
**Question:** Hogyan tehető intuitívvá a könyvelő számára a NAV Online Számla, a helyi számlatár és a főkönyv háromirányú keresztellenőrzése, valamint a fordított adózású acéltermékek felügyelete?  
**Decision:** Külön al-nézet a 65M lapok mellett (Háromirányú OSA Egyeztetés), interaktív státusz-szűrőkkel és részletes tétel-összehasonlító táblázattal; önálló tab a fordított adózású acéltermékek (07/08 lapok) kezelésére VTSZ alapú anomália jelzőkkel.  
**Current Implementation:** `VatOsaThreeWayReconciliation.tsx`, `VatSteelProductsSection.tsx`, `useSteelProductsData.ts`.  
**Rationale:** A NAV ellenőrzések elkerülése érdekében elengedhetetlen, hogy a könyvelő egyetlen képernyőn lássa a számlák eltéréseit és az acélipari fordított adózás kötelező adatait.  

---

## 🖥️ Felhasználói Felület és Funkciók

### 1. Háromirányú OSA Egyeztető Lap (`VatOsaThreeWayReconciliation.tsx`)
A 65M partneri nézet tetején található nézetváltóban helyet kapott az **„OSA Háromirányú Egyeztetés”** gomb:
- **KPI Állapotkártyák:**
  - *Tökéletes Egyezés:* Zöld pipa, a NAV-ban és a könyvelésben is megegyező számlák száma és összege.
  - *Számszaki Eltérés:* Sárga figyelmeztetés, a kerekítési vagy összegbeli különbségek száma.
  - *Könyvelésből Hiányzó:* Piros figyelmeztetés az olyan számlákra, amelyek a NAV-ban léteznek, de az ügyfél még nem továbbította őket a könyvelőnek.
  - *NAV-ból Hiányzó:* Számlák, amelyeket lekönyveltek, de az OSA-ban nem találhatók.
- **Tételes Összehasonlító Táblázat:**
  - Egymás melletti oszlopokban tünteti fel a NAV OSA által rögzített nettó/áfa/bruttó értékeket, a helyi könyvelési számlát, valamint a kapcsolódó főkönyvi számlaszámokat (`466`, `467`, `311`, `454`).
  - Gyorstags/Badges jelzi az anomália típusát (pl. `Dátum eltérés`, `Nettó összeg eltérés`, `Hiányzó könyvelés`).

### 2. Fordított ÁFA Acéltermékek és Fémhulladék Lap (`VatSteelProductsSection.tsx`)
Az ÁFA bevallás főlapjai között elérhető **„Fordított ÁFA (07/08 lap)”** fül:
- **07-es Lap (Értékesítői oldal):** A belföldi fordított adózású értékesítések vevőnkénti és VTSZ szerinti aggregálása.
- **08-as Lap (Beszerzői oldal):** A beszerzett acéltermékek és fémhulladékok részletezése.
- **Anomália Detektor:** Sárga/piros szalag hívja fel a figyelmet, ha egy tételnél a VTSZ acélterméket jelöl, de normál 27%-os áfával számlázták, vagy ha a kötelező mennyiségi egység (kg) hiányzik a bizonylatról.

---

## 🔗 Kapcsolódó
- [A-243: NAV Online Számla Háromirányú Keresztellenőrzés Architektúra](../../architecture/decisions/A-243-nav-osa-three-way-reconciliation-and-steel-products-architecture.md)
- [P-179: ÁFA Bevallás Változásvédelem UX](./P-179-vat-return-snapshots-and-amendments-workspace-ux.md)
