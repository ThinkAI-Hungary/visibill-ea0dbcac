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
   - **`repairHungarianMojibake(str)` & `cleanText(str)`**: Beépített automatikus karakterjavító. A teljes 18-magánhangzós magyar mátrixot javítja az összes lehetséges forráskódolás (ISO-8859-2, Windows-1250, Latin-1 és dupla UTF-8 dekódolás) esetén (`ĂĄ` -> `á`, `ĂŠ` -> `é`, `Ăł` -> `ó`, `Ăś` -> `ö`, `Ĺ‘` -> `ő`, `Ăş` -> `ú`, `Ăź` -> `ü`, `Ĺ±` -> `ű`, `Ĺą` -> `ű` stb.).
   - **Névtér-független DOM bejárás (`findTagText`, `getElementsByTagName`)**: A hivatalos NAV XML-ek gyakran alapértelmezett névtérrel (`xmlns="http://www.apeh.hu/abev/nyomtatvanyok/2005/01"`) rendelkeznek. A szabványos `querySelector` ilyenkor nem találja meg a tageket; a parser a lokális tagnevekre illeszkedő segédfüggvénnyel garantálja az elemek megtalálását.
   - **`parseFiling08Xml(xmlText)`**: Képes mind a hivatalos ÁNYK 08-as nyomtatványok (`nyomtatvany`, `mezo`), mind az általános szemantikus bér-XML-ek értelmezésére. Kinyeri az M-lapokból a dolgozói adatokat és az adóalapokat (SZJA, TB, SZOCHO, kedvezmények, nettó bér).
   - **Hivatalos ÁNYK `eazon` és szemantikus attribútum-kompatibilitás**: Támogatja mind a logikai neveket (`VEZETEKNEV`, `BRUTTO_BER`, `M001A`), mind a hivatalos ÁNYK elektronikus azonosítókat (`eazon` attribútumok):
     - `0A0001C017A` (Vezetéknév), `0A0001C018A` (Keresztnév)
     - `0A0001C007A` (Adóazonosító jel), `0A0001D001A` (TAJ szám), `0A0001C027A` (Születési dátum)
     - `0B0001D0270DA` (Bruttó bér / jövedelem alap)
     - `0C0001D0330BA` (Levont SZJA előleg), `0C0001C0319BA` (25 év alattiak kedvezményének alapja)
     - `0I0001D0626CA` (TB járulék alapja), `0I0001D0629CA` (Levont TB járulék), `0I0001D0634CA` (SZOCHO alap)
     - `0F0001D0520AA` (FEOR szám), `0F0001D0524AA` (Heti munkaórák száma)
     - `0F0001C005A` (Eredeti belépés dátuma a céghez, 6 számjegyű `YYMMDD` formátumban)
     - Főlap (08A): `0A0001C002A` (Adózó adószáma), `0A0001C013A` (Adózó neve), `0A0001C027A` (Időszak kezdete).
   - **Robusztus időszak-detektálás**: A főlap (`08A`) és az egyéni lapok (`08M`) mezőiből (`0A0001C027A`, `0101D`, `idoszak > tol`, `IDOSZAK_TOL`, `BEVALLASI_IDOSZAK_METTOL`) prioritási sorrendben nyeri ki az évet és a hónapot. Megakadályozza az aktuális hónapra való hibás fallback-et, így a több havi XML egyidejű feltöltésekor a hónapok nem írják felül egymást.
   - **`normalizeDate(str)`**: ISO `YYYY-MM-DD` formátumra alakítja a `DD.MM.YYYY`, `YYYY.MM.DD`, `YYYYMMDD`, `YYMMDD` (pl. `240715` -> `2024-07-15`), `DD/MM/YYYY` dátumokat.

2. **`payrollReconstructionEngine.ts` (Rekonstrukciós és Kalkulációs Tervező):**
   - **`buildReconstructionPlan`**: Összeveti a beolvasott 08-as XML fájl adatait a meglévő céges dolgozókkal (`existingEmployees`), jogviszonyokkal (`existingEmployments`) és ciklusokkal (`existingCycles`).
   - Előkészíti a hiányzó dolgozók, jogviszonyok és zárt (`status: 'closed'`, `current_step: 8`) ciklusok rekonstrukciós tervét.
   - **`preparePayrollCalculationRecord`**: Létrehozza a részletes `accounty_payroll_calculations` rekordot (bruttó bér, SZJA, TB járulék, SZOCHO, nettó bér, levonások és metaadatok).

3. **`useBulkImportPayroll.ts` (Tranzakcionális In-Memory Cache Hook):**
   - **`importEmployees`**: Kötegelt dolgozó- és jogviszony import. In-memory szinkronizációval (`localEmps`, `localEmployments`) elkerüli a fájlon belüli azonos TAJ/Adóazonosító duplikált létrehozását.
   - **Szellem-dolgozó védelem**: Automatikusan kihagyja és naplózza azokat a sorokat, amelyeknél sem név, sem TAJ, sem adóazonosító nem érhető el az XML-ből, megakadályozva üres fantom-dolgozók beszúrását az adatbázisba.
   - **`reconstructCycles` (Egyetlen menetben optimalizált kötegelt import)**:
     - Először kiszűri és deduplikálja az egyedi munkavállalókat az összes havi XML-ből (`uniqueEmployeesMap`), és egyetlen atomi menetben szinkronizálja őket, megszüntetve a redundáns N+1 lekérdezéseket és az értesítési toast-özönt.
     - Ciklus felülírásakor (`overwriteExisting = true`) explicit frissíti a ciklus státuszát (`status: 'closed'`, `current_step: 8`) és lezárási jegyzeteit.
     - Jogviszony illesztésnél prioritást élvez az aktív jogviszony (`status === 'active' || !status`).
     - Automatikusan érvényteleníti a kapcsolódó React Query kulcsokat (`payrollQueryKeys.all`, `companyEmployments`, `employees`, `cycles`).

4. **UI Integráció:**
   - **`EmployeeImportPage.tsx`**: 2-füles felület (Excel/CSV sablon letöltéssel + NAV 08 ÁNYK XML feltöltéssel). Több fájl behúzása esetén a `pendingFiles` állapoton keresztül azonnal átadja az összes fájlt a rekonstrukciós ablaknak.
   - **`PayrollReconstructionDialog.tsx`**: Támogatja az `initialFiles` prop-ot: az ablak megnyílásakor automatikusan beolvassa, kronológiailag rendezi, és összesíti az összes feltöltött hónap béradatait.

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
- [BRD 032: Payroll Modul](../../business/decisions/032-payroll-module.md)
- [P-033: Bérszámfejtési Ciklus Workflow](../../product/decisions/P-033-payroll-cycle.md)
- [P-063: Bérszámfejtés Gyors Rekonstrukció és Dolgozói Tömeges Import UX](../../product/decisions/P-063-payroll-bulk-import-and-reconstruction-ux.md)
- [A-016: PostgreSQL Query Stratégia](./A-016-postgresql-query-strategy.md)

