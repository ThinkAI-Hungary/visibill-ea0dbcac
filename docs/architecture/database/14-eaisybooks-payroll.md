# 📘 eaisyBooks — Bérszámfejtés

> Foglalkoztatottak, jogviszonyok, bérszámfejtési ciklusok, bérelemek, nyilatkozatok, cafeteria, letiltások.

**Táblák ebben a csoportban:** 13

---

### `accounty_employees`

> Bérszámfejtési modul foglalkoztatottak törzstáblája. Egy céghez (companies) N foglalkoztatott tartozik.

**RLS:** ✅ | **Sorok:** ~6

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| first_name | text | — |  |
| last_name | text | — |  |
| birth_name | text | ✓ |  |
| birth_place | text | ✓ |  |
| birth_date | date | ✓ |  |
| mothers_name | text | ✓ |  |
| gender | text | ✓ |  |
| nationality | text | ✓ | `'HU'::text` |
| taj_number | text | ✓ |  |
| tax_id | text | ✓ |  |
| id_card_number | text | ✓ |  |
| address | jsonb | ✓ |  |
| temp_address | jsonb | ✓ |  |
| email | text | ✓ |  |
| phone | text | ✓ |  |
| bank_account | text | ✓ |  |
| iban | text | ✓ |  |
| status | text | ✓ | `'active'::text` |
| avatar_url | text | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_accounty_employees_company`, `idx_accounty_employees_name`, `idx_accounty_employees_status`, `idx_accounty_employees_taj`, `idx_accounty_employees_tax_id`

---

### `accounty_employments`

> Jogviszonyok. Egy foglalkoztatotthoz (accounty_employees) N jogviszony tartozhat párhuzamosan (pl. munkaviszony + társas vállalkozó).

**RLS:** ✅ | **Sorok:** ~6

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| employee_id | uuid | — |  |
| company_id | uuid | — |  |
| job_code | text | — |  |
| job_serial_number | integer | ✓ | `1` |
| employment_type | text | — |  |
| start_date | date | — |  |
| end_date | date | ✓ |  |
| probation_end | date | ✓ |  |
| is_fixed_term | boolean | ✓ | `false` |
| weekly_hours | numeric | ✓ | `40` |
| feor_code | text | ✓ |  |
| job_title | text | ✓ |  |
| location_id | uuid | ✓ |  |
| cost_center | text | ✓ |  |
| department | text | ✓ |  |
| base_salary | numeric | ✓ |  |
| salary_type | text | ✓ | `'monthly'::text` |
| remote_work_type | text | ✓ |  |
| remote_work_days_per_week | integer | ✓ |  |
| is_insured | boolean | ✓ | `true` |
| status | text | ✓ | `'active'::text` |
| metadata | jsonb | ✓ | `'{}'::jsonb` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `employee_id` → `accounty_employees.id`

**Indexek:** `idx_accounty_employments_company`, `idx_accounty_employments_employee`, `idx_accounty_employments_job_code`, `idx_accounty_employments_status`

---

### `accounty_employee_jobs`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| employee_id | uuid | — |  |
| job_code | text | — | `'1101'::text` |
| job_code_label | text | ✓ | `'Munkaviszony (általános)'::text` |
| seq_num | integer | ✓ | `1` |
| position | text | ✓ | `''::text` |
| feor | text | ✓ | `''::text` |
| weekly_hours | integer | ✓ | `40` |
| start_date | date | — |  |
| end_date | date | ✓ |  |
| base_salary | integer | ✓ | `0` |
| status | text | — | `'active'::text` |
| insured | boolean | ✓ | `true` |
| minimum_base | boolean | ✓ | `false` |
| employer | text | ✓ | `''::text` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `employee_id` → `accounty_employees.id`

---

### `accounty_job_modifications`

**RLS:** ✅ | **Sorok:** ~9

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| employee_id | uuid | — |  |
| job_id | uuid | ✓ |  |
| change_type | text | — |  |
| effective_date | date | — |  |
| old_value | text | ✓ | `''::text` |
| new_value | text | ✓ | `''::text` |
| reason | text | ✓ | `''::text` |
| generate_08e | boolean | ✓ | `false` |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `employee_id` → `accounty_employees.id`, `job_id` → `accounty_employee_jobs.id`

---

### `accounty_payroll_cycles`

> Havi bérszámfejtési ciklus. Egy céghez havonta max. egy ciklus tartozik. 8 lépéses stepper.

**RLS:** ✅ | **Sorok:** ~5

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| year | integer | — |  |
| month | integer | — |  |
| status | text | ✓ | `'draft'::text` |
| current_step | integer | ✓ | `1` |
| approved_by | uuid | ✓ |  |
| approved_at | timestamp with time zone | ✓ |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `approved_by` → `auth.users.id`, `company_id` → `companies.id`

**Indexek:** `accounty_payroll_cycles_company_id_year_month_key`, `idx_accounty_cycles_company`, `idx_accounty_cycles_period`, `idx_accounty_cycles_status`, `idx_accounty_payroll_cycles_approved_by`

---

### `accounty_payroll_items`

> Bérelemek: a havi ciklus jogviszonyonkénti tételei (alapbér, pótlékok, juttatások, levonások).

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| cycle_id | uuid | — |  |
| employment_id | uuid | — |  |
| item_type | text | — |  |
| description | text | ✓ |  |
| amount | numeric | — |  |
| hours | numeric | ✓ |  |
| days | numeric | ✓ |  |
| rate_pct | numeric | ✓ |  |
| is_deduction | boolean | ✓ | `false` |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `cycle_id` → `accounty_payroll_cycles.id`, `employment_id` → `accounty_employments.id`

**Indexek:** `idx_accounty_items_cycle`, `idx_accounty_items_employment`

---

### `accounty_payroll_calculations`

> Számfejtett eredmények: a futtatott adómotor kimenete jogviszonyonként.

**RLS:** ✅ | **Sorok:** ~1

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| cycle_id | uuid | — |  |
| employment_id | uuid | — |  |
| gross_salary | numeric | ✓ |  |
| szja_base | numeric | ✓ |  |
| szja_amount | numeric | ✓ |  |
| tb_amount | numeric | ✓ |  |
| szocho_amount | numeric | ✓ |  |
| net_salary | numeric | ✓ |  |
| tax_credits | jsonb | ✓ | `'{}'::jsonb` |
| szocho_credits | jsonb | ✓ | `'{}'::jsonb` |
| deductions | jsonb | ✓ | `'{}'::jsonb` |
| cafeteria_tax | jsonb | ✓ | `'{}'::jsonb` |
| metadata | jsonb | ✓ | `'{}'::jsonb` |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `cycle_id` → `accounty_payroll_cycles.id`, `employment_id` → `accounty_employments.id`

**Indexek:** `accounty_payroll_calculations_cycle_id_employment_id_key`, `idx_accounty_calcs_cycle`, `idx_accounty_calcs_employment`

---

### `accounty_declarations`

> Adóelőleg-nyilatkozatok: 9 különböző kedvezmény-típus, foglalkoztatottanként.

**RLS:** ✅ | **Sorok:** ~1

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| employee_id | uuid | — |  |
| declaration_type | text | — |  |
| valid_from | date | — |  |
| valid_until | date | ✓ |  |
| status | text | ✓ | `'active'::text` |
| parameters | jsonb | — | `'{}'::jsonb` |
| document_url | text | ✓ |  |
| nav_receipt_id | text | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `employee_id` → `accounty_employees.id`

**Indexek:** `idx_accounty_decl_employee`, `idx_accounty_decl_status`, `idx_accounty_decl_type`

---

### `accounty_cafeteria`

> Cafeteria-elszámolás: SZÉP-kártya, lakhatás, csekély értékű ajándék. A közteher-kulcs a tax_rate oszlopban.

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| employment_id | uuid | — |  |
| cycle_id | uuid | ✓ |  |
| benefit_type | text | — |  |
| amount | numeric | — |  |
| provider | text | ✓ |  |
| card_number | text | ✓ |  |
| tax_rate | numeric | ✓ |  |
| status | text | ✓ | `'pending'::text` |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `cycle_id` → `accounty_payroll_cycles.id`, `employment_id` → `accounty_employments.id`

**Indexek:** `idx_accounty_cafeteria_cycle`, `idx_accounty_cafeteria_employment`

---

### `accounty_garnishments`

> Bér-letiltások (Vht. 65.§): tartásdíj, közjogi, magánjogi. A sorrend és maximum korlátok a taxEngine-ben érvényesülnek.

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| employee_id | uuid | — |  |
| garnishment_type | text | — |  |
| creditor_name | text | ✓ |  |
| creditor_account | text | ✓ |  |
| decree_number | text | ✓ |  |
| original_amount | numeric | ✓ |  |
| remaining_amount | numeric | ✓ |  |
| monthly_deduction | numeric | ✓ |  |
| max_deduction_pct | numeric | ✓ | `0.33` |
| priority | integer | ✓ | `1` |
| is_active | boolean | ✓ | `true` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `employee_id` → `accounty_employees.id`

**Indexek:** `idx_accounty_garnishments_active`, `idx_accounty_garnishments_employee`

---

### `accounty_timesheets`

> Jelenléti ívek feldolgozása OCR/AI-val. A kinyert adatok a payroll_items-be kerülnek validáció után.

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| cycle_id | uuid | — |  |
| employment_id | uuid | — |  |
| document_url | text | ✓ |  |
| ocr_data | jsonb | ✓ |  |
| ocr_confidence | numeric | ✓ |  |
| is_verified | boolean | ✓ | `false` |
| verified_by | uuid | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `cycle_id` → `accounty_payroll_cycles.id`, `employment_id` → `accounty_employments.id`, `verified_by` → `auth.users.id`

**Indexek:** `idx_accounty_timesheets_cycle`, `idx_accounty_timesheets_employment`, `idx_accounty_timesheets_verified_by`

---

### `accounty_leaves`

> Szabadság/távollét nyilvántartás foglalkoztatottanként. Támogatja a betegszabadságot, anyasági ellátásokat és pótszabadságokat.

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| employment_id | uuid | — |  |
| cycle_id | uuid | ✓ |  |
| leave_type | text | — |  |
| start_date | date | — |  |
| end_date | date | — |  |
| days | numeric | — |  |
| daily_rate | numeric | ✓ |  |
| status | text | ✓ | `'approved'::text` |
| metadata | jsonb | ✓ | `'{}'::jsonb` |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `cycle_id` → `accounty_payroll_cycles.id`, `employment_id` → `accounty_employments.id`

**Indexek:** `idx_accounty_leaves_cycle`, `idx_accounty_leaves_employment`, `idx_accounty_leaves_type`

---

### `accounty_job_codes`

> NAV jogviszonykódok master táblája. Az 1115-ös kód 2026.01.01-től automatikusan aktív.

**RLS:** ✅ | **Sorok:** ~19

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| code | text | — |  |
| name | text | — |  |
| is_insured | boolean | ✓ | `true` |
| min_contribution_base_rule | text | ✓ |  |
| valid_from | date | ✓ |  |
| valid_until | date | ✓ |  |
| description | text | ✓ |  |
| id | uuid | ✓ | `gen_random_uuid()` |
| is_active | boolean | ✓ | `true` |
| valid_to | date | ✓ |  |
| nav_reference_url | text | ✓ |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

---

