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

