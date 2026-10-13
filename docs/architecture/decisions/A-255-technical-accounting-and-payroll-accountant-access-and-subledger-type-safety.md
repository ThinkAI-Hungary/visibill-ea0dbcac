# A-255: Technikai Könyvelési és Bérszámfejtési RPC Jogosultságkezelés, Külső Könyvelői Hozzáférés (has_accounty_company_access) és Folyószámla Típusbiztonság

**Status:** Decided  
**Date:** 2026-10-13  
**Kapcsolódó döntések:** [A-003](./A-003-multi-tenancy-rls.md), [A-175](./A-175-subledger-and-open-items-architecture.md), [A-226](./A-226-gl-subledger-concurrency-storm-and-analytic-reconciliation-schema-fix.md), [A-247](./A-247-role-capability-matrix.md), [A-250](./A-250-payroll-module-14-reconciliation-giro-and-tab-architecture.md)

---

## Context

A 2026-10-12-i release során bevezetésre került a **Module 22 — Technikai Könyvelés és Számviteli Audit** (anomália detektálás, Partner 360 likvid pozíció és kompenzációs mátrix, főkönyvi átvezetések), valamint a **Module 14 — Bérszámfejtési 471-es főkönyvi egyeztetés és banki tranzakció automatikus párosítás**.

A management felületen és a hibanaplókban (`/visibill-error-hunter`) két kritikus hiba jelentkezett:

1. **Jogosultsági hiba külső könyvelőknél (`PostgreSQL P0001`):**  
   A külső megbízott könyvelők (pl. Lendvai Ádám a VBV Vision Kft. cég auditálásakor) `[accounting-anomalies/query_error] Nincs jogosultsága a cég könyvelési adatainak auditálásához` hibát kaptak.
   - **Gyökérok:** Mind a 7 új RPC függvény kizárólag a `public.company_members` táblán végzett `WHERE company_id = p_company_id AND user_id = auth.uid()` ellenőrzést. Az eaisyBooks architektúrában azonban a könyvelőirodák munkatársai nem közvetlen cégtagok, hanem a `public.accounty_assignments` táblában rendelkeznek hozzárendeléssel. Ennek következtében a megbízott könyvelők, az irodai adminok és a support adminok teljesen kizáródtak ezen modulok használatából.

2. **Folyószámla egyeztetés RPC típushiba (`PostgreSQL 42804`):**  
   A `public.get_subledger_item_matches` RPC futtatásakor `structure of query does not match function result type` kivétel keletkezett.
   - **Gyökérok:** A függvény `RETURNS TABLE` definíciójában a 15. mező (`other_description`) `character varying` típusként szerepelt, míg az összekapcsolt `public.acc_journal_lines.description` mező `text` típusú. A PL/pgSQL `RETURN QUERY` utasítása szigorú típusazonosságot követel meg a mezők sorrendje és típusa között, és az implicit típuskonverziót nem végezte el.

3. **Acéltermék lekérdezés URL túlcsordulás (`PostgREST HTTP 400 Bad Request`):**  
   Nagy forgalmú cégeknél az ÁFA bevallási időszakban több ezer NAV számlaazonosító került beágyazásra a query stringbe (`useSteelProductsData.ts`), túllépve a webszerver maximális URL-hosszát.

---

## Decision

### 1. Egységes Könyvelői Jogosultságkezelés (`has_accounty_company_access` és `rls_write_denied_company_ids`)

Minden moduláris könyvelési és analitikai RPC függvényben tilos a kizárólagos `company_members` vizsgálat. Helyette a kanonikus `public.has_accounty_company_access(p_company_id)` függvényt kell alkalmazni, amely egyszerre és konszolidáltan auditálja:
- A közvetlen cégtagi tagságot (`company_members`).
- A megbízott könyvelői hozzárendelést (`accounty_assignments`).
- A könyvelőirodai tulajdonosi és adminisztrátori jogokat.
- A platform support adminokat (`public.is_support_admin()`) és a `service_role` JWT hívásokat.

