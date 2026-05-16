# P-010: Számla Lista Nézet & Szűrők

**Status:** Decided  
**Category:** Számla Kezelés  
**BRD Reference:** REQ-5.1, REQ-5.2

**Question:** Hogyan jelennek meg a számlák listában és milyen szűrők elérhetőek?

**Decision:** Táblázatos nézet szűrőkkel, kártya nézet nélkül.

**Current Implementation:**
- InvoicesPage.tsx — táblázatos nézet
- Szűrők: státusz, típus, dátum, partner, összeg
- useInvoiceFilters hook: szűrők állapotkezelés
- useFilterPersistence: szűrő beállítások persistencia
- Rendezés: dátum, összeg, partner

**Rationale:** A táblázatos nézet hatékony és működik. Kártya nézet vagy virtualizáció bevezetése nem product döntés — ha teljesítmény probléma merül fel, az technikai refaktor kérdése.
