# P-016: Tranzakció Lista & Szűrők

**Status:** Decided  
**Category:** Tranzakció & Párosítás  
**BRD Reference:** REQ-7.1

**Question:** Hogyan jelennek meg a tranzakciók és milyen szűrők elérhetőek?

**Decision:** Lista + futár riport tab egy oldalon. Nincs futár riport szeparáció.

**Current Implementation:**
- TransactionsPage.tsx: tranzakció lista + CourierReportTab
- TransactionDetailsDialog: részletek megjelenítés
- CourierReportTab / CourierInvoiceDialog: 3-oldalú párosítás (Csomag ↔ NAV számla ↔ Banki jóváírás). `partial_nav` és `partial_trx` státuszoknál tájékoztató infópanel, egyértelmű gombfeliratok (`Másik számla választása` / `Számla párosítása`), a táblázat soraiban `Részletek` művelet.
- Szűrők: dátum, összeg, típus, párosítási státusz

**Rationale:** A tab megközelítés kompakt és logikus. A futár riportok konceptuálisan a tranzakciókhoz kapcsolódnak (bank kivonat ↔ futár elszámolás). A P-006 sidebar csoportosítás oldja az esetleges navigációs zsúfoltságot. A részletes státuszmagyarázatok megelőzik a banki jóváírás és a futárkézbesítés felületi összetévesztését.

