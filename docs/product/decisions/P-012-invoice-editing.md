# P-012: Számla Szerkesztés

**Status:** Decided  
**Category:** Számla Kezelés

**Question:** Hogyan szerkeszthet a felhasználó egy feldolgozott számlát?

**Decision:** 2 dialógus rendszer:

1. **InvoiceEditDialog** — Egyedi mező gyors javítása (pl. összeg, partner, dátum)
2. **InvoiceFullEditDialog** — Teljes számla szerkesztés beleértve a tételek szerkesztését

**Rationale:** Két szint elegendő: gyors javítás a leggyakoribb esetekre, teljes szerkesztés a ritkább, összetett esetekre. A tétel szerkesztés a teljes szerkesztés részeként érhető el, nem külön dialógusban.
