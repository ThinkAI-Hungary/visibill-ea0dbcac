# A-077: Management Stats Edge Function & Telemetry Decomposition

> **Státusz:** ✅ Decided  
> **Dátum:** 2026-09-01  
> **Érintett komponensek:** `supabase/functions/management-stats/`, `src/features/management/components/worker/`, `src/features/management/hooks/`  
> **Kapcsolódó PRD:** [P-061](../../product/decisions/P-061-management-worker-telemetry-and-monthly-llm-ux.md)  
> **Kapcsolódó ADR-ek:** [A-005](./A-005-edge-functions.md), [A-019](./A-019-management-dashboard.md), [A-046](./A-046-llm-cost-aggregation-server-side-rpc.md), [A-061](./A-061-decompose-management-dashboard.md)

---

## 1. Context

A Visibill és eaisybill adminisztrációs és operátori vezérlőközpontjának gerincét két óriásmonolit alkotta:
1. `supabase/functions/management-stats/index.ts` (3,947 sor): A teljes Edge Function backend egyetlen gigantikus fájlban kezelte a többprojektes hitelesítést (PROD, VSWEB, THINKERMAN), az összes PostgREST lekérdezést, a statisztikai aggregációkat, a hibakezelést és újraküldést (PGMQ migrációval), a jogosultságkezelést és a fájlműveleteket.
2. `src/features/management/components/worker/WorkerPanel.tsx` (1,579 sor): A worker telemetria frontend oldala egyetlen fájlban tartott 18 lokális és URL állapotot, TanStack Query 5s pollingot, konténer CPU/RAM mérőket, sor-szintű queue figyelést, hibatáblázatot és bulk retry modált.

**Problémák a refaktorálás előtt:**
- A 3,947 soros Deno Edge Function átláthatatlan volt, a hibajavítások vagy bővítések során magas volt a regresszió kockázata.
- A frontend és backend közötti felelősségmegoszlás elmosódott: az 1,579 soros React komponensben az adatformázás, az állapotkezelés és a renderelési logika szorosan összefonódott.
- A Deno és React kódbázis tesztelése és karbantarthatósága megnehezült a nagy kognitív terhelés miatt.

---

## 2. Decision

A feature planning (P-077) és az architektúra audit során jóváhagyott döntési mátrix alapján végrehajtottuk a teljes backend és frontend telemetria dekomponálását.

### A. Backend Edge Function Moduláris Architektúra (`supabase/functions/management-stats/`)

Megtartottuk az egységes Edge Function végpontot (`index.ts`), de a funkciókat domén-specifikus almodulokba szerveztük:

- **`types.ts`**: Közös DTO típusok, domain modellek és determinisztikus üres válasz-objektumok (`emptyOverview`, `emptyCompanyDetail`, `emptyErrors`, `emptyFiles`, `emptyWorkerStatus`, `emptyLLMCosts`, `emptyForAction`).
- **`middleware/auth.ts`**: Centralizált CORS kezelés, JSON válaszkészítő, REST-alapú JWT token validáció, biztonságos `serviceFetch` wrapper (amely garantálja, hogy a management role PostgREST hívások mindig `service_role` hitelesítéssel futnak le), és `authenticateRequester` middleware.
- **`utils/multiProject.ts`**: Többprojektes Supabase kliensgyár (PROD, VSWEB, THINKERMAN kliensek dinamikus inicializálása környezeti változókból).
- **`utils/common.ts`**: Segédfüggvények (`roleLabel`, `startOfMonthIso`, `isCompletedMessage`, `listAllAuthUsers`, `sortLlmRows`).
- **Domain Handlerek (`handlers/`)**:
  - `overviewHandler.ts`: `buildOverview`, `buildCompanyDetail`, `buildUserDetail`, `fetchMultiProjectMonthlyLlm`.
  - `llmCostsHandler.ts`: `buildLLMCosts` (cross-project LLM költség aggregáció, KPI-k, napi trendek).
  - `errorsHandler.ts`: `buildErrors`, `deleteErrors`, `deleteAllErrors`, `retryErrors`, `buildQueuePayload`, `migrateRowToTable`.
  - `permissionsHandler.ts`: `buildUserPermissions`, `updatePermissions`, `deleteUser` (soft-delete & anonymization).
  - `filesHandler.ts`: `buildFiles`, `updateFileStatus`, `deleteFiles`, `parseStorageUrl`.
  - `superadminHandler.ts`: `buildSuperadminData` (15+ modul lapozható adata).
  - `workerHandler.ts`: `buildWorkerStatus`, `getActiveErrors`.
- **`index.ts` (Router Facade)**: Egy letisztult (~90 soros) delegáló router, amely autentikálja a kérést, majd a megfelelő handlerhez irányítja azt.

### B. Frontend Worker Telemetria Dekomponálása (`src/features/management/`)

- **`hooks/useWorkerTelemetry.ts`**: Dedikált egyedi hook, amely összefogja a keresési paraméterek (URL search params) szinkronizálását, a TanStack Query 5s pollingot, a szűréseket, az aggregált állapotokat és az újraküldési (retry) munkafolyamatokat.
- **Presenter Komponensek (`components/worker/`)**:
  - `ContainerMetricsCard.tsx`: Konténer fejléc, üzemidő, verzió, host IP, és valós idejű CPU / RAM terheltségi sávok.
  - `QueueMonitorGrid.tsx`: Queue listák és globális/inline várakozási részletek (peek adatokkal és forrás-jelvényekkel).
  - `PipelineStatusList.tsx`: Pipeline teljesítménytáblázat, 7 napos sparkline diagramokkal és átlagos futásidőkkel.
  - `TaskErrorRetryTable.tsx`: Hibás feldolgozások táblázata (kijelölés, részletes hiba kibontás, lapozás), sikeres feldolgozások listája, folyamatban lévő elemek és a cél-pipeline kiválasztó modál.
- **`WorkerPanel.tsx`**: Letisztult orchestrator komponens, amely deklaratívan kapcsolja össze a hookot és a vizuális komponenseket.

---

## 3. Consequences

### Pozitívumok (Pros):
- **100%-os API Visszamenőleges Kompatibilitás**: Az Edge Function interfésze és az URL akciók (`?action=...`) változatlanok maradtak, a frontend és az automatizált scriptek zavartalanul működnek.
- **Nagyfokú Karbantarthatóság és Modularitás**: A 3,947 soros monolit 8 különálló, jól definiált felelősségi körrel rendelkező fájlra bomlott; a frontend 1,579 soros monolitja 5 moduláris egységre tagolódott.
- **Izolált Tesztelhetőség**: Létrejött a `src/features/management/__tests__/workerTelemetry.test.tsx` tesztkészlet, amely önállóan ellenőrzi a telemetria komponensek működését. A teljes tesztcsomag (75 fájl, 1039 teszt) hibátlanul lefut.
- **Biztonságos Multi-Tenant & Multi-Project Kezelés**: A `serviceFetch` és a multiProject kliensek centralizációja megakadályozza a jogosultság- és token-szivárgást.

### Megkötések (Cons):
- A több fájlra tagolódás több importkapcsolatot jelent, amit a Deno és TypeScript típusellenőrzés szigorúan monitoroz.
