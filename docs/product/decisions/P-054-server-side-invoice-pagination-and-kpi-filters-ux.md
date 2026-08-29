# P-054: Scalable Server-Side Invoice Pagination & KPI Card Filtering UX

**Status:** Decided  
**Category:** UI / Performance / Invoices  
**Question:** Hogyan biztosítsuk a számlák lapozásának és a KPI kártyákkal való státusz szerinti szűrésének hibátlan és azonnali működését nagy adatbázisoknál (több ezer vagy tízezer számla esetén)?  
**Decision:** A KPI kártyákra (`Összes`, `Párosított`, `Javasolt`, `Nincs párosítás`) kattintás szerver-oldali szűrést (`p_kpi_filter`) aktivál, ami azonnal a kiválasztott státuszú számlák pontos lapozott nézetét hozza be.  
**Current Implementation:**
- A felhasználó rákattinthat a 4 KPI kártya bármelyikére.
- Az aktív szűrőállapot az URL query paraméterbe íródik (`?kpi=matched`, `?kpi=suggested`, `?kpi=unmatched`).
- A `UnifiedPagination` komponens nem a korábbi memóriaszűrt darabszámot, hanem közvetlenül a szerver által visszaadott `total_count`-ot és `total_pages`-t jeleníti meg.
- A táblázatsorok színezése (zöld: párosított, sárga: javasolt, normál/piros: nyitott, narancs: kompenzálandó) közvetlenül a szerver `match_status` mezőjéből történik villámgyorsan.  
**Rationale:** A korábbi kliens-oldali szűréskor ha az 50 soros lapon csak 1 párosított számla volt, a felhasználó azt hitte, hogy összesen csak 1 számlája van a cégnek. A szerver-oldali szűréssel a KPI kártyára kattintva azonnal teljes 50 számlát tartalmazó lapok töltenek be és a lapozó pontosan a szűrt státuszhoz tartozó összes oldalt mutatja.

## Kapcsolódó
- [A-055: Server-Side Invoice Query, KPI Aggregation & GIN Trigram Optimization](../../architecture/decisions/A-055-server-side-invoice-query-kpi-optimization.md)
- [P-010: Számla lista nézet & szűrők](./P-010-invoice-list.md)
