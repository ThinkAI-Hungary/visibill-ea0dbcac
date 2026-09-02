# A-083: Rules of Hooks Invariáns Garantálása és Teszt-Telemetria Kiszivárgás Megelőzése

**Status:** Decided  
**Date:** 2026-09-02  
**Utoljára frissítve:** 2026-09-02  

## Context

Az éles környezetben a `/management` oldalon a felhasználók a `Minified React error #300` hibába ütköztek:
> *"Rendered fewer hooks than expected. This may be caused by an accidental early return statement."*

### Gyökérok Elemzés (RCA)
1. **RichTextContent korai visszatérések:** A jegykezelés részletező nézetében (`/management?view=tickets`) használt `RichTextContent` komponensben a tartalom meglétét és HTML típusát ellenőrző korai kilépések (`if (!content) return ...`, `if (!hasHtml) return ...`) a `useMemo` hookok elé voltak szervezve. Emiatt attól függően, hogy a mező üres, sima szöveg vagy HTML volt, 0, 1 vagy 2 hook futott le, azonnal felborítva a React fiber fát dinamikus re-rendereléskor.
2. **Kódbázis-szintű lappangó elágazások:** A kódbázis-szintű TypeScript AST szkennelés további 5 Accounty oldalon tárt fel olyan mintát, ahol az `if (isError)` vagy `if (!config)` ágak korai kilépése után még további 10-20 hook futott volna le, ami hálózati hiba vagy hiányzó URL paraméter esetén ugyanilyen instabilitást okozott volna.
3. **Teszt-telemetria kiszivárgása:** Amikor a Vitest helyi egységtesztjei (`npm test`) lefutottak, az `AccountyErrorBoundary.test.tsx` szándékos hibát generáló tesztkomponense (`Bomb`) által kiváltott hibákat az `errorReporter` közvetlenül beszúrta a Supabase `app_error_logs` éles/dev táblájába (`💣 Teszt hiba!`), ami fiktív hibákkal árasztotta el a Management felület hibalistáját.

## Decision

1. **Feltétel Nélküli Hook Végrehajtási Szabály (Rules of Hooks Invariance):**
   - Minden React komponensben és custom hookban az **összes hooknak (`useState`, `useMemo`, `useEffect`, `useCallback`, TanStack query-k) kötelezően a komponens törzsének legelején, minden feltételes visszatérés (`if (isError)`, `if (!config)`, `if (!content)`) ELŐTT le kell futnia**.
   - A hookok után következő korai return ágak felé safe optional chaininget (`config?.`) és stabil alapértelmezett értékeket (`data = []`, `''`) kell alkalmazni.

2. **Globális Tesztkörnyezeti Védelem (`errorReporter.ts`):**
   - A központi hibajelentő (`reportError`) kötelezően ellenőrzi a környezetet:
     ```typescript
     if (import.meta.env.MODE === 'test' || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')) {
       return;
     }
     ```
   - Tesztkörnyezetben semmilyen frontend hiba nem íródhat be a Supabase `app_error_logs` táblájába, megakadályozva a tesztzaj felkerülését a termelési felületekre.

3. **Teszt-Elszigetelés és Regressziós Védelem:**
   - Az error boundary tesztekben a `reportError` mockolása kötelező (`vi.mock('@/lib/errorReporter')`).
   - Dedikált regressziós tesztcsomag védi a dinamikus típusváltásokat (`richTextContent.test.tsx`) és a hibás/hiányzó állapotokat (`rulesOfHooksRegression.test.tsx`).

## Consequences

**Pozitív:**
- 100%-ban megszűnt a React Invariant #300 hiba az éles bundle-ben és a helyi felületeken.
- A Management felület "Hibák" panelje teljesen tiszta, nem kerülnek bele a fejlesztői tesztek fiktív hibái.
- Determinisztikus, stabil komponens életciklus hálózati hibák és hiányzó paraméterek esetén is.

**Negatív / Költségek:**
- Minimális, elhanyagolható számítási kapacitás üres vagy hibaállapotban lévő adatok szűrésére és lapozására a korai return előtt.

## Kapcsolódó
- [A-019: Management Dashboard](./A-019-management-dashboard.md)
- [A-069: Frontend Error Reporting & Context Inspection](./A-069-frontend-error-reporting-and-context-inspection.md)
- [A-079: Accounty ErrorBoundary Route Reset](./A-079-accounty-errorboundary-route-reset-and-prompt-rules-scoping.md)
- [docs/architecture/error-logging-system.md](../error-logging-system.md)
