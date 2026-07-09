# 📘 eaisyBooks — EV (Egyéni Vállalkozó)

> ✅ **Active** — EV ügyfelek speciális nyilvántartásai. Frontend implementáció kész (2026-07-08): adóforma-összehasonlítás (átalány/VSZJA/KATA), TB-járulék & szocho kalkuláció minimumjárulék-alappal, pénztárkönyv, 14 nyilvántartás típus, bevallás workflow.

**Táblák ebben a csoportban:** 21

---

### `accounty_ev_client_settings`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — | `2026` |
| taxpayer_form | USER-DEFINED | — | `'atalany'::accounty_ev_taxpayer_form` |
| employment_status | USER-DEFINED | — | `'foallasu'::accounty_ev_employment_statu` |
| vat_status | USER-DEFINED | — | `'alanyi_mentes'::accounty_ev_vat_status` |
| cost_ratio_category | USER-DEFINED | ✓ | `'general'::accounty_ev_cost_ratio_catego` |
| registration_number | text | ✓ |  |
| activity_codes | ARRAY | ✓ | `'{}'::text[]` |
| main_activity_code | text | ✓ |  |
| skilled_main_activity | boolean | ✓ | `false` |
| bookkeeping_mode | USER-DEFINED | ✓ | `'egyszeres'::accounty_ev_bookkeeping_mod` |
| org_type | USER-DEFINED | ✓ |  |
| is_public_benefit | boolean | ✓ | `false` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

**Indexek:** `accounty_ev_client_settings_company_id_tax_year_key`, `idx_accounty_ev_client_settings_company`, `idx_accounty_ev_client_settings_year`

---

### `accounty_ev_lifecycle_events`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| event_type | USER-DEFINED | — |  |
| event_date | date | — |  |
| from_form | USER-DEFINED | ✓ |  |
| to_form | USER-DEFINED | ✓ |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

**Indexek:** `idx_accounty_ev_lifecycle_company`

---

### `accounty_ev_records_receivables`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| customer_name | text | — |  |
| invoice_number | text | ✓ |  |
| completion_date | date | ✓ |  |
| amount | bigint | — |  |
| settlement_date | date | ✓ |  |
| cashbook_entry_id | uuid | ✓ |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `cashbook_entry_id` → `accounty_penztarkonyv_tetel.id`, `company_id` → `companies.id`, `created_by` → `auth.users.id`

**Indexek:** `idx_accounty_ev_receivables_company`

---

### `accounty_ev_records_payables`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| supplier_name | text | — |  |
| invoice_number | text | ✓ |  |
| receipt_date | date | ✓ |  |
| amount | bigint | — |  |
| payment_date | date | ✓ |  |
| cashbook_entry_id | uuid | ✓ |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `cashbook_entry_id` → `accounty_penztarkonyv_tetel.id`, `company_id` → `companies.id`, `created_by` → `auth.users.id`

**Indexek:** `idx_accounty_ev_payables_company`

---

### `accounty_ev_records_fixed_assets`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| asset_name | text | — |  |
| acquisition_date | date | — |  |
| acquisition_cost | bigint | — |  |
| depreciation_rate | numeric | ✓ |  |
| accumulated_depreciation | bigint | ✓ | `0` |
| net_value | bigint | ✓ |  |
| disposal_date | date | ✓ |  |
| disposal_type | text | ✓ |  |
| is_below_threshold | boolean | ✓ | `false` |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

**Indexek:** `idx_accounty_ev_fixed_assets_company`

---

### `accounty_ev_records_investments`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| investment_name | text | — |  |
| cost_elements | jsonb | ✓ | `'[]'::jsonb` |
| activation_date | date | ✓ |  |
| depreciation_base | bigint | ✓ |  |
| fixed_asset_id | uuid | ✓ |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`, `fixed_asset_id` → `accounty_ev_records_fixed_assets.id`

---

### `accounty_ev_records_securities`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| security_type | text | — |  |
| nominal_value | bigint | ✓ |  |
| acquisition_cost | bigint | — |  |
| yield_amount | bigint | ✓ | `0` |
| disposal_date | date | ✓ |  |
| disposal_proceeds | bigint | ✓ |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

---

### `accounty_ev_records_wages`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| record_type | text | — |  |
| period_month | integer | ✓ |  |
| gross_amount | bigint | — |  |
| net_amount | bigint | ✓ |  |
| tax_amount | bigint | ✓ | `0` |
| contribution_amount | bigint | ✓ | `0` |
| cashbook_entry_id | uuid | ✓ |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `cashbook_entry_id` → `accounty_penztarkonyv_tetel.id`, `company_id` → `companies.id`, `created_by` → `auth.users.id`

---

### `accounty_ev_records_vehicle_log`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| entry_date | date | — |  |
| departure_location | text | ✓ |  |
| arrival_location | text | ✓ |  |
| distance_km | numeric | — |  |
| purpose | text | — |  |
| is_business | boolean | — | `true` |
| fuel_cost | bigint | ✓ | `0` |
| vehicle_plate | text | ✓ |  |
| odometer_start | integer | ✓ |  |
| odometer_end | integer | ✓ |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

**Indexek:** `idx_accounty_ev_vehicle_company`

---

### `accounty_ev_records_consignment`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| item_name | text | — |  |
| quantity | numeric | ✓ |  |
| direction | text | — |  |
| transfer_date | date | — |  |
| settlement_date | date | ✓ |  |
| amount | bigint | ✓ |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

---

### `accounty_ev_records_other_claims`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| claim_type | text | — |  |
| counterparty | text | ✓ |  |
| amount | bigint | — |  |
| date_incurred | date | — |  |
| date_settled | date | ✓ |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

---

### `accounty_ev_records_scrapping`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| asset_name | text | — |  |
| scrapping_reason | text | ✓ |  |
| scrapping_date | date | — |  |
| original_value | bigint | ✓ |  |
| residual_value | bigint | ✓ | `0` |
| protocol_url | text | ✓ |  |
| fixed_asset_id | uuid | ✓ |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`, `fixed_asset_id` → `accounty_ev_records_fixed_assets.id`

