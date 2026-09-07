# A-103: Accounty RLS Teljesítményoptimalizálás és Postgres Hibanapló Stabilizálás

**Status:** Decided  
**Date:** 2026-09-07  
**Utoljára frissítve:** 2026-09-07  

## Context

A Supabase PostgreSQL adatbázis naplóiban (ClickHouse / Log Explorer) végzett vizsgálat során több visszatérő hiba és kritikus szűk keresztmetszet került azonosításra:

1. **`canceling statement due to statement timeout` (Postgres hiba: 57014):**
   Az `accounty_missing_items` tábla lekérdezésekor (különösen a PostgREST `Prefer: count=exact` számlálások során) a kérések elérték a 8-10 másodperces `statement_timeout` korlátot, és a PostgreSQL megszakította a tranzakciót.
   
   **Gyökérok:**
   Az `accounty_missing_items` táblán (22 208 sor) és az `accounty_deadlines` táblán lévő RLS SELECT szabály:
   ```sql
   CREATE POLICY accounty_missing_items_select ON public.accounty_missing_items
     FOR SELECT USING (has_accounty_company_access(company_id));
   ```
   minden egyes vizsgált sornál meghívta a `has_accounty_company_access(company_id)` függvényt.
   A függvény hiányolta a `(SELECT auth.uid())` InitPlan gyorsítótárazást (ADR A-003 / Supabase Best Practices), és rekurzív módon hívta a `is_iroda_admin_for_firm` függvényt, ami soronként vizsgálta az `accounty_assignments`, `company_members` és `profiles` táblákat. Ez tízezres sorszámnál több tízezer belső lekérdezést generált kérésenként. Amikor a frontend `Promise.all`-lal párhuzamos lekérdezéseket indított, a kapcsolatok feltorlódtak és időtúllépést okoztak.

2. **`permission denied for table accounty_ai_chat_messages` (42501):**
   Anonim vagy még nem teljesen inicializált állapotban lefutó kliensoldali React Query hookok authentikálatlan kérést küldtek az AI csevegési üzenetek táblájára.

3. **`null value in column "document_date" / "accounting_year" violates not-null constraint` (23502):**
   A kézi vegyes naplótétel rögzítő űrlap (`AddManualJournalEntryModal.tsx`) engedte a mentést kitöltetlen dátumokkal, ami `null` értéket adott át az `acc_journal_headers` kötelező mezőinek.

4. **`duplicate key value violates unique constraint "partners_company_id_tax_number_key"` (23505):**
   A partnertörzsben már létező adószámmal próbáltak új partnert felvinni, ami nyers adatbázishibát és felesleges hibanapló bejegyzést eredményezett.

---

## Decision

### 1. Adatbázis RLS és Hozzáférési Függvények Optimalizálása (`20260907_optimize_accounty_access_and_rls.sql`)

* **Gyorsítótárazható RLS Hashed Subplan Szabályok:**
  Az `accounty_missing_items` és `accounty_deadlines` táblák RLS SELECT szabályait közvetlen `IN (SELECT ... UNION ...)` részkifejezésre cseréltük, amely `(SELECT auth.uid())`-t használ. Így a PostgreSQL nem soronként hív függvényt, hanem a lekérdezés legelején egyszer képez egy in-memory hash táblát (InitPlan Hashed SubPlan). A hozzáférés a vezetőség és könyvelők mellett kiterjed a cég közvetlen tagjaira is (`role IN ('owner', 'admin', 'member', 'support_admin')`):
  ```sql
  CREATE POLICY accounty_missing_items_select ON public.accounty_missing_items
    FOR SELECT TO authenticated
    USING (
      (
        EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE user_id = (SELECT auth.uid()) 
            AND (is_support_admin = true OR role IN ('management', 'thinkai'))
        )
      )
      OR
      company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin', 'member', 'support_admin')
        UNION
        SELECT company_id FROM public.accounty_assignments WHERE accountant_user_id = (SELECT auth.uid())
        UNION
        SELECT aa.company_id FROM public.accounty_assignments aa
        JOIN public.accounty_assignments firm_admin ON firm_admin.accountant_user_id = (SELECT auth.uid()) 
          AND (firm_admin.accounting_firm_id = aa.accounting_firm_id OR firm_admin.company_id = aa.accounting_firm_id)
          AND firm_admin.role IN ('iroda_admin', 'senior', 'admin')
      )
    );
  ```

