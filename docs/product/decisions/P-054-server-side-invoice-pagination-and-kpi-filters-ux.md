# P-054: Scalable Server-Side Invoice Pagination, KPI Card Filtering & Page-Level Batch Matching UX

**Status:** Decided  
**Category:** UI / Performance / Invoices  
**Question:** Hogyan biztosítsuk a számlák lapozásának, a KPI kártyákkal való státusz szerinti szűrésének, valamint a kapcsolt tranzakciók lenyitásának hibátlan és azonnali (0ms) működését nagy adatbázisoknál (több tízezer számla és tranzakció esetén)?  
**Decision:** 
1. A KPI kártyákra (`Összes`, `Párosított`, `Javasolt`, `Nincs párosítás`) kattintás szerver-oldali szűrést (`p_kpi_filter`) aktivál, ami azonnal a kiválasztott státuszú számlák pontos lapozott nézetét hozza be.
2. **Page-Level Batch Pre-fetch:** Az oldal nem a cég összes tranzakcióját tölti le, hanem kizárólag az aktuálisan megjelenített oldal számlaazonosítóihoz (`currentPageInvoiceIds` — limit: 25, 50, 100, 200) kérdezi le kötegben a párosított tranzakciókat.
**Current Implementation:**
- A felhasználó rákattinthat a 4 KPI kártya bármelyikére.
- Az aktív szűrőállapot az URL query paraméterbe íródik (`?kpi=matched`, `?kpi=suggested`, `?kpi=unmatched`).
- A `UnifiedPagination` komponens nem a korábbi memóriaszűrt darabszámot, hanem közvetlenül a szerver által visszaadott `total_count`-ot és `total_pages`-t jeleníti meg.
- A táblázatsorok színezése (zöld: párosított, sárga: javasolt, normál/piros: nyitott, narancs: kompenzálandó) közvetlenül a szerver `match_status` mezőjéből történik villámgyorsan.
- **Azonnali lenyitás (0 ms latency):** Az aktuális laphoz tartozó tranzakciók egy memóriatérképbe (`pageInvoiceIdToTransactionsMap`) kerülnek, így a számlasor kinyitásakor a feltöltött számlakép és a banki tranzakció kártyája azonnal, egyszerre jelenik meg.  
**Rationale:** A kliens-oldali szűrés és a globális tranzakció-lekérdezés nem skálázható nagy adatbázisoknál. A szerver-oldali lapozással és a lap-szintű kötegelt tranzakció-lekérdezéssel a rendszer adatforgalma minimális marad, miközben a felhasználói élmény azonnali és folyamatos.

## Kapcsolódó
- [A-055: Server-Side Invoice Query, KPI Aggregation & GIN Trigram Optimization](../../architecture/decisions/A-055-server-side-invoice-query-kpi-optimization.md)
- [A-014: React Query Cache Stratégia](../../architecture/decisions/A-014-react-query-cache.md)
- [P-010: Számla lista nézet & szűrők](./P-010-invoice-list.md)
- [P-017: AI Párosítás Megjelenítés](./P-017-matching-display.md)
