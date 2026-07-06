# P-035: Hibajegy UI és Workflow

**Status:** Decided  
**Category:** Ügyfélszolgálat & Support  
**BRD Reference:** Decision 036 (Hibajegy rendszer)  
**Utolsó frissítés:** 2026-06

**Question:** Hogyan néz ki a hibajegy rendszer felülete?

**Decision:** Beépített in-app ticket rendszer, elérhető a fő app-ból és az Accounty-ból is.

**Current Implementation:**
- `TicketsPage.tsx` — több route-ról elérhető:
  - `/:companyId/:dateRange/tickets/:ticketId?` (fő app)
  - `/accounty/tickets/:ticketId?` (Accounty)
  - `/tickets/:ticketId?` (standalone)
- Ticket típusok: Hibajelentés (bug), Visszajelzés (feedback), Kérdés (question)
- Ticket prioritás: alacsony/közepes/magas/kritikus — user választhatja beküldéskor
- Ticket lista: kereshető (jegyszám, üzenet, cég, email), szűrhető (multi-status, prioritás, platform)
- Pagináció: 15 jegy/oldal (sima user), 25 jegy/oldal (support admin)
- Multi-status szűrő: egyszerre több státusz szűrhető (pl. Új + Folyamatban) — Popover + Checkbox UI
- Ticket részletek: válasz thread, screenshot csatolás, clipboard paste (Ctrl+V)
- Kép előnézet: csatolt képek kattinthatók küldés előtt → fullscreen gallery
- Fullscreen galéria: Portal-alapú overlay (z-index: 9999), teljes képernyős képnézegető
- Unread badge: `useUnreadTicketCount` hook — olvasatlan ticketek száma a sidebar-ban
- Felelős kijelölés: support admin hozzárendelhet support agentet, változás logolódik a timeline-ban
- Jegy történet (Timeline): státusz változás (Új → Folyamatban), felelős változás, kommentek — actor névvel

**Rationale:** Egy beépített ticket rendszer gyorsabb visszajelzési ciklust biztosít mint az email, és kontextust ad a fejlesztőknek (melyik oldalon, melyik cég kontextusban keletkezett a hiba).
