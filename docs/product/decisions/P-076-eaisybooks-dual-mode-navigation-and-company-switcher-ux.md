# P-076: [eaisyBooks] Hierarchikus Kliens Kontextus & Dual-Mode Aloldal-megőrző Company Switcher UX

**Status:** Decided  
**Category:** eaisyBooks  
**BRD Reference:** REQ-8b.19, Decision 054 (Client-Centric Navigation)

**Question:** Hogyan valósul meg a zökkenőmentes, kontextusvesztés nélküli navigáció az eaisyBooks irodai portfólió és az ügyfélszintű könyvelési modulok között?

**Decision:** Dual-mode navigációs keretrendszer az `AccountyLayout`-ban és a fejlécben elhelyezett kontextus-megőrző `CompanySwitcher`:
1. **Navigációs Módok Automatikus Detektálása:**
   - Ha az URL illeszkedik a `/eaisybooks/:companyId/:dateRange/*` mintára, a `sidebarMode` értéke `client`.
   - Ha az URL a gyökér `/eaisybooks/*` alá esik (pl. `/eaisybooks/portfolio` vagy `/eaisybooks/missing-invoices`), a `sidebarMode` értéke `portfolio`.
2. **Subpage-megőrző Cégváltó (`CompanySwitcher`):**
   - Amikor a könyvelő egy adott ügyfél modulján áll (pl. `/eaisybooks/comp-A/2026-01-01..2026-03-31/payroll`), és a fejlécben másik céget választ (`comp-B`), a navigáció célpontja automatikusan:
     `/eaisybooks/comp-B/2026-01-01..2026-03-31/payroll` lesz.
   - Nincs felesleges visszairányítás a kezdőoldalra; a könyvelő azonnal folytathatja a bérszámfejtést a másik ügyfélnél.
3. **"← Vissza a portfólióhoz" Gomb & Portfólió Átmeneti Skeleton Loader:**
   - Az ügyfél menü tetején jól látható, kiemelt visszalépési gomb a központi portfólió nézetbe (`/eaisybooks`).
   - A portfólió szintre való visszanavigáláskor a sidebar 250ms átmeneti Shimmer Skeleton Loader-t (`<AccountyNavSkeleton />`) jelenít meg a menüpontok hirtelen felvillanásának (snap/flash) megakadályozására, amit a portfólió csoportok selymes `fade-in` animációja követ.

**Current Implementation:**
- Komponensek: `AccountyLayout.tsx`, `AccountySidebar.tsx`, `AccountyNavSkeleton.tsx`, `AccountyCompanySwitcher.tsx`
- Routing: `src/routes/accountyRoutes.tsx`

**Rationale:** A könyvelők gyakran kötegelten dolgoznak egy-egy részfeladaton (pl. 15 cég bérszámfejtésének jóváhagyása egymás után). A kontextus-megőrző cégváltó megszünteti a felesleges kattintásokat és a navigációs frikciót.
