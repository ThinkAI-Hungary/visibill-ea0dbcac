---
trigger: model_decision
description: Apply when touching database schemas, writing migrations, RPC functions, RLS policies, or Supabase queries in eaisybill-prod.
---

# Database & Migration Guidelines (Visibill / eaisybill-prod)

> [!IMPORTANT]
> **Mély Specifikáció & Architektúra:**
> Ez a szabály kizárólag a tömör védőkorlátokat és invariánsokat rögzíti. A részletes technikai magyarázatokat, kódpéldákat és benchmarkokat a [docs/architecture/database-guidelines.md](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/database-guidelines.md) specifikáció, valamint a globális [supabase-postgres-best-practices](file:///C:/Users/Morfi/.gemini/config/skills/supabase-postgres-best-practices/SKILL.md) skill tartalmazza.

---

## 🎯 1. Zero Silent DB Decisions
* **Kifejezett jóváhagyás kötelező:** Új tábla, meglévő oszlopok módosítása, típusváltása vagy törlése előtt kötelező bemutatni a sémát a felhasználónak.
* **Destruktív műveletek tiltása:** `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` vagy feltétel nélküli `DELETE` szigorúan tilos felhasználói jóváhagyás nélkül.

---

## 📁 2. Migrációs Szabvány & Idempotencia
* **Hely és fájlformátum:** Kizárólag `supabase/migrations/YYYYMMDDHHMMSS_<leiro_nev_snake_case>.sql` (pontosan 14 számjegyű egyedi időbélyeg).
* **Zero Clutter:** Átmeneti, seed vagy manuális SQL szkripteket kizárólag a `scratch/` mappába szabad menteni, a `supabase/migrations/` könyvtárba soha!
* **Kötelező Idempotencia:** Minden DDL utasításnak újrafuttathatónak kell lennie (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`).
* *Részletek:* [ADR A-002](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-002-supabase-baas.md).

---

## ⚙️ 3. RPC Szabvány & Short-Circuit Limit Invariáns
* **`search_path` védelem:** `SECURITY DEFINER` függvényeknél kötelező a `SET search_path = public, pg_temp`.
* **Explicit Volatilitás a Fejlécben:** Lekérdező eljárásoknál kötelező a `LANGUAGE plpgsql STABLE` deklaráció (a `CREATE OR REPLACE` egyébként csendben `VOLATILE`-ra állítja vissza!).
* **Public Grant Megvonása:** Új RPC-nél kötelező a kétlépcsős jogosultságkezelés:
  ```sql
  REVOKE EXECUTE ON FUNCTION public.my_rpc(...) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.my_rpc(...) TO authenticated, service_role;
  ```
* **⚠️ Short-Circuit Limit Invariáns (Unbounded Materialization Kivédése):**
  PostgreSQL PL/pgSQL függvényben a `RETURN QUERY` kifejezés belső limit nélkül a teljes eredményhalmazt materializálja a memóriában (timeoutot okozva még akkor is, ha a hívó külső limitet ad meg).
  **Kötelező:**
  1. `p_limit integer DEFAULT 1000` paraméter.
  2. Belső korlát: `v_effective_limit := LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 5000);`.
  3. Belső `RETURN QUERY (...) LIMIT v_effective_limit;` elhelyezése a korai indexscan leálláshoz ([ADR A-259](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-259-invoice-items-denormalization-and-unclassified-gl-rpc-limit.md)).
* **Kötelező Vitest Regressziós Teszt:** Minden új vagy módosított RPC-hez kötelező automatizált tesztet írni a `src/test/` alatt és zölden futtatni.
* **Batch Upsert Védelem (Hiba 21000):** `ON CONFLICT DO UPDATE` előtt kötelező kliensoldali deduplikáció és tárolt eljárás szintű `WITH ORDINALITY` normalizáció ([ADR A-193](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-193-nav-hybrid-async-sync-and-atomic-item-idempotency.md)).

---

## 🛡️ 4. RLS & Multi-Tenant Tételtábla Denormalizáció
* **RLS kötelező minden táblán:** `ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;`.
* **⚠️ Multi-Tenant Tételtábla Denormalizáció & Zéró Lateral Join (Line-Item Invariant):**
  Minden 1000 sort meghaladó pénzügyi gyermektáblán (`invoice_items`, `nav_invoice_items`, `acc_journal_lines`, `petty_cash_items`):
  1. **Közvetlen `company_id` oszlop kötelező:** `company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE`.
  2. **Összetett Index Kötelező:** `CREATE INDEX idx_table_comp_parent ON table(company_id, parent_id);`.
  3. **Közvetlen RLS Kötelező:** `company_members cm WHERE cm.company_id = table.company_id` (szigorúan tilos szülő táblás `EXISTS (SELECT 1 FROM parent ...)` áttételes vizsgálat).
  4. **Defense-in-Depth Triggerek:** `BEFORE INSERT/UPDATE` trigger a `company_id` kitöltésére, és `AFTER UPDATE` trigger a szülő táblán.
  5. **Kliensoldali Lateral Join Tilalom:** Kliens kódban (Supabase JS, hookok) tilos a gyermektáblát szülő reláción keresztül szűrni (`invoices!inner(company_id)`). Kizárólag közvetlen szűrés engedélyezett: `.eq('company_id', companyId)`.
* *Részletek:* [ADR A-097](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-097-multi-tenant-nav-items-denormalization-and-gl-optimization.md) és [ADR A-259](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-259-invoice-items-denormalization-and-unclassified-gl-rpc-limit.md).

---

## 🚀 5. Teljesítmény és Indexelés (Production-Grade)
* **Idegen kulcsok:** Minden idegen kulcs oszlopra (`REFERENCES`) kötelező a B-tree index.
* **Szimmetrikus Parciális Indexelés:** Nullable szűrt mezőknél mindkét ágra (`IS NOT NULL` és `IS NULL`) kötelező célzott parciális indexet definiálni ([ADR A-092](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-092-database-security-and-performance-optimization.md)).
* **Pre-Materializáció & Index-Pruning Csapda:** Összetett eljárásokban a számlafejléceket dedikált `AS MATERIALIZED` CTE-be kell kiemelni; a gyermektábla összekapcsolásakor az `ON` záradékban kötelező a `company_id = p_company_id` feltétel ([ADR A-189](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-189-gl-rpc-performance-optimization-and-timeout-elimination.md)).
* **Konzol- és Kódtisztaság:** Frontend lekérdezéseknél tilos a `SELECT *` nagy táblákon; csak a szükséges mezőket kérd le.

---

## 🛑 6. PostgREST & Query Védőkorlátok
* **PGRST204 (Zéró Fantom Oszlop):** Tilos mezőneveket intuíció alapján beírni; lekérdezés vagy mutáció előtt kötelező ellenőrizni a valós DB sémát a migrációkban vagy az `information_schema.columns` táblában.
* **PGRST205 (Schema-First Deploy):** Új táblát használó frontend kódot csak azután szabad élesíteni, miután a migráció lefutott, bekerült a `schema_migrations`-be, és ki lett adva: `NOTIFY pgrst, 'reload schema';`. Nem-kritikus kártyáknál kötelező a graceful fallback.
* **1000-Soros Csendes Csonkítás (Pagination Invariant):** Ha az adathalmaz meghaladhatja az 1000 sort, kötelező az iteratív lapozási hurok (`range(offset, offset + 999)`) a hamis rész-egyenlegek elkerülésére ([ADR A-232](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-232-gl-zero-as-value-multi-account-batching-and-partner-aging.md)).
* **Zero-as-Value & Falsy Védelem:** Pénzügyi logikában a 0 teljesen érvényes érték. Tilos az `amount || default`, kötelező a nullish coalescing: `amount ?? 0`.
* **RPC Tömb Pushdown:** N darab párhuzamos hívás helyett az eljárásoknak kötelező támogatniuk a tömb alapú paraméterátadást (`uuid[]`).

---

## 🔄 7. Migrációs Nyilvántartás & Git Szinkron
* **`schema_migrations` Teljes Körű Regisztráció:** Távoli DB-n végzett közvetlen futtatáskor a `version` mellett a `name` és a `statements` (futtatott SQL) oszlopokat is kötelező beszúrni a `supabase_migrations.schema_migrations` táblába.
* **Frontend TypeScript Típusok:** Séma- vagy RPC-módosítás után kötelező a típusok szinkronizálása a `src/integrations/supabase/types.ts` fájlban.

---

## 🚀 8. Main Merge & Kötelező Éles Migráció Futtatás
* **Divergencia Audit (`git log main..develop`):** Ha a diffben a jelenlegi feladaton felüli egyéb migrációk vagy fájlok is találhatók, az agent **KÖTELES MEGÁLLNI ÉS RÁKÉRDEZNI (`ask_question`)** (Teljes Merge vs Célzott Hotfix Ág).
* **Teljeskörű Prod DB Szinkronizáció:** Teljes develop merge esetén **SZIGORÚAN KÖTELEZŐ** a `develop` ágon lévő MINDEN sémamódosítást, új táblát, mezőt, indexet, tárolt eljárást (RPC), RLS szabályt és Edge Functiont maradéktalanul lefutatni és érvényesíteni az éles Prod DB-n (`vxxgvdlqvvchtlmqnrqf`).
* **Config.toml Izoláció:** A `supabase/config.toml` fájlban lévő `project_id`-t tilos összemergedni: `main`-en mindig az éles (`vxxgvdlqvvchtlmqnrqf`), `develop`-on mindig a dev (`qhvcdqkqpgpdxogqqvyr`) azonosítónak kell szerepelnie!
* **Evidence Gate:** A feladat nem befejezett fizikai lekérdezési bizonyíték nélkül az éles DB szinkronitásáról.
