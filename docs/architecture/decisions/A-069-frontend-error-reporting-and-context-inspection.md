# A-069: Centralized Frontend Error Ingestion, Stack Trace Preservation & Intelligent Context Deserialization

**Status:** Decided  
**Date:** 2026-08-31  
**Category:** Platform Üzemeltetés & Hibakezelés  
**Related Decisions:** [A-019](./A-019-management-dashboard.md), [A-061](./A-061-decompose-management-dashboard.md), [P-036](../../product/decisions/P-036-management-dashboard.md)

---

## 1. Context

A frontend hibakezelési rétegében (`reportError`) és a Management Dashboard Error Control Paneljében (`ErrorControlPanel.tsx`) két olyan anomália létezett, ami megnehezítette a termelési hibák diagnosztizálását:
1. **Üzenet levágás (Incomplete Messages):** Amikor egy kódkomponens `message: 'Prefix:'` formátummal hívta meg a `reportError`-t és a valós kivételt az `error` mezőben adta át, a korábbi kód nem fűzte hozzá a tényleges hibaüzenetet a fő üzenethez, így az adatbázisban csak a bevezető szöveg (pl. `Batch upload failed for channel bank:`) rögzült.
2. **Kényszerített `[object Object]` szövegképzés (Object Coercion):** A felület a kontextus mezőket sima `String(v)` kiértékeléssel jelenítette meg, ami a JavaScript Error vagy objektum mezőknél (mint az `error_details: { name, message, stack }`) értelmezhetetlen `[object Object]` szöveget adott.
3. **Hiányzó Stack Trace és URL:** A JavaScript call stack nem került lekérésre és megjelenítésre a felületen.

---

## 2. Decision

1. **Intelligens hibaüzenet rekonstrukció (`src/lib/errorReporter.ts`):**
   - Bevezettük az `extractErrorDetails` segédfüggvényt, amely natív `Error`, Supabase Storage/PostgREST error és egyedi hibaobjektumokból is kinyeri a `message`, `name`, `stack`, `details` és `cause` mezőket.
   - Ha a megadott üzenet kettősponttal végződik, vagy nem tartalmazza a kivétel szövegét, a rendszer automatikusan kiegészíti a teljes hibaüzenettel.
   - Automatikusan rögzíti a hívási láncot (`stack_trace`) és a pontos böngésző útvonalat (`url`).
2. **Strukturált kontextus és hibakövetés (`ErrorControlPanel.tsx`):**
   - A kontextus mezők objektumait formázott, szintaxis-kiemelt, görgethető JSON blokként jeleníti meg.
   - Külön másolható `Stack Trace` kódblokkot kapott minden hiba.
   - A fejléc gyorsáttekintője (5 mezős grid) mutatja a Forrás táblát, Rekord ID-t, Felhasználót, Érintett céget és az Időpontot.
3. **Böngésző- és bővítmény-szintű VM zajszűrés (`src/main.tsx`, `src/lib/errorReporter.ts`):**
   - A globális eseményfigyelők (`unhandledrejection`, `error`) és az `errorReporter` automatikusan kiszűrik a dinamikus chunk betöltési hibákat és a böngésző belső VM / bővítmény eredetű (pl. Web Vitals / Soft Navigation `reportAllChanges` és `startTime`) kivételeit, megelőzve az `app_error_logs` tábla teleszemetelését.

---

## 3. Consequences

### Pozitív:
- Az üzemeltetők és fejlesztők a dashboardon közvetlenül látják a hibák pontos okát (pl. `Bucket not found`, `RLS violation`, `Failed to fetch`), ahelyett hogy csonka szövegeket vagy `[object Object]` feliratokat látnának.
- Azonnali root-cause analízis a stack trace és URL alapján.
