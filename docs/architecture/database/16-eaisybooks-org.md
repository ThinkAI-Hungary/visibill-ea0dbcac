# 📘 eaisyBooks — Szervezet

> Telephelyek, részlegek, költséghelyek, iroda beállítások, éves feladatok.

**Táblák ebben a csoportban:** 6

---

### `accounty_sites`

**RLS:** ✅ | **Sorok:** ~1

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| code | text | — | `''::text` |
| name | text | — |  |
| address | text | ✓ | `''::text` |
| main_activity | text | ✓ | `''::text` |
| headcount | integer | ✓ | `0` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`

---

### `accounty_departments`

**RLS:** ✅ | **Sorok:** ~1

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| site_id | uuid | ✓ |  |
| name | text | — |  |
| manager | text | ✓ | `''::text` |
| headcount | integer | ✓ | `0` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `site_id` → `accounty_sites.id`

---

### `accounty_cost_centers`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| parent_id | uuid | ✓ |  |
| code | text | — | `''::text` |
| name | text | — |  |
| responsible | text | ✓ | `''::text` |
| headcount | integer | ✓ | `0` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `parent_id` → `accounty_cost_centers.id`

---

### `accounty_office_settings`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| settings | jsonb | — | `'{}'::jsonb` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `user_id` → `auth.users.id`

**Indexek:** `accounty_office_settings_user_id_key`

---

### `accounty_year_end_tasks`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| year | integer | — | `EXTRACT(year FROM CURRENT_DATE)` |
| title | text | — |  |
| subtitle | text | ✓ | `''::text` |
| category | text | ✓ | `'general'::text` |
| icon_name | text | ✓ | `'FileText'::text` |
| color | text | ✓ | `'from-blue-500 to-indigo-500'::text` |
| deadline | date | ✓ |  |
| status | text | — | `'pending'::text` |
| legal_ref | text | ✓ | `''::text` |
| checklist | jsonb | ✓ | `'[]'::jsonb` |
| output_label | text | ✓ | `''::text` |
| sort_order | integer | ✓ | `0` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`

---

### `accounty_transfers`

**RLS:** ✅ | **Sorok:** ~3

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| employee_id | uuid | ✓ |  |
| employee_name | text | ✓ | `''::text` |
| bank_account | text | ✓ | `''::text` |
| net_salary | integer | ✓ | `0` |
| period | text | — |  |
| status | text | — | `'pending'::text` |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `employee_id` → `accounty_employees.id`

---

