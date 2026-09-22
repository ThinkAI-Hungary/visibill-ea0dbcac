# P-105: Főkönyvi Kivonat 2-Tier Eszköztár és Hierarchikus Számlafa Kibontás/Összecsukás UX

**Státusz:** Elfogadva  
**Dátum:** 2026-09-22  
**Érintett modulok:** Főkönyvi kivonat (`GeneralLedgerPage.tsx`), Számlatükör fastruktúra táblázat (`GeneralLedgerTable.tsx`)  

---

## 1. Kontextus és Problémafelvetés
A Főkönyvi kivonat (`/eaisybooks/general-ledger`) a könyvelők egyik legfontosabb munkaeszköze. A korábbi felületen két jelentős ergonómiai és vizuális probléma állt fenn:
1. **Túlfolyó, töredezett eszköztár (Toolbar Overflow):**
   A keresőmező, nézetváltó, időszakválasztó és a különböző szűrők (Dátum alap, Bizonylatok státusza, Egyenleg szűrés) egyetlen flex-sorba voltak zsúfolva. Kisebb felbontáson vagy normál laptop képernyőn a vezérlők tördelődtek, a gombok lecsúsztak a második sorba, ami rendezetlen benyomást keltett és értékes vertikális helyet vett el.
2. **Nehézkes fastruktúra navigáció:**
   A hierarchikus számlatükör (számlaosztályok, számlacsoportok, szintetikus és analitikus számlák) alapértelmezetten összecsukott vagy részben nyitott állapotban jelent meg. Ha a könyvelő a teljes főkönyvet egyszerre akarta áttekinteni vagy auditálni, tucatnyi vagy több száz csoportot kellett egyesével kézzel lenyitogatnia. Ugyanez igaz volt az összecsukásra is.

---

## 2. Termékdöntés és Megoldás

### 1. Kétszintű Eszköztár Architektúra (2-Tier Toolbar)
Az eszköztárat két funkcionálisan elkülönülő sorra bontottuk:
- **Felső sor — Navigáció, Keresés és Fanézet Vezérlés:**
  - **Bal oldal:** Főkönyvi kereső (`GlSearchAutocomplete`) gyors számlakereséssel és számlaszámra ugrással, közvetlenül mellette a kompakt **"Mind kinyitása"** (`ChevronsUpDown` ikonnal) és **"Mind összecsukása"** (`FolderClosed` ikonnal) gombpár.
  - **Jobb oldal:** Nézetváltó szegmentált vezérlő (`[ Összesítő | Klasszikus ]`), mellette az aktív könyvelési időszak badge és az időszakválasztó gomb.
- **Alsó sor — Dedikált Adatszűrő Sáv:**
  - Finom elválasztóval és enyhe háttérrel ellátott, áramvonalas szűrősáv:
    - `Szűrők:` címke diszkrét megjelenéssel.
    - **Dátum alap:** `[ Kibocsátás | Teljesítés ]` (PRD P-066 / P-103).
    - **Bizonylatok:** `[ Összes tétel | Csak lekönyvelt ]` (PRD P-067).
    - **Egyenleg:** `[ Összes | Csak forgalom ]` (0-egyenlegű, mozgás nélküli számlák kiszűrése).

### 2. Globális Fa Kibontás és Összecsukás ("Mind kinyitása" / "Mind összecsukása")
- A `GeneralLedgerTable` ref-jén keresztül expozícióra került az `expandAll()` és `collapseAll()` imperatív metódus.
- **Mind kinyitása:** Egyetlen kattintással az összes hierarchikus szint (1-es, 2-es, 3-as, 4-es számlaosztályok, alcsoportok és analitikák) kinyílik, így a könyvelő azonnal látja az összes alábontást, tételmozgást és egyenleget.
- **Mind összecsukása:** Visszaállítja a legfelső számlaosztály-szintű összesített nézetet, letisztult makroszintű képet adva a mérleg- és eredménykimutatási főcsoportokról.
- Gombok méretezése: Kompakt `h-8 px-2.5 text-xs`, hogy elegánsan illeszkedjenek a keresőmező mellé anélkül, hogy elnyomnák a felület többi funkcióját.

---

## 3. UI/UX Tesztelés és Stabilitás
- Automatizált unit tesztcsomag: `src/pages/__tests__/GeneralLedgerExpandToggle.test.tsx` ellenőrzi a gombok megjelenését, kattintási eseményeit és a mockolt táblázat hívásait.
- Reszponzív viselkedés: Mobilon és tableten a 2 sor rugalmasan alkalmazkodik, megszüntetve a vízszintes kilógást és gomb-átfedést.