---

### `accounty_ev_records_inventory`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| item_name | text | — |  |
| quantity | numeric | ✓ |  |
| unit_price | bigint | ✓ |  |
| total_value | bigint | — |  |
| inventory_date | date | — |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

---

### `accounty_ev_records_subcontractors`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| subcontractor_name | text | — |  |
| invoice_number | text | ✓ |  |
| completion_date | date | ✓ |  |
| paid_amount | bigint | — |  |
| payment_date | date | ✓ |  |
| cashbook_entry_id | uuid | ✓ |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `cashbook_entry_id` → `accounty_penztarkonyv_tetel.id`, `company_id` → `companies.id`, `created_by` → `auth.users.id`

---

### `accounty_ev_records_strict_forms`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| form_type | text | — |  |
| serial_range_from | text | ✓ |  |
| serial_range_to | text | ✓ |  |
| usage_description | text | ✓ |  |
| scrapped_count | integer | ✓ | `0` |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

---

### `accounty_ev_contribution_calc`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| quarter | integer | — |  |
| ytd_income | bigint | ✓ | `0` |
| prev_quarters_base | bigint | ✓ | `0` |
| current_quarter_base | bigint | ✓ | `0` |
| insurance_months | integer | ✓ | `3` |
| monthly_breakdown | jsonb | ✓ | `'[]'::jsonb` |
| tb_amount | bigint | ✓ | `0` |
| szocho_amount | bigint | ✓ | `0` |
| total_amount | bigint | ✓ | `0` |
| minimum_base_applied | boolean | ✓ | `false` |
| minimum_base_amount | bigint | ✓ | `0` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

**Indexek:** `accounty_ev_contribution_calc_company_id_tax_year_quarter_key`

---

### `accounty_ev_hipa_calc`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| assessment_mode | text | — | `'simplified'::text` |
| revenue | bigint | ✓ | `0` |
| tax_base | bigint | ✓ | `0` |
| municipality_rate | numeric | ✓ | `0.02` |
| tax_amount | bigint | ✓ | `0` |
| advance_paid | bigint | ✓ | `0` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`

**Indexek:** `accounty_ev_hipa_calc_company_id_tax_year_key`

---

### `accounty_ev_tax_returns`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| return_type | USER-DEFINED | — |  |
| form_code | text | ✓ |  |
| period_key | text | ✓ |  |
| status | USER-DEFINED | — | `'draft'::accounty_ev_return_status` |
| data | jsonb | ✓ | `'{}'::jsonb` |
| calculated_tax | bigint | ✓ | `0` |
| paid_amount | bigint | ✓ | `0` |
| deadline | date | ✓ |  |
| submitted_at | timestamp with time zone | ✓ |  |
| accepted_at | timestamp with time zone | ✓ |  |
| nav_submission_id | text | ✓ |  |
| nav_status | text | ✓ |  |
| xml_data | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

**Indexek:** `idx_accounty_ev_returns_company`, `idx_accounty_ev_returns_deadline`

---

### `accounty_ev_audit_log`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| entity_type | text | — |  |
| entity_id | uuid | ✓ |  |
| action | text | — |  |
| old_data | jsonb | ✓ |  |
| new_data | jsonb | ✓ |  |
| performed_by | uuid | ✓ |  |
| performed_at | timestamp with time zone | — | `now()` |
| ip_address | text | ✓ |  |

**FK:** `company_id` → `companies.id`, `performed_by` → `auth.users.id`

**Indexek:** `idx_accounty_ev_audit_company`, `idx_accounty_ev_audit_entity`

---

### `accounty_penztarkonyv_tetel`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| serial_number | integer | — |  |
| entry_date | date | — |  |
| document_number | text | ✓ |  |
| description | text | — |  |
| entry_direction | USER-DEFINED | — |  |
| main_category | USER-DEFINED | — |  |
| amount | bigint | — |  |
| vat_amount | bigint | ✓ | `0` |
| document_url | text | ✓ |  |
| document_ocr_data | jsonb | ✓ |  |
| period_closed | boolean | — | `false` |
| storno_of_id | uuid | ✓ |  |
| is_storno | boolean | — | `false` |
| linked_record_type | text | ✓ |  |
| linked_record_id | uuid | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`, `storno_of_id` → `accounty_penztarkonyv_tetel.id`

**Indexek:** `idx_accounty_penztarkonyv_company_year`, `idx_accounty_penztarkonyv_date`, `idx_accounty_penztarkonyv_serial`, `idx_accounty_penztarkonyv_storno`

---

### `accounty_penztarkonyv_period_close`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| tax_year | integer | — |  |
| period_type | USER-DEFINED | — |  |
| period_key | text | — |  |
| column_totals | jsonb | — | `'{}'::jsonb` |
| opening_balance | bigint | ✓ | `0` |
| closing_balance | bigint | ✓ | `0` |
| closed_at | timestamp with time zone | — | `now()` |
| closed_by | uuid | ✓ |  |
| notes | text | ✓ |  |

**FK:** `closed_by` → `auth.users.id`, `company_id` → `companies.id`

**Indexek:** `accounty_penztarkonyv_period__company_id_tax_year_period_ty_key`

---

