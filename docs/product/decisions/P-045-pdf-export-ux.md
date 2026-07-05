# P-045: PDF Export UX & Banner viselkedés

**Status:** Decided
**Category:** UI / Workflow
**Question:** Hogyan értesítsük a felhasználót az aszinkron export állapotáról anélkül, hogy zavarnánk a munkáját?

**Decision:**
Egy dinamikus bannert használunk a Számlák oldal tetején, amely követi az export állapotát:

1.  **Layout Integráció**: A banner nem `absolute` pozícionált, hanem a `CardHeader` és `CardContent` közé ékelődik be, így elkerülhető a layout shift és a KPI kártyák kitakarása.
2.  **Státusz megjelenítés**:
    *   **Folyamatban**: Progress bar mutatja a százalékos állást és az aktuálisan feldolgozott számlát.
    *   **Kész (Auto-download)**: Ha a user az oldalon maradt, a letöltés automatikusan elindul, a banner pedig 10 másodperc után magától eltűnik.
    *   **Kész (Manual fallback)**: Ha a user elnavigált és visszajött, egy "Kattints ide a letöltéshez" gomb jelenik meg. A banner manuális bezárásig vagy a letöltés utáni 5 mp-ig látható.
3.  **Globális értesítés**: Ha a felhasználó egy másik menüpontban tartózkodik, a `LiveNotificationProvider` egy globális toast üzenetet küld: "PDF export kész! X számla exportálva. Navigálj a Számlák oldalra a letöltéshez."

**Current Implementation:**
*   `PdfExportBanner.tsx`: UI komponens.
*   `usePdfExport.ts`: Állapotkezelés és auto-dismiss logika.
*   `LiveNotificationProvider.tsx`: Globális Realtime figyelő.

**Rationale:**
A cél a "set it and forget it" élmény: a user elindítja az exportot, mehet máshova dolgozni, és értesítést kap, ha kész. A manuális letöltési lehetőség (fallback) kritikus azokra az esetekre, amikor a böngésző blokkolja az auto-downloadot vagy a user megszakítja a session-t.

## Kapcsolódó
*   [A-028: PDF Export Workflow](../../architecture/decisions/A-028-pdf-export-lifecycle.md)
*   [P-021: Export formátumok](./P-021-export-formats.md)
