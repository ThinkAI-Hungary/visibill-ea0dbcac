# P-035: Hibajegy UI és Workflow

**Status:** Decided  
**Category:** Ügyfélszolgálat & Support  
**BRD Reference:** Decision 036 (Hibajegy rendszer)

**Question:** Hogyan néz ki a hibajegy rendszer felülete?

**Decision:** Beépített in-app ticket rendszer, elérhető a fő app-ból és az Accounty-ból is.

**Current Implementation:**
- `TicketsPage.tsx` — több route-ról elérhető:
  - `/:companyId/:dateRange/tickets/:ticketId?` (fő app)
  - `/accounty/tickets/:ticketId?` (Accounty)
  - `/tickets/:ticketId?` (standalone)
- Ticket létrehozás: cím, leírás, prioritás (alacsony/közepes/magas/kritikus)
- Ticket lista: szűrhető, kereshető
- Ticket részletek: válasz thread, screenshot csatolás
- Unread badge: `useUnreadTicketCount` hook — olvasatlan ticketek száma a sidebar-ban

**Rationale:** Egy beépített ticket rendszer gyorsabb visszajelzési ciklust biztosít mint az email, és kontextust ad a fejlesztőknek (melyik oldalon, melyik cég kontextusban keletkezett a hiba).