* **Rövidzáras (Short-Circuit) PL/pgSQL Függvények:**
  A `has_accounty_company_access(target_company_id uuid)` és `is_iroda_admin_for_firm(target_firm_id uuid)` függvényeket átírtuk `LANGUAGE plpgsql`-re:
  1. Első lépésben azonnal ellenőrzi a `profiles.is_support_admin` vagy vezetőségi szerepkört (`role IN ('management', 'thinkai')`) — ha igaz, azonnal `TRUE`-val tér vissza < 0.05 ms alatt.
  2. Második lépésben a direkt tagságot vizsgálja a `company_members` táblán (`role IN ('owner', 'admin', 'member', 'support_admin')`).
  3. Harmadik lépésben vizsgálja csak az `accounty_assignments` és iroda-admin relációkat.

### 2. Frontend Kliensoldali Védelmek

* **AI Chat Lekérdezés Auth Függőség (`src/hooks/useAiChatSessions.ts`):**
  A `useAiChatMessages` hook lekérdezési feltétele kibővült: `enabled: !!sessionId && !!user?.id`, megakadályozva az unauthenticated / anon próbálkozásokat.

* **Kötelező Dátum és Állapot Védelem Kézi Vegyes Naplónál (`src/components/journals/AddManualJournalEntryModal.tsx`):**
  - Beküldés előtt szigorú regex formátum-ellenőrzés (`/^\d{4}-\d{2}-\d{2}$/`) és kitöltöttségi validáció fut le a bizonylat- és könyvelési dátumokra.
  - Létező tétel módosításakor állapot-retesz (concurrency / status guard) ellenőrzi az adatbázisban a bizonylat fejléctételt; amennyiben időközben lekönyvelték (`POSTED` vagy `LEKONYVELVE`), a felülírást azonnal letiltja és magyar nyelvű hibaüzenetet ad.

* **Partner Adószám Normalizálás és Duplikáció Előszűrés (`src/pages/PartnersPage.tsx`):**
  - A mentés előtt a `parseTaxNumber` segédfüggvénnyel kinyert 8-jegyű törzsszám alapján vizsgálja a létező partnereket, így mind a kötőjeles (`12345678-1-42`), mind az egybefüggő (`12345678142`) beviteleknél megelőzi a felesleges hálózati kéréseket és a 23505-ös hibanaplózást.
  - A mentési mutáció `onError` ágában elkapja a `23505` hibakódot vagy a `partners_company_id_tax_number_key` megkötést, és tiszta, felhasználóbarát toasztot jelenít meg: *"Ez az adószám már létezik a cég partnertörzsében."*.

---

## Eredmények és Mérések (Empirical Evidence)

A módosítások éles adatbázison (`supabase-visibill`) történt alkalmazása után lefutatott `EXPLAIN (ANALYZE, BUFFERS)` vizsgálat eredménye:

| Mutató | Optimalizálás Előtt | Optimalizálás Után | Javulás |
| :--- | :--- | :--- | :--- |
| **Végrehajtási idő (Execution Time)** | **2 911.39 ms** (vagy timeout 8-10s) | **3.02 ms** | **~970x gyorsulás** |
| **Tervezési idő (Planning Time)** | 2.50 ms | 1.15 ms | **2.2x gyorsulás** |
| **Buffer találatok (Buffer Hits)** | > 60 000 blokk olvasás | 794 blokk olvasás | **98.7%-os csökkenés** |
| **RLS végrehajtási terv** | SubPlan függvényhívás 22 208 sorra | Hashed SubPlan (egyszeri kiértékelés) | **Skálázható** |

---

## Kapcsolódó Dokumentumok
- [A-003: Multi-tenancy and RLS](A-003-multi-tenancy-rls.md)
- [A-016: PostgreSQL Query Strategy](A-016-postgresql-query-strategy.md)
- [A-092: Database Security and Performance Optimization](A-092-database-security-and-performance-optimization.md)
- [A-100: Banki Tranzakció Egyediségi Megkötés Bővítése](A-100-transaction-unique-constraint-amount-inclusion.md)
