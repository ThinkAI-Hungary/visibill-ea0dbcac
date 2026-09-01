# A-073: eaisybill ↔ eaisyBooks Cégfelviteli Automatikus Szinkronizáció

**Status:** Decided  
**Date:** 2026-09-01  
**Category:** Adatbázis, Triggerek, eaisyBooks & Multi-Tenancy  
**Related Decisions:** [A-003](./A-003-multi-tenancy-rls.md), [A-009](./A-009-auth-rbac.md), [A-016](./A-016-postgresql-query-strategy.md), [A-020](./A-020-auth-trigger-chain-incident.md), [A-072](./A-072-accounting-assignments-insert-rls.md)

---

## 1. Context

A könyvelő felhasználók (pl. iroda adminok, szenior könyvelők) a napi munka során az **eaisybill** bizonylatkezelő fejlécében lévő cégválasztó modulban (`CompanySelector.tsx` – „Új cég”) is hoznak létre új ügyfeleket.
* **A hiba tünete:** A felvitt cég azonnal megjelent az eaisybill fejlécében és listáiban, azonban az **eaisyBooks** felületen („Saját ügyfeleim”, „Céglista”, modulok) **egyáltalán nem látszott**.
* **A gyökérok:** Az eaisybill cégfelvitel közvetlenül a `companies` táblába szúrt be, ahol a korábbi `on_company_created()` trigger csak a `company_members` (`role = 'owner'`) és `petty_cash_registers` rekordokat hozta létre. Nem hozott létre rekordot az `accounty_assignments`, `accounty_tax_profiles` és `accounty_communication_preferences` táblákban.
* Mivel az eaisyBooks hookjai (`useAccountyClients`, `useMyAssignedCompanyIds`) a cégeket és statisztikákat az `accounty_assignments` táblából olvassák ki, a hozzárendelés nélküli cégek kiestek a könyvelői irányítópultból.

---

## 2. Decision

### 1. PostgreSQL Database Trigger Szintű Garancia (`public.on_company_created()`)
A `public.on_company_created()` trigger (`AFTER INSERT ON public.companies`) kibővítésre került:
- **SECURITY DEFINER** és **SET search_path TO 'public'** attribútumokkal fut.
- Ha az újonnan létrehozott cég tulajdonosa (`NEW.owner_id`) rendelkezik meglévő könyvelőirodával (`accounty_assignments.accounting_firm_id IS NOT NULL`):
  1. **`accounty_assignments`** rekord beszúrása:
     - `accountant_user_id = NEW.owner_id`
     - `company_id = NEW.id`
     - `accounting_firm_id = v_firm_id`
     - `role = COALESCE(v_user_role, 'iroda_admin')`
     - `is_primary = true`
     - `is_main_accountant = true` (ha még nincs főkönyvelő)
     - `source = 'sync'`
  2. **`accounty_tax_profiles`** alapértelmezett rekord beszúrása (`vat_frequency = 'monthly'`, `contribution_frequency = 'monthly'`, `is_kata = false`, `is_kiva = false`).
  3. **`accounty_communication_preferences`** alapértelmezett rekord beszúrása (`channel_email = true`, `auto_reminder = true`).
- Ha a létrehozó NEM könyvelő (sima eaisybill KKV ügyfél), a trigger nem hoz létre felesleges accounty rekordokat.

### 2. Idempotens Backfill Migráció (`20260901_auto_sync_company_to_eaisybooks.sql`)
A meglévő adatbázisban korábban létrehozott, de könyvelői hozzárendelés nélkül maradt 6 cég (`EURODIFFERENT Kft.`, `JKP STATIC Kft.`, `Günder János e.v.`, `SOFT-CONTROLL KFT.`, `Baul-Paks Kft`, `Fakov Kft`) automatikusan pótlásra került.

### 3. Frontend Cache Invalidation (`src/components/CompanySelector.tsx`)
A `CompanySelector.tsx` `handleCreateCompany` függvénye a cég sikeres létrehozása után érvényteleníti az `accounty-clients`, `accounty-kpis`, `accounty-deadlines` és `accounty-my-assignments` React Query cache kulcsokat, így a felhasználó azonnal látja az új céget, amint az eaisyBooks modulra vált.

---

## 3. Consequences

### Pozitív:
- **Teljes Adatkonzisztencia:** Függetlenül attól, hogy a cég az eaisybill fejlécéből, a NewClientPage varázslóból, mobilról vagy integrációból jön létre, a könyvelőiroda alá azonnal és automatikusan bekerül.
- **Nulla manuális support beavatkozás:** Nem szükséges többé manuális SQL script vagy support ticket az új cégek könyvelői megjelenítéséhez.
- **Biztonság és RLS Védelem:** A trigger csak a létrehozó felhasználó saját könyvelőirodájához rendeli hozzá a céget, kizárva az adatszivárgást.
