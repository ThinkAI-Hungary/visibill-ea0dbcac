# P-113: Főkönyvi Kivonat Kontírok vs. Tételes Nézetváltó UX

**Status:** Decided  
**Dátum:** 2026-09-24  
**Utoljára frissítve:** 2026-09-25  
**Kategória:** UI / Főkönyv & Riportok  
**Érintett modulok:** Főkönyvi kivonat (`GeneralLedgerPage.tsx`), Számlatükör fastruktúra és tételes táblázat (`GeneralLedgerTable.tsx`)  

---

## 1. Kontextus és Problémafelvetés
A könyvelők napi munkájuk során két eltérő absztrakciós szinten dolgoznak a főkönyvvel:
1. **Kontírok (Összevont nézet):** Számlaszintű makró áttekintés, mérleg- és eredménykimutatási számlacsoportok forgalmának és egyenlegeinek gyors vizsgálata anélkül, hogy a több ezer egyedi bizonylatsor túlterhelné a képernyőt.
2. **Tételes (Analitikus nézet):** Mélyreható auditálás és ellenőrzés, ahol minden egyes főkönyvi szám alatt azonnal látni kell a mögöttes gazdasági eseményeket (vevői/szállítói számlák, banki kivonatok, vegyes bizonylatok tételei).

Korábban a főkönyvi kivonatban a tételek kizárólag egyesével, az adott analitikus számlára manuálisan kattintva voltak lenyithatók. Ha a könyvelő a teljes időszak összes tételét át akarta tekinteni, tucatnyi számlát kellett külön-külön megnyitnia.

---

## 2. Termékdöntés és Megoldás

### 1. Kétszintű Eszköztárba Integrált Nézetváltó
A felső eszköztársorban (Tier 1), a meglévő elrendezésváltó (`[ Összesítő | Klasszikus ]`) mellett elhelyezésre került egy új szegmentált kapcsoló:
- **`[ Kontírok | Tételes ]`**
  - **Kontírok (Alapértelmezett):** Megőrzi a villámgyors betöltést és a tiszta számlatükör fastruktúrát.
  - **Tételes:** Egyetlen kattintással az összes aktív számlaosztály és kontír kinyílik, és a tételek (dátummal, partnerrel, bizonylattípussal, státuszjelvénnyel és egyenleggel) közvetlenül a megfelelő kontír alá behúzva jelennek meg.

### 2. Szigorú Alapértelmezés (Nem Tételes)
A felhasználói követelményeknek megfelelően az alapértelmezett állapot mindig a **Kontírok** nézet marad minden oldalbetöltéskor és céglátogatáskor, biztosítva a minimális kezdeti hálózati adatforgalmat és a letisztult áttekintést.

### 3. URL Mélylinkelés és Állapotmegőrzés
- A nézet szinkronizálva van a böngésző URL-jével: `?granularity=teteles` (kontírok esetén tiszta marad az URL).
- A felhasználó kontírok nézetbeli egyedi fa-kibontási állapota megőrződik, így a Tételes mód be- és kikapcsolása után pontosan a korábban megnyitott számlák állapota áll vissza.

---

## 3. Minőségbiztosítás és Verifikáció
- Unit teszt: `src/components/general-ledger/__tests__/GeneralLedgerGranularityToggle.test.tsx`
- Teljesítmény: Tételes módban egyetlen kötegelt RPC hívás fut le (`fetchAllGlCategorizedItems`), megszüntetve az N+1 lekérdezési kockázatot.

---

## 4. Kapcsolódó
- [A-153: Főkönyvi Kivonat Kötegelt Tételes Adatbetöltés és Fastruktúra Renderelés](../../architecture/decisions/A-153-general-ledger-batch-itemized-view-architecture.md)
- [P-105: Főkönyvi Kivonat 2-Tier Eszköztár és Fastruktúra Kibontás/Összecsukás UX](./P-105-general-ledger-toolbar-and-expand-collapse-ux.md)
- [P-068: Főkönyvi Gyorskeresés és Pagináció UX](./P-068-gl-search-and-comparison-pagination-ux.md)
