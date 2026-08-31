# P-057: Számla Kezelő Moduláris Felület (Invoices Feature Slice) UX

**Status:** Decided  
**Category:** UI / Workflow / Navigation  
**Question:** Hogyan tartható fenn a számlakezelő nézet (NAV kimenő/bejövő, beküldött kimenő/bejövő, KPI kártyák, szűrősáv, táblázat sor expanzió, modális dialógusok és tömeges műveletek) vizuális konzisztenciája és gyors válaszideje a feature szelet dekompozíciója során?  
**Decision:** 
1. **Egységes 4-Füles Elrendezés:** A felület felső fülválasztója (`InvoiceTabSelector`) azonnal szinkronizál az URL slug-gal (`outbound_nav`, `inbound_nav`, `submitted_outbound`, `submitted_inbound`).
2. **Kattintható KPI Összefoglaló Kártyák:** Az `InvoiceKpiCards` azonnali vizuális visszajelzést ad az összes, párosított, javasolt és párosítatlan számlák darabszámáról és szűréséről.
3. **Kontextus-érzékeny Szűrősáv:** Az `InvoiceFilterBar` a tab típusának megfelelően jeleníti meg az elérhető szűrőket (pl. kibocsátási dátumtartomány, pénznem, fizetési állapot, kategória, projekt, fizetési mód, folyamatos szolgáltatás).
4. **Lebegő Csoportos Műveleti Sáv (Floating Bulk Actions Bar):** Bármely számla kijelölésekor az `InvoiceBulkActionsBar` egy finoman animált portálként jelenik meg a képernyő alsó részén, összesített bruttó összeget és tömeges hozzárendelést biztosítva.
5. **Modális Dialógusok Deep-Linkelése:** Bármely számla képe (`?invoice=<id>&action=view`), szerkesztése (`action=edit`), tételei (`action=items`) vagy feltöltött fájljai (`action=files`) URL-ből közvetlenül megnyithatóak anélkül, hogy a felhasználó elveszítené az oldal kontextusát.

**Current Implementation:** `src/features/invoices/` modul komponensei (`InvoicesFeature.tsx`, `InvoiceHeader.tsx`, `InvoiceKpiCards.tsx`, `InvoiceFilterBar.tsx`, `NavInvoiceTable.tsx`, `SubmittedInvoiceTable.tsx`, `InvoiceBulkActionsBar.tsx`, `InvoiceDialogManager.tsx`).

**Rationale:** A felhasználói élmény azonnali, reszponzív és zökkenőmentes marad, miközben az izolált időzítők és a tiszta komponensstruktúra garantálja a magas renderelési teljesítményt még több ezer számla kezelése esetén is.

## Kapcsolódó
- [A-062: Invoices Feature Slice Modularization](../../architecture/decisions/A-062-invoices-feature-slice-modularization.md)
- [P-010: Invoice List View & Filters](./P-010-invoice-list.md)
- [P-015: Bulk Actions UX](./P-015-bulk-actions.md)
- [P-054: Server-Side Invoice Pagination & KPI Card Filtering UX](./P-054-server-side-invoice-pagination-and-kpi-filters-ux.md)
- [045: Invoices Feature Slice](../../business/decisions/045-invoices-feature-slice.md)
