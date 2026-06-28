# 📦 Tárgyi Eszközök

> Tárgyi eszközök nyilvántartása, értékcsökkenési események, TAO sablonok.

**Táblák ebben a csoportban:** 3

---

### `fixed_assets`

**RLS:** ✅ | **Sorok:** ~30

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| user_id | uuid | — |  |
| inventory_number | text | — |  |
| name | text | — |  |
| description | text | ✓ |  |
| vtsz_teszor | text | ✓ |  |
| acquisition_value | numeric | — |  |
| residual_value | numeric | ✓ | `0` |
| currency | text | ✓ | `'HUF'::text` |
| purchase_date | date | — |  |
| activation_date | date | — |  |
| disposal_date | date | ✓ |  |
| useful_life_months | integer | — |  |
| depreciation_method | text | ✓ | `'linear'::text` |
| tao_template_id | uuid | ✓ |  |
| tao_rate_override | numeric | ✓ |  |
| location_id | uuid | ✓ |  |
| activated_by_user_id | uuid | ✓ |  |
| activated_by_name | text | ✓ |  |
| source_invoice_id | uuid | ✓ |  |
| source_invoice_type | text | ✓ |  |
| source_invoice_number | text | ✓ |  |
| supplier_name | text | ✓ |  |
| status | text | — | `'active'::text` |
| documents | jsonb | ✓ | `'[]'::jsonb` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |
| gl_account_id | uuid | ✓ |  |

**FK:** `activated_by_user_id` → `auth.users.id`, `company_id` → `companies.id`, `gl_account_id` → `gl_accounts.id`, `location_id` → `company_locations.id`, `tao_template_id` → `tao_depreciation_templates.id`, `user_id` → `auth.users.id`

**Indexek:** `fixed_assets_company_id_inventory_number_key`, `idx_fixed_assets_activated_by_user_id`, `idx_fixed_assets_company`, `idx_fixed_assets_gl_account_id`, `idx_fixed_assets_location_id`, `idx_fixed_assets_tao_template_id`, `idx_fixed_assets_user_id`

---

### `asset_events`

**RLS:** ✅ | **Sorok:** ~35

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| asset_id | uuid | — |  |
| company_id | uuid | — |  |
| user_id | uuid | — |  |
| event_type | text | — |  |
| event_date | date | — | `CURRENT_DATE` |
| description | text | ✓ |  |
| old_values | jsonb | ✓ |  |
| new_values | jsonb | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `asset_id` → `fixed_assets.id`, `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_asset_events_asset`, `idx_asset_events_company_id`, `idx_asset_events_user_id`

---

### `tao_depreciation_templates`

**RLS:** ✅ | **Sorok:** ~11

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| name | text | — |  |
| tao_rate_percent | numeric | — |  |
| category_code | text | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |

---

