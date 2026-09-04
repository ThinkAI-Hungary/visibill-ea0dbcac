# P-068: Főkönyvi Gyorskeresés, Összehasonlító Táblázat Pagináció és Felületi Ergonómia UX

**Status:** Decided  
**Date:** 2026-09-04  
**Utoljára frissítve:** 2026-09-04  
**Category:** General Ledger / Search / Table UX / Pagination / Terminology  
**Érintett felületek:** [GeneralLedgerPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/GeneralLedgerPage.tsx), [GeneralLedgerTable.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx), [GeneralLedgerComparisonTable.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerComparisonTable.tsx), [JournalView.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx), [GlSearchAutocomplete.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GlSearchAutocomplete.tsx), [unified-pagination.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ui/unified-pagination.tsx)  

---

## Context

A Főkönyv modul három különböző nézetet kínál a könyvelők számára:
1. **Főkönyvi kivonat (Karton fa / Hierarchikus nézet):** Számlaosztályok, főkönyvi számlák és alájuk besorolt tételek hierarchikus fája.
2. **Naplófőkönyv (Idősoros tételek):** Bizonylatok időrendi listája.
3. **Összehasonlítás (Tárgyév vs. Előző év):** Számlaszámok egyenlegeinek évenkénti összevetése.

A napi könyvelői munka során több ergonómiai, navigációs és megjelenítési probléma merült fel:
- **Keresés korlátai:** A felhasználóknak gyorsan meg kell találniuk konkrét partnereket, számlaszámokat vagy összegeket anélkül, hogy végig kellene kattintaniuk a többszintes számlatükör fát. A kliens-oldali szűrés korábban csak a már lenyitott faágakban működött, és 1000 tétel felett nem adott találatot.
- **Inkonzisztens Összehasonlítás Nézet:** Míg a Naplófőkönyv nézet gazdag eszköztárral (keresés, szűrés, lapozás, Excel export, statisztikai összegző sáv) rendelkezett, addig az Összehasonlítás fül egy csupasz, lapozatlan, több száz sort egyszerre renderelő HTML táblázat volt, ahol a felhasználónak kézzel kellett görgetnie az eltérések megkereséséhez.
- **Zavaró Technikai Terminológia:** A Naplófőkönyv nézetben a belső adatbázis táblanevek jelentek meg forrásként (`invoices`, `journal_entries`, `bank_transactions`, `xml_audit_records`), és az osztályozatlan tételeknél az angol `UNCLASSIFIED` kulcsszó szerepelt.
- **Disruptív Lapozási Ugrás (Auto-scroll to top):** Amikor a felhasználó lapozott egy táblázatban, a `UnifiedPagination` komponensbe épített `useEffect` automatikusan a képernyő legtetejére görgette a felhasználót, megszakítva a vizuális fókuszt és kényszerítve a visszagörgetést.
- **Title tagek hiányosságai:** A böngésző natív buborékjai késve, szürke dobozban jelentek meg, és nem feleltek meg a Visibill prémium dizájnjának.

---

## Decision

### 1. Főkönyvi Globális Kereső Autocomplete (`GlSearchAutocomplete`)
A Főkönyvi kivonat fejlécében bevezetésre került egy valós idejű, debounced keresősáv:
- **Keresési mező:** Bemenet számlaszámra, számla nevére, partner nevére, bizonylatszámra és összegre.
- **Megjelenítés:**
  - Kétféle entitást különböztet meg vizuálisan badge-dzsel: `Főkönyvi számla` (kék) és `Tétel` (zöld).
  - Megjeleníti a bizonylat kibocsátóját/partnerét, a megjegyzést, a kapcsolódó főkönyvi számot és a formázott összeget (`HUF`).
- **Billentyűzet Navigáció:** Teljes akadálymentesség: Fel/Le nyilakkal navigálható az eredménylista, `Enter`-re kijelöl és navigál, `Escape`-re bezár.
- **Intelligens Fa-Navigáció (`handleNavigateToEntity`):**
  - Számlára kattintva azonnal legörget a számlához és kék pulzáló kerettel kiemeli.
  - Tételre kattintva automatikusan lenyitja a szülő főkönyvi számlát, szükség esetén beilleszti a tételt a betöltött listába, a sorra görget (`scrollIntoView`) és 2.5 másodpercig sárga/kiemelő háttérrel fókuszba helyezi.

### 2. Összehasonlító Tábla Újratervezése és Paginációja (`GeneralLedgerComparisonTable`)
Az Összehasonlítás nézetet a Naplófőkönyv standardjához igazítottuk:
- **Gyorskereső Mező:** Számlaszám és megnevezés szerinti azonnali keresés törlés (`X`) gombbal.
- **Eltérés Szűrő Választó (Diff Filter):**
  - `Összes számla`
  - `Csak eltérések` (ahol a tárgyévi és előző évi egyenleg különbözik)
  - `Csak növekedés` (pozitív differencia)
  - `Csak csökkenés` (negatív differencia)
