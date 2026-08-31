# A-062: Számla Feature Szelet Modularizáció és Dekompozíció (`src/features/invoices`)

**Status:** Decided  
**Date:** 2026-08-31  
**Utoljára frissítve:** 2026-08-31  

## Context
A korábbi `src/pages/InvoicesPage.tsx` fájl 2243 soros monolitikummá duzzadt. Egyetlen fájlban keveredett a szűrés, URL paraméter kezelés, szerver-oldali és kliens-oldali rendezés, lapozás, sor-szintű kinyitás/összecsukás, kontextus menük, feltöltött fájlok és PDF export dialógusok mountolása, valamint a tömeges kijelölések állapota.
A másodpercenkénti NAV szinkron cooldown visszaszámláló az egész 2000 soros komponenst újrarenderelte.

A modularizáció célja az volt, hogy a számla kezelést egy tiszta, domain-driven feature szeletté bontsuk a `src/features/invoices/` alatt, miközben 100%-ban megőrizzük a meglévő URL paraméter kompatibilitást, a modális ablakok deep-linkelését, a táblázat sorainak kinyithatóságát és a tömeges műveleteket.

## Decision
1. **Domain Feature Slice Könyvtárstruktúra:**
   - `src/features/invoices/types/index.ts`: Közös domain típusok, tab slug konstansok (`TAB_SLUGS`), és deep-link akció típusok.
   - `src/features/invoices/context/InvoiceContext.tsx`: Központi compound Provider, amely a lekérdezéseket, szűrőket, URL szinkronizációt, rendezést, lapozást, kijelöléseket és modális dialógusokat enkapszulálja.
   - `src/features/invoices/context/useInvoiceContext.ts`: Null-guarddal védett React Context hook.
   - `src/features/invoices/utils/invoiceRelations.ts`: Tiszta függvények a NAV és beküldött számlák összerendeléséhez, valamint a hierarchikus előleg/végszámla/sztornó láncok feloldásához.
   - `src/features/invoices/components/header/`: `InvoiceHeader.tsx`, `NavSyncButton.tsx` (izolált cooldown timer), `InvoiceKpiCards.tsx`.
   - `src/features/invoices/components/filters/`: `InvoiceTabSelector.tsx`, `InvoiceFilterBar.tsx`.
   - `src/features/invoices/components/table/`: `NavInvoiceRow.tsx`, `SubmittedInvoiceRow.tsx`, `NavInvoiceTable.tsx`, `SubmittedInvoiceTable.tsx`, `InvoiceTableContainer.tsx`.
   - `src/features/invoices/components/actions/`: `InvoiceBulkActionsBar.tsx`.
   - `src/features/invoices/components/dialogs/`: `BulkDeleteDialog.tsx`, `InvoiceDialogManager.tsx`.
   - `src/features/invoices/InvoicesFeature.tsx`: Fő feature orchestrator nézet.
   - `src/features/invoices/index.ts`: Publikus barrel export.

2. **18 soros Facade az InvoicesPage-ben:**
   - A `src/pages/InvoicesPage.tsx` fájl egy vékony facade lett, amely kizárólag a top-scroll hatást futtatja, beágyazza az `<InvoiceProvider>`-t és rendereli az `<InvoicesFeature />`-t.

3. **URL Állapot és Deep-link Kompatibilitás:**
   - A 12 URL szűrő query paraméter (`q`, `idf`, `idt`, `amin`, `amax`, `cur`, `paid`, `sub`, `proj`, `cat`, `pm`, `cont`), a tab slug-ok (`outbound_nav`, `inbound_nav`, `submitted_outbound`, `submitted_inbound`), és az akció paraméterek (`?invoice=<id>&action=items|view|edit|files`) 100%-ban változatlanul működnek.

## Consequences
**Pozitív:**
- A kód karbantarthatósága és tesztelhetősége drasztikusan javult: 2243 soros monolit helyett kis, jól fókuszált komponensek (~50-200 sor/fájl).
- A `NavSyncButton` cooldown számlálója izolált komponenst kapott, így másodpercenként nem indít teljes oldal újraszámolást.
- A táblázatok explicit nézetekre lettek bontva (`NavInvoiceTable` vs `SubmittedInvoiceTable`), megelőzve az anti-pattern boolean prop robbanást.
- Az O(1) tranzakció kötegelt lekérdezés és a számla relációk tiszta modulba kerültek.

**Negatív / Trade-off:**
- A feature belsejében lévő alkomponensek az `InvoiceContext`-re támaszkodnak, ezért önállóan `<InvoiceProvider>` nélkül nem renderelhetőek (viszont unit tesztelhetőek a tiszta segédfüggvények).

## Kapcsolódó
- [A-060: Moduláris App Router & Platform Bootstrap Architektúra](./A-060-modular-app-router-and-bootstrap-shell.md)
- [A-061: Decomposing Management Dashboard](./A-061-decompose-management-dashboard.md)
- [P-054: Server-Side Invoice Pagination & KPI Card Filtering UX](../../product/decisions/P-054-server-side-invoice-pagination-and-kpi-filters-ux.md)
- [P-057: Invoices Feature Slice UX](../../product/decisions/P-057-invoices-feature-slice-ux.md)
- [045: Invoices Feature Slice](../../business/decisions/045-invoices-feature-slice.md)
