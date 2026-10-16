# A-247: Szerepkör-képesség mátrix (Capability Matrix), Bérszámfejtő szerepkör és ÁFA-zárolás backend védelme

**Dátum:** 2026-10-11  
**Státusz:** Elfogadva és implementálva (Dev környezet; Prod élesítés külön, kontrollált merge-dzsel)  
**Specifikáció:** `implementation-plans/eaisybill_szerepkorok_fejlesztes.md`  
**Kapcsolódó ADR-ek:** A-102 (eaisyBooks jogosultsági mátrix), A-242 (ÁFA bevallás pillanatkép)  
**Érintett komponensek:** `src/lib/permissions/*`, `useCompanyCapabilities`, `useUserRole`, `useEaisybillPermissions`, `useAccountyPermissions`, `ProtectedAccountyRoute`, ÁFA UI (`VatReturnViewTab`, `VatXmlExportModal`), `accounty_assignments`, `vat_returns`, `invite-user` és `management-stats` Edge Function

---

## 1. Kontextus

A szerepkörök (`owner / admin / member / assistant / viewer / employee` az eaisyBillben; `iroda_admin / senior_könyvelő / könyvelő / asszisztens` az eaisyBooksban) elnevezése és tényleges jogai eltértek a specifikációtól: a `viewer` és a `member` UI-neve félrevezető volt, a Cégvezető látta a könyvelés-technikai nézeteket, az Asszisztens a bankegyenlegeket, az ÁFA-zárolást és az ÁNYK XML-exportot bármely könyvelői szint elvégezhette, és a bérszámfejtő külön szerepkör híján teljes könyvelői hozzáférést kapott.

## 2. Döntések

| ID | Döntés |
| :--- | :--- |
| **D-1** | **Hibrid alias.** A DB-ben `company_members.role = 'member'` marad; a UI-ban `finance_lead` személyként ("Pénzügyi Vezető") jelenik meg. Nincs DB-szintű átnevezés → nincs migrációs kockázat. |
| **D-2** | Központi `useCompanyCapabilities` hook + tiszta `capabilities.ts` mátrix (`canViewControlling`, `canViewBankBalances`, `canManageInvoices`, `canManageAccountingTech`, `canClosePeriod`, `canManageTeam`, `canExportOfficialTaxReturn`, `canWriteLedger`, `canManagePayments`). |
| **D-3** | Asszisztens: nincs Könyvelés csoport, nincs banki egyenleg/likviditás. Cégvezető (`admin`): `/subledger` és `/journals` rejtett, a kontrolling látható. Cégtulajdonos: minden. Pénzügyi Vezető: kontrolling, csapatkezelés nélkül. **Megfigyelő** (`viewer`): globális read-only, a kontrollingot is látja, semmit nem módosíthat. Munkavállaló (`employee`): kizárólag munkaidő és jelenlét, dedikált `EmployeeShell` oldalsáv nélkül. |
| **D-4** | ÁFA-időszak zárolása (`vat_returns.status = 'finalized'`) és hivatalos ÁNYK XML export: eaisyBooksban kizárólag `senior_könyvelő` és `iroda_admin`. UI-védelem **és** backend védelem (`ACCESS_DENIED`, ERRCODE 42501). |
| **D-5** | **Hibrid Bérszámfejtő.** Új eaisyBooks szerepkör: `payroll_specialist`. Alapértelmezetten csak bérszámfejtés (rw) + olvasható portfólió/adónaptár + hibajegy/AI/profil. Nincs ügyfél-könyvelés, főkönyv, számla, TAO. A jogai azonban a `accounty_module_permissions` táblán keresztül **állíthatók** (DB override mindig felülírja az alapértelmezést). |

A `viewer` UI-neve mindenhol **"Megfigyelő"** (nem "Csendestárs"/"Betekintő"); a `member` neve **"Pénzügyi Vezető"**; az `admin` neve **"Cégvezető / Ügyvezető"**.

## 3. Megvalósítás

