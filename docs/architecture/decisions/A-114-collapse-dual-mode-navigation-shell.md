# Architecture Decision Record (ADR)

# A-114: eaisyBooks Kettős Működési Módú Navigációs Héj Összevonása (Collapse Dual-Mode Navigation Shell) és Seam Hardening

**Státusz:** ✅ Decided  
**Dátum:** 2026-09-13  
**Kategória:** Frontend & Rendszer Architektúra  
**Kapcsolódó döntések:** [A-102](./A-102-eaisybooks-dual-mode-modular-architecture.md), [A-013](./A-013-scoped-routing.md), [A-060](./A-060-modular-app-router-and-bootstrap-shell.md), [A-115](./A-115-eaisybooks-eaisybill-cold-warm-hybrid-transition-and-route-resolution.md), [P-083](../../product/decisions/P-083-eaisybooks-eaisybill-app-mode-switcher-and-cold-warm-transition-ux.md), [054](../../business/decisions/054-eaisybooks-client-centric-navigation.md)

---

## 1. Kontextus és Problémafelvetés

Az [A-102](./A-102-eaisybooks-dual-mode-modular-architecture.md) döntés lefektette az eaisyBooks kettős működési módját (Portfólió Mód vs. Ügyfél Kontextus Mód). A gyors organikus növekedés során azonban az implementációban súlyos architekturális rés keletkezett:
1. **26-Prop Drilling Seam:** Az `AccountyLayout` komponens 26 különálló propot (pl. `isCollapsed`, `toggleSidebarCollapse`, `allClients`, `kpis`, `unreadTicketCount`, `canAccess`, `user`, `signOut`, `theme`, `setTheme`, `expandedPayroll`, `payrollSearch`, stb.) kényszerült áthúzni az `AccountySidebar`-ba, `AccountyHeader`-be és a kapcsolódó vezérlőkbe.
2. **Monolitikus Sidebar (812 sor):** Az `AccountySidebar.tsx` egyetlen monolitban kezelte a portfólió navigációt, a bérszámfejtési céglistát, a keresést, az ügyfél-specifikus almodulokat és a profil láblécet. A kód tele volt egymásba ágyazott ternáris operátorokkal és boolean flag robbanással.
3. **Kettős Scoped Layout Seam:** Az `AccountyScopedLayout.tsx` újra lekérte és validálta a cég jogosultságokat, miközben az `AccountyLayout` nem rendelkezett autoritatív, központosított állapottal a kiválasztott cégről vagy a módról, ami átmeneti skeleton villanásokat és szinkronizációs késéseket idézett elő közvetlen URL betöltéskor.

---

## 2. A Döntés

Elfogadtuk és megvalósítottuk a **Kettős Működési Módú Navigációs Héj Összevonását (Candidate 1)**:

### 2.1. Központi `AccountyShellContext` és `AccountyShellProvider`
- Létrehoztunk egy autoritatív React Contextet (`AccountyShellContext.tsx`), amely egyetlen forrásból kezeli:
  - Az aktív módot (`mode: 'portfolio' | 'client'`).
  - A kiválasztott ügyfélcéget (`selectedClientId`, `selectedClient`), amelyet explicit beállításból és a canonical URL útvonalból (`extractCompanyIdFromPath`) is azonnal felold.
  - A sidebar összecsukott és mobil fiók állapotait (cookie és localStorage perzisztenciával).
  - A gyorskereső / parancspaletta (`cmdOpen`, `cmdQuery`), a súgó fiók (`helpDrawerOpen`) és a bemutató túra (`runTour`) állapotait.
  - A navigációt, prefetch mechanizmust (`handlePrefetch`) és a simított portfólió visszalépést (`handleBackToPortfolio`).
  - A felhasználói profilt, irodai KPI-okat, jogosultságokat és értesítéseket.
- Az `AccountyLayout` beburkolja a gyermekkomponenseit az `<AccountyShellProvider>`-be, ezáltal a shell és komponensei **0 propot** igényelnek a normál működéshez.

### 2.2. Moduláris Kompozíciós Komponensek (Vercel Composition Patterns)
A monolitikus sidebar felbontásra került tiszta, dedikált modulokra:
1. `<PortfolioNav />`: Kizárólag a portfólió szintű modulokért (Portfólió csempe/lista, Hiányzó számlák, Adónaptár, Riportok, Bérszámfejtés accordion, Adminisztráció) felel.
2. `<ClientNav />`: Kizárólag az ügyfél-specifikus modulokért (Áttekintés, Profil, Számlák, EV, TAO, Bérszámfejtés, Cégkapu beállítások) felel, és rendereli a kiemelt `← Vissza a portfólióhoz` akciógombot.
3. `<AccountySidebar />`: Karcsú (~280 soros) elrendezési konténer, amely a módnak megfelelően dinamikusan delegálja a renderelést a `ClientNav` vagy `PortfolioNav` komponensnek.

### 2.3. Seam Hardening és Teszt Kompatibilitás (Defensive Standalone Fallback)
Annak érdekében, hogy az izolált egységtesztek (amelyek az `AccountySidebar`-t vagy `AccountyHeader`-t önállóan, context provider nélkül renderelik propokkal) továbbra is 100%-ban működjenek:
- Az `AccountySidebar` ellenőrzi a `useAccountyShellOptional()` állapotát: ha nem talál szülő `AccountyShellProvider`-t, transzparensen beburkolja magát egy belső `AccountySidebarStandalone` providerbe a kapott propok alapján.
- Az `AccountyHeader` és az `AccountyCommandPalette` defenzív opcionális mezőeléréssel és context fallbackkel dolgozik (`props.x ?? shell?.x`).

---

## 3. Következmények és Előnyök

1. **Nulla Prop Drilling:** Az `AccountyLayout` 575 sorról ~270 sorra csökkent, a 26 prop felesleges láncolása teljesen megszűnt.
2. **Karbantarthatóság:** A sidebar struktúrája áttekinthető, a portfólió és ügyfél nézet kódjai élesen elválasztva élnek önálló fájlokban.
3. **100% Regressziómentesség:** Mind a 40 Accounty tesztcsomag (675 sikeres teszt) hibátlanul lefut, a korábbi útvonal-átirányítások és a tesztkörnyezet is stabil maradt.
4. **Hibátlan Felhasználói Élmény:** A böngészős tesztek igazolták a gyors, akadás- és villódzásmentes átmenetet a Portfólió nézet és az Ügyfél nézet között.
