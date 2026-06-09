# Decision 038: [Accounty] Új Felhasználó Onboarding Stratégia

**Status:** Decided

**Category:** Cégstruktúra & Jogosultságok

**Question:** Mi az optimális onboarding élmény egy új felhasználó számára?

**Decision:**
- **NAV szinkronizáció mint „first value":** Regisztráció után a NAV integráció beállítása az első lépés
- Adószám megadása → NAV technikai felhasználó kulcsok → automatikus számla letöltés
- A NAV-ból lehúzott számlák azonnal megjelennek a rendszerben — azonnali érték
- **Empty state wizard** (`EmptyStateDashboard`): lépéses onboarding ha nincs adat
  1. NAV integráció beállítása
  2. Banki kivonat feltöltése
  3. Kategória (GL) beállítás
- **Accounty onboarding:** `seedAccountyAssignments()` — automatikus könyvelő→cég hozzárendelés az összes elérhető céghez
- Product tour: `P-002` — interaktív bemutató az első bejelentkezéskor

**Rationale:** A felhasználó figyelmét a regisztráció utáni első percekben kell megnyerni. A NAV szinkronizáció azonnali értéket biztosít (meglévő számlák megjelennek), szemben az üres alkalmazással ahol a felhasználó nem tudja mit csináljon.