### 3.1 Frontend
- `src/lib/permissions/capabilities.ts`: szerepkör-címkék, alias (`toEaisybillPersona`), képességmátrixok (eaisyBill + eaisyBooks), `resolveCapabilities` (tag + hozzárendelés esetén engedékeny egyesítés). Új `canManagePayments` képesség az átutalási csomagok indítására és céges bankszámlák szerkesztésére (csak cégvezetés és pénzügyi vezető).
- `src/lib/permissions/accountyDefaults.ts`: **egyetlen forrás** az eaisyBooks modul-alapértelmezésekhez (futásidejű hook és a mátrix-oldal ugyanazt használja).
- `useEaisybillPermissions`: új modulok `subledger`, `accounting_rules`; admin alapból nem látja a `subledger`/`journals` modulokat; viewer olvashatja a kontrolling modulokat (P&L, mérleg, főkönyv, éves beszámoló, ÁFA), írási jog nélkül; `settings` írás csak owner/admin.
- `useAccountyPermissions` + `ProtectedAccountyRoute` (`requiredModule`, `AccountyModuleLayout`): az ügyfél-szintű bérszámfejtés, számla/főkönyv/EV és TAO útvonalak modul-szintű védelmet kaptak.
- Műszerfal & Tranzakciók: az operatív egyenleg, készpénzkártya és a tranzakciós KPI összegzők csak `canViewBankBalances` esetén jelennek meg (asszisztens elől elrejtve).
- Utalások & Bankszámlák: a `TransfersPage.tsx` indítási és export gombjai, valamint a `BankAccountsTab.tsx` módosítási funkciói `canManagePayments` kaput kaptak.
- Munkavállalói Shell (`src/components/EmployeeShell.tsx`): Munkavállaló szerepkör esetén nincs oldalsáv és dátumválasztó; letisztult mobil-first fejléc jelenik meg, egyéb útvonalakról a `ProtectedRoute` automatikusan visszairányít a `/working-time`-ra.
- ÁFA UI: a Véglegesítés/Újranyitás gomb `canClosePeriod`-hoz, az ÁNYK/ePorezna/A60 export és az XML modal `canExportOfficialTaxReturn`-hoz kötött.
- `PermissionMatrixPage`, `AccountantManagementPage`, `TeamSettingsTab`, `ProfileSettingsPage`, `InviteUserDialog`, `Settings.tsx`: `payroll_specialist` választható; az alapértelmezés-váltó a szerepkör alapértékéből indul (a tiltott alapértelmezésű modul engedélyezése így tényleg működik).

### 3.2 Adatbázis (`20261011012947_role_capability_refactor.sql`, idempotens)
1. `accounty_assignments_role_check` kiegészítve `payroll_specialist`-tel.
2. `accounty_module_permissions_module_name_check` bővítve (`tao`, `client_bookkeeping`, `admin_*`) – korábbi látens hiba: a frontend ezeket a modulneveket már használta, a CHECK elutasította (23514).
3. `eaisybill_module_permissions` backfill: a meglévő `general_ledger` felülírások átmásolva `subledger`-re, a `journals` felülírások `accounting_rules`-ra (nincs jogosultság-visszalépés).
4. `sync_accounty_assignment_to_cache()`: `payroll_specialist` → `invoices/transactions = false`, `salaries/hr = true`. `REVOKE ... FROM PUBLIC, anon`.
5. `can_finalize_company_filing(uuid)`: `STABLE SECURITY DEFINER`, `search_path = public`, csak `authenticated`/`service_role`.
6. `fn_vat_returns_finalize_guard()` + `trg_vat_returns_finalize_guard` (BEFORE INSERT OR UPDATE OF status ON `vat_returns`): ha nem jogosult felhasználó `finalized` állapotba vagy állapotból léptet, `ACCESS_DENIED` (42501).

### 3.3 Edge Function
- `invite-user`: `ACCOUNTANT_ROLES` állandó (+ `payroll_specialist`) a három duplikált lista helyett.
- `management-stats/permissionsHandler.ts`: a menedzsment nézet tükrözi az új alapértelmezéseket.

## 4. Biztonsági korlátok (őszinte kép)

- ~~A `payroll_specialist` elkülönítése csak UI + cache jelzők szintjén érvényesül.~~ **Lezárva a 8. fejezetben** (`rls_guard_payroll_isolation`, 33 tábla). A maradék ~40 cache-alapú tábla (munkaidő, egyéb `accounty_*`) szándékosan olvasható maradt.
- A `vat_returns` zárolás védelme a fejlécre **és a sorokra** is kiterjed, DELETE-re is (8. fejezet). Az ÁNYK XML kliensoldalon generálódik, ezért az export védelme UI-szintű + `executeXmlDownload`/`handleXmlDownloadClick` belső guard (döntés: 3C, szerver oldali export nem készül).
- Az eaisyBooks szerepkör felhasználó-szintű (legmagasabb hozzárendelés), a DB-őr viszont cégenkénti hozzárendelést vizsgál; a UI a cégszintű `useCompanyCapabilities`-t használja.

