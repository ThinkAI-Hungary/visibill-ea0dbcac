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
| M-5 | Rollback terv | Mi történik ha hibás? Van-e undo? |
```

> **Referencia:** Részletes magyarázatokhoz: `supabase-postgres-best-practices` skill `references/` mappája (pl. `security-rls-performance.md`, `schema-foreign-key-indexes.md`, `data-pagination.md`).

---

## Implementáció Után — KÖTELEZŐ Lépések

### Ha a feladat komplex volt (3+ fájl, új funkció):
A teljes post-implementáció workflow a `visibill-feature-planner` skill-ben van:
```
view_file ~/.gemini/config/skills\visibill-feature-planner\SKILL.md
```
→ Fázis 3.5 (User Validáció) → Fázis 4 (Docs Frissítés) → Fázis 5 (Graphify)

### Ha a feladat egyszerű volt (1-2 fájl):
1. **User validáció:** Kérd a user megerősítését hogy működik
2. **EF/RPC registry frissítés:**
   - Új Edge Function → frissítsd `A-005-edge-functions.md`
   - Új RPC function → frissítsd `A-016-postgresql-query-strategy.md`
   - Darabszám változás → frissítsd `overview.md` és `index.md`
