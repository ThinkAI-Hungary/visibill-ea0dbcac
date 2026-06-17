---
name: visibill-db-audit
description: Use when auditing, reviewing, or optimizing the Visibill database schema, RLS policies, indexes, and queries. Triggers on "db-audit", "db audit", "adatbázis átvizsgálás", "rls ellenőrzés", "supabase audit", "postgres optimalizálás", "database audit", "schema audit", "rls audit". This skill ensures that RLS policies, indexes, and schema changes are systematically audited against Supabase best practices and Visibill's architecture decisions, with clear risk explanations and step-by-step verified execution.
license: MIT
metadata:
  author: Visibill Team
  version: "1.0.0"
  date: June 2026
---

# Visibill Database & Supabase Audit Framework

Ez a skill egy szisztematikus keretrendszert biztosít a Visibill/eAIsyBill adatbázis-séma, RLS (Row-Level Security) szabályok, indexek és lekérdezések átvizsgálására, optimalizálására és biztonságossá tételére.

---

## 1. FÁZIS: Előfeltételek & Referenciák Betöltése

Mielőtt az audit elkezdődne, az AI asszisztensnek **KÖTELEZŐ** beolvasnia az alábbi skilleket és dokumentumokat (külön-külön megnyitva a `view_file` eszközzel):

