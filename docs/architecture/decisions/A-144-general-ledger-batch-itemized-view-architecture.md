# A-144: Főkönyvi Kivonat Kötegelt Tételes Adatbetöltés és Fastruktúra Renderelés

**Státusz:** Elfogadva  
**Dátum:** 2026-09-24  
**Érintett modulok:** `GeneralLedgerTable.tsx`, `GeneralLedgerPage.tsx`, `src/lib/glData.ts`  

---

## 1. Kontextus és Technikai Kihívás
A Főkönyvi kivonatban a hierarchikus számlatükör fastruktúra mellett elérhetővé kellett tenni a teljes tételes analitikus megjelenítést (számlák, banki tranzakciók, kézi vegyes könyvelések).
Ha ezt számlánkénti on-demand lekérdezéssel oldanánk meg, több tucat vagy akár több száz egyedi PostgREST HTTP kérés indulna el párhuzamosan (N+1 lekérdezési anomália), ami hálózati torlódást, felesleges adatbázis terhelést és kliens-oldali fagyást eredményezne.

---

## 2. Architektúra Döntés

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

---

## 3. Minőségbiztosítás és Eredmények
- **Build:** Sikeres (`vite build` 0 hibával).
- **Unit tesztek:** `GeneralLedgerGranularityToggle.test.tsx` és `GeneralLedgerExpandToggle.test.tsx` sikeresen lefutottak.
- **Böngészős Smoke teszt:** Automatikus browser subagent ellenőrizte a váltást, az URL szinkronizációt (`?granularity=teteles`), az elemek megjelenését és a hibamentes visszacsukást.
