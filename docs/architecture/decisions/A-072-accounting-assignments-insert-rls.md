# A-072: Robust Accounting Firm Assignment RLS & Direct Client Creation

**Status:** Decided  
**Date:** 2026-08-31  
**Category:** Biztonság, Auth & eaisyBooks  
**Related Decisions:** [A-003](./A-003-multi-tenancy-rls.md), [A-009](./A-009-auth-rbac.md), [P-031](../../product/decisions/P-031-accounty-layout.md)

---

## 1. Context

A `/eaisybooks/new-client` oldalon manuális ügyfélhozzáadáskor a frontend `42501` hibát kapott:
`new row violates row-level security policy for table "accounty_assignments"`.

A gyökérok két összefüggő hiányosság volt:
1. **Frontend:** A `NewClientPage.tsx` nem fűzte hozzá a bejelentkezett könyvelő `accounting_firm_id` mezőjét az `accounty_assignments.upsert()` híváshoz (így `NULL` maradt), és hardcoded `'junior'` szerepkört küldött.
2. **Adatbázis RLS:** Az `assignments_insert` szabály kizárólag az `is_iroda_admin_for_firm(accounting_firm_id)` függvényt vizsgálta, amely nem engedélyezte a beszúrást, ha `accounting_firm_id` hiányzott, vagy ha a könyvelő a saját cégéhez/irodájához (`company_members` `owner`/`admin`) rendelt ügyfelet.

---

## 2. Decision

1. **Frontend Firm & Role Resolution (`src/pages/Accounty/NewClientPage.tsx`):**
   - A kliens létrehozása előtt a frontend lekérdezi a bejelentkezett felhasználó aktív `accounting_firm_id`-ját és szerepkörét az `accounty_assignments` táblából.
   - Az upsert payloadban kötelezően megadja az `accounting_firm_id`-t és a felhasználó valós szerepkörét (`iroda_admin` / aktuális role).
   - Új cég létrehozásakor automatikusan beállítja a `companies.owner_id: user.id` értéket.
2. **RLS & Függvény Kiterjesztés (`20260831151500_fix_accounty_assignments_insert_rls.sql`):**
   - Az `is_iroda_admin_for_firm(p_firm_id)` mostantól ellenőrzi:
     - `accounty_assignments` táblát (`role IN ('iroda_admin', 'senior', 'admin')`),
     - `company_members` táblát (`role IN ('owner', 'admin', 'support_admin')`),
     - `profiles` táblát (`is_support_admin = true` vagy `role IN ('management', 'thinkai')`).
   - Az `assignments_insert` RLS policy megengedi a beszúrást mind `accounting_firm_id`, mind `company_id` adminisztráció, mind pedig a felhasználó saját cégtulajdonosi szerepköre esetén.

---

## 3. Consequences

### Pozitív:
- A könyvelők és irodavezetők megbízhatóan, azonnal tudnak új ügyfeleket rögzíteni és a saját irodájukhoz kapcsolni.
- Az RLS szabályzat védelme szigorú marad (csak tényleges iroda adminok/tulajdonosok oszthatnak ki jogosultságokat).
