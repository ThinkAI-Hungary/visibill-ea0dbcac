# A-153: Főkönyvi Kivonat Kötegelt Tételes Adatbetöltés és Fastruktúra Renderelés

**Status:** Decided  
**Dátum:** 2026-09-24  
**Utoljára frissítve:** 2026-10-14  
**Érintett modulok:** `GeneralLedgerTable.tsx`, `GeneralLedgerPage.tsx`, `src/lib/glData.ts`, `src/components/general-ledger/__tests__/GeneralLedgerBatchLoading.test.tsx`  

---

## 1. Context & Technikai Kihívás

A Főkönyvi kivonatban a hierarchikus számlatükör fastruktúra mellett elérhetővé kellett tenni a teljes tételes analitikus megjelenítést (számlák, banki tranzakciók, kézi vegyes könyvelések).
Ha ezt számlánkénti on-demand lekérdezéssel oldanánk meg, több tucat vagy akár több száz egyedi PostgREST HTTP kérés indulna el párhuzamosan (N+1 lekérdezési anomália), ami hálózati torlódást, felesleges adatbázis terhelést és kliens-oldali fagyást eredményezne.

---

## 2. Decision

### 1. Reaktivált Batch Query Stratégia (`fetchAllGlCategorizedItems`)
- Amikor `viewGranularity === 'teteles'`, a `GeneralLedgerTable` komponens a TanStack React Query segítségével aktivál egyetlen kötegelt lekérdezést:
  - Cache kulcs: `['glCategorizedItems', presetId, companyId, dateFrom, dateTo, dateBasis, postingStatus]`
  - Végpont: `get_gl_categorized_items` PostgreSQL RPC (PostgREST 1000-es lapmérettel automatikusan lapozva).
  - Stale Time: 60 másodperc.
- Ha `viewGranularity === 'kontirok'`, a lekérdezés inaktív (`enabled: false`), így nulla felesleges hálózati forgalmat generál.

### 2. O(1) Fastruktúra Indexelés (`batchItemsByGL`)
- A betöltött tételeket a komponens egyetlen `Map<parentCid, LedgerItem[]>` struktúrába csoportosítja.
- A fastruktúra bejárása (`traverseTree`) a korábbi ciklusonkénti lekérdezés helyett ebből a memóriában lévő Map-ből azonnal, mikromásodpercek alatt illeszti be a tételeket az érintett számlák alá.
- Visszaváltáskor a `Kontírok` nézetre a felület azonnal visszaugrik, újra tételesre váltáskor pedig a cache miatt azonnal (0 ms) renderel.

### 3. N+1 Guard a Korábbi On-Demand Hookokon
- A korábbi `expandedRowIds.forEach` és `toggleRow` on-demand betöltési ágak explicit védelmet kaptak: `if (viewGranularity === 'teteles') return;`. Ez megakadályozza, hogy tételes módban bármilyen számlaszintű egyedi lekérdezés elinduljon.

### 4. Állapotmegőrzés (`savedKontirokExpandedRef`)
- A könyvelő által a `Kontírok` módban manuálisan beállított kinyitott/becsukott fa-állapotot egy `useRef` tárolja el a `Tételes` módba lépéskor.
- A `Kontírok` nézetre való visszaváltáskor a korábbi kibontási állapot automatikusan helyreáll.

### 5. Kontírok/Összesített Nézet: Re-render Kaszkádvédelem és Kötegelt Levelek Betöltése (`fetchBatchAccountItems`) (2026-10-14)
- **Háttér és Hiba:** A nem tételes (`kontirok` / aggregált) nézetben, amikor a felhasználó rákattintott az "Összes kinyitása" (Expand All) gombra vagy több hierarchikus ágat nyitott ki, a korábbi `useEffect` implementáció egy reaktív kaszkád-hurkot indított el.
  - A `useEffect` dependenciáiban szerepelt a `tableData`, a `loadedRawAccountItems` és a `fetchAccountItemsOnDemand`.
  - Amint egy számla lekérdezése elindult, a `loadingAccountCids` és `loadedRawAccountItems` állapotváltozások azonnali re-rendert váltottak ki, ami leállította a meglévő munkamenetet (`cancelled = true`), de az in-flight HTTP kéréseket nem szakította meg, és azonnal egy új effectet indított.
  - Ennek következtében 40 ms alatt akár 25–40 párhuzamos POST kérés zúdult a `/rest/v1/rpc/get_gl_categorized_items` végpontra, ami a PostgREST Warp szál-kezelőjét túlterhelte (`Warp server error: Thread killed by timeout manager`) és a PostgreSQL-ben statement timeoutot (`code: 57014`) okozott.
- **Megoldás:**
  1. **Referenciális izoláció (`loadedRawAccountItemsRef`):** A betöltött tételeket egy `useRef` követi, így a betöltési folyamat során bekövetkező állapotfrissítések nem indítják újra a betöltő `useEffect`-et.
  2. **Dependenciák megtisztítása:** A `tableData` és a `loadedRawAccountItems` kikerült a `useEffect` dependency listájából; a számlák tétel-érintettségét a stabil `dbData` vizsgálja (`Number(item_count) > 0`).
  3. **Kötegelt tétellekérés (`fetchBatchAccountItems`):** Ha egynél több számla nyílik ki (pl. "Összes kinyitása"), nem N darab külön lekérdezés fut le, hanem a `fetchGlItemsForAccounts` funkcióval a számlák azonosítóit egy `p_gl_account_ids: uuid[]` tömbben adjuk át a `get_gl_categorized_items` RPC-nek, legfeljebb 30-as chunkolással (egyetlen ~80ms-os hívásban).
  4. **Keresési találatok előtöltése:** A keresőmező (`searchResults`) általi tételkibontás szintén a kötegelt loaderre támaszkodik, elkerülve a párhuzamos lekérdezési lavinát.
  5. **Közös leképező segédfüggvény (`mapEnrichedItemToLedgerItem`):** DRY architektúra a tételadatok és pseudo CID-k transzformációjára.

---

## 3. Consequences

- **Pozitív:**
  - N+1 lekérdezési lavina megelőzése: tucatnyi kérés helyett 1 darab paginált RPC kérés fut le.
  - Villámgyors UI reakcióidő (0 ms memóriaindex-alapú fa feltöltés).
  - Kettős nézet: makroszintű kontírok és mikro-audit tételes lista azonnal váltható.
- **Negatív / Kockázat:**
  - Tízezres tételszám esetén nagyobb memóriaigény a kliensoldali Map indexeléshez (PostgREST chunking és React Query cache méret felügyeletet igényel).

---

## 4. Kapcsolódó
- [P-113: Főkönyvi Kivonat Kontírok vs. Tételes Nézetváltó UX](../../product/decisions/P-113-general-ledger-granularity-kontirok-teteles-view.md)
- [A-150: Főkönyvi Lekérdezés Teljesítmény és DOM/Layout Védelem](./A-150-gl-performance-resilience-and-layout-hardening.md)
- [A-087: GL Adatbázis Keresés és Számlapagináció](./A-087-gl-database-search-and-account-pagination.md)
