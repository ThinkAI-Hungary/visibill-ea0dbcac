# P-006: Sidebar Menüstruktúra

**Status:** Decided  
**Category:** Dashboard & Navigáció  
**BRD Reference:** REQ-3.1

**Question:** Milyen menüpontok vannak a sidebarban és hogyan vannak rendezve?

**Decision:** Csoportosított sidebar collapsible kategóriákkal. A jelenlegi 19 flat elem logikus csoportokba rendezendő.

**Current Implementation (flat, 19 elem):**
1. Irányítópult, 2. Kategóriák, 3. Projektek, 4. Partnertörzs, 5. Számlák, 6. Kintlévőség, 7. Tranzakciók, 8. Főkönyv, 9. Eredménykimutatás, 10. Mérleg, 11. Beszámoló, 12. Feltöltés, 13. Bérek/járulékok, 14. Munkaidő, 15. Házipénztár, 16. TENY, 17. Integrációk, 18. Árfolyamok, 19. Előfizetés

**TODO (Csoportosítás):**
- Collapsible sidebar kategóriák bevezetése (pl. Pénzügyek, Riportok, HR, Beállítások)
- Konkrét csoportosítás még meghatározandó

**Rationale:** 19 flat elem ijesztő lehet új usereknek. Logikus csoportok csökkentik a cognitive load-ot és jobb szervezettséget adnak. Az extra kattintás elfogadható tradeoff a jobb áttekinthetőségért.