**Módosító (Write) RPC-k Cégszintű Zárolási Védelme:**  
Az adatbázist módosító függvényeknél (pl. `execute_journal_reclassification`, `rollback_journal_reclassification`, `auto_match_payroll_bank_transactions`) a hozzáférési ellenőrzést kiegészítettük a moduláris zárolási mechanizmussal:
```sql
IF NOT (
  (public.has_accounty_company_access(p_company_id)
   AND NOT EXISTS (
     SELECT 1 FROM public.rls_write_denied_company_ids('accounty', ARRAY['subledger', 'client_bookkeeping']) denied
     WHERE denied.company_id = p_company_id
   ))
  OR (auth.jwt() ->> 'role' = 'service_role')
  OR public.is_support_admin()
) THEN
  RAISE EXCEPTION 'Nincs jogosultsága a cég könyvelési műveleteinek elvégzéséhez';
END IF;
```

Érintett és refaktorált függvények:
1. `public.detect_accounting_anomalies(UUID, DATE, DATE)`
2. `public.get_partner_360_matrix(UUID, UUID, DATE, DATE, BOOLEAN)`
3. `public.get_omni_partner_ledger(UUID, UUID, TEXT, DATE, DATE, BOOLEAN)`
4. `public.execute_journal_reclassification(UUID, UUID, UUID, UUID[], DATE, TEXT, UUID, BOOLEAN)`
5. `public.rollback_journal_reclassification(UUID, UUID, TEXT)`
6. `public.get_payroll_471_reconciliation(UUID, INT, INT)`
7. `public.auto_match_payroll_bank_transactions(UUID, INT, INT)`

Mind a 7 eljárás `SECURITY DEFINER`, `search_path = public`, valamint a publikus és anonim végpontokról megvonva (`REVOKE ALL FROM PUBLIC, anon`), kizárólag `authenticated` és `service_role` szerepkörök számára engedélyezve.

### 2. Szigorú PL/pgSQL Típusillesztés a RETURN QUERY Eljárásokban

A `public.get_subledger_item_matches(p_company_id uuid, p_line_id uuid)` RPC visszatérési sémájában az `other_description` oszlopot explicit `text` típusra módosítottuk, a SELECT törzsben pedig garantáltuk a kényszerített castolást (`other_l.description::TEXT`). Ez azonnal felszámolta a PostgreSQL 42804 struktúra-eltérési kivételt.

### 3. REST Lekérdezési URL Kötegelés (Chunking)

A `useSteelProductsData.ts` horogban a számlaazonosítók (`navIds`) tömbjét biztonságos 50 elemes kötegekre (chunk) bontjuk, és `Promise.all` segítségével párhuzamosítva hajtjuk végre a lekérdezést. Ezzel a PostgREST URL mérete minden esetben az engedélyezett HTTP határértéken belül marad, elkerülve a 400 Bad Request hibákat.

---

## Consequences

### Pozitív
- **Zéró jogosultsági blokkolás megbízott könyvelőknél:** A könyvelőirodák által kezelt ügyfélcégek adatai zökkenőmentesen elérhetővé váltak az anomália- és partnerkönyvelési felületeken anélkül, hogy a könyvelőket mesterségesen cégtaggá kellene tenni.
- **Konzisztens zárolásvédelem:** Az írási műveletek tiszteletben tartják a cégszintű könyvelési zárlatokat.
- **Típusbiztos folyószámla egyeztetés:** A kiegyenlítési részletező modál (`SubledgerItemMatchesModal`) minden bizonylattípusnál hibamentesen jeleníti meg a kapcsolt tételeket.
- **Skálázható ÁFA analitika:** Nagy tételszámú számlaállomány esetén is megszűntek az URL túlcsordulási hibák.

### Negatív / Kockázatok
- Az RPC függvények jogosultsági módosításakor kötelező regressziós szerződéstesztek futtatása (`src/test/permissions/technicalAccountingAndPayrollAuth.test.ts`), hogy jövőbeli migrációk ne vezethessék vissza a szűk `company_members` mintát.