## 5. Nem része ennek az ADR-nek (specifikáció, de még nincs kikényszerítve)
Senior-kizárólagos TAO/KIVA évzáró varázsló, kiegészítő melléklet, OBR benyújtás, számlatükör szerkesztés, bér-titkosítás kapcsoló.

## 6. Tesztek
- Vitest: `src/test/permissions/capabilities.test.ts`, `src/test/permissions/roleDefaults.test.ts`, frissített `src/test/accounty/{eaisybillPermissions,pathToModule}.test.ts`, `src/test/dashboardMetricsProfit.test.tsx`.
- pgTAP: `supabase/tests/database/vat_returns_finalize_guard.test.sql` (14 katalógus/szerződés teszt).
- Dev DB viselkedés-teszt (visszagörgetett tranzakcióban): könyvelő / asszisztens / payroll_specialist → `ACCESS_DENIED`; senior / iroda_admin / support admin → engedélyezve.

## 7. Dev kézi tesztmátrix
| Szerepkör | Elvárt |
| :--- | :--- |
| Asszisztens (eaisyBill) | Műszerfalon nincs "Operatív eredmény" és "Házipénztár" kártya; nincs Könyvelés menücsoport |
| Cégvezető | `/subledger`, `/journals` nem érhető el; P&L, mérleg látható |
| Megfigyelő | Kontrolling látható, minden gomb inaktív, mentés nem lehetséges |
| Könyvelő (eaisyBooks) | ÁFA "Véglegesítés" és ÁNYK export letiltva |
| Senior / Iroda Admin | ÁFA véglegesítés és export működik |
| Bérszámfejtő | Csak bérszámfejtés + 08; a Jogosultsági Mátrixban további modul engedélyezhető |

## 8. Addendum: RLS-szintű védelem (`20261011042300_rls_role_write_guards_and_payroll_isolation.sql`)

Döntések (review után): **1A** szerepkör-érzékeny írási RLS, **2A** lezárt ÁFA törlés/újraszámolás védelem, **3C** XML export marad kliensoldali (dokumentált korlát), **4A** payroll_specialist tábla-szintű RLS izoláció.

