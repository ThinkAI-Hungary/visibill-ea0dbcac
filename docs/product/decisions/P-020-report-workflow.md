# P-020: Beszámoló Workflow UX

**Status:** Decided  
**Category:** Főkönyv & Riportok  
**BRD Reference:** REQ-7.6

**Question:** Hogyan készíti el a felhasználó az éves beszámolót?

**Decision:** 3 külön oldal, lineáris workflow, frozen snapshot véglegesítéskor.

**Current Implementation:**
- 3 külön oldal: Eredménykimutatás → Mérleg → Beszámoló
- Workflow: draft → validated → finalized → submitted
- Kiegészítő melléklet tab: 19 sablon
- Frozen data snapshot a véglegesítéskor
- Osztalék rögzítés lehetőség

**Rationale:** A moduláris 3 oldal működik és tiszta separation-t ad. A frozen snapshot biztosítja az adatintegritást. Wizard vagy összesítő dashboard nem indokolt — a felhasználók (cégvezetők/könyvelők) ismerik a beszámoló készítési folyamatot.
