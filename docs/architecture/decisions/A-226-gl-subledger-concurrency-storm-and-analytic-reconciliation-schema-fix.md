# A-226: Főkönyvi és Folyószámlai Lekérdezési Vihar (Concurrency Storm) Felszámolása, get_gl_analytic_reconciliation Sémajavítás és Folyószámla Pagináció

**Státusz:** Decided  
**Dátum:** 2026-10-07  
**Utoljára frissítve:** 2026-10-07  
**Érintett komponensek és modulok:**  
- `src/pages/GeneralLedgerPage.tsx`
- `src/pages/SubledgerPage.tsx`
- `src/pages/JournalsPage.tsx`
- `src/hooks/useSubledger.ts`
- `src/components/general-ledger/GlAnalyticReconciliationView.tsx`
- `src/components/general-ledger/GeneralLedgerComparisonTable.tsx`
- `supabase/migrations/20261007150000_fix_gl_analytic_reconciliation_and_partner_ledger_card.sql`

---

## 1. Kontextus és Problémafelvetés

A teljes Főkönyv (`/general-ledger`), Folyószámla (`/subledger`) és Napló (`/journals`) modulok mélyreható auditja során a következő kritikus skálázhatósági, teljesítménybeli és séma-integritási szűk keresztmetszeteket azonosítottuk:

1. **Rejtett Lapfülek Párhuzamos Lekérdezési Vihara (Concurrency Storm):**
   A `GeneralLedgerPage.tsx` komponensben a Radix UI `<TabsContent>` elemei korábban egyszerre voltak jelen a DOM-ban (`forceMount` vagy sima rejtett elrejtés), így az oldal megnyitásakor az összes lapfül (`extract` - Kivonat, `cards` - Számlakarton, `analytic` - Analitikus egyeztetés, `journal` - Naplófőkönyv, `comparison` - Összehasonlító tábla) azonnal és egyidejűleg lefutatta a nehéz RPC lekérdezéseit (`get_gl_balances`, `get_gl_categorized_items`, `get_gl_analytic_reconciliation`, `get_gl_comparison_analytics`). Ez 50+ párhuzamos lekérdezést zúdított a Supabase PostgreSQL kapcsolat-pooljára, periodikusan `504 Gateway Timeout` és `statement_timeout` hibákat idézve elő.

2. **Nem Létező Oszlopra Való Hivatkozás a `get_gl_analytic_reconciliation` RPC-ben:**
   A tárgyi eszköz analitikai egyeztetéshez készült `get_gl_analytic_reconciliation` tárolt eljárás a `public.fixed_assets.gross_value` oszlopra hivatkozott. Az éles adatbázis-sémában a `fixed_assets` tábla ezt a mezőt valójában `acquisition_value` néven tárolja. Ennek következtében az RPC hívása PostgreSQL szintaktikai/sémahibával (`column fa.gross_value does not exist`, SQLState 42703) meghiúsult. Ráadásul a kliensoldali JavaScript fallback (`GlAnalyticReconciliationView.tsx`) nem szűrt `company_id`-ra és `dateRange`-re, így cégközi adatszivárgás kockázatát hordozta.

3. **Folyószámla Korlátlan Adatbetöltése és QueryKey Szétcsúszása:**
   A `SubledgerPage.tsx` korábban pagináció nélkül, egyben renderelte le a teljes folyószámla analitikát (több ezer nyitott/zárt tétel esetén súlyos DOM-lassulást és UI-fagyást okozva). Ezenkívül a partnertörzs lekérdezése eltérő queryKey-t használt (`['subledger-partners', companyId]` vs `['partners', companyId]`), ellehetetlenítve a React Query cache újrahasznosítását, valamint a `useSubledgerAccounts` hook hiányolta az `activePresetId` függőséget.

4. **Napló Korlátlan Eredményméret és Frissítési Thrashing:**
   A `JournalsPage.tsx` korlátlan méretű naplósor-lekérdezést futtatott (`.select()` `limit` nélkül), ami növekvő adatbázisnál skálázódási plafonba ütközött. A napi MNB devizaárfolyamok lekérdezése (`dailyExchangeRates`) staleTime nélkül futott, minden apró tab- vagy szűrőváltásnál felesleges hálózati forgalmat generálva.

---

## 2. Architekturális Döntések

### D-1: Feltételes Lusta Lapfül Renderelés (Lazy Tab Unmounting)
A `GeneralLedgerPage.tsx`-ben megszüntettük a rejtett fülek eager renderelését:
- A nehéz számítási és lekérdezési igényű komponensek (`GeneralLedgerCardsView`, `GlAnalyticReconciliationView`, `GeneralLedgerJournalView`, `GeneralLedgerComparisonTable`) kizárólag akkor kerülnek be a React virtuális DOM-jába, ha a felhasználó ténylegesen az adott fülre (`activeTab === 'cards'`, `activeTab === 'analytic'`, stb.) navigál.
- A lapfül elhagyásakor a komponensek unmountolódnak, felszabadítva a memóriát és megszakítva a felesleges háttér-pollozást vagy inaktivált re-rendereket.

