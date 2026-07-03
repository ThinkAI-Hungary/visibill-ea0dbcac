# A-026: Support Admin Ideiglenes Hozzáférés (Impersonation & RLS Bypass)

**Status:** Decided
**Date:** 2026-07-03
**Utoljára frissítve:** 2026-07-03

## Context
A `support_admin` szerepkörű felhasználóknak (management usereknek) képesnek kell lenniük bejelentkezni egy adott cég vagy könyvelőiroda nevében (impersonation), hogy lássák pontosan azt az adatot, amit a felhasználó látna, de admin jogosultságokkal. 
Az eaisyBooks adatokhoz (számlák, partnerek stb.) az RLS (Row Level Security) kizárólag a `company_members` (saját cég dolgozói) és az `accounty_assignments` (rendelt könyvelőiroda/könyvelők) táblák alapján ad hozzáférést. 
Ha a support admin "belép" egy könyvelőirodába, látnia kell az iroda *összes* kezelt ügyfelének adatait. RLS szinten ennek lekezelése `support_admin` role alapján komplex és teljesítmény-intenzív lenne (50+ policy módosítása).

## Decision
Az ideiglenes hozzáférést **batch assignments** módszerrel oldjuk meg, az RLS policy-k módosítása nélkül:
1. Amikor a support admin "belép" egy cégbe, az `impersonate-company` Edge Function beszúr egy ideiglenes `company_members` (role: `support_admin`) sort az adott céghez.
2. Ezen felül az Edge Function megkeresi az összes ügyfelet, aki az adott céghez (mint `accounting_firm_id`) van rendelve.
3. Beilleszt az `accounty_assignments` táblába mindegyik ügyfélhez egy ideiglenes sort (`role: iroda_admin`) az admin felhasználó ID-jával.
4. Ezek az ideiglenes sorok egy új, **`is_impersonation` (boolean, default: false)** oszloppal vannak megjelölve.
5. Kilépéskor (stop action) az Edge Function egyben törli a `company_members` sort, ÉS az összes `is_impersonation = true` sort az adott admin felhasználóhoz.

Továbbá az alkalmazás-szintű switcher (`eaisybill` / `eaisyBooks`) csak akkor jelenik meg a support adminnak, ha az "impersonated" cég maga könyvelőiroda, vagy ténylegesen van érvényes `accounty_assignments` sora. (Ezt a `useHasEaisybillAccess` hook kezeli fallback logikával).

## Consequences
**Pozitív:**
- Az RLS policy-k érintetlenek maradnak, így a biztonsági modell egyszerű és robusztus marad.
- A teljesítmény nem romlik a policy-k túlbonyolítása miatt.
- Az RLS-re épülő funkciók (adatlekérés, dashboard, statisztikák) 100%-ban úgy működnek, ahogy az igazi felhasználóknak.

**Negatív:**
- Egy esetleges hiba (Edge function crash vagy a böngésző bezárása kilépés előtt) az ideiglenes sorok bennmaradását eredményezheti az adatbázisban (szemét adat). 
- Erre egy jövőbeli cleanup cron job lehet a megoldás, ami mondjuk 24 óránál régebbi `is_impersonation=true` sorokat töröl.

## Kapcsolódó
- [A-003: Multi-tenancy RLS alapon](./A-003-multi-tenancy-rls.md)
- [A-005: Edge Functions](./A-005-edge-functions.md)
- [P-036: Management Dashboard UI és Navigáció](../../product/decisions/P-036-management-dashboard.md)
