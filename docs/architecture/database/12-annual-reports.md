# 📋 Éves Beszámoló & ÁFA

> Éves zárlat, mérleg/eredménykimutatás struktúra, ÁFA bevallások.

**Táblák ebben a csoportban:** 11

---

### `annual_reports`

**RLS:** ✅ | **Sorok:** ~4

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| preset_id | uuid | — |  |
| fiscal_year | integer | — |  |
| status | text | — | `'draft'::text` |
| representative_name | text | ✓ |  |
| representative_role | text | ✓ | `'ügyvezető'::text` |
| report_date | date | ✓ | `CURRENT_DATE` |
| accounting_method | text | ✓ | `'kettős könyvvitel'::text` |
| frozen_bs_data | jsonb | ✓ |  |
| frozen_pnl_data | jsonb | ✓ |  |
| frozen_at | timestamp with time zone | ✓ |  |
| validation_results | jsonb | ✓ | `'[]'::jsonb` |
| validated_at | timestamp with time zone | ✓ |  |
| notes_sections | jsonb | ✓ | `'[]'::jsonb` |
| net_income | numeric | ✓ | `0` |
| dividend_amount | numeric | ✓ | `0` |
| retained_earnings | numeric | ✓ | `0` |
| dividend_resolution_date | date | ✓ |  |
| dividend_resolution_number | text | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`

**Indexek:** `annual_reports_company_id_preset_id_fiscal_year_key`, `idx_annual_reports_company_year`

---

### `annual_report_notes_templates`

**RLS:** ✅ | **Sorok:** ~19

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| section_key | text | — |  |
| section_title | text | — |  |
| default_text | text | — |  |
| order_num | integer | — |  |
| is_required | boolean | ✓ | `true` |
| category | text | — |  |

**Indexek:** `annual_report_notes_templates_section_key_key`

---

### `bs_structure`

**RLS:** ✅ | **Sorok:** ~94

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| row_code | character varying | — |  |
| name | text | — |  |
| section | character varying | — |  |
| type | character varying | — |  |
| parent_id | uuid | ✓ |  |
| order_num | integer | — |  |
| is_pnl_bridge | boolean | — | `false` |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `parent_id` → `bs_structure.id`

**Indexek:** `idx_bs_structure_parent_id`

---

### `bs_mapping`

**RLS:** ✅ | **Sorok:** ~586

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| preset_id | uuid | — |  |
| gl_account_id | uuid | — |  |
| bs_structure_id | uuid | — |  |
| user_id | uuid | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `bs_structure_id` → `bs_structure.id`, `company_id` → `companies.id`, `gl_account_id` → `gl_accounts.id`, `preset_id` → `chart_of_accounts_presets.id`, `user_id` → `auth.users.id`

**Indexek:** `bs_mapping_company_id_preset_id_gl_account_id_key`, `idx_bs_mapping_bs_structure_id`, `idx_bs_mapping_gl_account_id`, `idx_bs_mapping_preset_id`, `idx_bs_mapping_user_id`

---

### `bs_prior_year`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| bs_structure_id | uuid | — |  |
| fiscal_year | integer | — |  |
| prior_year_balance | numeric | — | `0` |
| prior_year_adjustment | numeric | — | `0` |
| user_id | uuid | ✓ |  |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `bs_structure_id` → `bs_structure.id`, `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `bs_prior_year_company_id_bs_structure_id_fiscal_year_key`, `idx_bs_prior_year_bs_structure_id`, `idx_bs_prior_year_user_id`

---

### `pnl_structure`

**RLS:** ✅ | **Sorok:** ~14

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| row_code | character varying | — |  |
| name | text | — |  |
| type | character varying | — |  |
| parent_id | uuid | ✓ |  |
| order_num | integer | — |  |
| multiplier | integer | — | `1` |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `parent_id` → `pnl_structure.id`

**Indexek:** `idx_pnl_structure_parent_id`

---

### `pnl_mapping`

