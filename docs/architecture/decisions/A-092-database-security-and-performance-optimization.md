# A-092: Teljes Adatbázis Biztonsági és Teljesítménybeli Audit & Optimalizáció

**Status:** Decided  
**Date:** 2026-09-05  
**Utoljára frissítve:** 2026-09-05  

## Context

A Visibill / eAIsyBill rendszer növekedésével és az éles adatbázis (`vxxgvdlqvvchtlmqnrqf`) terhelésének növekedésével a Supabase Security & Performance Advisorok és a PostgreSQL lekérdezési statisztikák (`pg_stat_statements`) komoly biztonsági és skálázódási kockázatokat jeleztek:

1. **5 kritikus biztonsági sebezhetőség (CRIT-1..CRIT-5):**
   - `accrual_entries`: nyílt `ALL true` RLS policy, bármely felhasználó módosíthatta mások elhatárolásait.
   - `ticket_events`: belső support audit események szivárogtak ki ügyfeleknek.
   - `get_auth_emails()`: REST API-n keresztül anonim vagy bejelentkezett userek lekérhették a teljes felhasználói email adatbázist.
   - `match_transaction_overrides_log`: RLS bekapcsolva policy nélkül (42501 permission denied hibát okozva mentéskor), hiányzó foreign key indexekkel.
   - `cmr_documents`: `SECURITY DEFINER` nézet, ami megkerülte az alaptáblák RLS védelmét.

2. **174 db `auth_rls_initplan` szűk keresztmetszet:**
   - A PostgreSQL lekérdezés-tervezője az `auth.uid()` függvényt alapesetben nem kezeli állandóként egy lekérdezésen belül, így per-row módon (minden egyes táblasor vizsgálatakor) újraértékelte azt, exponenciálisan növelve a CPU terhelést.

3. **91 db hiányzó Foreign Key index (`unindexed_foreign_keys`):**
   - A szülő rekordok törlésekor vagy módosításakor a hiányzó indexek szekvenciális táblavizsgálatot és ShareRowExclusiveLock táblazárolási torlódást okoztak a kapcsolódó táblákon (pl. `invoices.approved_by`, `invoice_items.project_id`, `acc_journal_*`, EV analitika táblák).

4. **61 db redundáns `multiple_permissive_policies` szabály:**
   - Cégtagi és könyvelői párhuzamos `PERMISSIVE` szabályok duplikálták a kiértékelést `SELECT` során, míg az `ALL` és `SELECT` együttes létezése feleslegesen lassította az olvasási műveleteket.

