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
    1. **In-Memory Caching:** Használj modul-szintű memóriagyorsítótárat (pl. 2 perc TTL), hogy több egymást követő kérés ne terhelje feleslegesen a PostgreSQL-t.
    2. **Graceful Fallback:** DB timeout (57014) vagy hálózati hiba esetén a kód szolgáljon ki stale adatot vagy biztonságos üres állapotot ahelyett, hogy kivételt dobna és összeomlasztaná a képernyőt.
    3. **Slice-First Index-Only elv:** Az RPC-ken belül a lapozási szeletet (LIMIT/OFFSET) mindig a relációs JOIN-ok és komplex JSONB mezőextrakciók előtt kell képezni.