- **Statisztikai Összegző Sáv:** Megjeleníti a szűrt számlák darabszámát, a tárgyévi összesített egyenleget, az előző évi egyenleget és a nettó eltérést.
- **Excel Export:** Közvetlen XLSX export gomb (`exportToFile`) időbélyeggel ellátott fájlnévvel (`Fokonyvi_osszehasonlitas_YYYYMMDD_HHMM.xlsx`).
- **Pagináció (`UnifiedPagination`):** Választható lapméret (25, 50, 100, 200 sor/oldal), lapozó gombokkal és elemszám kijelzéssel.
- **Terminológia:** A 0 vagy hiányzó számlaszámú tételeknél a tiszta **"Besorolatlan"** felirat jelenik meg.

### 3. Naplófőkönyv Terminológia és Finom Tipográfia (`JournalView`)
- **Típusnév leképezés:** A belső adatbázis táblaneveket magyar nyelvű, érthető elnevezésekre cseréltük:
  - `invoices` → `Számla`
  - `journal_entries` → `Naplótétel`
  - `nav_invoice_items` → `NAV Számla`
  - `bank_transactions` → `Banki tranzakció`
  - `xml_audit_records` → `XML Naplótétel`
- **Tipográfiai Stílus:** A felhasználó kérésének megfelelően a típusok és számlaszámok **nem kaptak vaskos badge kereteket**, hanem megtartották az eredeti, letisztult szövegformázást:
  - Főkönyvi szám: `font-mono bg-muted/60 text-foreground px-2 py-0.5 rounded text-xs`
  - Forrás típus: `bg-primary/5 text-primary/70 font-mono text-xs px-2 py-0.5 rounded`
- **"Besorolatlan" címke:** Az angol `UNCLASSIFIED` helyett egységesen a magyar "Besorolatlan" szöveg jelenik meg.

### 4. Paginációs Ugrálás Megszüntetése (`UnifiedPagination`)
- A `src/components/ui/unified-pagination.tsx` komponensből eltávolítottuk az agresszív `useEffect` scroll hívást (`element.scrollTo({ top: 0, behavior: 'smooth' })`).
- A táblázatban lapozó felhasználó pozíciója így stabil marad, nem ugrik el a látómező a táblázat fejlécéből vagy a kijelölt sorból.

### 5. CustomTooltip Alkalmazása
- A Főkönyv és az Audit XML import dialógusokban minden natív HTML `title` attribútumot felváltott a `CustomTooltip` komponens.
- Gyors, elegáns sötét/világos buborékok biztosítják a súgószövegek olvashatóságát.

---

## Consequences

### Pozitív
- **Professzionális Könyvelői Ergonómia:** A könyvelő a keresővel másodpercek alatt megtalálja a bizonylatokat a hierarchiában, anélkül hogy elveszítené az összefüggéseket.
- **Konzisztens Felületi Élmény:** Mind a Naplófőkönyv, mind az Összehasonlítás nézet ugyanazt a robusztus, szűrhető, exportálható és paginált táblázatos felületet nyújtja.
- **Nyugodt Lapozás:** Nincs többé nem kért oldal tetejére ugrás a táblázatokban.
- **Magyar Szakmai Terminológia:** Eltűntek a technikai kódok és idegen szavak (`UNCLASSIFIED`, táblanevek).

### Negatív / Kötöttségek
- Kliens-oldali paginációnál az Összehasonlítás lapon a teljes éves egyenleglista letöltődik a memóriába; ez a számlatükör jellegéből adódóan (maximum néhány száz számlaszám) minimális memóriaterhelést jelent.

---

## Kapcsolódó
- **BRD:** [050: Főkönyvi Könyvelési Státusz és Naplózási Kormányzás](../../business/decisions/050-gl-posting-status-and-journal-governance.md)
- **BRD:** [031: eaisyBooks Modul Scope](../../business/decisions/031-accounty-module.md)
- **ADR:** [A-087: Főkönyvi Adatbázis-alapú Keresés, Számla-szintű Lapozás és Tooltip Architektúra](../../architecture/decisions/A-087-gl-database-search-and-account-pagination.md)
- **ADR:** [A-086: Főkönyvi Könyvelési Státusz Szűrő és Naplózási Irányelvek](../../architecture/decisions/A-086-gl-posting-status-filter-and-journal-governance.md)
- **Design:** [11: Adatmegjelenítés & Táblázatok](../../design/11-data-display-tables.md)