5. **Kritikus Query Performance torlódások:**
   - A `nav_invoice_items.notes` szűrése átlagosan 2 976 ms (~3 mp) futási időt emésztett fel (Query #19).
   - Az `invoices` és `nav_invoices` bizonylatszám-összevetése (`replace(lower(...))`) nem használt indexet és 33 perc kumulatív CPU időt vett igénybe.
   - Az `accounty_missing_items` és `accounty_deadlines` összetett szűrései felesleges memóriarendezést és sor-szűrést végeztek.

6. **47 db `function_search_path_mutable` és további biztonsági figyelmeztetések:**
   - A rögzítetlen `search_path` kitette a függvényeket Search Path Injection támadásoknak (CVE-2018-1058).
   - `pg_trgm` a `public` sémában élt.
   - `accounty_dependents` RLS `ALL true` volt, ami személyes adatvédelmi (GDPR) kockázatot jelentett.
   - `storage.objects` megengedő `SELECT` szabályai kitették az `accounty_uploads` és `ticket-attachments` vödröket API-n keresztüli listázásnak.

---

## Decision

Az adatbázis-architektúra biztonságának és teljesítményének maximalizálása érdekében a következő egységes, iparági szabványoknak megfelelő döntéseket implementáltuk 23 dedikált migrációban:

### 1. `(SELECT auth.uid())` InitPlan Minta Szabványosítása
Minden RLS szabályban a közvetlen `auth.uid()` hívást kötelezően lecseréltük a `(SELECT auth.uid())` skalár subquery formára.  
**Működése:** A Postgres lekérdezés-tervezője a skalár subquery-t `InitPlan`-ként kezeli: a tranzakció legelején egyszer hajtja végre, az eredményt a memóriában gyorsítótárazza, és a táblavizsgálat során már fix konstanssal dolgozik.  
**Eredmény:** Mind a 174 `auth_rls_initplan` figyelmeztetés megszűnt (**0 db maradt**).

### 2. Single-Permissive és Write-Only RLS Konszolidáció
- **Kettős SELECT összevonása:** A cégtagi (`company_members`) és megbízott könyvelői (`accounty_assignments`) hozzáféréseket egyetlen permissive policy-ba vontuk össze `(member_cond OR accountant_cond)` logikával.
- **Write-only szétválasztás:** A menedzsment szabályokat `FOR ALL`-ról explicit módosító műveletekre (`INSERT, UPDATE, DELETE`) korlátoztuk, így `SELECT` műveleteknél nem fut le kettős ellenőrzés.  
**Eredmény:** Mind a 61 db redundáns permissive figyelmeztetés megszűnt (**0 db maradt**).

### 3. Teljes Foreign Key B-Tree Lefedettség
Minden idegen kulcs kapcsolatra dedikált B-Tree indexet építettünk (összesen 91 új index 3 tematikus kötegben: Core számlázás, Főkönyv, Accounty EV/HR).  
**Eredmény:** `unindexed_foreign_keys` száma 0-ra esett; a szülő rekordok törlése és a relációs JOIN-ok azonnali index keresést használnak.

### 4. Célzott Lekérdezés Optimalizálás (Query Performance)
- **Részleges (Partial) index:** `idx_nav_invoice_items_notes` a `WHERE notes IS NOT NULL` feltételre. A Query #19 futási ideje 2 976 ms-ról **1.19 ms-ra csökkent (2500x gyorsulás)**.
- **Funkcionális indexek:** `idx_invoices_company_normalized_bizonylat` és `idx_nav_invoices_company_normalized_invnum` a `replace(lower(...))` kifejezésekre. A subquery szekvenciális vizsgálata helyett közvetlen Index Scan fut le 0.06 ms alatt.
- **Összetett (Composite) indexek:** `accounty_missing_items` és `accounty_deadlines` táblákon a `(company_id, status, ...)` szűrőkre, biztosítva a tisztán Index Only Scan végrehajtást rendezési többletköltség nélkül.

### 5. `search_path` Rögzítés és Séma Tisztítás
- Mind a 47 eljáráson beállítottuk a `SET search_path = public` attribútumot, kiküszöbölve a Search Path Injection kockázatát.
- A `pg_trgm` kiterjesztést áthelyeztük az `extensions` sémába (`ALTER EXTENSION pg_trgm SET SCHEMA extensions;`).
- Az `accounty_dependents` RLS-t cégtagi és kijelölt könyvelői hozzáféréshez kötöttük.
- A `storage.objects` táblán a fájllistázást (`SELECT`) szigorúan az autentikált jogosultakra korlátoztuk, miközben a publikus URL-ek kiszolgálása sértetlen maradt.

---

## Consequences

### Pozitív:
- **Nulla nyitott biztonsági hiba:** A Supabase Security Advisorban az összes releváns linter (`rls_disabled_in_public`, `rls_enabled_no_policy`, `security_definer_view`, `function_search_path_mutable`, `extension_in_public`, `rls_policy_always_true`, `public_bucket_allows_listing`) tiszta (**0 hiba**).
- **Nulla teljesítménybeli szabálysértés:** A Performance Advisorban `unindexed_foreign_keys = 0`, `multiple_permissive_policies = 0`, `auth_rls_initplan = 0`, `duplicate_index = 0`.
- **Drasztikus CPU és I/O megtakarítás:** Az éles lekérdezések nem végeznek felesleges szekvenciális táblavizsgálatot vagy soronkénti `auth.uid()` hívást.
- **100%-os regresszió-mentesség:** Mind a 97 Vitest tesztcsomag (1182 teszt) és a produkciós build sikeresen és stabilan átment.

### Negatív / Költségek:
- **Tárterület-igény:** A 91 db új B-Tree és a funkcionális indexek némi lemezterületet foglalnak az adatbázisban, és minimális többlet terhelést jelentenek a sorbeszúrásoknál (`INSERT`). Ezt azonban messze ellensúlyozza a lock-ok és a Seq Scan-ek elkerüléséből adódó nyereség.
- **Fegyelem a jövőbeli fejlesztéseknél:** Minden új RLS szabályban kötelező követni a `(SELECT auth.uid())` mintát, az új idegen kulcsokhoz indexet kell létrehozni, és az új tárolt eljárásoknál rögzíteni kell a `search_path`-t.

---

## Érintett Migrációk Jegyzéke

| Migráció | Cél & Tartalom |
|---|---|
| `20260905161000` | CRIT-1: `accrual_entries` RLS cégtag & könyvelő védelem |
| `20260905163000` | CRIT-2: `ticket_events` belső események elrejtése ügyfelek elől |
| `20260905164000` | CRIT-3: `get_auth_emails()` jogosultság korlátozása `service_role`-ra |
| `20260905165000` | CRIT-4: `match_transaction_overrides_log` RLS és indexek pótlása |
| `20260905170000` | CRIT-5: `cmr_documents` nézet átállítása `security_invoker = true`-ra |
| `20260905171000` .. `181000` | InitPlan Batch 1–6 + worker heartbeats (174 db `auth_rls_initplan` optimalizáció) |
| `20260905183000` .. `185000` | FK Index Batch 1–3 (91 db B-Tree index Core, Főkönyv, EV táblákon) |
| `20260905190000` .. `194000` | Permissive RLS Batch 1–5 (61 db átfedő policy összevonása és szétválasztása) |
| `20260905195000` | Query Performance indexek (notes részleges index, bizonylatszám funkcionális indexek, hiányzó tételek & határidők) |
| `20260905200000` | 47 db eljárás `search_path = public` rögzítése |
| `20260905201000` | Utolsó 5 figyelmeztetés (`pg_trgm` schema, `accounty_dependents` GDPR, `app_error_logs`, Storage bucket listing védelem) |

---

## Kapcsolódó
- [A-003: Multi-tenancy RLS Alapon](./A-003-multi-tenancy-rls.md)
- [A-016: PostgreSQL Query Stratégia](./A-016-postgresql-query-strategy.md)
- [A-017: Biztonsági Architektúra](./A-017-security-architecture.md)
- [A-055: Server-Side Invoice Query, KPI Aggregation & GIN Trigram Optimization](./A-055-server-side-invoice-query-kpi-optimization.md)
