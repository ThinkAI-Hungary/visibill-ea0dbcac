# P-019: GL Kategorizálás Javaslat UX

**Status:** Decided  
**Category:** Főkönyv & Riportok  
**BRD Reference:** REQ-7.5

**Question:** Hogyan jelenik meg és hogyan fogadható el az AI GL javaslat?

**Decision:** Egyedi javaslat elfogadás/felülbírálás minden számlánál. Nincs auto-accept.

**Current Implementation:**
- AI GL javaslat: gl_account_id + gl_reasoning + gl_confidence
- Elfogadás/felülbírálás a számla részletek nézetben (`InvoiceItemsDialog`)
- GL panel: javasolt szám + indoklás megjelenítés
- Manuális override naplózva (audit_logs)
- **NAV ↔ Beküldött dual-table szinkronizáció:** Ha párosított számlán módosítják a GL besorolást, a "testvér" tétel is automatikusan frissül — [P-043](./P-043-gl-twin-sync.md)

**Rationale:** A felhasználó kontrollja prioritás — minden GL hozzárendelést tudatosan kell elfogadni. Auto-accept bevezetése kockázatos lenne ebben a fázisban, mivel az AI pontossága még nem bizonyított nagy mintán.

