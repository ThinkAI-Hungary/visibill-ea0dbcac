# A-256: Könyvelési Napló (JournalView) Szerveroldali Lapozás és Window Aggregációk

**Status:** Decided  
**Dátum:** 2026-10-14  
**Érintett modulok:** `JournalView.tsx`, `src/lib/glData.ts`, `supabase/migrations/20261014140000_get_gl_journal_view_items.sql`, `src/components/general-ledger/__tests__/JournalView.test.tsx`, `src/test/rpcPerformanceAndResilience.test.ts`  

---

## 1. Context & Technikai Kihívás

A Főkönyv Könyvelési napló (`JournalView.tsx`) nézete a cég összes könyvelt tételének (számlák, banki tranzakciók, kézi vegyes tételek) kronologikus audit-listáját jeleníti meg.

Nagy forgalmú cégeknél (pl. Mandala Fogadó Kft. 41 183 tétellel) a korábbi implementáció a `fetchAllGlCategorizedItems` segédfüggvényt használta:
1. Egy kliensoldali `while (hasMore)` ciklus 1 000-es csomagokban 42 egymást követő HTTP kéréssel próbálta lekérdezni a teljes tételsort a `get_gl_categorized_items` RPC-n keresztül.
2. A lekérdezés 25–35 másodpercig tartott, túlterhelte a PostgREST kapcsolatkészletét, és a PostgreSQL-ben statement timeoutot (`error 57014: canceling statement due to statement timeout`) váltott ki.
3. A szerver túlterheltsége miatt járulékos timeoutok keletkeztek a többi fülön is (pl. a számlalistában a `get_filtered_nav_invoices` lekérdezéseknél).
4. A kliens memóriájában futó szűrés, összegzés (Tartozik/Követel) és 50 soros szeletelés (`filtered.slice()`) jelentős memóriaterhelést és UI akadozást eredményezett.

---

## 2. Decision

### 1. Dedikált Szerveroldali Lapozó és Aggregáló RPC (`get_gl_journal_view_items`)
- Létrehoztunk egy dedikált PostgreSQL tárolt eljárást a naplófőkönyvi tételek hatékony kiszolgálására:
  - **Biztonság:** `SECURITY DEFINER`, `SET search_path TO 'public'`, `STABLE` volatilitás.
  - **Jogosultság:** Végrehajtási jog megvonva a `PUBLIC` és `anon` szerepköröktől, kizárólag `authenticated` és `service_role` számára engedélyezve.
  - **Szerveroldali szűrés (`p_search`):** ILIKE mintaillesztés a partner nevére, leírására, bizonylatszámára, tételtípusára, valamint a kapcsolódó főkönyvi számra (`gl_number`) és számlanévre (`gl_name`).
  - **Szerveroldali típus- és státuszszűrés:** `p_type_filter` (pl. számlák, bank, kézi vegyes) és könyvelési státusz (`p_posting_status`).
  - **Szerveroldali rendezés és lapozás:** `p_sort_dir` (ASC/DESC dátum szerint), `p_page`, `p_page_size` (alapértelmezetten 50 sor).

### 2. Window Function Aggregációk Egyetlen Menetben (`COUNT(*) OVER()`)
- A szűrt tételeken a PostgreSQL window funkciói futnak le a lapozási limit előtt:
  ```sql
  COUNT(*) OVER() AS total_count,
  SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) OVER() AS total_debit,
  SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) OVER() AS total_credit
  ```
- Ennek köszönhetően a kliens egyetlen hívásból megkapja az 50 megjelenítendő tételt, a teljes tételszámot (a lapozóhoz), valamint a Tartozik és Követel valós, szűrt végösszegeit.

### 3. Frontend Reaktivitás és Debounce (`JournalView.tsx`)
- Átállás TanStack React Query-re (`useQuery`):
  - Cache kulcs: `['glJournalPaged', presetId, companyId, dateFrom, dateTo, dateBasis, postingStatus, debouncedSearch, typeFilter, sortDir, currentPage, pageSize]`.
  - Keresőmező: 300 ms `useDebounce` késleltetéssel védi az adatbázist a gépelés közbeni felesleges lekérdezésektől.
  - Lapozás: A szerver által visszaadott `total_count` alapján számított `totalPages`.
  - Összesítő sáv: Közvetlen `totalDebit` és `totalCredit` kiírás a szerver válaszából.

### 4. Optimalizált Kötegelt Exportálás (`handleExport`)
- Az Excel exportálás nem a teljes adatbázist önti le ellenőrizetlenül, hanem egy dedikált, legfeljebb 10 000 sort lefedő célzott hívást indít a paged RPC felé, miközben a felületen letöltési állapotindikátor jelenik meg.

---

## 3. Consequences

- **Pozitív:**
  - **Válaszidő radikális csökkenése:** 41 183 tétel esetén az 1. oldal lekérdezése **548 ms** alatt lefut (a korábbi 25–35+ másodperces, hibára futó lekérdezés helyett).
  - **Adatbázis stabilitás:** Megszűnt a kapcsolatkészlet kiéheztetése és az 57014 statement timeout hiba; a párhuzamos lekérdezések (pl. számlalapozás) nem akadnak meg miatta.
  - **Kliens memóriatakarékosság:** A böngésző memóriájában egyszerre csak az aktuális 50 tétel él a 40 000+ tétel helyett.
- **Negatív / Kockázat:**
  - Exportálásnál a 10 000-nél több tételt tartalmazó cégek esetén jövőben streaming vagy háttérben generált aszinkron export (worker job) válhat szükségessé.

---

## 4. Kapcsolódó
- [A-153: Főkönyvi Kivonat Kötegelt Tételes Adatbetöltés és Fastruktúra Renderelés](./A-153-general-ledger-batch-itemized-view-architecture.md)
- [A-152: Számlalista Szerveroldali Pagináció és Teljesítmény Optimalizáció](./A-152-invoices-server-side-pagination-and-performance-optimization.md)
- [A-150: Főkönyvi Lekérdezés Teljesítmény és DOM/Layout Védelem](./A-150-gl-performance-resilience-and-layout-hardening.md)
- [A-087: GL Adatbázis Keresés és Számlapagináció](./A-087-gl-database-search-and-account-pagination.md)
