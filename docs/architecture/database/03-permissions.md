# 🔑 Jogosultságok & Hozzáférés

> Modul-szintű jogosultságok (eaisybill + eaisyBooks) és unified access cache.

**Táblák ebben a csoportban:** 3

---

### `eaisybill_module_permissions`

> Per-user, per-company module access overrides for eaisybill. Managed by company admins via the Permission Panel in Settings → Company tab.

**RLS:** ✅ | **Sorok:** ~15

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| user_id | uuid | — |  |
| module_name | text | — |  |
| can_read | boolean | — | `true` |
| can_write | boolean | — | `true` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `eaisybill_module_permissions_company_id_user_id_module_name_key`, `idx_eaisybill_module_perms_user_company`

---

### `accounty_module_permissions`

> Modulonkénti testreszabható jogosultságok. Az iroda admin állítja be, hogy melyik könyvelő/asszisztens melyik modulhoz fér hozzá.

**RLS:** ✅ | **Sorok:** ~2

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| accounting_firm_id | uuid | — |  |
| user_id | uuid | — |  |
| module_name | text | — |  |
| can_read | boolean | ✓ | `true` |
| can_write | boolean | ✓ | `false` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `accounting_firm_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `accounty_module_permissions_accounting_firm_id_user_id_modu_key`

> **A-247 (2026-10-11):** a `module_name` CHECK kiegészítve (`tao`, `client_bookkeeping`, `admin_*`). Az `accounty_assignments.role` CHECK-je elfogadja a `payroll_specialist` (Bérszámfejtő) szerepkört; a `sync_accounty_assignment_to_cache()` ennek `can_read/write_invoices` és `can_read_transactions` jelzőit `false`-ra, `can_read_salaries` / `can_read_hr` jelzőit `true`-ra állítja.
>
> **ÁFA-zárolás védelme:** `can_finalize_company_filing(uuid)` (`STABLE SECURITY DEFINER`, csak `authenticated`/`service_role`) + `trg_vat_returns_finalize_guard` (INSERT/UPDATE/**DELETE**) a `vat_returns` táblán és a sor-táblákon (`trg_vat_return_lines_finalize_guard`, `..._m_lines_...`, `..._a60_lines_...`): lezárt bevallást (fejléc és sorok) csak Senior, Iroda Admin, cégtag (owner/admin/member) vagy támogatási admin módosíthat/törölhet/nyithat vissza, egyébként `ACCESS_DENIED` (42501).
>
> **Szerepkör-érzékeny RLS (A-247 addendum, `20261011042300`):** RESTRICTIVE policyk (`rls_guard_write_ins/upd/del`) a `vat_returns`, `vat_return_*lines`, `acc_journals`, `acc_journal_headers/lines`, `acc_open_item_matches`, `acc_accounting_periods`, `invoice_items` táblákon: Megfigyelő (`viewer`), `employee` és `payroll_specialist` nem írhat, az eaisyBill `assistant` csak `invoice_items`-t. Segédfüggvények: `rls_write_denied_company_ids(text, text[])`, `rls_payroll_blocked_company_ids(text[])` (`STABLE SECURITY DEFINER`, `REVOKE FROM PUBLIC, anon`). A `rls_guard_payroll_isolation` (SELECT, 33 tábla) kizárja a `payroll_specialist`-et a pénzügyi/főkönyvi/EV táblákból; explicit `accounty_module_permissions.can_read` feloldja.
>
> **Könyvelőirodai Tag-Szinkronizáció (`20261011050500`):** `sync_company_member_to_eaisybooks()` szigorított szerepleképezéssel: `owner`/`admin` → `iroda_admin`, `member` → `könyvelő`, `assistant` → `asszisztens`, `viewer`/`employee` → NINCS könyvelési hozzárendelés. Trigger események: INSERT és UPDATE (szerepvisszavonás követése). `sync_eaisybill_accountant_removal()` törli a szinkronizált rekordot minden eltávolított irodai tag esetén.
>
> **Külső Könyvelői Főkönyvi Hozzáférés (`20261011052000`):** PERMISSIVE `accounty_bookkeeping_access` ALL szabályzat `acc_journals`, `acc_journal_headers`, `acc_journal_lines`, `acc_open_item_matches` táblákon az `accounty_assignments` alapján (`rls_accounty_bookkeeping_company_ids()` segédfüggvénnyel). Az `acc_accounting_periods` és `invoice_items` SELECT-only hozzáférést kapott. Bérszámfejtő kizárva.
>
> **Banki Utalások és Céges Bankszámlák RLS Védelme (`20261011130700`):** RESTRICTIVE write policyk (`payment_transfers_write_guard`, `company_bank_accounts_write_guard`) a `payment_transfers` és `company_bank_accounts` táblákon az INSERT, UPDATE és DELETE műveletekre. Kizárólag a cégvezetés és pénzügyi irányítás (`owner`, `admin`, `member`, `support_admin`) jogosult írásra. Megfigyelő (`viewer`), asszisztens (`assistant`), munkavállaló (`employee`), valamint külső könyvelők közvetlen táblamódosítása blokkolt.

---

### `user_company_access_cache`

> Unified access cache: combines company_members and accounty_assignments into one fast-lookup table for RLS policies.

**RLS:** ✅ | **Sorok:** ~111

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| user_id | uuid | — |  |
| company_id | uuid | — |  |
| access_source | text | — |  |
| role | text | — |  |
| can_read_invoices | boolean | ✓ | `true` |
| can_write_invoices | boolean | ✓ | `false` |
| can_read_transactions | boolean | ✓ | `true` |
| can_read_salaries | boolean | ✓ | `false` |
| can_read_hr | boolean | ✓ | `false` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_access_cache_company`, `idx_access_cache_user`, `idx_access_cache_user_company`

---