**RLS:** ✅ | **Sorok:** ~240

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| preset_id | uuid | — |  |
| gl_account_id | uuid | — |  |
| pnl_structure_id | uuid | — |  |
| user_id | uuid | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `gl_account_id` → `gl_accounts.id`, `pnl_structure_id` → `pnl_structure.id`, `preset_id` → `chart_of_accounts_presets.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_pnl_mapping_gl_account_id`, `idx_pnl_mapping_pnl_structure_id`, `idx_pnl_mapping_preset_id`, `idx_pnl_mapping_user_id`, `pnl_mapping_company_id_preset_id_gl_account_id_key`

---

### `vat_returns`

**RLS:** ✅ | **Sorok:** ~22

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| period_year | integer | — |  |
| period_month | integer | ✓ |  |
| period_quarter | integer | ✓ |  |
| frequency | text | — | `'H'::text` |
| status | text | — | `'draft'::text` |
| total_payable_base | numeric | ✓ | `0` |
| total_payable_tax | numeric | ✓ | `0` |
| total_deductible_base | numeric | ✓ | `0` |
| total_deductible_tax | numeric | ✓ | `0` |
| net_result | numeric | ✓ | `0` |
| amount_to_pay | numeric | ✓ | `0` |
| amount_reclaimable | numeric | ✓ | `0` |
| amount_carryforward | numeric | ✓ | `0` |
| prev_period_carryforward | numeric | ✓ | `0` |
| row_data | jsonb | ✓ | `'{}'::jsonb` |
| m_sheet_summary | jsonb | ✓ | `'{}'::jsonb` |
| validated_at | timestamp with time zone | ✓ |  |
| validation_errors | jsonb | ✓ | `'[]'::jsonb` |
| finalized_at | timestamp with time zone | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| user_id | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_vat_returns_company`, `idx_vat_returns_period`, `idx_vat_returns_user_id`, `vat_returns_period_uq`

---

### `vat_return_lines`

**RLS:** ✅ | **Sorok:** ~219

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| vat_return_id | uuid | — |  |
| row_number | text | — |  |
| base_amount | numeric | ✓ | `0` |
| tax_amount | numeric | ✓ | `0` |
| base_amount_rounded | integer | ✓ | `0` |
| tax_amount_rounded | integer | ✓ | `0` |
| is_calculated | boolean | ✓ | `false` |
| source_vat_codes | ARRAY | ✓ |  |

**FK:** `vat_return_id` → `vat_returns.id`

**Indexek:** `idx_vat_return_lines_return`, `vat_return_lines_vat_return_id_row_number_key`

---

### `vat_return_m_lines`

**RLS:** ✅ | **Sorok:** ~69

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| vat_return_id | uuid | — |  |
| partner_id | uuid | ✓ |  |
| partner_name | text | — |  |
| partner_tax_number | text | — |  |
| invoice_count | integer | — | `0` |
| base_amount | numeric | ✓ | `0` |
| tax_amount | numeric | ✓ | `0` |
| base_amount_rounded | integer | ✓ | `0` |
| tax_amount_rounded | integer | ✓ | `0` |
| tax_5_amount | numeric | ✓ | `0` |
| tax_18_amount | numeric | ✓ | `0` |
| tax_27_amount | numeric | ✓ | `0` |
| tax_prorated | numeric | ✓ | `0` |
| invoice_details | jsonb | ✓ | `'[]'::jsonb` |

**FK:** `partner_id` → `partners.id`, `vat_return_id` → `vat_returns.id`

**Indexek:** `idx_vat_return_m_lines_partner_id`, `idx_vat_return_m_lines_return`, `vat_return_m_lines_vat_return_id_partner_tax_number_key`

---

### `vat_form_rows`

**RLS:** ✅ | **Sorok:** ~90

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| row_number | text | — |  |
| section | text | — |  |
| page | text | — |  |
| label | text | — |  |
| has_base | boolean | ✓ | `true` |
| has_tax | boolean | ✓ | `true` |
| is_summary | boolean | ✓ | `false` |
| sort_order | integer | — | `0` |

---

