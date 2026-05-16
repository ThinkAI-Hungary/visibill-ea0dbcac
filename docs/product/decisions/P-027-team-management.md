# P-027: Csapattagok Meghívás & Kezelés

**Status:** Decided  
**Category:** Beállítások & Profil

**Question:** Hogyan hívhat meg a cég tulajdonos új csapattagokat?

**Decision:** Share token alapú csatlakozás marad. Nincs email meghívás, nincs tag kezelés panel.

**Current Implementation:**
- Share token generálás a Settings oldalon
- Bárki csatlakozhat a tokennel (member role-lal)
- Nincs tag eltávolítás vagy role change UI

**Rationale:** A share token egyszerű és zero friction. Formális meghívási rendszer és tag kezelés panel bevezetése akkor lesz aktuális ha több ügyféllel működik a rendszer és a biztonsági igény nő.