### 8.1 Mit tesz a migráció
- `rls_write_denied_company_ids(level, modules)` és `rls_payroll_blocked_company_ids(modules)`: `STABLE SECURITY DEFINER`, `search_path = public`, `REVOKE FROM PUBLIC, anon`. Csak a hívó saját cégeit adják vissza; uncorrelated `NOT IN (SELECT fn())` hashed SubPlan (A-103), így a `invoices`/`transactions` SELECT költsége nem nő (EXPLAIN: 1,0 / 4,3 ms).
- **RESTRICTIVE** `rls_guard_write_ins/upd/del` (10 tábla): `vat_returns`, `vat_return_a60_lines`, `acc_journals`, `acc_journal_headers`, `acc_open_item_matches`, `acc_accounting_periods` + szülőn át `vat_return_lines`, `vat_return_m_lines`, `acc_journal_lines`, `invoice_items`. Írhat: owner/admin/member/support_admin (+ `assistant` csak `invoice_items`-en), minden eaisyBooks szerep kivéve `payroll_specialist`. A modul-felülírások (`eaisybill_module_permissions` / `accounty_module_permissions` `can_write`) **bővíthetnek** (hibrid D-5), szűkíteni csak UI-szinten lehet.
- **RESTRICTIVE** `rls_guard_payroll_isolation` (SELECT, 33 tábla): `invoices`, `nav_invoices`, `transactions`, `partners`, `vat_returns`, `vat_return_a60_lines`, `vat_codes`, `accrual_entries`, `purchase_vouchers(_items)`, `llm_koltsegek`, `accounty_penztarkonyv_*`, 20 db `accounty_ev_*` (kivéve `accounty_ev_records_wages`). Explicit `accounty_module_permissions.can_read` felülírás vagy nem-employee `company_members` sor feloldja.
- ÁFA-megváltoztathatatlanság: `fn_vat_returns_finalize_guard` most INSERT/UPDATE/**DELETE**, és **minden** módosítás blokkolt lezárt bevalláson (nem csak státuszváltás); új `fn_vat_return_children_finalize_guard` a `vat_return_lines`, `vat_return_m_lines`, `vat_return_a60_lines` triggerein. A `calculate_*_vat_return` SECURITY DEFINER RPC-k is elbuknak, mert `auth.uid()` a hívó. Kivétel: `can_finalize_company_filing()` (senior, iroda_admin, owner/admin/member).

### 8.2 Korrekció az előző review-hoz
Az `invoices`/`transactions` írási policyk **már korábban** kizárták a `viewer`/`employee` szerepet. A valódi rések: `vat_returns` + sortáblák, `acc_*` (bármely tag írhatott) és `invoice_items`.

### 8.3 Tesztek
- pgTAP: `supabase/tests/database/rls_role_write_guards.test.sql` (44 teszt: katalógus + persona-mátrix). A pgTAP 1.3.3 a Dev DB-n telepítve (`CREATE EXTENSION pgtap WITH SCHEMA extensions`, kézi Dev-művelet, NEM migráció, hogy ne kerüljön a Prodra). Futtatás Dev-en: 44/44 sikeres.
- Vitest: `src/test/permissions/rlsGuardMigration.test.ts` (migráció-drift), `uiMountSmoke.test.tsx` (6 módosított UI komponens), `src/test/vat/vatXmlExportPermission.test.tsx` (export guard).
- Dev persona-eredmény (viselkedés): Megfigyelő minden írás 0 sor; asszisztens `invoice_items` 1, GL/ÁFA 0; payroll_specialist minden olvasás/írás 0 (explicit `can_read` felülírással a számlák láthatók, ÁFA marad 0); könyvelő: lezárt bevallás módosítás/törlés 42501, piszkozat 1; senior mindent megtehet.

### 8.4 Rollback
```sql
-- 1. policyk
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
           WHERE schemaname='public' AND policyname IN ('rls_guard_write_ins','rls_guard_write_upd','rls_guard_write_del','rls_guard_payroll_isolation')
  LOOP EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename); END LOOP; END $$;
-- 2. gyermek triggerek
DROP TRIGGER IF EXISTS trg_vat_return_lines_finalize_guard ON public.vat_return_lines;
DROP TRIGGER IF EXISTS trg_vat_return_m_lines_finalize_guard ON public.vat_return_m_lines;
DROP TRIGGER IF EXISTS trg_vat_return_a60_lines_finalize_guard ON public.vat_return_a60_lines;
DROP FUNCTION IF EXISTS public.fn_vat_return_children_finalize_guard();
-- 3. fejléc trigger visszaállítása a 20261011012947 verzióra (BEFORE INSERT OR UPDATE OF status)
DROP TRIGGER IF EXISTS trg_vat_returns_finalize_guard ON public.vat_returns;
CREATE TRIGGER trg_vat_returns_finalize_guard BEFORE INSERT OR UPDATE OF status ON public.vat_returns
  FOR EACH ROW EXECUTE FUNCTION public.fn_vat_returns_finalize_guard();
-- (a függvénytörzset a 20261011012947 migrációból kell visszaállítani)
-- 4. helperek
DROP FUNCTION IF EXISTS public.rls_write_denied_company_ids(text, text[]);
DROP FUNCTION IF EXISTS public.rls_payroll_blocked_company_ids(text[]);
```

### 8.5 Ismert korlátok / backlog (nem része ennek a lépésnek)
- Sok SECURITY DEFINER RPC (pl. `acc_post_journal_entry`) nem ellenőriz szerepkört, így Megfigyelő RPC-n át még írhat; RPC-szintű szerep-ellenőrzés külön feladat.
- `partners` INSERT és `fixed_assets` írás bármely tagnak nyitott; `salary` SELECT bármely tagnak (employee, viewer) olvasható.
- A további ~40 cache-alapú tábla (munkaidő, egyéb `accounty_*`) nincs izolálva a `payroll_specialist` elől; `accounty_ev_records_wages` szándékosan olvasható.
- A felülírások DB-szinten csak bővítenek; a szűkítő felülírás UI-szintű.
- Felhasználó-szintű (UI) vs cégenkénti (DB) eaisyBooks szerep eltérés; a UI szerepkör `staleTime` 5 perc.
- Prod rollout: main merge divergencia-audit + migráció (és Edge Function-ök) élesítése szükséges; jelenleg csak Dev.

### 8.6 Üzleti logika audit & Javítási Eredmények (Dev, 11 persona × 10 tábla × INSERT/UPDATE/DELETE)
Az effektív jog = meglévő PERMISSIVE policy ∩ az új RESTRICTIVE guard.
1. **✅ Irodai cég auto-előléptetés – JAVÍTVA (`20261011050500_fix_firm_member_sync_roles.sql`):**
   - Korábban a `sync_company_member_to_eaisybooks()` minden tagból `könyvelő`-t csinált (a Megfigyelőből és Munkavállalóból is).
   - Új explicit szerep-leképezés (`firm_member_accounting_role`): `owner`/`admin` → `iroda_admin`, `member`/`accountant` → `könyvelő`, `assistant` → `asszisztens`, `viewer`/`employee`/egyéb → nincs hozzárendelés (`NULL`).
   - A trigger kiegészítve `AFTER INSERT OR UPDATE OF role ON company_members` eseményre (szerepvisszavonáskor a szinkronizált sor törlődik).
   - A `sync_eaisybill_accountant_removal()` törlési trigger kiterjesztve minden irodai tagra (megszűnő tagság esetén a szinkronizált könyvelési jog azonnal visszavonódik).
   - Manuális tisztító script (`MANUAL_RUN_cleanup_firm_member_sync_assignments.sql`): a Dev DB-ben a 7 árva sync rekord törölve, a meglévő kézi és valós hozzárendelések érintetlenek.
   - 24/24 pgTAP teszt megerősítve (`firm_member_sync_roles.test.sql`).

2. **✅ Cégvezető (`admin`) főkönyvi írás és Autoposter Kiszervezés – JAVÍTVA (`20261011060000_create_autoposter_rpc_functions.sql` és `20261011063000_restrict_acc_tables_write_to_accountants.sql`):**
   - Korábban a cégtagok közvetlenül írhattak a főkönyvi táblákba (`acc_*`), mivel a kliensoldali auto-posterek (amortizáció, osztalék, bér, eszközaktiválás, fejlesztési tartalék) közvetlen `supabase.from('acc_journal_headers').insert()` hívásokat használtak a felhasználó JWT-jével.
   - **9 db új `SECURITY DEFINER` tárolt eljárás** került bevezetésre szerveroldali jogosultság-ellenőrzéssel (`check_user_can_auto_post_gl(company_id, allow_payroll boolean)`: `owner`/`admin` + könyvelői hozzárendelés; `allow_payroll = true` esetén (osztalék, bér) `payroll_specialist` is; a `member` **nem**; általános kivétel, nincs egyedi SQLSTATE):
     - `post_depreciation_run_to_gl`
     - `post_asset_activation_to_gl` és `remove_asset_activation_from_gl` (Storno)
     - `post_development_reserve_to_gl` és `remove_development_reserve_from_gl` (Storno)
     - `post_dividend_to_gl` és `delete_dividend_gl_entry` (Storno)
     - `post_payroll_cycle_to_gl`
   - **Sztv. 166. § Immutabilitás:** számozott `KONYVELT` tétel törlése/visszavonása esetén a meglévő `acc_storno_journal_entry` RPC ellentétes előjelű stornó bejegyzést hoz létre; piszkozat/számozatlan tétel fizikailag törlődik.
   - **Közvetlen tábla-szintű írás szigorítása:** A cégtagok közvetlen írási joga visszavonva az `acc_journals`, `acc_journal_headers`, `acc_journal_lines`, és `acc_open_item_matches` táblákon; az írás kizárólag a könyvelőirodai szerepköröknek (`rls_accounty_bookkeeping_company_ids()`) és a `support_admin`-nak engedélyezett.
   - **Kliens refaktorálás:** Mind az 5 frontend auto-poster átállítva az RPC hívásokra (`depreciationPostingService.ts`, `assetActivationAutoPoster.ts`, `developmentReserveAutoPoster.ts`, `dividendAutoPoster.ts` + `useDividends.ts`, `payrollAutoPoster.ts`).
   - 32/32 pgTAP teszt megerősítve (`autoposter_rpc_functions.test.sql`).

3. **✅ eaisyBooks-only könyvelők főkönyvi hozzáférése – JAVÍTVA (`20261011052000_external_accountant_ledger_access.sql`):**
   - Korábban a főkönyvi táblák (`acc_*`) PERMISSIVE szabályzata kizárólag `company_members` tagságot ellenőrzött, így a külső könyvelők (akiknek nincs cégtagságuk, csak `accounty_assignments` rekordjuk) még olvasni sem tudták a naplókat a Data API-n.
   - Új STABLE SECURITY DEFINER segédfüggvény: `rls_accounty_bookkeeping_company_ids()` (minden nem-bérszámfejtő könyvelői szerepkör: `iroda_admin`, `senior_könyvelő`, `könyvelő`, `asszisztens`).
   - Új PERMISSIVE ALL szabályzat: `acc_journals`, `acc_journal_headers`, `acc_journal_lines`, `acc_open_item_matches`.
   - Új PERMISSIVE SELECT-only szabályzat: `acc_accounting_periods` (hogy a zárolási logika kliensen helyesen működjön) és `invoice_items` (számlatételes olvasás).
   - A Bérszámfejtő (`payroll_specialist`) és illetéktelenek kizárása 100%-osan fenntartva.
   - 22/22 pgTAP teszt megerősítve (`external_accountant_ledger_access.test.sql`).

---

### 8.7 Teljes Teszt- és Verifikációs Jelentés (Refaktor Zárása)
- **Database pgTAP Tesztek (122 teszteset zöld):**
  - `autoposter_rpc_functions.test.sql`: 32/32 PASS (9 autoposter RPC, admin feladás, Megfigyelő elutasítás, Sztv. 166. § storno integritás).
  - `rls_role_write_guards.test.sql`: 44/44 PASS (30 RESTRICTIVE guard, 33 payroll isolation policy, 4 finalize guard trigger, 8-persona viselkedési mátrix).
  - `firm_member_sync_roles.test.sql`: 24/24 PASS (szerepleképezés, INSERT/UPDATE trigger lefutás, removal trigger, kézi hozzárendelés védelme).
  - `external_accountant_ledger_access.test.sql`: 22/22 PASS (külső könyvelő napló olvasás/írás, időszak és tételszintű SELECT, bérszámfejtő és idegen tiltás).
- **TypeScript & Kliensoldali Tesztek (63 tesztfájl / 802 teszt zöld):**
  - `assetActivationAutoPoster.test.ts`: 4/4 PASS.
  - `depreciationPostingService.test.ts`: 9/9 PASS.
  - `developmentReserveAutoPoster.test.ts`: 3/3 PASS.
  - `payrollIdempotencyAndCycleLock.test.ts`: 2/2 PASS.
  - `dividendAutoPoster.test.ts`: 5/5 PASS.
  - `accountingFirmSyncMigrations.test.ts`: 9/9 PASS.
  - `rlsGuardMigration.test.ts`: 6/6 PASS.
  - `uiMountSmoke.test.tsx`: 6/6 PASS.
  - `vatXmlExportPermission.test.tsx`: 5/5 PASS.
  - `vatRegressionTaxology.test.ts`: 16/16 PASS.
  - `capabilities.test.ts` & `roleDefaults.test.ts`: 38/38 PASS.
- **Rollback SQL (Idempotens visszaállítás szükség esetén):**
  ```sql
  -- 20261011063000 rollback:
  -- Cégtagok közvetlen írásának visszaállítása (nem ajánlott):
  CREATE POLICY acc_journals_company_member_all ON public.acc_journals FOR ALL TO authenticated USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));
  -- 20261011060000 rollback:
  DROP FUNCTION IF EXISTS public.post_depreciation_run_to_gl(uuid, text, date, date, date, text, text, text, jsonb);
  DROP FUNCTION IF EXISTS public.post_asset_activation_to_gl(uuid, uuid, text, text, numeric, date, uuid, uuid, text);
  DROP FUNCTION IF EXISTS public.remove_asset_activation_from_gl(uuid, text);
  DROP FUNCTION IF EXISTS public.post_development_reserve_to_gl(uuid, uuid, text, text, numeric, date, integer, uuid, uuid);
  DROP FUNCTION IF EXISTS public.remove_development_reserve_from_gl(uuid, text);
  DROP FUNCTION IF EXISTS public.post_dividend_to_gl(uuid, uuid, numeric, numeric, numeric, text, text, date, date, uuid, uuid, uuid, uuid);
  DROP FUNCTION IF EXISTS public.delete_dividend_gl_entry(uuid, uuid);
  DROP FUNCTION IF EXISTS public.post_payroll_cycle_to_gl(uuid, uuid, jsonb, jsonb);
  DROP FUNCTION IF EXISTS public.check_user_can_auto_post_gl(uuid, boolean);
  ```

### 8.8 Review-eredmény (Morfi, 2026-10-11): ismert eltérések
A specifikációtól való korábbi eltérések listája a [visibill-rbac-matrix.md](../visibill-rbac-matrix.md) 9. fejezetében szerepel.

### 8.9 Záró Addendum: Hézagok Teljes Felszámolása (`20261011070000_rbac_closing_legacy_rpc_and_period_guards.sql`)

A felhasználó jóváhagyásával és válaszaival (O1–O4) valamennyi azonosított rés felszámolásra került a `develop` ágon és a Dev adatbázisban:

1. **O1 Alapelv (Önálló Cég Vezetőségi Fallback):**
   - Ha a céghez **NINCS** hozzárendelt könyvelő (`accounty_assignments` sor hiányzik), a cégvezetés (`owner`, `admin`, `member`) teljes könyvelői hatáskört kap: futtathatja az auto-poster RPC-ket, közvetlenül kezelheti a főkönyvet, lezárhatja a könyvelési időszakot, és véglegesítheti az ÁFA-t.
   - Ha a céghez **VAN** hozzárendelt könyvelő, a főkönyvi írás és időszakzárás a könyvelők kizárólagos monopóliuma; a cégvezetés nem írhat a főkönyvbe.
2. **O2 Alapelv (Könyvelői Szerepkörök Szétválasztása):**
   - Napi bizonylatkönyvelés és feladás: nyitott minden könyvelői szintnek (`asszisztens`, `könyvelő`, `senior_könyvelő`, `iroda_admin`).
   - Időszakzárás (`set_accounting_period_closed`), ÁFA véglegesítés (`can_finalize_company_filing`), hivatalos ÁNYK XML és számlatükör szerkesztés (`gl_accounts` UPDATE/DELETE): kizárólag `senior_könyvelő`, `iroda_admin` (+ `support_admin`).
3. **O3 Alapelv (Számla Szintű Műveletek):**
   - `override_gl_classifications_batch`, `set_invoice_accounting_exclusion`, `toggle_invoice_item_exclude_from_accounting` RPC-k a `member_write` szinthez kötöttek (pénzügyi asszisztensek és cégtagok is elérik).
4. **27 Legacy Főkönyvi RPC Keményítése:**
   - Minden főkönyvi RPC `assert_company_role_tier` őrt kapott, a `FOR UPDATE` konkurens zárolások beépültek, és `REVOKE EXECUTE ... FROM anon, PUBLIC` érvényesült.
5. **Kliensoldali Védelem (`canWriteLedger`, `hasAssignedBookkeeper`):**
   - `PeriodClosingSettings.tsx` átállítva a tranzakcionális `set_accounting_period_closed` RPC-re és `canClosePeriod` kapura.
   - `JournalsPage.tsx` gombjai ("Időszakzárás", "Javaslatok generálása", "Új vegyes bizonylat") jogosultsági kaput és tájékoztató tooltipeket kaptak.
6. **Verifikáció:**
   - 159/159 pgTAP teszt PASS (`legacy_gl_rpc_authz.test.sql`: 23/23, `rls_role_write_guards.test.sql`: 44/44, `autoposter_rpc_functions.test.sql`: 32/32, `firm_member_sync_roles.test.sql`: 24/24, `external_accountant_ledger_access.test.sql`: 22/22, `vat_returns_finalize_guard.test.sql`: 14/14).
   - 64 Vitest tesztfájl / 820+ teszt PASS (Taxology ÁFA regresszió 16/16 PASS, élő Dev DB `npm run vat:guard` 100% egyezés).
   - TypeScript `npx tsc --noEmit` 0 hiba, Oxlint 0 hiba.

### 8.10 Csomag C Addendum: Banki Utalások & Bankszámlák RLS Védelme és Munkavállalói Shell (`20261011130700_restrict_bank_accounts_and_transfers_write_rls.sql`)

1. **Banki Utalások és Céges Bankszámlák Írási Védelme (RLS):**
   - A `payment_transfers` és `company_bank_accounts` táblák korábban nyitottabb írási joggal rendelkeztek.
   - Új RESTRICTIVE policyk (`payment_transfers_write_guard` és `company_bank_accounts_write_guard`): kizárólag a cégvezetés és pénzügyi irányítás (`owner`, `admin`, `member`, `support_admin`) jogosult INSERT, UPDATE, DELETE műveletekre.
   - Megfigyelő (`viewer`), asszisztens (`assistant`), munkavállaló (`employee`), valamint külső könyvelők közvetlen táblamódosítása blokkolva van.
2. **Kliensoldali Fizetési Képesség (`canManagePayments`):**
   - Új `canManagePayments: boolean` képesség a `capabilities.ts`-ben.
   - `TransfersPage.tsx`: átutalási csomag generálás és banki netbank-export gombok letiltva jogosultság hiányában.
   - `BankAccountsTab.tsx`: új bankszámla rögzítése, meglévő módosítása, törlése és API szinkronizáció inaktív jogosultság hiányában.
3. **Munkavállalói Shell (`EmployeeShell.tsx`):**
   - Az `employee` szerepkör számára az `AppLayout.tsx` nem tölti be az oldalsávot és a globális dátumválasztót.
   - Helyette a dedikált, mobil-first `EmployeeShell` renderelődik, amely csak a cégnevet, nyelvváltót, sötét módot és kijelentkezést tartalmazza.
   - A `ProtectedRoute.tsx` minden egyéb belső útvonalról automatikusan átirányít a `/working-time` modulra.
4. **Verifikáció:**
   - pgTAP: `bank_accounts_transfers_write_rls.test.sql` (katalógus és RLS viselkedés tesztek).
   - Vitest: `src/test/permissions/bankTransfersWriteRlsMigration.test.ts`, `src/test/employeeShell.test.tsx`.

### 8.11 Addendum: Külső Könyvelői Számlatükör Hozzáférés (chart_of_accounts_presets) és Kliensoldali Gyorsítótár-Előléptetés (EB-0280, `20261016193000_accounty_preset_access_rls.sql`)

1. **Kontextus & RLS Rés Feltárása (Ticket EB-0280):**
   - A `20261011052000_external_accountant_ledger_access.sql` migráció megadta az olvasási és írási jogokat az `acc_*` főkönyvi naplókra és a `gl_accounts` számlatükör-tételekre az `accounty_assignments` megbízott könyvelőinek (`rls_accounty_bookkeeping_company_ids()`), azonban a szülő `public.chart_of_accounts_presets` tábla RLS szabályzata kimaradt.
   - Ennek következtében a megbízott könyvelők (`role: 'könyvelő'`, pl. Lendvai Ádám) számára az RLS elrejtette a kezelt cég egyedi számlatükrét (`company_id = ...`), és a frontend kényszerűen a rendszerszintű generic sablonra (`company_id IS NULL`, 375 számlaszám) esett vissza.
   - Mivel a beépített sablonban nem szerepeltek a cég egyedi számlatükrében rögzített analitikus számlák (pl. `4541 - Belföldi szállítók forintban`, csak a `454` gyűjtő), a folyószámla és a főkönyv nézete eltért a cégvezető és a könyvelő között.

2. **Adatbázis RLS Megoldás:**
   - A `public.chart_of_accounts_presets` táblára két új PERMISSIVE szabályzat került:
     - `accounty_bookkeeping_read` (SELECT): `company_id IN (SELECT public.rls_accounty_bookkeeping_company_ids()) OR is_support_admin()`
     - `accounty_bookkeeping_write` (ALL): `company_id IN (SELECT public.rls_accounty_bookkeeping_company_ids()) OR is_support_admin()`
   - A meglévő `Enable read/insert/update/delete access for presets` szabályzatok változatlanul kiszolgálják a közvetlen cégtagokat (`company_members`).

3. **Kliensoldali Önjavító Mechanizmus (`useActivePreset.ts`):**
   - Azoknál a felhasználóknál, akik a jogosultsági rés fennállása idején léptek be, a böngésző `localStorage`-ában a generic sablon (`a6c46c77-52b7-499e-bb12-419aa94349af`) maradt elmentve aktívként.
   - A `useActivePreset` hook kiegészült egy automatikus előléptetéssel (auto-promotion): ha a tárolt `activePresetId` megegyezik a generic sablonnal, de a cég rendelkezik aktív egyedi számlatükörrel (`presets.find(p => p.company_id === companyId && p.is_active)`), a hook automatikusan és észrevétlenül átlépteti a klienst az egyedi számlatükörre, azonnal feloldva a beragadt gyorsítótár-állapotot.
   - `setActivePresetId` memoizálása `useCallback`-kel a hook-stabilitás és rerender-optimalizálás érdekében.

4. **Verifikáció:**
   - Adatbázis szimuláció könyvelői JWT-vel (`auth.uid() = d04e75e5-815f-488e-928e-5c648f260483`): a 860 tételes egyedi számlatükör és a `4541`–`4549` alszámlák láthatósága fizikailag igazolva PROD környezeten.
   - Vitest: `src/hooks/__tests__/useActivePreset.test.ts` (3/3 passed).
   - Oxlint: 0 hiba, TypeScript fordítás (`npx tsc --noEmit`): 0 hiba.
