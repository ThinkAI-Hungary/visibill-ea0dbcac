# 🏦 Házipénztár

> Házipénztár pénztárgépek, nyitó egyenlegek, tételek, szabályok.

**Táblák ebben a csoportban:** 5

---

### `petty_cash_registers`

**RLS:** ✅ | **Sorok:** ~2

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| name | text | — |  |
| location | text | ✓ |  |
| currencies | ARRAY | — | `'{HUF}'::text[]` |
| is_default | boolean | — | `false` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

**Indexek:** `idx_pcr_company`, `idx_pcr_one_default`

---

### `petty_cash_opening_balances`

**RLS:** ✅ | **Sorok:** ~2

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| register_id | uuid | — |  |
| currency | text | — | `'HUF'::text` |
| amount | numeric | — | `0` |
| start_date | date | ✓ |  |

**FK:** `register_id` → `petty_cash_registers.id`

**Indexek:** `petty_cash_opening_balances_register_id_currency_key`

---

### `petty_cash_entries`

**RLS:** ✅ | **Sorok:** ~34

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| register_id | uuid | — |  |
| entry_date | date | — |  |
| description | text | ✓ |  |
| amount | numeric | — |  |
| currency | text | — | `'HUF'::text` |
| source_type | text | — |  |
| source_id | uuid | ✓ |  |
| source_table | text | ✓ |  |
| routed_by | text | — | `'default'::text` |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`, `register_id` → `petty_cash_registers.id`

**Indexek:** `idx_pce_company_date`, `idx_pce_register_date`, `idx_pce_source`

---

### `petty_cash_routing_rules`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| target_register_id | uuid | — |  |
| priority | integer | — | `0` |
| match_currency | text | ✓ |  |
| match_source_type | text | ✓ |  |
| match_description_pattern | text | ✓ |  |
| match_partner_pattern | text | ✓ |  |
| is_active | boolean | — | `true` |
| created_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `target_register_id` → `petty_cash_registers.id`

**Indexek:** `idx_pcrr_company`

---

### `hp_settings`

**RLS:** ✅ | **Sorok:** ~2

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| created_by | uuid | ✓ |  |
| start_date | date | ✓ |  |
| opening_balance | numeric | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

**Indexek:** `idx_hp_settings_created_by`, `unique_company_settings`

---

