# A-020: Auth Trigger Chain — Signup Incident és Tanulságok

**Status:** Decided  
**Date:** 2026-06-09  
**Incident ID:** INC-2026-06-09-signup-failure

## Context

2026. június 9-én a regisztráció teljesen megbénult az éles rendszeren. Minden regisztrációs kísérlet `"Database error saving new user"` hibával elbukott. A probléma két egymástól független, de egymásra épülő trigger-hibára vezethető vissza.

## Az Incidens

### Trigger Chain (regisztrációs flow)

A signup folyamat az alábbi trigger chain-t aktiválja — **mindegyiknek sikerülnie kell**, különben az egész tranzakció ROLLBACK-el:

```
auth.users INSERT
  └── on_auth_user_created trigger
        └── handle_new_user()               [SECURITY DEFINER, search_path = 'public']
              └── profiles INSERT
                    ├── on_profile_created_init_email_prefs trigger
                    │     └── initialize_email_preferences()   [SECURITY DEFINER ✅]
                    └── on_profile_created_initialize_subscription trigger
                          └── initialize_user_subscription()    [SECURITY DEFINER ❌ → HIÁNYZOTT!]
```

### Root Cause 1 — `gen_random_bytes` nem elérhető (KRITIKUS)

| Elem | Részlet |
|------|---------|
| **Hiba** | `ERROR: function gen_random_bytes(integer) does not exist (SQLSTATE 42883)` |
| **Ok** | A `handle_new_user()` trigger `SET search_path TO 'public'` — de a `gen_random_bytes` a `pgcrypto` extension-ben van, ami az **`extensions`** sémában él, nem a `public`-ban. |
| **Mióta** | Amióta a `handle_new_user()` function-be bekerült a verification token generálás (`encode(gen_random_bytes(32), 'hex')`) |
| **Fix** | `SET search_path TO 'public', 'extensions'` |

### Root Cause 2 — `SECURITY DEFINER` hiányzik (MÁSODLAGOS)

| Elem | Részlet |
|------|---------|
| **Hiba** | `user_subscriptions` INSERT blokkolva RLS által |
| **Ok** | Az `initialize_user_subscription()` trigger function `CREATE OR REPLACE`-szel lett felülírva a `20251006` migrációban, de `SECURITY DEFINER` nélkül. Triggerek kontextusában `auth.uid()` NULL → RLS policy `(auth.uid() = user_id)` → INSERT denied. |
| **Mióta** | A `20251006144717` migráció óta, ahol a tier default-ot 'teszt'-re módosították, de a `SECURITY DEFINER` kulcsszót elfelejtették. |
| **Fix** | `SECURITY DEFINER SET search_path TO 'public'` hozzáadása |

### Diagnosztika módszere

1. A hibaüzenet (`"Database error saving new user"`) önmagában **nem informatív** — bármelyik trigger okozhatja
2. A **Supabase Auth Logs** (`get_logs service=auth`) tartalmazta a valódi hibát: `function gen_random_bytes(integer) does not exist`
3. Az RLS-probléma a logból nem volt látható (a 2. hiba elfedi az 1.-et), de a trigger chain elemzésével felderíthető

### Fix migráció

[20260609_fix_subscription_trigger_security_definer.sql](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/migrations/20260609_fix_subscription_trigger_security_definer.sql)

## Decision

### Szabályok — Trigger Function Írás/Módosítás

#### 1. `SECURITY DEFINER` KÖTELEZŐ minden trigger function-re

Minden `AFTER INSERT/UPDATE/DELETE` trigger function-nek `SECURITY DEFINER`-nek kell lennie, ha a trigger bármilyen más táblába ír. Indoklás: trigger kontextusban `auth.uid()` NULL, tehát RLS-sel védett táblákba nem tud írni.

```sql
-- ✅ HELYES
CREATE OR REPLACE FUNCTION public.my_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN ...
```

```sql
-- ❌ HELYTELEN — RLS blokkolni fogja
CREATE OR REPLACE FUNCTION public.my_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN ...
```

#### 2. `search_path` KÖTELEZŐEN tartalmazza az `extensions` sémát

Ha a function bármilyen extension-funkciót használ (`gen_random_bytes`, `pgcrypto`, `pg_net`, stb.), a `search_path`-nak tartalmaznia kell az `extensions` sémát:

```sql
-- ✅ HELYES — ha pgcrypto / pg_net extension-t használ
SET search_path TO 'public', 'extensions'

-- ✅ HELYES — ha pg_net-et is hív (net.http_post)
SET search_path TO 'public', 'extensions', 'net'
```

> **⚠️ Supabase-specifikus:** A Supabase a legtöbb extension-t az `extensions` sémába telepíti, NEM a `public`-ba. Ez eltér a standard Postgres-től. **Mindig ellenőrizd** az extension schema-ját: `SELECT n.nspname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = '<function_name>';`

#### 3. `CREATE OR REPLACE` használatakor MINDIG hordozd át az attribútumokat

Amikor egy létező function-t `CREATE OR REPLACE`-szel módosítasz, **KÖTELEZŐ** a korábbi function minden attribútumát átmásolni:
- `SECURITY DEFINER` (ha volt)
- `SET search_path TO ...`
- `LANGUAGE`
- `RETURNS` típus

A `CREATE OR REPLACE` a function body-ját cseréli, de **nem örökli** a korábbi attribútumokat — explicit újra meg kell adni!

```sql
-- ⚠️ VESZÉLYES — ha az eredeti SECURITY DEFINER volt, ez "lenyeli":
CREATE OR REPLACE FUNCTION public.my_func()
RETURNS trigger
LANGUAGE plpgsql
-- ← SECURITY DEFINER HIÁNYZIK! 
SET search_path TO 'public'
AS $function$ ... $function$;
```

## Consequences

**Pozitív:**
- Explicit szabályok trigger function írásra → nem fordulhat elő hasonló incidens
- DB audit skill bővítve → jövőbeli audit-ok automatikusan ellenőrzik

**Negatív:**
- A `SECURITY DEFINER` + `extensions` search_path nem kényszeríthető ki technikai szinten (lint) — a fejlesztői fegyelemre és az AI skill-ekre támaszkodunk

## Kapcsolódó
- [A-009: Auth és RBAC](./A-009-auth-rbac.md)
- [A-003: Multi-tenancy RLS](./A-003-multi-tenancy-rls.md)
- [A-017: Biztonsági Architektúra](./A-017-security-architecture.md)
- [DB Checklist Skill](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-db-checklist/SKILL.md)
- [DB Audit Skill](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-db-audit/SKILL.md)
