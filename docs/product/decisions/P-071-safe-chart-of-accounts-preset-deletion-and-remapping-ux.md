# P-071: Biztonságos Számlatükör Törlés és Tételek Átkötése (Safe CoA Preset Remapping) UX

**Status:** Decided  
**Date:** 2026-09-04  
**Category:** UI / General Ledger / Chart of Accounts / Governance / Modal UX  

## Context
A Visibill Főkönyv felületén a felhasználók egyedi számlatükör sablonokat (`chart_of_accounts_presets`, `type = 'custom'`) tölthetnek fel és kezelhetnek. Korábban az elavult sablonok törlése közvetlen táblatörléssel (`supabase.from('gl_accounts').delete()...`) történt, ami lekönyvelt tételek megléte esetén PostgreSQL foreign key hibát (`23503: acc_journal_lines_gl_account_id_fkey`) eredményezett, és nyers hibaüzenettel megszakadt a kliensen.

## Question
Hogyan biztosítsuk a számlatükör sablonok törlését úgy, hogy a felhasználó védve legyen az adatvesztéstől és a hibáktól, miközben nem kényszerül manuális, tételes átkönyvelésre?

## Decision
1. **Aktív sablon védelme:**
   - Az éppen aktív számlatükör sablon melletti törlés (kuka) ikon le van tiltva (`disabled`).
   - Fölötte magyar nyelvű magyarázó `CustomTooltip` jelenik meg: *"Az aktív számlatükör sablon nem törölhető. Előbb aktiválj egy másik sablont!"*.
2. **Használat-érzékeny megerősítő párbeszédablak (shadcn/ui `AlertDialog`):**
   - A böngésző natív `window.confirm()` helyett strukturált, akadálymentes modál jelenik meg.
   - **Ha nincsenek hivatkozások:** Egyszerű, megnyugtató törlési megerősítés jelenik meg (`Végleges törlés` gombbal).
   - **Ha vannak hivatkozások (lekönyvelt naplótételek, banki tranzakciók, számlák, eszközök, beszámolók):**
     - Kiemelt borostyánsárga figyelmeztető kártya jelenik meg, tételesen felsorolva az érintett tételek számát.
     - Egy `<Select>` legördülő választó jelenik meg (*"Hová kössük át a hivatkozásokat a törlés előtt?"*), amely automatikusan felajánlja a cég többi sablonját, alapértelmezetten kiválasztva az új aktív sablont.
     - A megerősítő gomb felirata dinamikusan `Átkötés és törlés`-re vált.
3. **Egykattintásos automatizáció:**
   - A felhasználónak nem kell tételeket manuálisan keresgélnie vagy átkönyvelnie: a rendszer a háttérben atomi tranzakcióban elvégzi az átkötést és törlést.
   - A felhasználó zöld toast visszajelzést kap az átkötött tételek számával.
   - Ha a célsablonból hiányzik egy hivatkozott főkönyvi szám, a folyamat visszagördül, és a felugró hibaüzenet tételesen megnevezi a hiányzó számlákat.

## Current Implementation
- Komponens: `src/components/general-ledger/ManagePresetsModal.tsx`
- Szerveroldali tranzakciós RPC-k:
  - `check_chart_of_accounts_preset_usage(p_preset_id UUID)`
  - `delete_chart_of_accounts_preset(p_preset_id UUID, p_target_preset_id UUID DEFAULT NULL)`

## Rationale
- **Zéró manuális adminisztráció:** Számlatükör csere esetén a felhasználónak nem kell órákat töltenie kézi javítgatással.
- **Adatbázis-szintű integritásgarancia:** A lekönyvelt tételek immutabilitása és egyensúlya nem sérül.
- **Teljes összhang a modern shadcn/ui és a11y irányelvekkel:** Minden gomb explicit `aria-label`-t kapott, a fókuszkezelés szabályos.

## Kapcsolódó
- [A-090: Biztonságos Számlatükör Sablon Törlés és Tételek Átkötése](../../architecture/decisions/A-090-safe-chart-of-accounts-preset-deletion-and-remapping.md)
- [A-016: PostgreSQL Lekérdezési és Hozzáférési Stratégia](../../architecture/decisions/A-016-postgresql-query-strategy.md)
- [P-067: Főkönyvi Könyvelési Státusz Szűrés és Naplózási Kormányzás](./P-067-gl-posting-status-filter-and-journal-governance-ux.md)
