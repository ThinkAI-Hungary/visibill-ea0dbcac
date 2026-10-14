# Decision 073: Főkönyvi Nyitó Egyenlegek Folytonossága, Virtuális Bankszámlák és Egydevizás Házipénztár Szabályzat

**Status:** Decided  
**Category:** Accounting Policy / General Ledger / Petty Cash / Virtual Banking  
**Date:** 2026-10-15  

---

## Question
Milyen üzleti, számviteli és szabályozási elvek határozzák meg:
1. Az 1-4. mérlegszámlák nyitó egyenlegeinek évközi átgördítését (rollforward) a főkönyvi kivonatokban?
2. A virtuális pénzforgalmi számlák (pl. Szallas.hu, szállásközvetítői és közvetítői virtuális bankok) kezelését és a belföldi GIRO bankszámla ellenőrzőösszeg alóli mentesítését?
3. A házipénztárak devizanem-hozzárendelésének szigorú korlátozását (egy pénztár = pontosan egyetlen devizanem)?

---

## Decision

### 1. Főkönyvi Nyitó Egyenlegek Évközi Folytonossága (Sztv. 15. § (4))
* **Folytonosság elve:** A Számviteli Törvény (Sztv.) 15. § (4) bekezdésében rögzített folytonosság elve megköveteli, hogy a mérlegszámlák (1. Befektetett eszközök, 2. Készletek, 3. Követelések és pénzeszközök, 4. Források) nyitó egyenlege az üzleti év teljes tartama alatt képezze a beszámolási időszakok kezdő egyenlegének bázisát.
* **Évközi átgördítés (Rollforward):**
  * Ha egy cég rögzítette a nyitó egyenlegeket (jellemzően az üzleti év első napjára, pl. `2026-01-01`), akkor bármely évközi időszakra (pl. 2026. október havi kivonat) lekért főkönyvi kivonatban a nyitó tételeknek kötelezően szerepelniük kell a nyitó/kezdő egyenlegben.
  * Tilos a nyitó egyenlegeket csak a nyitás napját tartalmazó szűrési periódusban megjeleníteni.
  * Az 5-9. eredményszámlák (Költségnemek, Ráfordítások, Bevételek) nem rendelkeznek nyitó egyenleggel; azok az üzleti év elején 0 egyenleggel indulnak.

### 2. Virtuális Pénzforgalmi Számlák (Szallas.hu, Közvetítők, Letéti Számlák)
* **Pénzeszköz-analitika:** A közvetítői és online platformok (Szallas.hu, Stripe, Barion, futár utánvét beszedések, SZÉP-kártya elszámolások) által kezelt egyenlegek és tranzakciók funkcionálisan bankszámlaként, technikai pénzeszközként viselkednek a könyvvezetésben (384/385/389 technikai számlák).
* **GIRO checksum validáció mentesítés:**
  * Mivel a virtuális banki egyenlegek nem rendelkeznek hagyományos 16 vagy 24 jegyű belföldi MNB/GIRO bankszámlaszámmal, a rendszerben mentesülnek a magyar bankszámlaszám-ellenőrző algoritmus alól (`is_virtual_bank = true`).
  * A könyvelő szabadon megadhatja a platform azonosítóját vagy technikai számlakódját (pl. `SZALLAS-HU-01`).
* **Multi-company izoláció:** A virtuális bankszámlák szigorúan az adott céghez kötöttek, az RLS és multi-tenant szabályok alól nem képeznek kivételt.

### 3. Házipénztárak Szigorú Egyetlen Devizaneme (Single Currency Cash Policy)
* **Valutapénztár izoláció:** A házipénztári bizonylatkezelés és készpénzkezelési szabályzat megköveteli, hogy egy adott fizikai vagy analitikus kassza csak egyféle devizanemben vezessen nyilvántartást.
* **Többes deviza kizárása:**
  * Pénztár létrehozásakor vagy módosításakor tilos a multiselect devizaválasztás engedélyezése.
  * A felhasználó exkluzív rádiógombbal választhatja ki az egyetlen törvényes devizanemet (HUF, EUR, USD, stb.).
  * Amennyiben a vállalkozás több devizában kezel készpénzt, különálló valutapénztárakat (pl. „EUR Házipénztár”, „HUF Főpénztár”) köteles nyitni, ezzel garantálva az árfolyam-különbözetek tiszta elszámolhatóságát és a kasszahiány/többlet vizsgálhatóságát.

---

## Rationale
* Az évközi nyitó hiányok megtévesztették a könyvelőket, mivel az októberi főkönyvi kivonatban a banki és vevői-szállítói egyenlegek nem mutatták az év eleji induló állományt. Az automatikus év eleji rollforward helyreállítja a számviteli törvény szerinti valós összképet.
* A Szallas.hu és más aggregátorok napi gyakorlatban bankként funkcionálnak a vendéglátásban és szállásadásban; a GIRO kényszer gátolta a felvitelüket.
* A többdevizás házipénztár analitikai hibaforrás, mert az árfolyam-ingadozások és kerekítések a fizikai kassza rovására torzították volna az egyenleget.

---

## Kapcsolódó
* **ADR:** [A-258: Főkönyvi Nyitó Átgördítés, Virtuális Bankszámlák és Utalások Deduplikáció](../../architecture/decisions/A-258-gl-opening-balances-rollforward-and-transfers-dedup-integrity.md)
* **PRD:** [P-189: Pénztárak Egyetlen Devizaneme, Szallas.hu Virtuális Bank, Főkönyvi Default Nézet](../../product/decisions/P-189-eaisybooks-gl-defaults-petty-cash-currency-and-virtual-bank-ux.md)
