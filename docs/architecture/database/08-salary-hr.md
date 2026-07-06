# 💰 Bér & Munkaidő

> Bérszámfejtés, bérfájlok, munkaidő-nyilvántartás, dolgozói díjszabások.

**Táblák ebben a csoportban:** 5

---

### `salary`

**RLS:** ✅ | **Sorok:** ~99

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| név | text | — |  |
| összeg | numeric | — |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| dátum | date | ✓ |  |
| company_id | uuid | ✓ |  |
| tipus | text | — |  |
| statusz | text | — |  |
| kifizetes_ideje | timestamp with time zone | ✓ |  |
| megjegyzes | text | ✓ |  |
| fizetesi_mod | text | — |  |
| transaction_id | uuid | ✓ |  |
| salary_file_id | uuid | ✓ |  |
| munkavallalo_neve | text | ✓ |  |

**FK:** `company_id` → `companies.id`, `salary_file_id` → `salary_files.id`, `transaction_id` → `transactions.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_salary_company_datum_tipus`, `idx_salary_company_id`, `idx_salary_salary_file_id`, `idx_salary_transaction_id`, `idx_salary_user_id`

---

### `salary_files`

**RLS:** ✅ | **Sorok:** ~7

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| payment_type | text | — |  |
| employee_name | text | ✓ |  |
| recipient_name | text | — |  |
| description | text | — |  |
| amount_to_transfer | numeric | — |  |
| payment_date | date | ✓ |  |
| due_date | date | ✓ |  |
| period_month | integer | ✓ |  |
| period_year | integer | ✓ |  |
| status | text | — | `'pending'::text` |
| payment_reference | text | ✓ |  |
| file_url | text | ✓ |  |
| file_name | text | ✓ |  |
| source | text | — | `'manual'::text` |
| metadata | jsonb | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| company_id | uuid | ✓ |  |
| file_size | integer | ✓ |  |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_salary_files_company_id`

---

### `time_entries`

**RLS:** ✅ | **Sorok:** ~82

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| user_id | uuid | — |  |
| project_id | uuid | ✓ |  |
| date | date | — | `CURRENT_DATE` |
| hours | numeric | — |  |
| description | text | ✓ |  |
| status | text | — | `'draft'::text` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| absence_type | text | ✓ |  |

**FK:** `company_id` → `companies.id`, `project_id` → `projects.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_time_entries_company_date`, `idx_time_entries_project_id`, `idx_time_entries_user_date`

---

### `employee_rates`

**RLS:** ✅ | **Sorok:** ~14

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| user_id | uuid | ✓ |  |
| employee_name | text | — |  |
| employee_type | text | — | `'employee'::text` |
| base_salary_cost | numeric | ✓ |  |
| hourly_rate | numeric | ✓ |  |
| effective_date | date | — | `CURRENT_DATE` |
| email | text | ✓ |  |
| phone | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| registration_token | text | ✓ | `encode(gen_random_bytes(16), 'hex'::text` |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `employee_rates_registration_token_key`, `idx_employee_rates_company_id`, `idx_employee_rates_company_name`, `idx_employee_rates_user_id`

---

### `leave_requests`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| user_id | uuid | — |  |
| leave_type | text | — | `'vacation'::text` |
| start_date | date | — |  |
| end_date | date | — |  |
| status | text | — | `'pending'::text` |
| note | text | ✓ |  |
| admin_note | text | ✓ |  |
| reviewed_by | uuid | ✓ |  |
| reviewed_at | timestamp with time zone | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `reviewed_by` → `auth.users.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_leave_requests_company`, `idx_leave_requests_reviewed_by`, `idx_leave_requests_user`

---

