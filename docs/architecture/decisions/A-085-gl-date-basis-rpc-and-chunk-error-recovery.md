# A-085: Főkönyvi Dátum Alap RPC Pushdown és Dinamikus Chunk Reload Recovery

**Status:** Decided  
**Date:** 2026-09-03  
**Utoljára frissítve:** 2026-09-03  
**Category:** Database / RPC Architecture / Error Boundaries / Resilience  
**Releváns jegy:** Kiss-Százi Emese (2026. szept. 2. 11:19)  

---

## Context

A felhasználói bejelentés két összefüggő mérnöki problémát hozott a felszínre:
1. **Dinamikus Chunk Betöltési Hiba (ChunkLoadError):**  
   Új verzió deploy-olásakor a böngészők korábbi HTML/JS bundle-t tartanak a memóriában. Amikor a felhasználó megnyit egy ritkábban használt lazy-loaded útvonalat (mint az eaisyBooks Beállítások oldal `/accounty/settings`), a böngésző a régi hash szerinti fájlt keresi a szerveren, ami 404-gyel elszáll (`TypeError: Failed to fetch dynamically imported module`). Az `AccountyErrorBoundary` korábban nem rendelkezett automatikus helyreállítással erre az esetre, így a felület használhatatlan hibaoldalra futott.
2. **Kizárólag Kibocsátás Dátum Alapú Főkönyv:**  
   A PostgreSQL `get_gl_balances` és `get_gl_categorized_items` tárolt eljárásai korábban mereven a számlák kibocsátási keltére (`kibocsatas_datuma` és `invoice_issue_date`) szűrtek. A számviteli törvény szerinti teljesítés dátuma szerinti kimutatáshoz adatbázis-szintű támogatás és cégbeállítási perzisztencia vált szükségessé.

---

## Decision

### 1. Dinamikus Chunk Betöltési Hiba Auto-Recovery (`ErrorBoundary`)
Az [AccountyErrorBoundary.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounty/AccountyErrorBoundary.tsx) és [ErrorBoundary.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ErrorBoundary.tsx) komponensekbe beépítésre került a chunk hibák automatikus detektálása és elhárítása:
- **Detektálás:**
  ```ts
  const isChunkError = 
    error?.name === 'ChunkLoadError' || 
    error?.message?.includes('Failed to fetch dynamically imported module') ||
    error?.message?.includes('Loading chunk');
  ```
- **10 Másodperces Debounce & Safe Reload:**
  Végtelen újratöltési ciklusok (reload loop) elkerülésére a `sessionStorage`-ban tárolt `visibill_last_chunk_reload` időbélyeggel védett automatikus `window.location.reload()` fut le. Ha 10 másodpercen belül már volt újratöltés, a rendszer megáll, és tiszta felhasználói hibaüzenetet jelenít meg a manuális újratöltés lehetőségével.
- **Típusbiztos hibajelentés:**
  Az `errorReporter.ts` kibővült a `'render'` hibatípussal, és a React komponens stack hierarchia a `context: { componentStack }` struktúrába ágyazódik.

### 2. Főkönyvi Dátum Alap Adatbázis RPC Pushdown
Ahelyett, hogy tízezer számlatételt töltenénk a böngészőbe és ott szűrnénk JavaScripttel, a dátum alapú aggregációt közvetlenül a PostgreSQL adatbázis szintjére delegáltuk (`RPC pushdown`):
- **Adatbázis séma módosítás:**
  A `company_settings` táblában létrejött a `gl_date_basis text DEFAULT 'kibocsatas' CHECK (gl_date_basis IN ('kibocsatas', 'teljesites'))` oszlop.
- **RPC paraméterezés:**
  A `get_gl_balances` és `get_gl_categorized_items` eljárások megkapták a `p_date_basis text DEFAULT 'kibocsatas'` paramétert, így korábbi kliensekkel 100%-ban visszafelé kompatibilisek maradtak.
- **SQL Dátumkezelési Logika & Null-Safety:**
  - `invoices` táblánál:
    `CASE WHEN p_date_basis = 'teljesites' THEN COALESCE(i.teljesites_datuma, i.kibocsatas_datuma) ELSE i.kibocsatas_datuma END`
  - `nav_invoices` táblánál:
    `CASE WHEN p_date_basis = 'teljesites' THEN COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at) ELSE COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at) END`
  - `gl_journal_entries`, `transactions` és árfolyamkülönbözetek: változatlanul bizonylat- és tranzakció-dátum szerint futnak.

### 3. Frontend Állapot és Reaktív Cache Stratégia
- A `useQuery` gyorsítótár-kulcsok (`['glBalances', ... dateBasis]` és `['glItems', ... dateBasis]`) közvetlenül függenek a `dateBasis`-tól.
- A szegmentált kapcsoló váltásakor a TanStack Query azonnal új lekérdezést futtat a háttérben, a Főkönyvi Kivonat, Naplófőkönyv és Többéves Összehasonlítás nézetek azonnal és szinkronban frissülnek.

---

## Consequences

### Pozitív
- **Zökkenőmentes verzióváltások:** A felhasználóknak nem kell manuálisan gyorsítótárat üríteniük verziófrissítések után, a beállítások menü mindig hiba nélkül megnyílik.
- **Mérföldkő az adózási és számviteli pontosságban:** A könyvelők valós teljesítés dátuma szerint készíthetnek mérleget és analitikát.
- **Nagy teljesítmény:** A számítások a Postgres adatbázisban indexelt oszlopokon és aggregációkkal futnak, milliszekundumok alatt lezajlanak még több tízezer tételnél is.

### Negatív / Kockázatok
- Ha egy bizonylatnál hibásan rögzítették a teljesítés dátumát (pl. elírás történt), az kihatással van a záróegyenlegekre. A `COALESCE` mechanizmus ezt védelmezi a hiányzó dátumoknál.

---

## Kapcsolódó
- BRD: [Decision 049: Főkönyvi Dátum Alap Üzleti Szabály](../../business/decisions/049-gl-date-basis-fulfillment-vs-issue.md)
- PRD: [P-066: Főkönyvi Dátum Alap Kapcsoló és Beállítások UX](../../product/decisions/P-066-gl-date-basis-toggle-and-settings-ux.md)
- Korábbi kapcsolódó ADR: [A-079: Accounty ErrorBoundary Route-Scoped Reset](./A-079-accounty-errorboundary-route-reset-and-prompt-rules-scoping.md)
- Korábbi kapcsolódó ADR: [A-069: Centralized Frontend Error Ingestion](./A-069-frontend-error-reporting-and-context-inspection.md)
