# P-031: [eaisyBooks] Layout & Navigáció (korábban: Accounty)

**Status:** Decided  
**Category:** eaisyBooks  
**BRD Reference:** Decision 031 (eaisyBooks modul scope)

**Question:** Hogyan épül fel az eaisyBooks önálló layout-ja és navigációs struktúrája?

**Decision:** Saját `AccountyLayout` wrapper, saját sidebar, teljesen független a fő app layout-tól.

**Current Implementation:**
- `AccountyLayout.tsx` — önálló layout, saját sidebar, header, user menu
- `AccountyRoleContext.tsx` — admin/könyvelő szerepkör kezelés
- Sidebar menüpontok:
  - Portfólió (`/accounty`) — ikon: Briefcase
  - Hiányzó számlák (`/accounty/missing-invoices`) — ikon: FileWarning
  - Adó naptár (`/accounty/tax-calendar`) — ikon: Calendar
  - Riportok (`/accounty/reports`) — ikon: BarChart2
  - Jóváhagyó rendszer (`/accounty/approval-queue`) — ikon: MailCheck
  - Bérszámfejtés (`/accounty/payroll/:id/*`) — ikon: Calculator, expandable per-client submenu
  - Hibajegyek (`/accounty/tickets`) — ikon: TicketCheck + unread badge
  - Beállítások (`/accounty/settings`) — ikon: Settings
  - Segítség (`/accounty/help`) — ikon: HelpCircle
- Command palette: Ctrl+K — gyors navigáció oldalak és ügyfelek között
- Sidebar collapse: ikon módra összecsukható, állapot localStorage-ben persisted
- Branding: eaisyBill | eaisyBooks — piros gradiens
- Vissza a fő app-ba: eaisybill logo kattintás → `/`
- Dark/light téma: saját toggle a header-ben
- FeedbackFab: gyors visszajelzés gomb

**Rationale:** Az önálló layout biztosítja, hogy az eaisyBooks saját navigációs logikát és branding-et használhasson. A fő app sidebar nem releváns egy könyvelőnek, aki ügyfélportfóliót kezel — az eaisyBooks sidebar az ő workflow-jára van optimalizálva.
