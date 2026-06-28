# Decision 036: [Accounty] Hibajegy és Visszajelzés Rendszer

**Status:** Decided  
**Utolsó frissítés:** 2026-06

**Category:** Ügyfélszolgálat & Support

**Question:** Hogyan jelezhetnek a felhasználók hibákat vagy küldhetnek visszajelzést?

**Decision:**
- In-app hibajegy rendszer: `TicketsPage` — elérhető a fő app-ból és az Accounty-ból is
- Route-ok:
  - Fő app: `/:companyId/:dateRange/tickets/:ticketId?`
  - Accounty: `/accounty/tickets/:ticketId?`
  - Standalone: `/tickets/:ticketId?`
- Ticket típusok: Hibajelentés (bug), Visszajelzés (feedback), Kérdés (question)
- Prioritás: felhasználó választhatja beküldéskor (alacsony/közepes/magas/kritikus)
- Screenshot csatolás lehetősége + clipboard paste (Ctrl+V)
- Kép előnézet küldés előtt → fullscreen gallery modal
- Olvasatlan ticketek száma badge-ként a sidebarban (`useUnreadTicketCount` hook)
- FeedbackFab: gyors visszajelzés gomb az Accounty layout-ban
- Pagináció: 15 jegy/oldal (user), 25 jegy/oldal (admin)
- Multi-status szűrő: egyszerre több státusz szűrhető (pl. Új + Folyamatban)
- Felelős kijelölés: support admin hozzárendelhet support agentet
- Jegy történet: státusz változás, felelős változás, kommentek — audit trail

**Rationale:** Egy beépített hibajegy rendszer gyorsabb visszajelzési ciklust biztosít, mint az email. Az olvasatlan szám badge biztosítja, hogy a felhasználók lássák a válaszokat.