1. **`supabase` skill**: [supabase/SKILL.md](file://~/.gemini/config/skills/supabase/SKILL.md)
2. **`supabase-postgres-best-practices` skill**: [supabase-postgres-best-practices/SKILL.md](file://~/.gemini/config/skills/supabase-postgres-best-practices/SKILL.md)
3. **Visibill-specifikus ADR-ek**:
   - [A-003-multi-tenancy-rls.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-003-multi-tenancy-rls.md) (Multi-tenancy RLS alapon)
   - [A-016-postgresql-query-strategy.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-016-postgresql-query-strategy.md) (PostgREST vs RPC, SECURITY DEFINER konvenciók)
   - [A-017-security-architecture.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-017-security-architecture.md) (5 rétegű biztonsági architektúra)
   - [A-020-auth-trigger-chain-incident.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-020-auth-trigger-chain-incident.md) (Trigger chain szabályok — signup incident tanulságai)

---

## 2. FÁZIS: Adatgyűjtés és Automatizált Vizsgálat

Az AI asszisztensnek az alábbi lépéseken kell végigmennie a hibák felderítéséhez:

1. **Adatbázis séma & RLS állapot lekérése:**
   - Használd a `list_tables` és `execute_sql` MCP eszközöket a táblák, oszlopok és az RLS státusz lekérdezésére.
   - Ellenőrizd, hogy van-e olyan tábla a `public` sémában, amin **nincs engedélyezve** az RLS (`rowsecurity` a `pg_class` táblában).

2. **Supabase Advisors futtatása:**
   - Használd a `get_advisors` MCP eszközt vagy a `supabase db advisors` CLI parancsot a potenciális biztonsági, teljesítménybeli és sémabeli problémák felderítésére.

3. **Lekérdezések és kódkapcsolatok elemzése:**
   - Keresd meg a Graphify gráf segítségével az összes olyan frontend/backend fájlt, amely közvetlenül futtat Supabase lekérdezéseket.
   - Ellenőrizd az indexeltség hiányát a foreign key (FK) oszlopokon.

4. **Visibill-specifikus ellenőrzési pontok (Audit Checkpoints):**
   - **RLS InitPlan optimalizáltság:** Keresd azokat az RLS policy-ket, amelyek közvetlenül `auth.uid()`-t vagy `current_setting()`-et használnak `(SELECT auth.uid())` subquery helyett (ami megakadályozza a per-row kiértékelést).
   - **Redundáns RLS szabályok:** Ellenőrizd, hogy van-e olyan tábla, amin `ALL` (pl. `modify`) és `SELECT` (pl. `select`) szabály is van teljesen azonos feltétellel (az `ALL` már eleve lefedi a `SELECT`-et, így a különálló `SELECT` feleslegesen duplázza a futási időt).
   - **SECURITY DEFINER jogok:** Ellenőrizd a `public` sémában lévő `SECURITY DEFINER` függvények `EXECUTE` jogosultságait. A kizárólag worker vagy belső triggerek által használt függvényekről le kell tiltani a `PUBLIC`, `anon` és `authenticated` hozzáférést (kizárólag a `service_role` hívhatja őket).
     * **FIGYELEM (Kritikus):** Ha a függvény PostgREST pre-request hook-ként (pl. `pgrst.db_pre_request = 'public.check_request'`) fut a háttérben, akkor az `anon` és `authenticated` szerepköröknek **KÖTELEZŐ** megadni az explicit `EXECUTE` jogosultságot. Ha erről a függvényről letiltjuk a hozzáférést, a teljes REST API megbénul, és minden kliens-oldali hívás (pl. cégadatok lekérdezése) 403 / permission denied hibával elbukik.
   - **Storage bucket listázás:** Győződj meg róla, hogy a storage SELECT szabályok korlátozzák az elérést (pl. cég-azonosító mappa vagy token alapján), megakadályozva a globális listázást (`public_bucket_allows_listing`).
   - **🔴 Trigger function SECURITY DEFINER (A-020 tanulság):** Ellenőrizd, hogy **MINDEN** trigger function (`RETURNS trigger`) rendelkezik-e `SECURITY DEFINER`-rel, ha más táblába ír. Trigger kontextusban `auth.uid()` NULL → RLS-sel védett táblákba nem tud írni `SECURITY DEFINER` nélkül.
     ```sql
     -- Audit query: hiányzó SECURITY DEFINER trigger function-ök
     SELECT p.proname, t.tgrelid::regclass as trigger_table, t.tgname as trigger_name
     FROM pg_trigger t
     JOIN pg_proc p ON t.tgfoid = p.oid
     WHERE NOT t.tgisinternal
       AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
       AND NOT p.prosecdef;  -- prosecdef = false → NEM SECURITY DEFINER
     ```
   - **🔴 Trigger function search_path (A-020 tanulság):** Ellenőrizd, hogy a `SECURITY DEFINER` function-ök `search_path`-ja tartalmazza-e az `extensions` sémát, ha bármilyen extension function-t használnak (`gen_random_bytes`, `encode`, `net.http_post`, stb.). Supabase-en az extension-ök az `extensions` sémában vannak, NEM a `public`-ban.
     ```sql
     -- Audit query: SECURITY DEFINER function-ök search_path ellenőrzése
     SELECT p.proname, p.proconfig
     FROM pg_proc p
     WHERE p.prosecdef = true  -- SECURITY DEFINER
       AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
       AND p.prorettype = (SELECT oid FROM pg_type WHERE typname = 'trigger');
     -- Vizsgáld: proconfig-ban van-e 'search_path=public, extensions'
     ```
   - **🔴 CREATE OR REPLACE attribútum-megőrzés (A-020 tanulság):** Ha `CREATE OR REPLACE FUNCTION` szerepel egy migrációban, ellenőrizd, hogy az **összes** eredeti attribútum (`SECURITY DEFINER`, `SET search_path`, stb.) meg van-e tartva. A `CREATE OR REPLACE` NEM örökli a korábbi attribútumokat — explicit újra meg kell adni!

---

## 3. FÁZIS: Audit Jelentés és Osztályozás

Készíts egy részletes jelentést az alábbi formátumban. Minden talált problémát kategorizálni kell súlyosság szerint:

* 🔴 **Kritikus (Critical):** Biztonsági rés (pl. hiányzó RLS, `anon` által hívható `SECURITY DEFINER` függvények, search_path sebezhetőség).
* 🟡 **Magas (High):** Súlyos optimalizációs hiba (pl. hiányzó foreign key indexek nagy táblákon, RLS policy InitPlan-optimalizáció nélkül, aminek következtében a lekérdezés lelassul).
* 🟠 **Közepes (Medium):** Rossz minták (pl. PostgREST bypass indokolatlanul, `select('*')` használata, nem használt és elavult táblák).
* 🟢 **Alacsony (Low):** Kisebb sémabeli eltérések, elnevezési konvenciók hibái.

### 📋 Audit Jelentés Sablon

```markdown
# Adatbázis Audit Jelentés — Visibill

## 1. Biztonsági és Optimalizációs Hibák Listája

### [Kategória / Hiba megnevezése] (Pl. Hiányzó RLS policy)
- **Súlyosság:** 🔴 Kritikus / 🟡 Magas / 🟠 Közepes / 🟢 Alacsony
- **Érintett táblák/függvények:** `tables_name` / `function_name`
- **Leírás:** Mi a pontos probléma a best practice-ek alapján?
- **Dokumentációs hivatkozás:** Pl. [A-017-security-architecture.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-017-security-architecture.md#L45)
- **Javasolt javítás:** SQL migrációs kód vagy konfiguráció.
```

---

## 4. FÁZIS: Javítási Terv és Kockázatértékelés (KÖTELEZŐ)

Mielőtt bármilyen módosítást elvégeznél, **minden egyes** javasolt javításhoz be kell mutatnod a lehetséges következményeket:

1. **Javítás hatása és kockázata:** Mit változtat meg a javítás?
2. **Kompabilitás & Lehetséges mellékhatások:**
   - Okozhat-e átmeneti kiesést vagy üres listákat a frontend-en a meglévő felhasználói sessionök alatt?
   - Befolyásolja-e a mentett adatokat (pl. kényszerített migráció vagy adatvesztés kockázata)?
   - Igényel-e kliens-oldali kódfissítést (pl. ha változik egy API/RPC visszatérési értéke)?
3. **Rollback terv:** Hogyan állítható vissza az eredeti állapot, ha a javítás hibát okoz?

*Példa kockázatértékelésre:*
> ⚠️ **Biztonsági javítás kockázata (RLS policy szigorítása a `salaries` táblán):**
> - **Következmény:** A meglévő bejelentkezett felhasználók a kliens-oldali cache miatt átmenetileg üres bérlistát láthatnak, amíg le nem jár a tokenjük vagy újra be nem jelentkeznek.
> - **Teendő:** A migráció után javasolt a React Query cache és a böngésző local session frissítése.

---

## 5. FÁZIS: Jóváhagyás és Láncolt Végrehajtás

A javításokat **KIZÁRÓLAG** a felhasználó explicit jóváhagyása után szabad megkezdeni. A végrehajtás során az AI asszisztensnek az alábbi szigorú tesztelési protokollt kell követnie:

1. **Egyesével történő végrehajtás:** Soha ne futtasd le az összes migrációt egyszerre! Egy módosítás = egy külön lépés.
2. **Azonnali verifikáció (Láncolt tesztelés):**
   - Minden SQL migráció futtatása után futtass le egy teszt query-t (pl. az `execute_sql` MCP eszközzel), amellyel ellenőrzöd a változtatás helyességét.
   - Ellenőrizd a jogosultságokat: győződj meg róla, hogy a védett tábla nem érhető el anonim módon, de bejelentkezett felhasználóval megfelelően működik.
3. **Folytatás csak sikeres teszt után:** Ha a teszt sikeres → lépj a következő javításra. Ha hibás → azonnal állítsd vissza az eredeti állapotot (Rollback) és jelezd a felhasználónak.
