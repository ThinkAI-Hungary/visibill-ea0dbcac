# Database Development & Optimization Guidelines (Visibill / eaisybill-prod)

Ez a dokumentum a VisiBill és eaisybill-prod rendszer teljes körű adatbázis-architektúrális és optimalizálási specifikációja. Az itt rögzített irányelvek betartása kötelező minden sémamódosítás, migráció, tárolt eljárás (RPC), RLS szabály és kliensoldali PostgREST lekérdezés megvalósításakor.

> [!TIP]
> **Kapcsolódó külső és belső szabványok:**
> * Globális készségek: [supabase-postgres-best-practices](file:///C:/Users/Morfi/.gemini/config/skills/supabase-postgres-best-practices/SKILL.md), [supabase](file:///C:/Users/Morfi/.gemini/config/skills/supabase/SKILL.md)
> * Védőkorlát szabályzat (Thin Rule): [`.agents/rules/database.md`](file:///d:/ThinkAI/Visibill/eaisybill/.agents/rules/database.md)
> * Architektúrális döntések (ADR): [ADR Index](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/index.md)

---

## 🎯 1. Zero Silent DB Decisions
* **Kifejezett jóváhagyás kötelező:**
  * Bármilyen új tábla létrehozása, meglévő tábla oszlopainak módosítása, típusváltása vagy törlése előtt kötelező bemutatni a tervezett sémát a felhasználónak.
* **Destruktív műveletek tiltása:**
  * `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` vagy feltétel nélküli `DELETE` szigorúan tilos felhasználói jóváhagyás nélkül.

---

## 📁 2. Migrációs Szabvány & Fájlkonvenciók
A projekt Supabase Git-alapú automatikus deploymentet használ. A migrációs motor hibátlan működéséhez az alábbi szabályok nem-alkuképesek:

* **Hely és fájlformátum:**
  * Minden adatbázis-módosításnak kizárólag a `supabase/migrations/` könyvtárba kell kerülnie.
  * Fájlnév formátum: `YYYYMMDDHHMMSS_<leiro_nev_snake_case>.sql` (pontosan 14 számjegyű időbélyeg).
  * *Példa:* `20260930120000_add_invoice_delivery_notes.sql`.
* **Időbélyeg-egyediség:**
  * Tilos korábbi vagy más fájlban már használt időbélyeget újra felhasználni! Mindig generálj egyedi, aktuális időbélyeget:
    ```powershell
    node -e "console.log(new Date().toISOString().replace(/\D/g, '').slice(0, 14))"
    ```
* **Tilos nem-migrációs SQL-t ide tenni:**
  * Bármilyen manuális segédszkript, teszt adatbázis-feltöltő, egyszeri javítószkript (`MANUAL_RUN_...`, `seed_...`, `temp_...`) kizárólag a `scratch/` vagy `scripts/` mappába kerülhet, **soha nem a `supabase/migrations/` könyvtárba**!
* **Kötelező Idempotencia (Hiba-biztos DDL):**
  * Minden migrációnak újrafuttathatónak és ütközésmentesnek kell lennie:
    ```sql
    -- Tábla létrehozás
    CREATE TABLE IF NOT EXISTS public.table_name (...);

    -- Új oszlop hozzáadása
    ALTER TABLE public.table_name ADD COLUMN IF NOT EXISTS column_name text;

    -- Index létrehozás
    CREATE INDEX IF NOT EXISTS idx_table_col ON public.table_name (column_name);

    -- Trigger létrehozás
    DROP TRIGGER IF EXISTS trg_example ON public.table_name;
    CREATE TRIGGER trg_example BEFORE INSERT ON public.table_name ...;
    ```
  * *Részletek:* [ADR A-002](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-002-supabase-baas.md).

---

## ⚙️ 3. RPC (Postgres Stored Procedures & Functions) Szabvány
* **Minden RPC migrációban él:**
  * Szigorúan tilos RPC-t kizárólag a Supabase SQL Editorban vagy ad-hoc módon létrehozni. Minden tárolt eljárásnak benne kell lennie egy verziózott migrációs fájlban (`supabase/migrations/`).
* **Kötelező `search_path` védelem (`SECURITY DEFINER` esetén):**
  * Minden `SECURITY DEFINER` függvényben kötelező rögzíteni a keresési útvonalat a jogosultság-kiterjesztési és schema-poisoning támadások kivédésére:
    ```sql
    CREATE OR REPLACE FUNCTION public.my_secure_rpc(...)
    RETURNS ...
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    ...
    $$;
    ```
* **Függvény Volatilitás explicit deklarálása:**
  * **`STABLE`:** Ha a függvény csak lekérdez (nem módosít adatot). Ez teszi lehetővé a Postgres query optimizer számára a hatékony végrehajtást és indexhasználatot.
  * **`VOLATILE`:** Ha a függvény módosítást (INSERT/UPDATE/DELETE/TRUNCATE) végez.
  * **`IMMUTABLE`:** Ha a függvény tiszta matematikai/szöveges transzformációt végez, és az adatbázis állapotától független.
* **⚠️ CREATE OR REPLACE Volatilitás-csapda (Regression Guard):**
  * PostgreSQL-ben a `CREATE OR REPLACE FUNCTION` futtatásakor, ha nincs explicit kiírva a `STABLE` kulcsszó a fejlécben, a motor **automatikusan és csendben visszaállítja `VOLATILE`-ra** a függvényt.
  * Minden lekérdező vagy riportáló RPC újradefiniálásakor a fejlécben kötelező a `LANGUAGE plpgsql STABLE` deklaráció!
* **⚠️ PostgreSQL DEFAULT PUBLIC GRANT Csapda (Jogosultság-szivárgás védelem):**
  * A PostgreSQL automatikusan `GRANT EXECUTE TO PUBLIC` jogot ad minden új függvényre. A `GRANT EXECUTE ... TO authenticated, service_role;` kiadása **nem vonja vissza** az `anon` jogosultságot!
  * Új vagy módosított `SECURITY DEFINER` eljárásnál kötelező a kétlépcsős jogosultság-kezelés:
    ```sql
    REVOKE EXECUTE ON FUNCTION public.my_rpc(...) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.my_rpc(...) TO authenticated, service_role;
    ```
* **⚠️ PL/pgSQL Unbounded Materialization Trap & Kötelező Belső Limit (Short-Circuit Invariant):**
  * PostgreSQL tárolt eljárásokban (`LANGUAGE plpgsql`) a `RETURN QUERY` kifejezés belső `LIMIT` nélkül a teljes eredményhalmazt materializálja a memóriában a függvény lefutása alatt, még akkor is, ha a hívó kliens (HTTP PostgREST query paraméter vagy Python worker) külső `LIMIT`-tel hívja meg!
  * Nagy tábláknál (pl. 40 000+ sor) ez azonnali 57014 statement timeout-ot okoz.
  * **Kötelező Szabály:** Minden táblát vagy sormozgást visszaadó kötegelt RPC-ben:
    1. Kötelező a `p_limit integer DEFAULT 1000` paraméter.
    2. Kötelező a belső határolás: `v_effective_limit := LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 5000);`.
    3. Kötelező a belső `RETURN QUERY ( ... ) LIMIT v_effective_limit;` elhelyezése, hogy a PostgreSQL lekérdezés-tervezője az indexscan során azonnal megálljon az N-edik találatnál (Short-circuit execution: 9890 ms helyett 26 ms).
  * *Részletek:* [ADR A-259](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-259-invoice-items-denormalization-and-unclassified-gl-rpc-limit.md).
* **🧪 Kötelező RPC Tesztelés és Verifikáció:**
  * Bármilyen RPC létrehozásakor vagy módosításakor **szigorúan kötelező hozzá tesztet írni** (kliensoldali Vitest regressziós/szerződésteszt a `src/test/` könyvtárban, pl. `src/test/rpcPerformanceAndResilience.test.ts`), és a verifikációs kapuban le is kell futtatni!
  * Élő adatbázison a katalógus attribútumokat (`pg_proc` provolatile és jogosultságok) is ellenőrizni kell.
* **Strukturált visszatérési értékek:**
  * Mindig határozz meg pontos visszatérési típust (`RETURNS jsonb`, `RETURNS boolean`, vagy `RETURNS TABLE (id uuid, name text, ...)`). Kerüld a generikus, nem típusos `RETURNS record` használatát.
* **⚠️ Batch Upsert & Kardinalitás Védelem (`ON CONFLICT DO UPDATE` - Hiba 21000):**
  * PostgreSQL-ben az `INSERT ... ON CONFLICT (...) DO UPDATE` parancs azonnal elhasal `21000: ON CONFLICT DO UPDATE command cannot affect row a second time` hibával, ha a bemeneti relációban egynél több olyan sor szerepel, amely azonos konfliktus-célpontra illeszkedik!
  * **Kötelező védelem:** Kliens/parser szinten deduplikálni kell a kulcsokat, tárolt eljárás szinten pedig `WITH ORDINALITY` CTE és sorszám-normalizálás segítségével belsőleg kell feloldani az ütközést.
  * *Részletek:* [ADR A-016](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-016-postgresql-query-strategy.md), [ADR A-092](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-092-database-security-and-performance-optimization.md), [ADR A-096](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-096-authoritative-nav-line-items-crosscheck-and-sync-guard.md), [ADR A-183](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-183-supabase-query-performance-and-financial-rpc-optimization.md) és [ADR A-193](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-193-nav-hybrid-async-sync-and-atomic-item-idempotency.md).

---

## 🛡️ 4. Row Level Security (RLS) és Bérlői Védelem
* **RLS kötelező minden táblán:**
  ```sql
  ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;
  ```
* **Explicit szabályok:**
  * Mindig definiálj explicit `SELECT`, `INSERT`, `UPDATE`, `DELETE` szabályokat a bérlői/cég jogosultságok (`company_id`, `auth.uid()`) alapján.
* **⚠️ Multi-Tenant Tételtábla Denormalizáció & Zéró Lateral Join (Line-Item Invariant):**
  * Minden olyan nagy kardinalitású gyermektáblán, amely tételszintű pénzügyi adatokat tárol (pl. `invoice_items`, `nav_invoice_items`, `acc_journal_lines`, `petty_cash_items`):
    1. **Közvetlen `company_id` oszlop kötelező:** Szigorúan tilos a bérlői azonosítást kizárólag a szülő táblára bízni! A gyermektáblán kötelező a `company_id uuid REFERENCES companies(id) ON DELETE CASCADE`.
    2. **Összetett Index Kötelező:** `CREATE INDEX idx_table_comp_parent ON table(company_id, parent_fk_id);`.
    3. **Közvetlen RLS Kötelező:** Az RLS policy-nak közvetlenül a tételtábla `company_id`-ját kell ellenőriznie (`company_members cm WHERE cm.company_id = table.company_id`), szigorúan tilos szülő táblás `EXISTS (SELECT 1 FROM parent WHERE ...)` áttételes ellenőrzést végezni.
    4. **Defense-in-Depth Triggerek:** Kötelező a `BEFORE INSERT/UPDATE` trigger a `company_id` automatikus kitöltésére a szülőből, és az `AFTER UPDATE` trigger a szülő táblán.
    5. **Kliensoldali Lateral Join Tilalom:** Kliens kódban (Supabase JS, Edge Function) tilos a gyermektáblát szülő reláción keresztül szűrni (`.select('*, invoices!inner(company_id))').eq('invoices.company_id', companyId)`). Helyette kötelező a közvetlen bérlői szűrés: `.eq('company_id', companyId)`.
  * *Részletek:* [ADR A-097](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-097-multi-tenant-nav-items-denormalization-and-gl-optimization.md) és [ADR A-259](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-259-invoice-items-denormalization-and-unclassified-gl-rpc-limit.md).
* **⚠️ Multi-Tenant CTE Izoláció (Cross-Tenant Scan Védelem):**
  * Amikor egy soronkénti allekérdezést `MATERIALIZED CTE`-be vagy hash join aggregációba emelsz ki teljesítményoptimalizálás céljából, és a belső táblán nincs közvetlen `company_id`, **kötelező összekapcsolni a szülő táblával és rászűrni a `company_id = p_company_id`-ra**!
* **Service Role bypass tudatosság:**
  * RLS házirendek írásakor vedd figyelembe, hogy a háttér worker (`service_role`) átlépi az RLS-t, míg a frontend kliensek szigorúan a felhasználó JWT tokenjével hajtják végre a szabályokat.
  * *Részletek:* [ADR A-003](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-003-multi-tenancy-rls.md), [ADR A-017](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-017-security-architecture.md), [ADR A-092](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-092-database-security-and-performance-optimization.md) (InitPlan optimalizálás), [ADR A-097](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-097-multi-tenant-nav-items-denormalization-and-gl-optimization.md) és [ADR A-103](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-103-accounty-rls-performance-optimization-and-error-guarding.md).

---

## 🚀 5. Teljesítmény és Indexelés (Production-Grade)
* **Idegen kulcsok (`REFERENCES`):**
  * Minden idegen kulcs oszlopra kötelező B-tree indexet tenni a JOIN műveletek és kaszkádolt törlések felgyorsítására.
* **Gyakran szűrt mezők:**
  * A `company_id, status`, `created_at DESC` típusú lekérdezésekhez készíts összetett (composite) indexet.
* **Szimmetrikus Parciális Indexelés:**
  * Ha egy nullable mezőre (pl. `matched_invoice_id`) parciális indexet hozol létre a kitöltött értékekre (`WHERE matched_invoice_id IS NOT NULL`), és az üzleti logika a nyitott/párosítatlan elemeket is lekérdezi (`WHERE matched_invoice_id IS NULL`), **kötelező mindkét ágra célzott indexet definiálni**!
* **RLS Szülő-Gyermek Index Kényszer:**
  * Ha egy gyermek tábla RLS szabálya allekérdezéssel a szülő táblához fordul, a szülő táblán kötelező a közvetlen index a szűrt oszlopra (`company_id`).
* **Tömeges Adatmozgatás utáni VACUUM:**
  * Tömeges szinkronizáció, backfill vagy nagy törlések után a nagy forgalmú táblákon kötelező a `VACUUM ANALYZE` futtatása a Visibility Map és a statisztikák frissítéséhez.
* **Nagy lekérdezések védelme:**
  * Frontend lekérdezéseknél szigorúan tilos `SELECT *` jellegű lekérdezést futtatni nagy táblákon vagy JSONB mezőkön; csak a szükséges mezőket kérd le.
  * *Részletek:* [ADR A-016](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-016-postgresql-query-strategy.md), [ADR A-050](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-050-server-side-aggregation-and-n-plus-1-optimization.md), [ADR A-092](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-092-database-security-and-performance-optimization.md), [ADR A-097](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-097-multi-tenant-nav-items-denormalization-and-gl-optimization.md) és [ADR A-183](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-183-supabase-query-performance-and-financial-rpc-optimization.md).

---

## 🔄 6. Migrációs Nyilvántartás & Git Szinkron (Baseline Garancia)
* **Zero Phantom Migrations:**
  * Soha ne állítsd a felhasználónak, hogy egy migráció elkészült, amíg a fájl fizikailag meg nem íródott a `supabase/migrations/` mappában.
* **`schema_migrations` teljes körű regisztráció (Név és SQL tartalom kötelező):**
  * Ha egy migrációt közvetlenül futtatsz le egy távoli adatbázison (pl. MCP `execute_sql` vagy `apply_migration`), **szigorúan kötelező** a `version` mellett a `name` és a `statements` oszlopokat is kitölteni a `supabase_migrations.schema_migrations` táblában!
  * **Tilos csak a verziót beszúrni**, mert a `name` hiányában a Supabase Studio felülete *"Name not available"* hibát jelenít meg, a `statements` hiányában pedig a *"View migration SQL"* gomb üres marad.
  * **Kötelező regisztrációs minta:**
    ```sql
    INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
    VALUES (
      '<YYYYMMDDHHMMSS>',
      '<migracio_neve_snake_case>',
      ARRAY[$stmt$ <teljes_futtatott_sql_kod> $stmt$]
    )
    ON CONFLICT (version) DO UPDATE SET
      name = EXCLUDED.name,
      statements = EXCLUDED.statements;
    ```
* **Frontend TypeScript típusok:**
  * Bármilyen séma-, oszlop- vagy RPC-módosítás után ellenőrizd vagy frissítsd a TypeScript típusokat (`src/integrations/supabase/types.ts`).

---

## 🔌 7. PostgREST RPC Hívások & Timeout Védelem (Kritikus API Szabályok)
* **Szigorú Paraméternév Illeszkedés (PGRST202 védelem):**
  * A PostgREST schema cache szigorúan a deklarált SQL argumentumnevek alapján azonosítja a függvényeket.
  * Tilos feltételezni a paraméterneveket! Például a `get_filtered_nav_invoices` lapozása nem `p_limit` / `p_offset`, hanem `p_page` / `p_page_size`.
* **Supabase 8s / 10s Statement Timeout (57014) & Dashboard Résiliencia:**
  1. **In-Memory Caching:** Használj modul-szintű memóriagyorsítótárat (pl. 2 perc TTL), hogy több egymást követő kérés ne terhelje feleslegesen a PostgreSQL-t ([ADR A-190](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-190-management-dashboard-counts-caching-and-worker-vault-offloading.md)).
  2. **Graceful Fallback:** DB timeout (57014) vagy hálózati hiba esetén a kód szolgáljon ki stale adatot vagy biztonságos üres állapotot ahelyett, hogy kivételt dobna és összeomlasztaná a képernyőt.
  3. **Slice-First Index-Only elv:** Az RPC-ken belül a lapozási szeletet (LIMIT/OFFSET) mindig a relációs JOIN-ok és komplex JSONB mezőextrakciók előtt kell képezni.
  4. **⚠️ Számlafejléc Pre-Materializáció & Anti-Join Invariáns:**
     * Többágas összetett tárolt eljárásokban szigorúan tilos az anti-joint és a bérlői/dátumszűrést tételszinten, soronként futtatni!
     * A számlafejléceket (`valid_invoices`, `valid_nav_invoices`) dedikált `AS MATERIALIZED` CTE-kbe kell kiemelni, ahol a bérlő (`company_id`), dátumtartomány és anti-join **pontosan egyszer, fejléc szinten** fut le; a tételek kizárólag ezekhez csatlakozhatnak.
     * *Részletek:* [ADR A-189.2](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-189-gl-rpc-performance-optimization-and-timeout-elimination.md#L139).
  5. **⚠️ Materialized CTE & Gyermektábla Index-Pruning Csapda (`company_id` join-feltétel):**
     * Összetett indexszel (`company_id, ...`) ellátott gyermektáblák csatolásakor a PostgreSQL nem tudja automatikusan áttolni a bérlői szűrést a belső joinba, ha a feltételből hiányzik a cégazonosító.
     * Kötelező a bérlői szűrőt explicit megadni a JOIN `ON` ágában is a szekvenciális vizsgálat megelőzésére:
       ```sql
       -- ✅ HELYES (Összetett index azonnal aktiválódik):
       FROM valid_nav_invoices n
       JOIN public.nav_invoice_items ni 
         ON ni.nav_invoice_id = n.id 
        AND ni.company_id = p_company_id
       ```
     * *Részletek:* [ADR A-189](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-189-gl-rpc-performance-optimization-and-timeout-elimination.md).

---

## 🛑 8. PostgREST Schema Cache Integritás (PGRST204 & PGRST205 Védelem)
* **PGRST204 Védelem — Zéró Fantom Oszlop (Zero Phantom Columns):**
  * Tilos mezőneveket intuíció alapján beírni! Új lekérdezés vagy mutációs payload készítésekor kötelező megnézni a tábla valós sémáját a migrációkban vagy az `information_schema.columns` táblában.
* **PGRST205 Védelem — Schema-First Deploy & Reziliens Cache:**
  * Új táblát használó frontend kódot kizárólag azután szabad élesíteni, miután a migráció fizikailag lefutott a távoli adatbázison, regisztrálva lett, és ki lett adva a cache frissítés (`NOTIFY pgrst, 'reload schema';`).
  * Nem-kritikus összefoglaló kártyáknál fel kell készülni a `PGRST205` / `42P01` hibakódra (graceful degradation).
* **PostgreSQL CHECK Kényszer Integritás (Hiba 23514 Megelőzése):**
  * A frontend mutációs payloadok készítésekor mindig ellenőrizni kell az adatbázis táblára vonatkozó `CHECK` kényszereket. Tilos kitalált státusz-stringeket beküldeni.
  * *Részletek:* [ADR A-016](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-016-postgresql-query-strategy.md).

---

## 🛑 9. PostgREST 1000-Soros Csendes Csonkítás (The Silent Truncation Trap)
* **A veszély:** A Supabase kliens `.from('table').select(...)` hívásai explicit `.range()` nélkül 1000 sornál csendben lezárják az eredményhalmazt.
* **Kötelező Invariáns (Pagination Invariant):**
  * Minden olyan lekérdezésben, ahol az adathalmaz meghaladhatja az 1000 sort, kötelező:
    1. **Lapozási hurok (Loop Pagination):** Iteratív kötegelt lekérés (`range(offset, offset + 999)`).
    2. **Explicit Védelmi Korlát:** Kisebb analitikáknál kötelező explicit `.limit(2000)` megadása és annak UI szintű jelzése.
  * *Részletek:* [ADR A-232](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-232-gl-zero-as-value-multi-account-batching-and-partner-aging.md).

---

## 💰 10. Zero-as-Value & Falsy Védelem és RPC Tömb Pushdown
* **Zero-as-Value Pénzügyi Szabály:**
  * Pénzügyi logikában a `0` teljesen érvényes állapot. Szigorúan kerüld az `amount || default` logikát, helyette mindig nullish coalescing operátort használj (`amount ?? 0`).
* **RPC Tömb Pushdown (Batching Invariant):**
  * Szigorúan tilos N darab párhuzamos RPC hívást indítani több entitáshoz. Az eljárásoknak kötelező támogatniuk a tömb alapú paraméterátadást (`uuid[]`).
  * *Részletek:* [ADR A-232](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-232-gl-zero-as-value-multi-account-batching-and-partner-aging.md).

---

## 🚀 11. Main Merge & Kötelező Éles Migráció Futtatás (Production Migration on Merge Guard)
Minden alkalommal, amikor kód kerül beolvasztásra a `main` ágba:
1. **Migrációs Diff és Divergencia Ellenőrzés (`git log main..develop`):**
   * Ha a diffben a jelenlegi feladaton felüli egyéb migrációk vagy forrásfájlok is találhatók, az agent **KÖTELES MEGÁLLNI ÉS RÁKÉRDEZNI A FELHASZNÁLÓNÁL (`ask_question`)** (Teljes Merge vs Célzott Hotfix Ág).
2. **Kötelező Éles Végrehajtás és Teljeskörű DB Szinkronizáció:**
   * Teljes develop merge esetén **SZIGORÚAN KÖTELEZŐ** a `develop` ágon lévő MINDEN sémamódosítást, új táblát, mezőt, indexet, tárolt eljárást (RPC), RLS szabályt és Edge Functiont maradéktalanul lefutatni és érvényesíteni az éles (Prod) adatbázison (`vxxgvdlqvvchtlmqnrqf`).
3. **Config.toml Izoláció:**
   * A `supabase/config.toml` fájlban a `main` ágon mindig az éles (`vxxgvdlqvvchtlmqnrqf`), a `develop` ágon mindig a dev (`qhvcdqkqpgpdxogqqvyr`) azonosítónak kell szerepelnie.
4. **Bizonyítási Kapu (Evidence Gate):**
   * A feladat nem tekinthető befejezettnek, amíg nincs fizikai bizonyíték az éles DB szinkronitásáról.
