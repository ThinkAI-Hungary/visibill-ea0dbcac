# P-023: In-app Értesítési Center

**Status:** Decided  
**Category:** Értesítések & Kommunikáció

**Question:** Kell-e dedikált értesítési center az app-ban?

**Decision:** Nincs értesítési center. Real-time toast értesítések maradnak, email értesítések lefedik a history igényt.

**Current Implementation:**
- LiveNotificationProvider: real-time toast értesítések
- Nincs harang ikon, nincs értesítési lista

**Rationale:** A toast + email kombináció elegendő. In-app értesítési center fejlesztési ráfordítása nem indokolt — a user emailben megkapja amit lemarad. Ha user feedback alapján igény merül fel, harang ikon + lista bevezethető.
