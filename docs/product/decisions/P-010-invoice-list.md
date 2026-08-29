# P-010: Számla Lista Nézet & Szűrők

**Status:** Decided  
**Category:** Számla Kezelés  
**BRD Reference:** REQ-5.1, REQ-5.2

**Question:** Hogyan jelennek meg a számlák listában és milyen szűrők elérhetőek?

**Decision:** Táblázatos nézet szűrőkkel, kártya nézet nélkül.

**Current Implementation:**
- InvoicesPage.tsx — táblázatos nézet, szerver-oldali lapozással (`paginatedNavInvoices`, `paginatedSubmittedInvoices`)
- Szűrők: státusz, típus, dátum, partner, összeg, deviza, kategória, projekt, fizetési mód, foly. szolg.
- KPI kártya státusz szűrés: `Összes`, `Párosított`, `Javasolt`, `Nincs párosítás` kattintható kártyák
- useInvoiceFilters hook: szerver-oldali RPC szűrők és lapozás állapotkezelése
- useFilterPersistence: szűrő beállítások persistencia és URL szinkronizáció
- Rendezés: dátum, összeg, partner (PostgreSQL szerver-oldali indexelt rendezéssel)

**Rationale:** A táblázatos nézet hatékony és működik. A több tízezres számlaszám kezeléséhez a szűrés, lapozás és KPI aggregáció 100%-ban átkerült PostgreSQL szerver-oldali RPC-kbe.

## Kapcsolódó
- [P-054: Scalable Server-Side Invoice Pagination & KPI Card Filtering UX](./P-054-server-side-invoice-pagination-and-kpi-filters-ux.md)
- [A-055: Server-Side Invoice Query, KPI Aggregation & GIN Trigram Optimization](../../architecture/decisions/A-055-server-side-invoice-query-kpi-optimization.md)
