# A-028: PDF Export Workflow & Lifecycle

**Status:** Decided
**Date:** 2026-07-05
**Utoljára frissítve:** 2026-07-05

## Context
A felhasználóknak szükségük van a kiválasztott számlák PDF alapú exportálására. A nagy mennyiségű adat (számlaképek összefűzése) miatt ez a folyamat időigényes, aszinkron feldolgozást igényel, és biztosítani kell, hogy a letöltés akkor is elérhető maradjon, ha a felhasználó elnavigál az oldalról.

## Decision
Bevezetünk egy aszinkron PDF export pipeline-t az alábbi technikai döntésekkel:

1.  **PGMQ alapú sorbaállítás**: Az export kérések a `pdf_export_jobs` táblába kerülnek, amit egy Edge Function dolgoz fel aszinkron módon.
2.  **Realtime állapotkövetés**: A frontend a Supabase Realtime-on keresztül figyeli a job státuszát (`pending` → `processing` → `completed`).
3.  **Lifecycle Management & Cleanup**:
    *   **24 órás ablak**: A generált fájlok és a job bejegyzések 24 óráig érvényesek. Ezt követően egy cron job `expired`-re állítja a státuszt és törli a Storage-ból a fájlokat.
    *   **Auto-download lock**: Csak akkor indul el az automatikus letöltés, ha a felhasználó ugyanabban a böngésző session-ben tartózkodik, ahol az exportot indította (`startedExportInSessionRef`).
4.  **Stale Cache védelem**: A `usePdfExport` hook `staleTime: 0` beállítást kapott, hogy navigációkor ne a cache-elt (esetleg beragadt) `processing` állapotot mutassa, hanem azonnal frissítsen a DB-ből.

## Consequences
**Pozitív:**
*   Nem blokkolja a felhasználói felületet a hosszan tartó generálás.
*   Megbízható letöltés elnavigálás vagy frissítés után is (24 órán belül).
*   Automatikus tárhely-felszabadítás (cleanup).

**Negatív:**
*   A Realtime kapcsolat megszakadása esetén manuális refetch-re vagy navigációra van szükség (amit a `refetchOnMount: 'always'` kezel).

## Kapcsolódó
*   [A-004: PGMQ mint aszinkron queue](./A-004-pgmq-queue.md)
*   [A-005: Edge Functions](./A-005-edge-functions.md)
*   [P-045: PDF Export UX](../product/decisions/P-045-pdf-export-ux.md)
