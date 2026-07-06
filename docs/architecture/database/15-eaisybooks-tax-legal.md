# 📘 eaisyBooks — Adó & Jogi

> NAV bevallások, TAO kalkuláció, adóparaméterek, jogszabályfigyelő, cégkapu, NAV meghatalmazás.

**Táblák ebben a csoportban:** 10

---

### `accounty_filings`

> NAV bevallások és bejelentések. filing_type a NAV űrlap típusa, channel a beküldési csatorna (ONYA/ÁNYK/M2M).

**RLS:** ✅ | **Sorok:** ~5

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| filing_type | text | — |  |
| period_year | integer | ✓ |  |
| period_month | integer | ✓ |  |
| period_quarter | integer | ✓ |  |
| status | text | ✓ | `'draft'::text` |
| xml_data | text | ✓ |  |
| channel | text | ✓ |  |
| nav_receipt_id | text | ✓ |  |
| nav_receipt_status | text | ✓ |  |
| error_codes | jsonb | ✓ |  |
| submitted_at | timestamp with time zone | ✓ |  |
| signed_by | text | ✓ |  |
| signed_at | timestamp with time zone | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_accounty_filings_company`, `idx_accounty_filings_period`, `idx_accounty_filings_status`, `idx_accounty_filings_type`

---

### `accounty_tao_yearly`

> TAO modul éves adókalkuláció. 11 lépéses wizard állapot és minden számított mező.

**RLS:** ✅ | **Sorok:** ~1

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| current_step | integer | ✓ | `1` |
| status | text | ✓ | `'draft'::text` |
| revenue | numeric | ✓ | `0` |
| other_revenue | numeric | ✓ | `0` |
| material_costs | numeric | ✓ | `0` |
| personnel_costs | numeric | ✓ | `0` |
| depreciation | numeric | ✓ | `0` |
| other_costs | numeric | ✓ | `0` |
| financial_result | numeric | ✓ | `0` |
| aee | numeric | ✓ | `0` |
| decreasing_items | jsonb | ✓ | `'{}'::jsonb` |
| decreasing_total | numeric | ✓ | `0` |
| increasing_items | jsonb | ✓ | `'{}'::jsonb` |
| increasing_total | numeric | ✓ | `0` |
| ebitda | numeric | ✓ | `0` |
| interest_expense | numeric | ✓ | `0` |
| interest_limit | numeric | ✓ | `0` |
| interest_adjustment | numeric | ✓ | `0` |
| has_cfc | boolean | ✓ | `false` |
| cfc_data | jsonb | ✓ | `'{}'::jsonb` |
| modified_tax_base | numeric | ✓ | `0` |
| tax_base | numeric | ✓ | `0` |
| tax_credits | jsonb | ✓ | `'{}'::jsonb` |
| tax_credits_total | numeric | ✓ | `0` |
| donations | jsonb | ✓ | `'{}'::jsonb` |
| donations_total | numeric | ✓ | `0` |
| calculated_tax | numeric | ✓ | `0` |
| advance_payments | numeric | ✓ | `0` |
| payable_tax | numeric | ✓ | `0` |
| filing_status | text | ✓ | `'not_started'::text` |
| filing_reference | text | ✓ |  |
| submitted_at | timestamp with time zone | ✓ |  |
| submitted_by | uuid | ✓ |  |
| notes | text | ✓ |  |
| metadata | jsonb | ✓ | `'{}'::jsonb` |
| approved_by | uuid | ✓ |  |
| approved_at | timestamp with time zone | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `approved_by` → `auth.users.id`, `company_id` → `companies.id`, `submitted_by` → `auth.users.id`

**Indexek:** `accounty_tao_yearly_company_id_tax_year_key`, `idx_accounty_tao_yearly_company`, `idx_accounty_tao_yearly_status`, `idx_accounty_tao_yearly_year`

---

### `accounty_tax_parameters`

> Központi adómérték és küszöb paraméterek: évente frissítendő, a taxEngine.ts innen olvassa a 2026-os értékeket.

**RLS:** ✅ | **Sorok:** ~72

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| tax_year | integer | — |  |
| parameter_key | text | — |  |
| parameter_value | numeric | — |  |
| description | text | ✓ |  |
| legal_reference | text | ✓ |  |

**Indexek:** `accounty_tax_parameters_tax_year_parameter_key_key`, `idx_accounty_tax_params_year`

---

### `accounty_tax_params_global`

**RLS:** ✅ | **Sorok:** ~18

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| year | integer | — |  |
| key | text | — |  |
| value | numeric | — |  |
| legal_reference | text | ✓ |  |
| valid_from | date | ✓ |  |
| notes | text | ✓ |  |
| updated_by | uuid | ✓ |  |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `updated_by` → `auth.users.id`

**Indexek:** `accounty_tax_params_global_year_key_key`

---

### `accounty_global_tax_params`

**RLS:** ✅ | **Sorok:** ~48

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| param_key | text | — |  |
| tax_year | integer | — |  |
| param_value | numeric | — |  |
| description | text | ✓ |  |
| legal_reference | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |

**Indexek:** `accounty_global_tax_params_param_key_tax_year_key`

---

### `accounty_legal_updates`

**RLS:** ✅ | **Sorok:** ~17

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| title | text | — |  |
| source | text | — |  |
| published_at | date | ✓ |  |
| affected_modules | ARRAY | ✓ | `ARRAY[]::text[]` |
| implementation_status | text | — | `'planned'::text` |
| notes | text | ✓ |  |
| created_by | uuid | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `created_by` → `auth.users.id`

---

### `accounty_cegkapu_settings`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tarhely_type | text | — | `'cegkapu'::text` |
| tarhely_id | text | ✓ | `''::text` |
| tarhely_status | text | — | `'unknown'::text` |
| tarhely_company_name | text | ✓ | `''::text` |
| capacity_used | integer | ✓ | `0` |
| capacity_total | integer | ✓ | `100` |
| signer_name | text | ✓ | `''::text` |
| signer_kau_type | text | ✓ | `'ugyfelkapu_plus'::text` |
| signer_kau_id | text | ✓ | `''::text` |
| signer_verified | boolean | ✓ | `false` |
| polling_frequency | text | ✓ | `'15'::text` |
| auto_receipt | boolean | ✓ | `true` |
| last_sync | timestamp with time zone | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`

**Indexek:** `accounty_cegkapu_settings_company_id_key`

---

### `accounty_nav_representations`

**RLS:** ✅ | **Sorok:** ~1

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| rep_type | text | — | `'organization'::text` |
| name | text | — | `''::text` |
| tax_id | text | — | `''::text` |
| scope | text | — | `'all'::text` |
| scope_details | text | ✓ |  |
| start_date | date | — | `CURRENT_DATE` |
| end_date | date | ✓ |  |
| status | text | — | `'active'::text` |
| registration_number | text | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`

---

### `accounty_retention_rules`

**RLS:** ✅ | **Sorok:** ~8

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| doc_type | text | — |  |
| retention_years | integer | — | `3` |
| legal_basis | text | ✓ | `''::text` |
| auto_delete | boolean | ✓ | `false` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`

**Indexek:** `accounty_retention_rules_company_id_doc_type_key`

---

### `accounty_data_contracts`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| partner_name | text | — |  |
| file_name | text | ✓ | `''::text` |
| upload_date | date | ✓ | `CURRENT_DATE` |
| valid_until | date | ✓ |  |
| status | text | — | `'active'::text` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |
| file_url | text | ✓ | `''::text` |

**FK:** `company_id` → `companies.id`

---