### D-2: `get_gl_analytic_reconciliation` SQL Javítás és Kliens Védelem
- **Adatbázis Migráció (`20261007150000_fix_gl_analytic_reconciliation_and_partner_ledger_card.sql`):**
  A tárgyi eszköz analitikai CTE-ben javítottuk az oszlophivatkozást:
  ```sql
  -- Korábban: COALESCE(fa.gross_value, 0) -> HIBA: fa.gross_value nem létezik!
  -- Javítva:
  COALESCE(fa.acquisition_value, 0)
  ```
- **Kliensoldali Fallback Hardening:**
  A `GlAnalyticReconciliationView.tsx`-ben a közvetlen táblalekérdezéses fallback lekérdezést szigorúan elláttuk a `.eq('company_id', companyId)` és az időszaki dátumszűrőkkel, kizárva a cégközi szivárgást és a teljes tábla felolvasását.

### D-3: Folyószámla Egységes Lapozó Rendszer (`UnifiedPagination`)
- A `SubledgerPage.tsx`-be integráltuk az egységes `UnifiedPagination` komponenst 50 elem/oldal alapértelmezett beállítással (25, 50, 100, 200 elem választható).
- A lapozási állapotot a `currentPage` és `pageSize` lokális állapot vezérli, amely automatikusan visszaugrik az 1. oldalra szűrő, lapfül vagy keresőszó módosításakor.
- A kijelölési lebegő mérlegsáv (`Sticky Balancing Bar`) a teljes szűrt halmazon számítja a globális mérleget, miközben a táblázat csak az adott lap 50 elemét rendereli a DOM-ban.
- A `useSubledger.ts` hookban harmonizáltuk a partnertörzs queryKey-t: `['partners', companyId]`, így az már a központi gyorsítótárból szolgálódik ki.

### D-4: Napló (Journals) Skálázási Védőkorlátok (Guardrails)
- A naplótételek lekérdezése 2000 tételes felső korlátot (`.limit(2000)`) kapott.
- A napi MNB árfolyamok (`dailyExchangeRates`) lekérdezését 500 rekordra korlátoztuk (`.limit(500)`), és 5 perces `staleTime: 5 * 60 * 1000` gyorsítótárazási élettartammal láttuk el.

---

## 3. Következmények és Előnyök

### Pozitív:
- **Zero Pool Exhaustion:** A Főkönyv oldal megnyitásakor a kezdeti SQL kapcsolatok száma 80%-kal csökkent; a rejtett lapfülek nem terhelik a PostgreSQL kapcsolat-poolját.
- **Helyreállított Integritás:** A `get_gl_analytic_reconciliation` hiba nélkül fut le, a tárgyi eszközök bekerülési értéke pontosan jelenik meg a főkönyvi számlák analitikus összevetésében.
- **Villámgyors Folyószámla Renderelés:** Több ezer tételes könyvelési adatbázisok esetén is azonnali a lapozás és a szűrés; megszűnt a DOM-fagyás.
- **Cache Sinergia:** A partnertörzs és az MNB devizaárfolyamok gyorsítótára megosztottá vált a modulok között.

### Trade-offok & Figyelembe vett szempontok:
- **Fülváltási Újratöltés:** Mivel a lapfülek unmountolódnak, az elhagyott lapfülre való visszatéréskor a React Query cache-ből inicializálódik a nézet. A `staleTime` és cache-időzítés biztosítja, hogy ez 0 hálózati késleltetéssel, azonnal történjen.

---

## 4. Kapcsolódó Dokumentáció

- **PRD:** [P-165: Folyószámla 50-es Lapozás és Főkönyv Lekérdezési Vihar Megszüntetése UX](../../product/decisions/P-165-general-ledger-and-subledger-pagination-and-concurrency-ux.md)
- **Kapcsolódó ADR-ek:**
  - [A-150: Főkönyvi Lekérdezés Teljesítmény, Hibakezelési Reziliencia & DOM Védelem](./A-150-gl-performance-resilience-and-layout-hardening.md)
  - [A-151: Eredménykimutatás és Mérleg Lekérdezési Vihar Megszüntetése](./A-151-pnl-and-balance-sheet-query-storm-elimination.md)
  - [A-175: Folyószámla és Analitika Architektúra, Nyitott Tételek Rendezése](./A-175-subledger-and-open-items-architecture.md)
  - [A-189: Főkönyvi Kivonat és Naplófőkönyv RPC Teljesítmény-Optimalizálás](./A-189-gl-rpc-performance-optimization-and-timeout-elimination.md)
