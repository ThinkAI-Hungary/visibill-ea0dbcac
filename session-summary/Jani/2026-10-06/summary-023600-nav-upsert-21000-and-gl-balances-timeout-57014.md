# Session Summary — 2026-10-06 02:36

```text
fix(nav, gl, rpc): NAV számlatétel 21000 kardinalitási hiba elhárítása és Főkönyvi RPC (get_gl_balances) 57014 timeout optimalizáció

- NAV Számlatétel Kötegelt Mentés Kardinalitás-védelme (PostgreSQL 21000 hiba elhárítása)
  - Hibanapló mélyelemzés (Supabase app_error_logs): 8 886 alkalommal lefutó `ON CONFLICT DO UPDATE command cannot affect row a second time (21000)` hiba azonosítása
  - Gyökérok: A NAV Online Számla XML válaszokban módosító számlák, göngyölegek vagy külső számlázók hibája miatt előfordultak duplikált `<lineNumber>` értékek, ami miatt az `INSERT ... ON CONFLICT (nav_invoice_id, line_number) DO UPDATE` összeomlott és megakasztotta a háttérfeldolgozást
  - Többrétegű megoldás (Defense-in-Depth):
    1. XML Parser szint (`xml-parser.ts`): Szigorú sorszám-egyediség nyilvántartás (`seenLineNumbers` halmaz) és fallback monoton növekvő sorszámozás
    2. Ingestion Service szint (`nav-ingestion-service.ts`): Védekező `normalizeItemsForRpc` sorszám-tisztítás az RPC hívás előtt
    3. Adatbázis RPC szint (`20261006020000_resilient_nav_invoice_item_dedup_rpc.sql`): `WITH ORDINALITY` CTE és sorszám-normalizálás a `save_nav_invoice_details_and_items` tárolt eljárásban
  - Minőségbiztosítás: `navSyncOrchestration.test.ts` (14/14 passed)

- Főkönyvi Kivonat és Naplófőkönyv RPC Teljesítmény-Optimalizálás (PostgreSQL 57014 Timeout Megszüntetése - A-189.2)
  - Hibanapló mélyelemzés: 4x `canceling statement due to statement timeout (57014)` hiba a `get_gl_balances` tárolt eljárásnál nagy forgalmú cégeknél (túllépve a Supabase 8,0s limitjét)
  - Gyökérok feltárása: Miért tért vissza a hiba 5 korábbi optimalizálás után is?
    - A korábbi migrációk a külső burkoló CTE-ket (`raw_items`, `je_map`) materializálták, de a `raw_items`-en belül a ③. ág (`nav_invoice_items`) a számlafejléceket tételszinten járta be egy lassú Nested Loop-ban
    - Az `uploaded_invoice_nums` anti-join (`NOT EXISTS (SELECT 1 ...)`) minden egyes tételsoron lefutott string tisztítással (`REPLACE(LOWER(...))`)
    - Ván Iroda Kft.-nél a 4 103 NAV számlából 1 764 számla (~43%) duplikálta a feltöltött számlákat: a PostgreSQL mind a 13 571 sort beolvasta és csak a legvégén dobta el a 6 000+ tételt, ráadásul az ÁFA és partner uniókban még 2x újraértékelte
  - Rendszerszintű megoldás: Header Pre-Materialization Invariant (`20261006030000_optimize_gl_nav_invoices_prematerialization.sql`)
    - `valid_invoices AS MATERIALIZED` & `valid_nav_invoices AS MATERIALIZED` CTE-k bevezetése a `get_gl_balances` és `get_gl_categorized_items` eljárásokban
    - A bérlői szűrés, dátumtartomány és az anti-join pontosan egyszer értékelődik ki számlafejléc szinten
    - A tételek, ÁFA és partner sorok kizárólag az előszűrt memóriatáblákhoz kapcsolódnak
  - Éles mérések valós adatokon (Supabase PostgreSQL):
    - Ván Iroda Kft. (`get_gl_balances`, 21 255 tétel): 8 787 ms → 221.7 ms (~40x gyorsulás)
    - Mandala Fogadó Kft. (`get_gl_balances`, 37 100 tétel): 6 083 ms → 707.5 ms (~8.6x gyorsulás)
    - Ván Iroda Kft. (`get_gl_categorized_items`, 311 Vevők fúrás): 3 688 ms → 174.2 ms (~21x gyorsulás)
    - 100% bit-pontos matematikai egyezés: Ván Iroda Kft. -1 264 300.60 Ft (0.00 Ft eltérés), Mandala Fogadó Kft. 130 870 188 732.65 Ft (0.00 Ft eltérés)

- Rendszerszabályok, Triage és Tudásbázis Szinkronizáció (/learn)
  - Szabályzat bővítés (`.agents/rules/database.md`):
    - Batch Upsert & Kardinalitás Védelem (Hiba 21000) kliens- és RPC szinten
    - Számlafejléc Pre-Materializáció & Anti-Join Invariáns (Hiba 57014) többágas pénzügyi aggregációknál
  - Hiba-vadász skill bővítés (`.agents/skills/visibill-error-hunter/SKILL.md`): 21000 és 57014 hibaosztályozási és javítási minták integrálása
  - Dokumentáció frissítés: `A-189 ADR` kiegészítése (A-189.2 fejezet) és `rpc-catalog.md` szinkronizálása
  - Tudásgráf frissítés: `graphify update .` lefutott (25 080 csomópont és 41 487 él aktualizálva)

- Minőségbiztosítás & Verifikációs Kapu
  - Oxlint gyors ellenőrzés: `npm run lint:fast` (0 hiba, 887 warning)
  - TypeScript típusellenőrzés: `npx tsc --noEmit` hibamentes (code 0)
  - RPC és rugalmassági egységtesztek: `rpcPerformanceAndResilience.test.ts` (15/15 passed)
  - Főkönyvi és naplózási tesztcsomag: 6 tesztfájl, 22 teszt (22/22 passed)
  - Élő adatbázis katalógus: `get_gl_balances` és `get_gl_categorized_items` `provolatile = 's'` (STABLE), `anon_can_execute = false`, `auth_can_execute = true`
```
