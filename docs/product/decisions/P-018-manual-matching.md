# P-018: Manuális Párosítás Felülírás

**Status:** Decided  
**Category:** Tranzakció & Párosítás

**Question:** Hogyan írhatja felül a felhasználó az AI párosítást?

**Decision:** Dialógusban keresés + hozzárendelés, is_verified flag-gel és audit log-gal.

**Current Implementation:**
- TransactionDetailsDialog-ban manuális számla keresés és hozzárendelés
- is_verified flag: felhasználó jóváhagyta a párosítást
- Audit log: minden felülírás naplózva

**Rationale:** Stabil és auditálható megoldás. Drag & drop vagy smart suggestion nem indokolt a jelenlegi fázisban — a keresés alapú felülírás egyértelmű és megbízható.
