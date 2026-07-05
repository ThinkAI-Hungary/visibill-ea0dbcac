# P-045: PDF Export UX & Banner viselkedés

**Status:** Decided
**Category:** UI / Workflow
**Question:** Hogyan értesítsük a felhasználót az aszinkron export állapotáról anélkül, hogy zavarnánk a munkáját?

**Decision:**
Két rétegű értesítési rendszer:

1. **Banner (InvoicesPage)**: Dinamikus banner a Számlák oldal tetején, az export állapotát mutatja.
   - **queued/processing**: Spinner + progress bar
   - **completed (auto-download)**: Ha a user az oldalon maradt, automatikus letöltés + 10s auto-dismiss
   - **completed (manual)**: Ha a user visszajött, "Letöltés" gomb
   - **error**: Hibaüzenet + retry lehetőség

2. **Globális toast notification (AppLayout)**: `usePdfExportNotifications` hook az AppLayout-ban.
   - Csak **státusz-átmenetre** reagál (processing → completed), nem állapotra
   - Nem használ localStorage/sessionStorage — a `useRef` prevStatus-szal figyeli az átmenetet
   - Polling: 3s aktív job mellett, 15s idle
   - User-scoped: `.eq('user_id', userId)` — más cég-tagok nem kapják

**Current Implementation:**
- `PdfExportBanner.tsx`: Banner UI komponens
- `usePdfExport.ts`: Számlák oldal hook (start, poll, download, banner)
- `usePdfExportNotifications.ts`: Globális notification hook (AppLayout-ban mountolt)

**Rationale:**
"Set it and forget it" élmény: user indít exportot, elnavigálhat, toast jelzi ha kész.
A transition-based approach megelőzi a beragadt/ismétlődő toast-okat client storage nélkül.

## Kapcsolódó
- [A-028: PDF Export Workflow](../../architecture/decisions/A-028-pdf-export-lifecycle.md)
- [P-021: Export formátumok](./P-021-export-formats.md)
