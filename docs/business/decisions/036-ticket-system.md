# Decision 036: [Accounty] Hibajegy és Visszajelzés Rendszer

**Status:** Decided

**Category:** Ügyfélszolgálat & Support

**Question:** Hogyan jelezhetnek a felhasználók hibákat vagy küldhetnek visszajelzést?

**Decision:**
- In-app hibajegy rendszer: `TicketsPage` — elérhető a fő app-ból és az Accounty-ból is
- Route-ok:
  - Fő app: `/:companyId/:dateRange/tickets/:ticketId?`
  - Accounty: `/accounty/tickets/:ticketId?`
  - Standalone: `/tickets/:ticketId?`
- Ticket létrehozás: cím, leírás, prioritás (alacsony/közepes/magas/kritikus)
- Screenshot csatolás lehetősége
- Olvasatlan ticketek száma badge-ként a sidebarban (`useUnreadTicketCount` hook)
- FeedbackFab: gyors visszajelzés gomb az Accounty layout-ban

**Rationale:** Egy beépített hibajegy rendszer gyorsabb visszajelzési ciklust biztosít, mint az email. Az olvasatlan szám badge biztosítja, hogy a felhasználók lássák a válaszokat.
