# Decision 017: Tranzakció Kezelés & Párosítás

**Status:** Decided

**Category:** Pénzügyi Modulok

**Question:** Hogyan működik a banki tranzakciók kezelése és a számla-tranzakció párosítás?

**Decision:**
- CSV-alapú banki tranzakció import
- AI-alapú automatikus számla-tranzakció matching (confidence score, match type, reason)
- Manuális felülbírálás lehetősége (is_verified flag)
- GL szám hozzárendelés tranzakciókra is

**Rationale:** Az AI-alapú párosítás drasztikusan csökkenti a manuális munkát. A confidence score lehetővé teszi a bizonytalan párosítások felülvizsgálatát.
