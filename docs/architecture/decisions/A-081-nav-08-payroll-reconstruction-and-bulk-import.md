# A-081: NAV 08 (2608 / 2508 / 2408) XML Feldolgozás és Tömeges Bérszámfejtés Rekonstrukciós Motor

**Status:** Decided  
**Date:** 2026-09-02  
**Utoljára frissítve:** 2026-09-02  
**Category:** Frontend / eaisyBooks / Bérszámfejtés  

---

## 1. Context

A könyvelőirodák új ügyfél átvételekor vagy évközi rendszerváltáskor gyakran több tucat dolgozó törzsadataival és a tárgyév korábbi hónapjainak már lezárt, NAV felé beküldött bérszámfejtési adataival rendelkeznek.  
A kézi rögzítés (dolgozónként, jogviszonyonként, hónapról hónapra) rendkívül időigényes és hibalehetőségeket rejt magában.  
A bérszámfejtési szoftverekből exportált hivatalos havi **NAV 08 (pl. 2608, 2508, 2408)** ÁNYK XML nyomtatványok és az Excel/CSV exportok tartalmazzák a dolgozók teljes személyi törzsadatait (08M-01/02), biztosítási jogviszonyait (08M-04) és a lejelentett havi jövedelem-/járulékösszegeket (08M-07, 08M-08).

### Technikai kihívások:
1. **ÁNYK XML struktúra komplexitás:** Nem hierarchikus adatbázis rekordok, hanem űrlaplapok (`08M`) és kódolt mezőnevek (`M001A`, `M002`, `M0401`, `M0701` stb.).
2. **Karakterkódolások:** A hivatalos ÁNYK exportok gyakran `ISO-8859-2` (Latin-2) vagy `windows-1250` kódolásúak, ami a modern böngészőkben a magyar ékezetes karakterek sérülését okozhatja.
3. **Adatbázis integritás & Tranzakcionális duplikációvédelem:** A dolgozókat (`accounty_employees`), az aktív jogviszonyokat (`accounty_employments`), a havi ciklusokat (`accounty_payroll_cycles`) és az egyéni kalkulációkat (`accounty_payroll_calculations`) úgy kell kötegelten létrehozni, hogy a fájlon belüli és az adatbázisban már meglévő adatokkal ne keletkezzen duplikáció.

---

## 2. Decision

Kliens-oldali, aszinkron és nagy sebességű parser és rekonstrukciós motort vezettünk be a `src/lib/payroll/` rétegben.

### 2.1. Architekturális komponensek

1. **`nav08XmlParser.ts` (XML feldolgozó & Kódoláskezelő):**
   - **`readTextFileWithEncoding(file)`**: Kétlépcsős buffer dekódoló. Detektálja az XML fejléc `encoding` attribútumát (`ISO-8859-2`, `windows-1250`, `utf-8`), és a megfelelő `TextDecoder` segítségével veszteségmentesen nyeri ki az ékezetes karaktereket.
   - **`parseFiling08Xml(xmlText)`**: Képes mind a hivatalos ÁNYK 08-as nyomtatványok (`nyomtatvany`, `mezo`), mind az általános szemantikus bér-XML-ek értelmezésére. Kinyeri az M-lapokból a dolgozói adatokat és az adóalapokat (SZJA, TB, SZOCHO, kedvezmények, nettó bér).
   - **`normalizeDate(str)`**: ISO `YYYY-MM-DD` formátumra alakítja a `DD.MM.YYYY`, `YYYY.MM.DD`, `YYYYMMDD`, `DD/MM/YYYY` dátumokat.

2. **`payrollReconstructionEngine.ts` (Rekonstrukciós és Kalkulációs Tervező):**
   - **`buildReconstructionPlan`**: Összeveti a beolvasott 08-as XML fájl adatait a meglévő céges dolgozókkal (`existingEmployees`), jogviszonyokkal (`existingEmployments`) és ciklusokkal (`existingCycles`).
   - Előkészíti a hiányzó dolgozók, jogviszonyok és zárt (`status: 'closed'`, `current_step: 8`) ciklusok rekonstrukciós tervét.
   - **`preparePayrollCalculationRecord`**: Létrehozza a részletes `accounty_payroll_calculations` rekordot (bruttó bér, SZJA, TB járulék, SZOCHO, nettó bér, levonások és metaadatok).

3. **`useBulkImportPayroll.ts` (Tranzakcionális In-Memory Cache Hook):**
   - **`importEmployees`**: Kötegelt dolgozó- és jogviszony import. In-memory szinkronizációval (`localEmps`, `localEmployments`) elkerüli a fájlon belüli azonos TAJ/Adóazonosító duplikált létrehozását.
   - **`reconstructCycles`**: Több havi 08-as XML kötegelt mentése ciklusokkal és egyéni bérszámfejtési kalkulációkkal.
   - Automatikusan érvényteleníti a kapcsolódó React Query kulcsokat (`payrollQueryKeys.all`, `companyEmployments`, `employees`, `cycles`).

4. **UI Integráció:**
   - **`EmployeeImportPage.tsx`**: 2-füles felület (Excel/CSV sablon letöltéssel + NAV 08 ÁNYK XML feltöltéssel). Dinamikus, ékezetmentesített oszlopfelismeréssel (`findCol`).
   - **`PayrollReconstructionDialog.tsx`**: Több havi XML fájl egyszerre történő bedobása, kronológiai rendezése, áttekintő statisztikák (összes dolgozó, bruttó, nettó, járulékok) és kötegelt visszamenőleges generálás.

---

## 3. Consequences

### Pozitív
- **1-kattintásos áttérés:** Az új könyvelt cégek teljes éves béradatai perceken belül betölthetők a NAV 08-as bevallásaik alapján.
- **Formátumfüggetlenség:** Bármilyen elterjedt magyar bérprogram (Kulcs-Bér, Novitax, RLB, ÁNYK) exportját automatikusan kezeli.
- **Konzisztens Jogviszony Kapcsolat:** A dolgozókhoz azonnal létrejön az aktív `accounty_employments` rekord (alapbér, FEOR, heti munkaidő, T1041 kód).
- **Zárt Ciklus Snapshot:** A rekonstruált ciklusok zártként jönnek létre, így nem borítják fel az aktuális nyitott havi számfejtési lépéseket.

### Negatív / Kockázatok és Kezelésük
- *Nagy méretű XML fájlok kliens-oldali DOM memóriahasználata:* A DOMParser gyors és hatékony böngészőben; 100+ dolgozós havi lapok is 50-100ms alatt futnak le.

---

## 4. Kapcsolódó Dokumentáció
- [P-033: Bérszámfejtési Ciklus Workflow](../../product/decisions/P-033-payroll-cycle.md)
- [P-063: Bérszámfejtés Gyors Rekonstrukció és Dolgozói Tömeges Import UX](../../product/decisions/P-063-payroll-bulk-import-and-reconstruction-ux.md)
- [A-016: PostgreSQL Query Stratégia](./A-016-postgresql-query-strategy.md)
