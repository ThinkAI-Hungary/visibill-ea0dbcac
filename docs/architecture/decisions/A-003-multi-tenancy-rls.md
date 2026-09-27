# A-003: Multi-tenancy RLS Alapon

**Status:** Decided  
**Date:** 2025-09

## Context

A rendszer multi-company: egy felhasználó több céget kezelhet, és egy cégnek több tagja lehet. Az adatokat cég szinten kell szeparálni.

## Decision

**Row Level Security (RLS)** — minden tábla RLS policy-val van védve. A `company_id` mező a tenant identifier.

**Pattern (InitPlan Optimalizált & Single-Permissive):**
```sql
-- Minden felhasználó csak a saját cégeihez és könyvelt cégeihez tartozó sorokat látja
CREATE POLICY "invoices_select_policy"
ON invoices FOR SELECT
TO authenticated
USING (
  -- Cégtagi jogosultság
  EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = invoices.company_id
      AND cm.user_id = (SELECT auth.uid())
  )
  OR
  -- Megbízott könyvelői jogosultság
  EXISTS (
    SELECT 1 FROM accounty_assignments aa
    WHERE aa.company_id = invoices.company_id
      AND aa.accountant_user_id = (SELECT auth.uid())
  )
);
```

**Kritikus Tervezési Szabályok (A-092 szerint):**
1. **`(SELECT auth.uid())` subquery forma kötelező:** A sima `auth.uid()` függvényhívást a Postgres soronként újraértékeli (`auth_rls_initplan`). A subquery forma biztosítja, hogy a tervező `InitPlan`-ként egyszer futtassa le és gyorsítótárazza.
2. **Single-permissive konszolidáció:** Tilos két külön `PERMISSIVE` szabályt létrehozni cégtagi és könyvelői olvasásra. Egyetlen policy-ban, `OR` logikai kapcsolattal kell megfogalmazni, megelőzve a kettős kiértékelést.
3. **Write-only szabályok szétválasztása:** Ahol a cégtag módosíthat, a szabályt explicit módon `FOR INSERT, UPDATE, DELETE` műveletekre kell korlátozni ahelyett, hogy `FOR ALL` szabály futna párhuzamosan a `FOR SELECT` szabállyal.

**Struktúra:**
- `company_members` — összekapcsolja a user-eket és a cégeket (role: owner/admin/member)
- `accounty_assignments` — összekapcsolja a könyvelőket és az ügyfélcégeket
- Minden adat-tábla (invoices, transactions, stb.) tartalmaz `company_id`-t
- A RLS policy a `company_members` és `accounty_assignments` táblákon keresztül ellenőriz

## Consequences

**Pozitív:**
- Adatszeparáció DB szinten — nem lehet véletlenül "átszivárogni"
- A frontend kódnak nem kell szűrnie — a DB automatikusan szűr
- A service_role key (worker) megkerüli a RLS-t — hatékony batch feldolgozás
- `InitPlan` memóriagyorsítótár: nincs soronkénti CPU pazarlás
- Nincs redundáns permissive kiértékelés

**Negatív:**
- Komplex JOIN-os RLS policy-k lassíthatják a lekérdezéseket (ezért kötelező a B-Tree index az összes Foreign Key-re!)
- Debugolás nehéz (RLS "csendesen" szűr, nem dob hibát)
- A `company_members` tábla RLS policy-ja kritikus pont — ha hibás, minden adat sérülékeny

## Cross-company Invoice Routing (2026-07-02)

Ha egy user több céghez is tagként hozzá van rendelve (`company_members`), a worker automatikusan
route-olja a számlákat a helyes céghez az adószám alapján. Ez a `company_id` UPDATE a worker
`service_role`-lal hajtja végre (RLS bypass). A routing CSAK a user `company_members` tagságai
között történik — más tenant adataihoz nem férhet hozzá. Lásd: worker `company_router.py`, ADR-027.

## eaisyBooks Könyvelői és Support Admin RLS Kiterjesztés (2026-09-27)

A külső könyvelők (`accounty_assignments`) és a központi technikai ügyfélszolgálat (`support_admin`) számára a kritikus törvényi bevallási táblák (`vat_returns`, `vat_return_lines`, `vat_return_m_lines`) és az általános cégjogosultsági segédfüggvény (`is_company_member_or_above`) kibővítésre került (migration: `20260927160000_fix_vat_returns_accounty_and_support_admin_rls.sql`):
1. **`is_company_member_or_above(company_id)`**:
   - `company_members` ellenőrzés mellett meghívja a `has_company_access_via_cache(p_company_id, 'accounty'::text)` függvényt, valamint az `is_support_admin()` ellenőrzést.
2. **`vat_returns*` RLS szabályok konszolidációja**:
   - Egységes `vat_returns_access`, `vat_return_lines_access`, `vat_return_m_lines_access` `FOR ALL` szabályok lettek bevezetve, amelyek `public.is_company_member_or_above(company_id) OR public.has_company_access_via_cache(company_id, 'accounty') OR public.is_support_admin()` feltételt használnak mind a `USING`, mind a `WITH CHECK` ágakban.

## Kapcsolódó
- [A-092: Teljes Adatbázis Biztonsági és Teljesítménybeli Audit & Optimalizáció](./A-092-database-security-and-performance-optimization.md)
- [A-072: Robust Accounting Firm Assignment RLS](./A-072-accounting-assignments-insert-rls.md)


