# A-066: Management Route Access Control és NotFound Guard

**Status:** Decided  
**Date:** 2026-08-31  
**Utoljára frissítve:** 2026-08-31

## Context
A `/management` útvonal a platform szintű super-admin és üzemeltetési felületet tartalmazza (27+ felügyeleti modul, LLM költségek, worker státuszok, audit naplók). 
Korábban, ha egy bejelentkezett, normál szerepkörű felhasználó (pl. `user`, `admin`, `employee`) navigált a `/management` címre, a rendszer betöltötte a management menükeretet és üres állapotokat jelenített meg. 
Ez információszivárgási és biztonsági kockázatot jelentett, mivel a jogosulatlan felhasználók számára sem szabad jelezni vagy elérhetővé tenni az üzemeltetési keretrendszert.

## Decision
Bevezetésre került egy dedikált `ManagementRoute` guard komponens a `src/routes/authRoutes.tsx`-ben.

1. **Szigorú Szerepkör Ellenőrzés (`profiles.role`):**
   - A guard lekérdezi a bejelentkezett felhasználó profilját a gyorsítótárazott `['profile-check', user.id]` query-ből.
   - Ha a szerepkör NEM `'management'` és NEM `'thinkai'`, a rendszer **azonnal a `<NotFound />` (404) hibaoldalt** rendereli le a felhasználó számára.
2. **Zero Bundle Leakage (Lazy Loading):**
   - A nehéz `ManagementDashboard` JavaScript bundle csak és kizárólag akkor töltődik le, ha a jogosultság-ellenőrzés sikeresen lefutott (`isAuthorized === true`).
3. **Konzisztens 404 Oldal Megjelenés:**
   - A `src/pages/NotFound.tsx` komponens modernizálásra került sötét/világos mód kompatibilis Tailwind design tokenekkel (`bg-background text-foreground text-muted-foreground`), kiegészítve egy kezdőlapra visszavezető navigációs gombbal.

## Consequences
**Pozitív:**
- Teljes információszivárgás elleni védelem: a jogosulatlan felhasználók számára a `/management` útvonal létezése sem derül ki (standard 404).
- Csökkentett hálózati terhelés: nem töltődik le feleslegesen a management modulok kódja.
- Automatizált unit tesztekkel védett viselkedés (`src/routes/__tests__/managementRouteGuard.test.tsx`).

**Negatív / Trade-off:**
- A guard komponens egy aszinkron profilszerepkör ellenőrzést igényel az első betöltéskor (melyet a React Query 5 perces staleTime gyorsítótára minimalizál).

## Kapcsolódó
- [A-009: Supabase Auth & RBAC](./A-009-auth-rbac.md)
- [A-019: Management Dashboard Architektúra](./A-019-management-dashboard.md)
- [A-060: Moduláris App Router](./A-060-modular-app-router-and-bootstrap-shell.md)
- [P-036: Management Dashboard UX](../../product/decisions/P-036-management-dashboard.md)
