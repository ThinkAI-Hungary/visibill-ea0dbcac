# A-026: Support Admin Ideiglenes Hozzáférés (Impersonation & Full RLS Access)

**Status:** Decided  
**Date:** 2026-07-03  
**Utoljára frissítve:** 2026-08-25  

## Context
A `support_admin` szerepkörű felhasználóknak (management usereknek) képesnek kell lenniük bejelentkezni bármely cég vagy könyvelőiroda nevében (impersonation), és **teljes adminisztrátori ellenőrzéssel** (full control: olvasás, írás, számítások, törlés) kell rendelkezniük az összes Eaisybill és Eaisybooks modulban (pl. ÁFA bevallás 2665, Főkönyv, Mérleg, Eredménykimutatás, Számlák, Tranzakciók, Bérek, TENY, Kintlévőség, Házipénztár, Beállítások, EV modulok, Bérszámfejtés stb.).

## Decision
1. **Edge Function szint (`impersonate-company`):**
   - Belépéskor: beszúr egy `role: 'support_admin'` sort a `company_members` táblába. Könyvelőiroda vagy hozzárendelt cég esetén `accounty_assignments` sorokat (`role: 'iroda_admin'`, `is_impersonation: true`).
   - Kilépéskor: törli a `company_members` és az `accounty_assignments` ideiglenes rekordjait.

2. **Adatbázis Helper Függvények és RLS (`20260825000000_support_admin_full_access.sql`):**
   - `public.is_company_member_or_above(company_id)`: Bővítve `role IN ('owner', 'admin', 'member', 'assistant', 'viewer', 'support_admin')`.
   - `public.is_company_admin(company_id)`: Bővítve `role IN ('owner', 'admin', 'support_admin')`.
   - `public.has_accounty_company_access(company_id)`: Engedélyezi a cég `support_admin`, `owner` és `admin` tagjainak a hozzáférést a könyvelési és EV modulokhoz.
   - `public.is_iroda_admin_for_firm` és `is_member_of_firm`: Felismeri a `support_admin` és platform `management`/`thinkai` felhasználókat.
   - `salary`, `eaisybill_module_permissions`, `api_keys` és `company_members` táblák RLS policy-jai közvetlenül támogatják a `support_admin`-t.
   - `generate_api_key` és `revoke_api_key` RPC függvények engedélyezik a `support_admin` szerepkört.

3. **Frontend Réteg:**
   - `useUserRole`: `isAdmin = true` minden `support_admin` számára.
   - `useEaisybillPermissions`: Teljes R/W jogosultság.
   - `AccountyRoleContext`: `support_admin` és `management` profilok automatikusan `iroda_admin` szerepkört kapnak.

## Consequences
**Pozitív:**
- A support admin impersonáció alatt 100%-os adminisztrátori funkcionalitást kap minden Eaisybill és Eaisybooks modulban.
- Megszűnnek az üres állapotok, sikeres számítások után (pl. ÁFA bevallás generálás) az adatok azonnal megjelennek.
- Nincs szükség RLS kikapcsolására; a multi-tenancy adatbiztonság továbbra is szigorúan érvényesül.

## Kapcsolódó
- [A-003: Multi-tenancy RLS alapon](./A-003-multi-tenancy-rls.md)
- [A-005: Edge Functions](./A-005-edge-functions.md)
- [A-019: Management Dashboard](./A-019-management-dashboard.md)
- [P-036: Management Dashboard UI és Navigáció](../../product/decisions/P-036-management-dashboard.md)

