# 📦 Tárgyi Eszközök

> Tárgyi eszközök nyilvántartása, értékcsökkenési események, TAO sablonok.

**Táblák ebben a csoportban:** 7

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
| project_id | uuid | ✓ |  |
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
| development_reserve_id | uuid | ✓ |  |
| development_reserve_amount | numeric | ✓ | `0.00` |

**FK:** `activated_by_user_id` → `auth.users.id`, `company_id` → `companies.id`, `development_reserve_id` → `development_reserves.id`, `gl_account_id` → `gl_accounts.id`, `location_id` → `company_locations.id`, `project_id` → `projects.id`, `tao_template_id` → `tao_depreciation_templates.id`, `user_id` → `auth.users.id`

**Indexek:** `fixed_assets_company_id_inventory_number_key`, `idx_fixed_assets_activated_by_user_id`, `idx_fixed_assets_company`, `idx_fixed_assets_dev_reserve`, `idx_fixed_assets_gl_account_id`, `idx_fixed_assets_location_id`, `idx_fixed_assets_project_id`, `idx_fixed_assets_tao_template_id`, `idx_fixed_assets_user_id`

> **Kivezetési workflow (A-251, 2026-10-13):** a tábla további mezői: `disposal_status` (text + CHECK: `none | pending_approval | approved | rejected`; `approved` csak a `approve_asset_disposal` RPC útján állítható), `disposal_reason_type`, `disposal_committee`, `disposal_details` (jsonb). A főkönyvi kapcsolat az `acc_journal_lines.fixed_asset_id` oszlop (FK → `fixed_assets.id`, `ON DELETE RESTRICT`, cég-azonosság trigger, index). RPC-k: `request_asset_disposal`, `reject_asset_disposal`, `approve_asset_disposal`, `rpc_reconcile_fixed_assets_with_gl`. Részletek: [A-251](../decisions/A-251-fixed-assets-gl-linkage-reconciliation-and-disposal-workflow.md).

---

### `development_reserves`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — | |
| user_id | uuid | ✓ | |
| creation_year | integer | — | |
| reserve_amount | numeric | — | |
| expiration_date | date | — | |
| description | text | ✓ | |
| gl_account_id | uuid | ✓ | |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`, `gl_account_id` → `gl_accounts.id`

**Indexek:** `idx_development_reserves_company`, `idx_development_reserves_year`

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

**Könyvelési integráció (A-180 / P-141):**
Az időszaki értékcsökkenés Vegyes naplóba történő feladásakor (`depreciationPostingService.ts`) minden érintett eszközhöz automatikusan létrejön egy `event_type = 'value_change'` esemény:
- `description`: `ÉCS elszámolás (${documentId}): ${amount} Ft (maradvány: ${remainingBookValue} Ft)`
- `old_values`: `{ accumulated_before, book_value_before }`
- `new_values`: `{ period_amount, accumulated_after, book_value_after, document_id }`

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

### `company_sub_locations` (M2.1)

**RLS:** ✅ | **Leírás:** Hierarchikus tárgyi eszköz tárolóhelyek és rész-helyszínek (épület, emelet, raktár, polc).

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — | |
| location_id | uuid | — | |
| parent_id | uuid | ✓ | |
| name | text | — | |
| code | text | ✓ | |
| description | text | ✓ | |
| is_active | boolean | — | `true` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `location_id` → `company_locations.id`, `parent_id` → `company_sub_locations.id`
**Indexek:** `idx_company_sub_locations_company_id`, `idx_company_sub_locations_location_id`, `idx_company_sub_locations_parent_id`

---

### `grant_projects` (M3.1, M3.4)

**RLS:** ✅ | **Leírás:** Vissza nem térítendő beruházási támogatási és pályázati projektek nyilvántartása, fenntartási időszak monitoring.

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — | |
| name | text | — | |
| code | text | — | |
| grantor | text | ✓ | |
| contract_number | text | ✓ | |
| eligible_cost | numeric(14,2) | — | `0` |
| grant_amount | numeric(14,2) | — | `0` |
| intensity_rate | numeric(5,2) | — | `0` |
| own_contribution | numeric(14,2) | — | `0` |
| advance_amount | numeric(14,2) | — | `0` |
| disbursed_amount | numeric(14,2) | — | `0` |
| maintenance_period_years | integer | — | `3` |
| maintenance_end_date | date | ✓ | |
| status | text | — | `'active'` |
| notes | text | ✓ | |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`
**Indexek:** `idx_grant_projects_company_id`, `idx_grant_projects_status`, `uq_grant_projects_company_code`
**Triggerek:** `trg_prevent_delete_grant_project_with_usage` (BEFORE DELETE: megakadályozza a projekt törlését, ha kapcsolt tárgyi eszköz, alkatrész-komponens vagy lekönyvelt PIE vegyes tétel kapcsolódik hozzá; `20261013170000_teny_blind_spot_hardening.sql`).

---

### `fixed_asset_components` (M3.1, M3.2)

**RLS:** ✅ | **Leírás:** Tárgyi eszköz alkatrész-, forrás- és ráaktiválási komponensek (különböző forrás, aktiválási dátum vagy leírási kulcs esetén).

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — | |
| fixed_asset_id | uuid | — | |
| name | text | — | |
| component_type | text | — | `'initial'` |
| activation_date | date | — | |
| gross_value | numeric(14,2) | — | `0` |
| grant_project_id | uuid | ✓ | |
| grant_funding_amount | numeric(14,2) | — | `0` |
| own_funding_amount | numeric(14,2) | — | `0` |
| grant_ratio_percent | numeric(5,2) | — | `0` |
| useful_life_months | integer | ✓ | |
| depreciation_rate | numeric(5,2) | ✓ | |
| gl_asset_account | text | ✓ | |
| notes | text | ✓ | |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `fixed_asset_id` → `fixed_assets.id`, `grant_project_id` → `grant_projects.id`
**Indexek:** `idx_fixed_asset_components_company_id`, `idx_fixed_asset_components_fixed_asset_id`, `idx_fixed_asset_components_grant_project_id`

