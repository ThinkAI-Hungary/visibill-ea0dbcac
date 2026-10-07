# P-165: Folyószámla 50-es Lapozás (UnifiedPagination) és Főkönyv Lekérdezési Vihar Megszüntetése UX

**Státusz:** Decided  
**Dátum:** 2026-10-07  
**Kategória:** UI / Performance / Navigation / Table UX  
**Érintett képernyők és komponensek:**  
- `src/pages/GeneralLedgerPage.tsx`
- `src/pages/SubledgerPage.tsx`
- `src/pages/JournalsPage.tsx`
- `src/components/common/UnifiedPagination.tsx`

---

## 1. Felhasználói Igény és Problémafelvetés

A könyvelői audit és tesztelési visszajelzések alapján a következő felhasználói élményt (UX) romboló problémák jelentkeztek:

1. **Oldalbetöltési Fagyás a Főkönyv Megnyitásakor:**
   Amikor a könyvelő rákattintott a „Főkönyv” menüpontra, a böngésző felülete több másodpercre megdermedt, mivel az összes lapfül (Kivonat, Karton, Analitikus egyeztetés, Naplófőkönyv, Összehasonlító tábla) háttérben futó párhuzamos lekérdezései és DOM-összeállításai blokkolták a böngésző UI threadjét.
2. **Görgetési Lassulás és Átláthatatlanság a Folyószámlán:**
   A Folyószámla (`/subledger`) oldalon a korábbi megoldás egyszerre jelenítette meg az összes nyitott és zárt tételt. Egy több száz vagy több ezer tétellel rendelkező cég esetében ez a görgetést akadozóvá tette, és megnehezítette a navigációt.
3. **Hiányzó Lapméret Választó:**
   A felhasználók igényelték, hogy a folyószámla tételeit a rendszerszintű szabványoknak megfelelően (mint a Számlák vagy Bizonylatok oldalon) lehessen lapozni, és igény esetén növelni lehessen a megjelenített sorok számát (25 / 50 / 100 / 200).

---

## 2. Megvalósított Felületi Élmény (UX) és Döntések

### 2.1 Főkönyvi Lusta Lapfül-Navigáció
- **Azonnali Oldalbetöltés:** A Főkönyv főoldalára érkezve kizárólag az éppen aktív fül (alapértelmezetten a „Kivonat”) renderelődik és tölti be adatait.
- **Folyamatos Lapfül-Átmenet:** Lapfül-váltáskor a célfelület azonnal reagál, tiszta skeleton állapotot mutat az adatbetöltés idejére, kiküszöbölve a korábbi 2-3 másodperces felületfagyást.

### 2.2 Folyószámla `UnifiedPagination` Integráció
- **50 Elem/Oldal Alapértelmezés:** A `SubledgerPage.tsx` táblázata a szabványos `UnifiedPagination` vezérlővel bővült az alsó sávban, 50 tétel/oldal alapértelmezett lapmérettel.
- **Rugalmas Lapméret-választó:** A könyvelő a láblécben szabadon válthat 25, 50, 100 és 200 tétel közötti nézetre.
- **Intelligens Oldal-visszaállítás (Auto Reset):**
  - Bármilyen szűrő (főkönyvi szám, partner, könyvelési státusz), lapfülváltás (Nyitott / Zárt / Teljes), vagy keresőszó begépelése esetén a lapozó automatikusan visszaugrik az 1. oldalra, elkerülve az üres képernyőt.
- **Lebegő Mérlegsáv Sinergia:** A képernyő alján lebegő mérlegsáv (`∑T`, `∑K` és differencia) a kijelölések függvényében továbbra is azonnal és pontosan kalkulál, a tételpárosítás zökkenőmentes marad.

### 2.3 Napló (Journals) Finomhangolás
- A könyvelési naplók oldalán a korábban tapasztalt felső vezérlősáv stabilitását megőrizve az adatok betöltése 2000 tételre korlátozódott, az MNB napi devizaárfolyamok pedig 5 perces gyorsítótárból szolgálódnak ki, így a naplók közötti váltás azonnali, flicker-mentes élményt nyújt.

---

## 3. Kapcsolódó Dokumentáció

- **ADR:** [A-226: Főkönyvi és Folyószámlai Lekérdezési Vihar Felszámolása, get_gl_analytic_reconciliation Sémajavítás és Folyószámla Pagináció](../../architecture/decisions/A-226-gl-subledger-concurrency-storm-and-analytic-reconciliation-schema-fix.md)
- **Kapcsolódó PRD-k:**
  - [P-136: Folyószámla és Analitika Kezelőfelület, Különbözet-Rendezés és Nyomtatási Kimutatások UX](./P-136-subledger-and-open-items-ux.md)
  - [P-068: Főkönyvi Gyorskeresés, Összehasonlító Táblázat Pagináció és Felületi Ergonómia UX](./P-068-gl-search-and-comparison-pagination-ux.md)
  - [P-122: Főkönyv Felhasználói Élmény (UX), Letisztult Könyvelői Ergonómia](./P-122-general-ledger-ui-ux-restructuring-and-clutter-reduction.md)
