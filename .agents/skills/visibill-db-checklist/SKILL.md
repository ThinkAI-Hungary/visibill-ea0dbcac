---
name: visibill-db-checklist
description: Use when ANY Visibill task involves database operations — new tables, migrations, RPC functions, RLS policies, Edge Function DB queries, or frontend Supabase queries. Triggers on "migration", "RPC", "RLS", "tábla", "SQL", "SECURITY DEFINER", "CREATE TABLE", "CREATE FUNCTION", "Edge Function query", "supabase query", "index", "policy", "trigger", "PGMQ", "adatbázis", "database", "schema".
---

# Visibill DB/SQL Best Practices Checklist

> **Szabály:** Ha a feature bármilyen DB műveletet érint, az AI KÖTELES végigmenni ezeken a checklist-eken.

## KÖTELEZŐ: Referenciák Betöltése

Az AI **KÖTELES** első lépésként megnyitni és elolvasni:

1. **`supabase` skill**: [supabase/SKILL.md](file:///~/.gemini/config/skills/supabase/SKILL.md) — Security checklist, Schema Changes
2. **`supabase-postgres-best-practices` skill**: [supabase-postgres-best-practices/SKILL.md](file:///~/.gemini/config/skills/supabase-postgres-best-practices/SKILL.md) — Rule Categories by Priority
3. **Visibill ADR-ek**:
   - [A-016](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-016-postgresql-query-strategy.md) — 77 RPC function katalógus, PostgREST vs RPC, SECURITY DEFINER
   - [A-017](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-017-security-architecture.md) — RLS pattern, multi-tenancy, audit trail
   - [A-003](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-003-multi-tenancy-rls.md) — Multi-tenancy RLS
   - [A-005](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-005-edge-functions.md) — 46 Edge Function katalógus (ha EF érintett)
4. **Adatbázis Séma és Táblák**:
   - [database-schema.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/database-schema.md) — A teljes adatbázis séma áttekintő (155 tábla)
   - [database/](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/database/) — Részletes csoportosított tábla és mezőleírások (01-21 csoportok)

> ⚠️ Ezen referenciák elolvasása nélkül TILOS bármilyen SQL, migration vagy DB kód tervezése!

---

## 1. Általános DB Checklist

```markdown
### 🗄️ DB/SQL Döntések & Best Practices
| # | Szabály | Ellenőrzés | Státusz |
|---|--------|-----------|---------| 
| DB-1 | **RLS policy szükséges?** | Minden tábla RLS-sel védett (ADR A-003) | ✅/❌ |
| DB-2 | **RLS: `(SELECT auth.uid())` InitPlan** | SELECT-be wrappelt auth.uid() → per-scan InitPlan | ✅/❌ |
| DB-3 | **FK indexek** | Minden foreign key oszlopra van index? | ✅/❌ |
| DB-4 | **SECURITY DEFINER: search_path** | `SET search_path TO 'public'` | ✅/❌ |
| DB-5 | **SECURITY DEFINER: EXECUTE revoke** | `anon` role-ról REVOKE, explicit GRANT | ✅/❌ |
| DB-6 | **Permissive RLS: ne legyen USING(true)** | SELECT policy-k company_id-re szűrjenek | ✅/❌ |
| DB-7 | **Pagination** | 1000+ soros tábláknál server-side pagination | ✅/❌ |
| DB-8 | **Auth API pagination** | `auth.admin.listUsers()` lapozva | ✅/❌ |
| DB-9 | **N+1 query elkerülés** | Nincs loop-ban query | ✅/❌ |
| DB-10 | **Denormalizáció indokolás** | Dokumentáld miért | ✅/❌ |
| DB-11 | **Redundáns RLS szabályok** | Kerüljük, vonjuk össze OR-ral | ✅/❌ |
| DB-12 | **🔴 Trigger SECURITY DEFINER (A-020)** | Minden trigger function ami más táblába ír → SECURITY DEFINER KÖTELEZŐ (auth.uid() NULL trigger kontextusban) | ✅/❌ |
| DB-13 | **🔴 Trigger search_path extensions (A-020)** | Ha extension function-t hív (gen_random_bytes, net.http_post) → `SET search_path TO 'public', 'extensions'` | ✅/❌ |
| DB-14 | **🔴 CREATE OR REPLACE attribútum-megőrzés (A-020)** | `CREATE OR REPLACE` NEM örökli SECURITY DEFINER-t — explicit újra kell adni! | ✅/❌ |
| DB-15 | **🔴 Monolitikus RPC & Unified Ledger ellenőrzés** | Ha az RPC > 150 sor vagy 3+ forrást kapcsol össze: indokolt-e az on-the-fly unió, vagy egységes tételtáblából (`acc_journal_lines`) kell olvasni? | ✅/❌ |
| DB-16 | **🔴 pgTAP Adatbázis Tesztelés (Pénzügyi RPC-k)** | Számítási/főkönyvi RPC-khez (`calculate_*`, `get_gl_*`, `get_pnl_*`) kötelező pgTAP tesztfájl (`supabase/tests/database/`) | ✅/❌ |
```

---

## 2. Új Tábla Checklist (`CREATE TABLE`)

```markdown
### 📋 Új Tábla Checklist — [táblanév]
| # | Szabály | Leírás |
|---|--------|--------|
| T-1 | `id uuid DEFAULT gen_random_uuid() PRIMARY KEY` | UUID PK, nem SERIAL |
| T-2 | `company_id uuid REFERENCES companies(id)` | Multi-tenant szűrő mező |
| T-3 | `created_at timestamptz DEFAULT now()` | Létrehozás timestamp |
| T-4 | `updated_at timestamptz DEFAULT now()` | Módosítás timestamp |
| T-5 | RLS ENABLE + policy | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` |
| T-6 | SELECT policy: `(SELECT auth.uid())` pattern | InitPlan-optimalizált auth check |
| T-7 | INSERT policy: `WITH CHECK` | user_id vagy company_id ellenőrzés |
| T-8 | FK index: `CREATE INDEX idx_{tábla}_{fk} ON {tábla}({fk})` | Minden FK-ra index |
| T-9 | Audit trigger (ha szükséges) | `global_audit_trigger_func()` csatolás |
| T-10 | GRANT: `REVOKE ALL FROM anon; GRANT ... TO authenticated` | Explicit jogosultságok |
| T-11 | Nincsenek redundáns RLS policy-k | ALL mellé nem teszünk azonos SELECT szabályt |
```

---

## 3. Új RPC Function Checklist (`CREATE FUNCTION`)

```markdown
### 📋 Új RPC Function Checklist — [function_név]
| # | Szabály | Leírás |
|---|--------|--------|
| F-1 | `SECURITY DEFINER` | Ha cross-table aggregáció kell |
| F-2 | `SET search_path TO 'public'` | Search path injection védelem |
| F-3 | `company_id` paraméter + szűrés | Multi-tenancy betartása |
| F-4 | `REVOKE EXECUTE ON FUNCTION ... FROM anon, public` | Anon és PUBLIC nem hívhatja |
| F-5 | `GRANT EXECUTE ON FUNCTION ... TO authenticated / service_role` | Frontend: `authenticated` + `service_role`, Worker: KIZÁRÓLAG `service_role` |
| F-6 | Return type: `jsonb` vagy `SETOF record` | Explicit tipizálás |
| F-7 | Error handling: `RAISE EXCEPTION` | Hibakezelés a function-ben |
| F-8 | **Pre-request hook kivétele** | Ha PostgREST pre-request hook → `anon` és `authenticated` KÖTELEZŐ EXECUTE jog |
| F-9 | **🔴 Trigger: SECURITY DEFINER + extensions (A-020)** | Trigger function → SECURITY DEFINER + `SET search_path TO 'public', 'extensions'` ha extension-t használ. Részletek: [A-020](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-020-auth-trigger-chain-incident.md) |
| F-10 | **🔴 pgTAP Egységteszt** | `supabase/tests/database/{function_name}.test.sql` tesztfájl létrehozása |
| F-11 | **🔴 Buffer & Timeout Budget** | EXPLAIN (ANALYZE, BUFFERS) futtatás nagy adathalmazon: futásidő < 500ms, nincs felesleges N-szeres CTE kiértékelés (`MATERIALIZED` használata indokolt esetben) |
```

---

## 4. Frontend Query Checklist (Supabase client)

```markdown
### 📋 Frontend Query Checklist
| # | Szabály | Leírás |
|---|--------|--------|
| Q-1 | React Query hook-ban | `useQuery` / `useMutation` wrapperben |
| Q-2 | queryKey tartalmazza a companyId-t | Cache invalidáció cégváltáskor |
| Q-3 | staleTime beállítva | Ne legyen 0 (felesleges refetch) |
| Q-4 | Error → throw | React Query kezelje, ne silent swallow |
| Q-5 | Mutation → invalidateQueries | Kapcsolódó query-k frissítése |
| Q-6 | Select explicit oszlopok | `.select('id, name')` nem `select('*')` ha nem kell |
| Q-7 | Pagination ha 100+ sor | `.range(from, to)` vagy cursor-based |
```

---

## 5. Edge Function DB Checklist

```markdown
### 📋 Edge Function DB Checklist
| # | Szabály | Leírás |
|---|--------|--------|
| E-1 | Auth middleware | JWT token validáció (`getUser(token)`) |
| E-2 | Role check (ha szükséges) | `profiles.role` vagy `company_members.role` |
| E-3 | Service role indoklás | Miért kell RLS bypass? Dokumentáld |
| E-4 | Pagination | `auth.admin.listUsers` → lapozás! |
| E-5 | Error → valid JSON | Soha ne crasheljen, mindig JSON response |
| E-6 | Parallel queries | `Promise.all()` ahol nincs függőség |
```

---

## 6. Migration Checklist

```markdown
### 📋 Migration Checklist
| # | Szabály | Leírás |
|---|--------|--------|
| M-1 | Nem destruktív | Nincs `DROP TABLE`, `DROP COLUMN` production-ben |
| M-2 | Idempotens | `IF NOT EXISTS`, `OR REPLACE` használata |
| M-3 | Index: nem CONCURRENTLY | Supabase migration transaction-ben fut |
| M-4 | Test: funkció tesztelése MCP-n | `execute_sql` MCP tool-lal tesztelés |
| M-5 | **Rollback terv** | Mi történik ha hibás? Van-e undo? |
| M-6 | **🔴 CREATE OR REPLACE ellenőrzés (A-020)** | Ha `CREATE OR REPLACE FUNCTION` → ellenőrizd hogy SECURITY DEFINER, search_path, stb. meg van-e tartva az eredeti definícióból! |
```

### 📂 Migrációs Fájl Naming Convention

A `supabase/migrations/` mappában **két formátum** létezik:

#### 1. Legacy formátum (Supabase CLI generált) — NE használd manuálisan

```
YYYYMMDDHHMMSS_<uuid>.sql
```

Példák:
```
20250915221246_fb156f61-8e2a-49cb-aff0-b370531cd9e8.sql
20260604093846_4bcdf64d-1abe-4552-89f8-5b927a79dfc1.sql
```

> Ez a formátum a `supabase migration new` CLI parancs által generált. UUID azonosítója van, nem emberi olvasásra szánták. **Manuális migráció íráskor NE használd ezt a formátumot.**

#### 2. Aktuális formátum (manuális / AI agent) — KÖTELEZŐ

```
YYYYMMDD_<rövid_leíró_snake_case>.sql
```

Szabályok:
| # | Szabály | Leírás |
|---|--------|--------|
| N-1 | **Prefix:** `YYYYMMDD` | Dátum (UTC), pl. `20260609` — elegendő napi felbontás |
| N-2 | **Separator:** `_` | Egyetlen alulvonás a dátum után |
| N-3 | **Leíró rész:** snake_case | Rövid, beszédes angol név — mit csinál a migráció |
| N-4 | **Hossz:** max ~60 karakter | A teljes fájlnév legyen átlátható `ls`/`dir` kimenetben |
| N-5 | **Prefix kulcsszavak:** `fix_`, `add_`, `seed_`, `drop_` | Első szó jelezze a szándékot |
| N-6 | **MANUAL_RUN_ prefix** | Ha NEM a normál migration pipeline-ban kell futtatni, hanem manuálisan |

Példák (helyes):
```
20260608_rls_initplan_optimization.sql
20260608_add_missing_fk_indexes.sql
20260609_fix_subscription_trigger_security_definer.sql
20260515100000_balance_sheet_tables.sql        ← HHMMSS opcionális (sorrend)
20260529_accounty_payroll_schema.sql
MANUAL_RUN_accounty_pending.sql                ← manuális futtatás
```

Példák (helytelen):
```
❌ fix.sql                          — nincs dátum
❌ 20260609.sql                     — nincs leíró rész
❌ migration_v2_final_FINAL.sql     — nem informatív
❌ 20260609_<uuid>.sql              — ne használj UUID-t manuálisan
```

> **⚠️ Ha egyazon napon több migráció kell:** Adj HHMMSS-t is a dátum után a sorrend biztosítására (pl. `20260515100000_`, `20260515100100_`, `20260515100200_`). A Supabase a fájlnév szerinti ABC-sorrend alapján futtatja a migrációkat.

---

## 7. pgTAP Adatbázis Teszt-suite (Automated DB Testing)

A Supabase CLI és PostgreSQL beépített pgTAP tesztkeretrendszere biztosítja a tárolt eljárások (RPC-k), triggerek és RLS szabályzatok regressziómentes, automatizált tesztelését.

### 📁 Hol helyezkednek el a tesztek?
`supabase/tests/database/{rpc_vagy_modul_neve}.test.sql`

### 🛠️ Hogyan futtatható?
- **Helyi Supabase CLI-vel:**
  ```powershell
  npx supabase test db
  ```
- **Vagy MCP-n / távoli SQL konzolon (`execute_sql`):**
  Futtatható közvetlenül a teszt SQL szkriptje; mivel a végén `ROLLBACK;` van, nem módosítja és nem szemeteli össze a termelési adatbázist.

### 📐 Standard pgTAP Teszt Sablon
```sql
BEGIN;
-- 1. Adjuk meg a futtatandó tesztesetek számát
SELECT plan(4);

-- 2. Létezés és függvény-szignatúra ellenőrzése
SELECT has_function('public', 'get_gl_balances', 'get_gl_balances RPC-nek léteznie kell a public sémában');

-- 3. Üres cég / NULL-safety teszt (nem dobhat hibát nem létező azonosítókra)
SELECT is_empty(
  'SELECT * FROM public.get_gl_balances(''00000000-0000-0000-0000-000000000000''::uuid, ''00000000-0000-0000-0000-000000000000''::uuid)',
  'Üres vagy nem létező cégnél üres eredményt kell adnia exception nélkül'
);

-- 4. Egzakt matematikai és könyvelési egyenleg teszt fixture adatokkal
SELECT results_eq(
  'SELECT total_balance FROM public.get_gl_balances(''test-company-uuid''::uuid, ''test-preset-uuid''::uuid) WHERE gl_number = ''311''',
  'VALUES (150000.00::numeric)',
  'A 311-es vevői számla egyenlegének pontosan 150 000 Ft-nak kell lennie'
);

-- 5. Jogosultsági kapu: anon role nem futtathatja
SELECT throws_ok(
  'SET ROLE anon; SELECT * FROM public.get_gl_balances(''test-company-uuid''::uuid, ''test-preset-uuid''::uuid)',
  '42501',
  NULL,
  'Anonim felhasználó nem futtathatja a főkönyvi RPC-t'
);

SELECT * FROM finish();
ROLLBACK; -- ⚠️ KÖTELEZŐ: visszaállítja a tesztkörnyezetet, nem szemetel a DB-be!
```

### 🎯 Kötelező pgTAP Ellenőrzési Pontok Pénzügyi RPC-knél:
1. **Zero-state (Üres cég):** Hibamentes lefutás 0 soros vagy nem létező cégazonosítókra.
2. **Dátumszűrés és Dátumalap (`kibocsatas` vs `teljesites`):** Adott időszakon kívül eső tételek nem kerülhetnek be az eredménybe.
3. **Pénzügyi Integritás (T/K Előjelek):** Kötelező ellenőrizni, hogy a Tartozik (+) és Követel (-) előjelek matematikailag pontosak.
4. **Jogosultsági Védelem:** Ellenőrizni, hogy `anon` role esetén `permission denied (42501)` exception keletkezik.

---

## Implementáció Után — KÖTELEZŐ Lépések

### Ha a feladat komplex volt (3+ fájl, új funkció):
A teljes post-implementáció workflow a `visibill-feature-planner` skill-ben van:
```
view_file ~/.gemini/config/skills\visibill-feature-planner\SKILL.md
```
→ Fázis 3.5 (User Validáció) → Fázis 4 (Docs Frissítés) → Fázis 5 (Graphify)

### Ha a feladat egyszerű volt (1-2 fájl):
1. **User validáció:** Kérd a user megerősítését hogy működik a megvalósított kód.
2. **EF/RPC registry frissítés:**
   - Új Edge Function → frissítsd `A-005-edge-functions.md`
   - Új RPC function → frissítsd `A-016-postgresql-query-strategy.md`
   - Darabszám változás → frissítsd `overview.md` és `index.md`
3. **Adatbázis sémadokumentáció frissítése (CSAK user megerősítés után!):**
   - **Kritikus szabály:** Csak miután a felhasználó visszaigazolta, hogy a DB-t érintő módosítás élesben/devben jól működik, csak akkor szabad lefutni a dokumentáció frissítésének!
   - Töltsd le a friss metaadatokat a Supabase MCP server-ből (`supabase-visibill` / `execute_sql` parancsokkal) az alábbi fájlokba a `.temp-db-metadata/` mappába:
     * `columns.json` (oszlopok lekérdezése)
     * `constraints.json` (tábla megszorítások)
     * `accurate_fks.json` (pontos FK-k `pg_constraint` alapján)
     * `indexes.json` (indexek listája)
     * `comments.json` (tábla/oszlop kommentek)
     * `tables.json` (táblák statisztikái: sorok száma és RLS állapot)
   - Futtasd a `npm run gen-db-docs` parancsot a dokumentáció automatikus frissítéséhez.
   - Töröld le a `.temp-db-metadata/` könyvtárat a tiszta állapot megőrzése érdekében.
