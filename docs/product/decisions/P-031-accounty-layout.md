# P-031: [eaisyBooks] Dual-Mode Layout & Navigáció (korábban: Accounty)

**Status:** Decided  
**Category:** eaisyBooks  
**BRD Reference:** Decision 031 (eaisyBooks modul scope), Decision 054 (eaisyBooks Client-Centric Navigation)

**Question:** Hogyan épül fel az eaisyBooks önálló layout-ja és navigációs struktúrája?

**Decision:** Saját `AccountyLayout` wrapper, dual-mode sidebar (`portfolio` és `client` mód), subpage-megőrző `CompanySwitcher`, teljesen független a fő eaisyBill app layout-tól, 4 szintű RBAC-val és DB-szintű modul felülbírálattal.

**Current Implementation:**
- `AccountyLayout.tsx` — önálló layout, dual-mode sidebar, header, user menu, `AccountyErrorBoundary` hibaszigeteléssel (A-079)
- `AccountyRoleContext.tsx` & `useAccountyPermissions.ts` — 4 szintű szerepkör (`iroda_admin`, `senior_könyvelő`, `könyvelő`, `asszisztens`), kiegészítve az `accounty_module_permissions` táblából érkező egyedi R/W felülbírálatokkal.
- **Dual-Mode Sidebar navigáció:**
  1. **Portfólió Mód (`/eaisybooks/*`):**
     - Portfólió (`/eaisybooks`) — Kanban / Grid / List nézetek, KPI kártyák
     - Hiányzó számlák (`/eaisybooks/missing-invoices`) — ikon: FileWarning
     - Jóváhagyási sor (`/eaisybooks/approval-queue`) — ikon: MailCheck
     - Adó naptár (`/eaisybooks/tax-calendar`) — ikon: Calendar
     - Riasztások (`/eaisybooks/alerts`) — ikon: AlertTriangle
     - Riportok (`/eaisybooks/reports`) — ikon: BarChart2
     - AI Asszisztens (`/eaisybooks/ai-assistant`) — ikon: Bot
     - Adminisztráció (Iroda, Szakmai, Biztonság, Támogatás alcsoportok)
  2. **Ügyfél Kontextus Mód (`/eaisybooks/:companyId/:dateRange/*`):**
     - "← Vissza a portfólióhoz" navigációs gomb
     - Fejlécben: **Aloldal-megőrző `CompanySwitcher`** (cégváltáskor az aktuális aloldalon marad)
     - Áttekintés (`/overview`)
     - Cégprofil (`/profile`)
     - Számlák (`/invoices`)
     - Tranzakciók (`/transactions`)
     - Jóváhagyási sor (`/approval-queue`)
     - Főkönyv (`/general-ledger`)
     - Bérszámfejtés (`/payroll`)
     - EV könyvvitel (`/ev`) — átalányadó, VSZJA, KATA, pénztárkönyv zárási varázslóval
     - TAO / KIVA (`/tao`)
     - Cégkapu (`/cegkapu`)
     - Képviselet (`/representation`) — EGYKE meghatalmazások
     - Szabályok (`/rules`) — `company_prompt_rules` könyvelési szabálytár
- **Ügyfélportál:** `/eaisybooks/client-portal` (magic-link tokenes jelszómentes bizonylatbekérés)
- **Visszafelé Kompatibilitás:** `/accounty/*` útvonalak automatikus átirányítása a `/eaisybooks/*` útvonalakra
- Command palette: Ctrl+K — gyors navigáció oldalak és ügyfelek között
- Sidebar collapse: ikon módra összecsukható, állapot localStorage-ben persisted
- Branding: eaisyBill | eaisyBooks — piros/korall gradiens
- AppModeSwitcher: zökkenőmentes váltás eaisyBill és eaisyBooks között

**Rationale:** Az önálló dual-mode layout biztosítja, hogy a könyvelő egyetlen felületen lássa a teljes irodai ügyfélportfóliót, miközben egyetlen kattintással mélyreható ügyfél-szintű könyvelési, bérszámfejtési és hatósági munkát végezhet anélkül, hogy elveszítené a navigációs fonalat vagy az időszaki kontextust.
