# P-061: Management Worker Telemetry Decomposition & Calendar Month LLM UX

**Status:** ✅ Decided  
**Date:** 2026-09-01  
**Category:** Platform Operations / Monitoring UX  
**Question:** Hogyan tehető a Worker Telemetria átláthatóvá, könnyen karbantarthatóvá és hogyan egyértelműsíthető a naptári hónapfordulós LLM költségkijelzés a Management Dashboardon?  
**Decision:** 
1. A korábbi 1,579 soros `WorkerPanel` monolitot 4 dedikált presenter komponensre és egy `useWorkerTelemetry` hookra bontottuk:
   - `ContainerMetricsCard`: Konténer CPU/RAM terheltségi sávok, verzió, host IP és üzemidő.
   - `QueueMonitorGrid`: PGMQ üzenetsorok mérete, várakozási idők és peek részletek inline/globális megjelenítéssel.
   - `PipelineStatusList`: Pipeline teljesítménytáblázat 7 napos sparkline diagramokkal.
   - `TaskErrorRetryTable`: Hibás feldolgozások táblázata, kijelölés, részletes hibakibontás, lapozás és cél-pipeline újraküldő modál.
2. Az Áttekintés (Overview) oldalon a havi LLM költségkártyákra dinamikus magyar hónapnév (`Havi összköltség (Szeptember)`) és explicit `TÁRGYHÓ` jelvény került, hogy a hónap 1-jei számláló-újraindulás ne keltse hiba vagy adatvesztés benyomását.

## Rationale
- A dekomponált felület izoláltan tesztelhető és a Vercel React Best Practices irányelveknek megfelelően minimalizálja a felesleges re-rendereléseket.
- A dinamikus hónapnév egyértelműsíti a tárgyhavi (naptári hónap) és az all-time (történelmi) pénzügyi adatok közötti különbséget.

## Kapcsolódó
- [A-077: Management Stats Edge Function & Telemetry Decomposition](../../architecture/decisions/A-077-management-stats-edge-function-and-telemetry-decomposition.md)
- [A-019: Management Dashboard Architektúra](../../architecture/decisions/A-019-management-dashboard.md)
- [P-036: Management Dashboard UI és navigáció](./P-036-management-dashboard.md)
