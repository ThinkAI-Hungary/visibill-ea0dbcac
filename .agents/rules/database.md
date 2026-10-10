---
trigger: model_decision
description: Apply when touching database schemas, writing migrations, RPC functions, RLS policies, or Supabase queries in eaisybill-prod.
---

# Database & Migration Guidelines (Visibill / eaisybill-prod)

> [!TIP]
> **Külső Hivatalos Szabványok:**
> A projekt specifikus szabályain felül kötelezően alkalmazandók a globális [supabase-postgres-best-practices](file:///C:/Users/Morfi/.gemini/config/skills/supabase-postgres-best-practices/SKILL.md) és [supabase](file:///C:/Users/Morfi/.gemini/config/skills/supabase/SKILL.md) skillek iránymutatásai (pl. RLS performance, BOLA védelem, composite indexek, lock management, valamint pg_cron / pgmq kezelés).

## 🎯 1. Zero Silent DB Decisions
* **Kifejezett jóváhagyás kötelező:**
  * Bármilyen új tábla létrehozása, meglévő tábla oszlopainak módosítása, típusváltása vagy törlése előtt kötelező bemutatni a tervezett sémát a felhasználónak.
* **Destruktív műveletek tiltása:**
  * `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` vagy feltétel nélküli `DELETE` szigorúan tilos felhasználói jóváhagyás nélkül.

---

## 📁 2. Migrációs Szabvány & Fájlkonvenciók (KÖTELEZŐ)
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
  * Bármilyen manuális segédszkript, teszt adatbázis-feltöltő, egyszeri javítószkript (`MANUAL_RUN_...`, `seed_...`, `temp_...`) kizárólag a `scripts/` mappába kerülhet, **soha nem a `supabase/migrations/` könyvtárba**!
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
  * *Részletek:* [ADR A-002](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-002-supabase-baas.md).

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
  * PostgreSQL-ben a `CREATE OR REPLACE FUNCTION` futtatásakor, ha nincs explicit kiírva a `STABLE` kulcsszó a fejlécben, a motor **automatikusan és csendben visszaállítja `VOLATILE`-ra** a függvényt (még akkor is, ha korábban egy másik migrációban `ALTER FUNCTION ... STABLE` futott rá!).
  * Minden lekérdező vagy riportáló RPC újradefiniálásakor a fejlécben kötelező a `LANGUAGE plpgsql STABLE` deklaráció!
* **⚠️ PostgreSQL DEFAULT PUBLIC GRANT Csapda (Jogosultság-szivárgás védelem):**
  * A PostgreSQL automatikusan `GRANT EXECUTE TO PUBLIC` jogot ad minden új függvényre. A `GRANT EXECUTE ... TO authenticated, service_role;` kiadása **nem vonja vissza** az `anon` jogosultságot!
  * Új vagy módosított `SECURITY DEFINER` eljárásnál kötelező a kétlépcsős jogosultság-kezelés:
    ```sql
    REVOKE EXECUTE ON FUNCTION public.my_rpc(...) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.my_rpc(...) TO authenticated, service_role;
    ```
* **🧪 Kötelező RPC Tesztelés és Verifikáció:**
  * Bármilyen RPC létrehozásakor vagy módosításakor **szigorúan kötelező hozzá tesztet írni** (kliensoldali Vitest regressziós/szerződésteszt a `src/test/` könyvtárban, pl. `src/test/rpcPerformanceAndResilience.test.ts`), és a verifikációs kapuban le is kell futtatni!
  * Élő adatbázison a katalógus attribútumokat (`pg_proc` provolatile és jogosultságok) is ellenőrizni kell.
* **Strukturált visszatérési értékek:**
  * Mindig határozz meg pontos visszatérési típust (`RETURNS jsonb`, `RETURNS boolean`, vagy `RETURNS TABLE (id uuid, name text, ...)`). Kerüld a generikus, nem típusos `RETURNS record` használatát.
* **⚠️ Batch Upsert & Kardinalitás Védelem (`ON CONFLICT DO UPDATE` - Hiba 21000):**
  * PostgreSQL-ben az `INSERT ... ON CONFLICT (...) DO UPDATE` parancs azonnal elhasal `21000: ON CONFLICT DO UPDATE command cannot affect row a second time` hibával, ha a bemeneti relációban (pl. `jsonb_array_elements(...)` vagy kötegelt insert) egynél több olyan sor szerepel, amely azonos konfliktus-célpontra illeszkedik!
  * **Kötelező védelem:** Minden olyan RPC-ben vagy kötegelt mentésben, amely `ON CONFLICT DO UPDATE`-et használ:
    1. **Kliens- és parserszinten:** Kötelező deduplikálni a kulcsokat az adatbázis hívása előtt (pl. `seenLineNumbers` halmaz és monoton növekvő sorszámozás).
    2. **Tárolt eljárás szinten:** Az eljárásnak belsőleg reziliensnek kell lennie. Ha a bemeneti JSON-ban duplikáció érkezik, az eljárás `WITH ORDINALITY` CTE és sorszám-normalizálás segítségével köteles belsőleg feloldani az ütközést ahelyett, hogy eldobná a tranzakciót.
  * *Részletek:* [ADR A-016](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-016-postgresql-query-strategy.md), [ADR A-092](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-092-database-security-and-performance-optimization.md) (search_path & jogosultság-védelem), [ADR A-096](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-096-authoritative-nav-line-items-crosscheck-and-sync-guard.md), [ADR A-183](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-183-supabase-query-performance-and-financial-rpc-optimization.md) (RPC volatilitás & gyorsítás) és [ADR A-193](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-193-nav-hybrid-async-sync-and-atomic-item-idempotency.md).

---

## 🛡️ 4. Row Level Security (RLS) és Bérlői Védelem
* **RLS kötelező minden táblán:**
  * Új tábla létrehozásakor azonnal ki kell adni:
    ```sql
    ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;
    ```
* **Explicit szabályok:**
  * Mindig definiálj explicit `SELECT`, `INSERT`, `UPDATE`, `DELETE` szabályokat a bérlői/cég jogosultságok (`company_id`, `auth.uid()`) alapján.
* **⚠️ Multi-Tenant CTE Izoláció (Cross-Tenant Scan Védelem):**
  * Amikor egy soronkénti allekérdezést `MATERIALIZED CTE`-be vagy hash join aggregációba emelsz ki teljesítményoptimalizálás céljából, és a belső táblán (pl. `invoice_items`, `nav_invoice_items`) nincs közvetlen `company_id`, **kötelező összekapcsolni a szülő táblával és rászűrni a `company_id = p_company_id`-ra**!
  * Ennek elmulasztása esetén a PostgreSQL minden bérlői lekérdezésnél az adatbázis összes cégének adatait végigpásztázza, ami súlyos cross-tenant adatszivárgást és exponenciális lassulást okoz.
* **Service Role bypass tudatosság:**
  * RLS házirendek írásakor vedd figyelembe, hogy a háttér worker (`service_role`) átlépi az RLS-t, míg a frontend kliensek szigorúan a felhasználó JWT tokenjével hajtják végre a szabályokat.
  * *Részletek:* [ADR A-003](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-003-multi-tenancy-rls.md), [ADR A-017](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-017-security-architecture.md), [ADR A-092](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-092-database-security-and-performance-optimization.md) (InitPlan optimalizálás), [ADR A-097](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-097-multi-tenant-nav-items-denormalization-and-gl-optimization.md) (tételszintű bérlői denormalizáció) és [ADR A-103](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-103-accounty-rls-performance-optimization-and-error-guarding.md) (Hashed SubPlan & rekurzió-mentesítés).

---

## 🚀 5. Teljesítmény és Indexelés (Production-Grade)
* **Idegen kulcsok (`REFERENCES`):**
  * Minden idegen kulcs oszlopra kötelező B-tree indexet tenni a JOIN műveletek és kaszkádolt törlések felgyorsítására.
* **Gyakran szűrt mezők:**
  * A `company_id, status`, `created_at DESC` típusú lekérdezésekhez készíts összetett (composite) indexet.
* **Szimmetrikus Parciális Indexelés:**
  * Ha egy nullable mezőre (pl. `matched_invoice_id`) parciális indexet hozol létre a kitöltött értékekre (`WHERE matched_invoice_id IS NOT NULL`), és az üzleti logika a nyitott/párosítatlan elemeket is lekérdezi (`WHERE matched_invoice_id IS NULL`), **kötelező mindkét ágra célzott indexet definiálni**!
* **RLS Szülő-Gyermek Index Kényszer:**
  * Ha egy gyermek tábla (pl. `acc_journal_lines`) RLS szabálya allekérdezéssel a szülő táblához fordul (`header_id IN (SELECT id FROM acc_journal_headers WHERE company_id = ...)`), a szülő táblán kötelező a közvetlen index a szűrt oszlopra (`company_id`).
* **Tömeges Adatmozgatás utáni VACUUM:**
  * Tömeges szinkronizáció, backfill vagy nagy törlések után a nagy forgalmú táblákon (`nav_invoice_items`, `transactions`, `accounty_missing_items`) kötelező a `VACUUM ANALYZE` futtatása a Visibility Map és a statisztikák frissítéséhez.
* **Nagy lekérdezések védelme:**
  * Frontend lekérdezéseknél szigorúan tilos `SELECT *` jellegű lekérdezést futtatni nagy táblákon vagy JSONB mezőkön; csak a szükséges mezőket kérd le.
  * *Részletek:* [ADR A-016](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-016-postgresql-query-strategy.md), [ADR A-050](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-050-server-side-aggregation-and-n-plus-1-optimization.md), [ADR A-092](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-092-database-security-and-performance-optimization.md) (91 Foreign Key index & parciális indexek), [ADR A-097](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-097-multi-tenant-nav-items-denormalization-and-gl-optimization.md) és [ADR A-183](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-183-supabase-query-performance-and-financial-rpc-optimization.md) (összetett és részleges indexelés).

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
  * Tilos feltételezni a paraméterneveket! Például a `get_filtered_nav_invoices` lapozása nem `p_limit` / `p_offset`, hanem:
    ```typescript
    // ✅ HELYES:
    await supabase.rpc('get_filtered_nav_invoices', {
      p_company_id: companyId,
      p_page: 1,
      p_page_size: 50,
      p_direction: 'inbound', // vagy 'outbound'
    });

    // ❌ HIBÁS (PGRST202 hibát dob):
    await supabase.rpc('get_filtered_nav_invoices', {
      p_company_id: companyId,
      p_limit: 50,
      p_offset: 0,
    });
    ```
  * Új RPC hívás írásakor mindig ellenőrizd a pontos SQL deklarációt a migrációs fájlban vagy az `information_schema.parameters` táblában.

* **Supabase 8s Statement Timeout (57014) & Dashboard Résiliencia:**
  * A Supabase szerepkörökön 8 másodperces `statement_timeout` él.
  * Olyan Edge Function-ökben vagy felületeken, amelyek összetett aggregáló RPC-t hívnak (pl. `get_company_counts`, `get_management_files`):
    1. **In-Memory Caching:** Használj modul-szintű memóriagyorsítótárat (pl. 2 perc TTL), hogy több egymást követő kérés ne terhelje feleslegesen a PostgreSQL-t ([ADR A-190](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-190-management-dashboard-counts-caching-and-worker-vault-offloading.md), valamint 57014 timeout kivédés: [ADR A-097](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-097-multi-tenant-nav-items-denormalization-and-gl-optimization.md) és [ADR A-103](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-103-accounty-rls-performance-optimization-and-error-guarding.md)).
    2. **Graceful Fallback:** DB timeout (57014) vagy hálózati hiba esetén a kód szolgáljon ki stale adatot vagy biztonságos üres állapotot ahelyett, hogy kivételt dobna és összeomlasztaná a képernyőt.
    3. **Slice-First Index-Only elv:** Az RPC-ken belül a lapozási szeletet (LIMIT/OFFSET) mindig a relációs JOIN-ok és komplex JSONB mezőextrakciók előtt kell képezni.
    4. **⚠️ Számlafejléc Pre-Materializáció & Anti-Join Invariáns:**
       * Többágas összetett tárolt eljárásokban szigorúan tilos az anti-joint és a bérlői/dátumszűrést tételszinten, soronként futtatni!
       * A számlafejléceket (`valid_invoices`, `valid_nav_invoices`) dedikált `AS MATERIALIZED` CTE-kbe kell kiemelni, ahol a bérlő (`company_id`), dátumtartomány és anti-join **pontosan egyszer, fejléc szinten** fut le; a tételek kizárólag ezekhez csatlakozhatnak.
       * *Részletes háttérelemzés, CTE architektúra és benchmarkok:* [ADR A-189.2](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-189-gl-rpc-performance-optimization-and-timeout-elimination.md#L139).
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
       * *Részletek:* [ADR A-189](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-189-gl-rpc-performance-optimization-and-timeout-elimination.md).

---

## 🛑 8. PostgREST Schema Cache Integritás (PGRST204 & PGRST205 Védelem)

A Supabase API rétege (PostgREST) belső séma-gyorsítótárral (schema cache) dolgozik. Bármilyen eltérés a kód és a DB között azonnali 4xx hibát dob.

### A) PGRST204 Védelem — Zéró Fantom Oszlop (Zero Phantom Columns):
* **Hiba tünete:** `Could not find the 'xyz' column of 'table' in the schema cache`.
* **Kiváltó ok:** A frontend vagy Edge Function olyan mezőt küld be `.insert()` / `.update()` payloadban, vagy kér le `.select()`-ben, amely fizikailag nem létezik a PostgreSQL táblában (pl. elírás vagy feltételezett kapcsolat, mint a `nav_invoice_id` az `invoices` táblán).
* **Kötelező Invariáns:**
  1. **Séma-ellenőrzés írás előtt:** Tilos mezőneveket intuíció alapján beírni! Új lekérdezés vagy mutációs payload készítésekor **kötelező megnézni a tábla valós sémáját** a legutolsó releváns migrációs fájlban vagy élő DB esetén az `information_schema.columns` táblában (`execute_sql`).
  2. **Típusosítás:** Ha egy tábla sémája változik, tilos `Record<string, any>` maszkolással elrejteni az oszlopokat; törekedni kell a generált vagy explicit interfészek használatára.

### B) PGRST205 Védelem — Schema-First Deploy & Reziliens Cache:
* **Hiba tünete:** `Could not find the table 'public.xyz' in the schema cache`.
* **Kiváltó ok:** A felület már hivatkozik egy új táblára, de a migráció még nem futott le az éles DB-ben, vagy lefutott, de a PostgREST cache nem frissült / a migráció nincs regisztrálva a `schema_migrations` táblában.
* **Kötelező Invariáns:**
  1. **Schema-First Sorrend:** Új táblát használó frontend kódot kizárólag **azután** szabad élesíteni, miután a migráció fizikailag lefutott a távoli adatbázison, regisztrálva lett a `supabase_migrations.schema_migrations` táblában, és ki lett adva a cache frissítés:
     ```sql
     NOTIFY pgrst, 'reload schema';
     ```
  2. **UI Nem-Kritikus Query Résiliencia (Graceful Degradation):**
     * Nem-kritikus összefoglaló kártyáknál, fejléc számlálóknál vagy banner KPI lekérdezéseknél (pl. OPG forgalom, függő tételek) a query catch blokkjának fel kell ismernie a `PGRST205` / `42P01` hibakódot, és csendes default értékkel (`0` / `null`) kell visszatérnie a teljes oldal összeomlása és az `app_error_logs` elárasztása helyett.

### C) PostgreSQL CHECK Kényszer Integritás (Hiba 23514 Megelőzése):
* **Hiba tünete:** `new row for relation "xyz" violates check constraint "xyz_check"` (PostgreSQL hibakód: `23514`).
* **Kiváltó ok:** A kliensoldalról vagy Edge Function-ből feltételezett, kitalált státusz-értékeket küldünk be (pl. `invoices.statusz = 'partially_paid'` vagy `'feldolgozva'`), amelyek nem szerepelnek a DB `CHECK` kényszerében megengedett literálok között.
* **Kötelező Invariáns:**
  1. **CHECK kényszer ellenőrzése:** A frontend mutációs payloadok készítésekor mindig ellenőrizni kell az adatbázis táblára vonatkozó `CHECK` kényszereket a migrációkban vagy a `pg_constraint` katalógustáblában.
  2. **Valós adatokkal való kifejezés:** Ha egy entitás részleges állapotban van (pl. részfizetett számla), azt a valós összegmezőkkel (`fizetve_osszeg > 0 AND fizetve_osszeg < brutto_osszeg`) kell kifejezni az engedélyezett enum státusz (`'feldolgozott'`) megtartása mellett, nem ad-hoc státuszstringek kitalálásával.
* *Részletek (PostgREST lekérdezési stratégia és hibamegelőzés):* [ADR A-016](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-016-postgresql-query-strategy.md).

---

## 🛑 9. PostgREST 1000-Soros Csendes Csonkítás (The Silent Truncation Trap)
* **A PostgREST 1000 soros limit veszélye:**
  * A Supabase kliens `.from('table').select(...)` hívásai explicit `.range()` vagy `.limit()` nélkül a PostgREST alapértelmezett korlátja miatt **pontosan 1000 sornál csendben lezárják az eredményhalmazt**.
  * Főkönyvi kartonoknál, partner analitikáknál és naplóknál ez végzetes adatcsonkítást okoz: a rendszer nem jelez hibát, de az 1001. sortól kezdve a tételek hiányoznak, ami hamis kumulált egyenlegeket és hibás audit riportokat eredményez.
* **Kötelező Invariáns (Pagination Invariant):**
  * Minden olyan lekérdezésben, ahol az adathalmaz meghaladhatja az 1000 sort, kötelező:
    1. **Lapozási hurok (Loop Pagination):** Iteratív kötegelt lekérés (pl. `range(offset, offset + 999)`) mindaddig, amíg a visszaadott sorok száma eléri az 1000-et.
    2. **Explicit Védelmi Korlát:** Kisebb analitikáknál kötelező explicit `.limit(2000)` megadása és annak UI szintű jelzése, ha a limit elérte a határt.
  * *Részletek és partner folyószámla implementáció:* [ADR A-232](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-232-gl-zero-as-value-multi-account-batching-and-partner-aging.md).

---

## 💰 10. Zero-as-Value & Falsy Védelem és RPC Tömb Pushdown
* **Zero-as-Value Pénzügyi Szabály:**
  * Pénzügyi logikában a `0` (nulla összeg, nulla egyenleg, nulla különbözet) teljesen érvényes és kitöltött állapot, nem kezelhető `null`-ként vagy `undefined`-ként!
  * Szigorúan kerüld a naiv `if (amount)` vagy `amount || default` logikát, helyette mindig explicit nullish coalescing operátort használj (`amount ?? 0`).
  * SQL tárolt eljárásokban paraméterszűrésnél a `p_value IS NOT NULL` feltételt használd ahelyett, hogy a 0 értéket a szűrő kihagyásaként értelmeznéd.
* **RPC Tömb Pushdown (Batching Invariant):**
  * Ha a kliensnek több entitáshoz (pl. több kijelölt főkönyvi számhoz vagy partnerhez) van szüksége tételes adatokra, **szigorúan tilos N darab párhuzamos RPC hívást indítani**.
  * Az eljárásoknak kötelező támogatniuk a tömb alapú paraméterátadást (pl. `p_gl_account_ids uuid[] DEFAULT NULL`), lehetővé téve a PostgreSQL szintű egyetlen menetes szűrést és aggregációt.
  * *Részletek:* [ADR A-232](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-232-gl-zero-as-value-multi-account-batching-and-partner-aging.md).

---

## 🚀 11. Main Merge & Kötelező Éles Migráció Futtatás (Production Migration on Merge Guard)

Minden alkalommal, amikor kód kerül beolvasztásra a `main` ágba (akár Pull Request útján, akár közvetlen `git merge develop` paranccsal):

1. **Migrációs Diff Ellenőrzés (Pre-Merge Diff Check):**
   * A merge előtt kötelező ellenőrizni, hogy a beolvasztandó commitok tartalmaznak-e új vagy módosított migrációs fájlt:
     ```powershell
     git diff main...develop --name-only -- supabase/migrations/
     ```
2. **Kötelező Éles Végrehajtás (Mandatory Execution on Prod DB):**
   * Ha a diffben új vagy módosított migráció szerepel:
     * **SZIGORÚAN KÖTELEZŐ elvégezni az adatbázis-migrációt az éles (Prod) Supabase adatbázison (`vxxgvdlqvvchtlmqnrqf`, MCP: `supabase-visibill`)!**
     * Sosem szabad a `main` ágat úgy hagyni, hogy a kód már feltételez egy új táblát, mezőt, RPC-t vagy RLS szabályt, de az éles adatbázis még a régi sémán fut.
3. **Alkalmazási Módok és Verifikáció:**
   * **Automatikus GitHub Integráció:** Ha a `main` ágra történő push után a Supabase automatikus integrációja fut le, az agent köteles lekérdezni a Prod DB `supabase_migrations.schema_migrations` tábláját, és ellenőrizni, hogy a migráció verziója sikeresen regisztrálásra került.
   * **Közvetlen migráció futtatás (Direct Apply):** Ha a migráció nem fut le automatikusan, az agent köteles a jóváhagyott migrációs SQL-t a Prod DB-n végrehajtani (`execute_sql` vagy `apply_migration`), majd kiadni a schema reload parancsot:
     ```sql
     NOTIFY pgrst, 'reload schema';
     ```
4. **Bizonyítás (Evidence Gate):**
   * A feladat nem tekinthető befejezettnek mindaddig, amíg nincs fizikai bizonyíték arról, hogy az éles adatbázis sémája naprakész a `main` ágon lévő kóddal.


