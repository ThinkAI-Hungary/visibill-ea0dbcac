# A-049: Felhasználó Törlési és Anonimizálási Stratégia (Soft Delete)

**Status:** Decided  
**Date:** 2026-08-11  
**Utoljára frissítve:** 2026-08-11

## Context

A rendszer üzemeltetői igényként jelezték a felhasználók törlésének/eltávolításának lehetőségét a Management Dashboard ("Felhasználók" tab) felületen.
Az adatbázis sémában a felhasználó ID-je (`user_id` / `owner_id`) több mint 40 táblában szerepel idegen kulcsként (pl. számlafeltöltések, ÁFA bevallások, tranzakció naplók, házipénztár bizonylatok, cégtagságok).

Egy közvetlen fizikai törlés (`DELETE FROM auth.users`) az alábbi súlyos problémákat idézné elő:
1.  **Cégek és üzleti adatok kaszkádolt törlése (CASCADE):** A `companies.owner_id` idegen kulcs `ON DELETE CASCADE` szabállyal rendelkezik. A tulajdonos fizikai törlésével a teljes cég, az összes számlája, tranzakciója és könyvelési adata törlődne.
2.  **Tranzakciók meghiúsulása (NO ACTION / RESTRICT):** 34 db pénzügyi, főkönyvi és EV modul tábla `ON DELETE NO ACTION` szabállyal rendelkezik (pl. `vat_returns`, `fixed_assets`, `petty_cash_entries`). Ha a felhasználónak van akár egyetlen történeti bejegyzése ezekben, az adatbázis hibát dob és megtagadja a törlést.

## Decision

A fizikai törlés helyett a **Soft Delete / Anonimizálási Stratégiát (Opció A)** alkalmazzuk a következő szabályok szerint:

1.  **Cégtulajdonos (Owner) védelem:** A törlési Edge Function ellenőrzi, hogy a felhasználó tulajdonosa-e aktív cégnek. Ha igen, a törlést megtagadja, és hibaüzenetben kéri az admint a tulajdonjog átruházására egy másik tagra vagy a cég törlésére.
2.  **Hozzáférések megvonása:** Töröljük a felhasználó összes cégtagságát (`company_members`), eaisyBooks hozzárendelését (`accounty_assignments`), valamint eaisybill és accounty modul szintű jogosultságait. Ezáltal azonnal elveszíti hozzáférését a teljes platformhoz, és nem jelenik meg tagként a cég munkatársai között.
3.  **Profil anonimizálás:** A `profiles` táblában a felhasználó személyes adatait és hozzáférési flagjeit felülírjuk:
    *   `name` -> `"Törölt Felhasználó"`
    *   `avatar_url`, `position`, `company` -> `null`
    *   `eaisybill_access`, `eaisybooks_access`, `is_support_admin` -> `false`
    *   `role` -> `"user"`
4.  **Autentikációs fiók letiltása és elfedése:** A Supabase Auth Admin API segítségével a felhasználó email címét anonim formátumra módosítjuk (`deleted_{user_id_prefix}@visibill.hu`), email megerősítési flagjét visszavonjuk, jelszavát random UUID-re cseréljük, kiürítjük a metaadatokat és véglegesen letiltjuk (bannoljuk) a fiókot.

## Consequences

### Pozitív:
- **100% adatintegritás:** Egyetlen számla, tranzakció, riport vagy cég sem törlődig véletlenül, a DB idegen kulcsok nem sérülnek.
- **GDPR megfelelőség:** A személyes adatok (Név, Email, Avatar) visszavonhatatlanul és véglegesen megsemmisülnek a rendszerből.
- **Auditálhatóság megőrzése:** A korábbi főkönyvi bejegyzéseknél, bizonylatoknál és naplóknál a hivatkozások megmaradnak, de az elkövető neve helyén egységesen *"Törölt Felhasználó"* látható.

### Negatív:
- A felhasználó sora megmarad a Supabase Auth-ban és a `profiles` táblában (bár teljesen inaktív és felismerhetetlen formában).

## Kapcsolódó
- [A-019: Management Dashboard](./A-019-management-dashboard.md)
- [A-009: Supabase Auth + RBAC](./A-009-auth-rbac.md)
- [A-003: Multi-tenancy RLS](./A-003-multi-tenancy-rls.md)
