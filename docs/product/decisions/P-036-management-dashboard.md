# P-036: Management Dashboard UI és Navigáció

**Status:** Decided  
**Category:** Platform Üzemeltetés  
**BRD Reference:** Decision 037 (Management Dashboard)

**Question:** Hogyan néz ki a platform admin dashboard?

**Decision:** Önálló route, saját layout, csak management role számára.

**Current Implementation:**
- `ManagementDashboard.tsx` — route: `/management`
- Saját layout: nincs fő app sidebar, nincs Accounty sidebar
- Hozzáférés: `profiles.role === 'management'` — automatikus redirect `/management`-re bejelentkezéskor
- Monitoring: felhasználók, cégek, feldolgozási pipeline állapot

**Rationale:** A platform üzemeltető igényei annyira különböznek a normál felhasználóétól, hogy saját dashboard szükséges. Az automatikus redirect biztosítja, hogy a management user ne a normál dashboardon landoljon.
