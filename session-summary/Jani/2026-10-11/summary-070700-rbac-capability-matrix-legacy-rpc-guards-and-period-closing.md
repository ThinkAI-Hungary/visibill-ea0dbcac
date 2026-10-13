# Session Summary — 2026-10-11 07:07

```text
feat(rbac): A-247 jogosultsági képességmátrix (RBAC) refaktorálás, O1–O4 szerepkör-szintek, 27 db legacy GL RPC autorizációs védelem, atomi időszakzárás RPC és UI kapuk

- Adatbázis & PostgreSQL RPC Jogosultsági Szintek (Dev DB: qhvcdqkqpgpdxogqqvyr, A-247)
  - O1 Szabály (Könyvelő nélküli cégvezetői könyvelés): Megalkottuk a `company_has_assigned_bookkeeper(p_company_id uuid)` segédfüggvényt, amely detektálja, ha egy céghez nincs hozzárendelve dedikált könyvelőirodai vagy egyéni könyvelő (`iroda_admin`, `senior_könyvelő`, `könyvelő`, `asszisztens`). Ilyenkor a cégvezetés (`owner`, `admin`, `member` / Pénzügyi Vezető) könyvelői jogokat kap (főkönyvi írás, zárás, auto-posterek).
  - O2 Szabály (Szerepkörök szétválasztása kijelölt könyvelő esetén): Bevezettük az `assert_company_role_tier(p_company_id uuid, p_required_tier text)` és `has_company_role_tier(...)` eljárásokat. Ha van kijelölt könyvelő, a napi könyvelés nyitott minden szintnek (`asszisztens`, `könyvelő`, `senior_könyvelő`), míg a kritikus műveletek (időszakzárás, ÁFA véglegesítés, MKVK XML export, számlatükör szerkesztés/törlés) kizárólag a `senior_könyvelő`, `iroda_admin` és `support_admin` számára engedélyezettek.
  - Atomi Időszakzárási RPC (`set_accounting_period_closed`): Kiváltottuk a korábbi kliensoldali közvetlen táblafrissítést egy szerveroldali, tranzakció-biztos eljárással, amely `accountant_lead_write` tier ellenőrzést, audit naplózást és időszak-kezelést végez.
  - 27 db Legacy GL RPC autorizációs felvértezése: Minden korábbi főkönyvi eljárás (`create_gl_opening_balance_batch`, `storno_acc_journal_entry`, `save_gl_rules_batch`, stb.) kiegészült kötelező `assert_company_role_tier` szintvizsgálattal, a törlési műveletek `FOR UPDATE` párhuzamossági zárolással lettek ellátva, és a jogosulatlan hozzáférés elhárítására lefutott a `REVOKE ALL ON FUNCTION ... FROM anon, PUBLIC`.
  - RLS Védelmi szigorítások: `acc_accounting_periods`, `gl_accounts` és `companies` táblákon RLS házirendek megerősítve a közvetlen Data API bypass kizárására.
  - Migrációk: `20261011012947`, `20261011042300`, `20261011050500`, `20261011052000`, `20261011060000`, `20261011063000`, `20261011070000` és `MANUAL_RUN_cleanup_firm_member_sync_assignments.sql` regisztrálva és lefutva a Dev DB-n.

- Kliensoldali Jogosultságkezelés & UI Integráció (`capabilities.ts`, `useCompanyCapabilities.ts`)
  - Képességmátrix kiegészítése: Új `canWriteLedger` képesség bevezetése a `CompanyCapabilities` típusban.
  - Dinamikus O1/O2 szerepkör-feloldás: A `resolveCapabilities()` bővült `hasAssignedBookkeeper?: boolean` flaggel. Ha nincs könyvelő, a cégvezetés írhatja a főkönyvet és zárhat. Ha van könyvelő, érvényesül a feladatmegosztás (Segregation of Duties), a cégvezetés csak olvasási joggal bír a könyvelésben.
  - Reaktív Hook: `useCompanyCapabilities.ts` integrálva a `company_has_assigned_bookkeeper` RPC hívással (5 perces TanStack Query gyorsítótárral).
  - `PeriodClosingSettings.tsx`: Áttérés a `set_accounting_period_closed` RPC hívására. Inaktív állapot `!canClosePeriod` esetén és figyelemfelhívó magyarázó sáv jogosulatlan felhasználóknak.
  - `JournalsPage.tsx`: Az „Időszakzárás” gomb `canClosePeriod`, a „Javaslatok generálása” és „Új vegyes bizonylat” gombok pedig `canWriteLedger` által védve lettek, tiltott állapotban informatív tooltip magyarázattal.

- Dokumentáció & Döntési Nyilvántartás Szinkronizáció
  - `docs/architecture/visibill-rbac-matrix.md` & `decisions/visibill-rbac-matrix.md`: 6. szekcióban frissítve az RPC autorizációs táblázat, 8. szekcióban a 159 pgTAP teszt eredménye rögzítve, a 9. szekció Morfi felülvizsgálatának mind a 8 hiányossága ✅ LEZÁRVA státuszra állítva.
  - `docs/architecture/decisions/A-247-role-capability-matrix.md`: 8.9-es addendum rögzítve az O1–O4 döntések végrehajtásáról.
  - Kódbázis Tudásgráf: `graphify update .` lefutott (26 764 csomópont, 44 621 él frissítve AST szinten).

- Minőségbiztosítás & Verifikáció (Quality Gate)
  - Adatbázis pgTAP tesztek (Dev DB): 159/159 assertion sikeresen lefutott (100% zöld):
    - `legacy_gl_rpc_authz.test.sql`: 23/23 PASS
    - `autoposter_rpc_functions.test.sql`: 32/32 PASS
    - `rls_role_write_guards.test.sql`: 44/44 PASS
    - `firm_member_sync_roles.test.sql`: 24/24 PASS
    - `external_accountant_ledger_access.test.sql`: 22/22 PASS
    - `vat_returns_finalize_guard.test.sql`: 14/14 PASS
  - Oxlint vizsgálat: `npm run lint:fast` 0 hiba (1543 fájl ellenőrizve)
  - TypeScript típusellenőrzés: `npx tsc --noEmit` hibamentes (exit code: 0)
  - Kliensoldali Vitest tesztek: `src/test/permissions/` (61/61 PASS), `periodClosingAndCashClosingClarity.test.tsx` (2/2 PASS)
  - ÁFA Regresszióvédelmi Kapu (VAT Safety Gate): `vatRegressionTaxology.test.ts` (16/16 PASS), `npm run vat:guard` élő Dev DB vs golden master 100%-os egyezés

- DevOps, Környezetizoláció & Git
  - Szigorú Dev / Prod elhatárolás: A felhasználói utasításnak megfelelően („Nem akarjuk egyelőre prodra migrálni”) az éles környezet érintetlen maradt.
  - Git commit: `43ba18e0` a `develop` ágon elkészült és pusholva lett az `origin/develop` tárolóba.
  - CI/CD: A GitHub Action `deploy-dev.yml` munkafolyamat automatikusan elindult és levezényli a lint, build és rsync deploy folyamatot a `dev.visibill.hu` droplet felé.
```
