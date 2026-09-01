# Decision 036: [Accounty] Hibajegy és Visszajelzés Rendszer

**Status:** Decided  
**Utolsó frissítés:** 2026-09-01

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
- Formázott szövegbevitel (Rich Text): félkövér, dőlt, áthúzott, címsorok, felsorolás, számozott lista, kód, idézet támogatás a hibajegyek leírásában és a hozzászólásokban
- Bővített csatolmánykezelés: képek (JPEG, PNG, GIF, WebP) és dokumentumok (PDF, CSV, XLS, XLSX) csatolása, közvetlen jegyhez csatolási lehetőség nyitott hibajegy esetén is
- Csatolmány előnézet: modern lebegő eszköztáras kártyák (`Eye` megtekintés és `Trash2` törlés funkcióval)
- Egységes app tooltip-ek a hibajegy modul minden interaktív elemén
- Screenshot csatolás lehetősége + clipboard paste (Ctrl+V)
- Kép előnézet küldés előtt → fullscreen gallery modal
- Olvasatlan ticketek száma badge-ként a sidebarban (`useUnreadTicketCount` hook)
- FeedbackFab: gyors visszajelzés gomb az Accounty layout-ban
- Pagináció: 15 jegy/oldal (user), 25 jegy/oldal (admin)
- Multi-status szűrő: egyszerre több státusz szűrhető (pl. Új + Folyamatban)
- Felelős kijelölés: support admin hozzárendelhet support agentet
- Jegy történet: státusz változás, felelős változás, kommentek — audit trail

**Rationale:** Egy beépített hibajegy rendszer gyorsabb visszajelzési ciklust biztosít, mint az email. Az olvasatlan szám badge biztosítja, hogy a felhasználók lássák a válaszokat.
