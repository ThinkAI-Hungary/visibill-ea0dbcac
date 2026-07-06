# 🏷️ Törzsadatok

> Kategóriák, projektek, partnertörzs, futár riportok.

**Táblák ebben a csoportban:** 7

---

### `categories`

**RLS:** ✅ | **Sorok:** ~24

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| name | text | — |  |
| description | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| company_id | uuid | ✓ |  |
| icon | text | ✓ |  |
| color | text | ✓ |  |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_categories_company_id`, `idx_categories_user_id`

---

### `projects`

**RLS:** ✅ | **Sorok:** ~22

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| name | text | — |  |
| description | text | ✓ |  |
| client_name | text | ✓ |  |
| status | text | — | `'active'::text` |
| budget | numeric | ✓ |  |
| start_date | date | ✓ |  |
| end_date | date | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| company_id | uuid | ✓ |  |
| project_code | text | ✓ |  |
| project_type | text | — | `'one_time'::text` |
| icon | text | ✓ |  |
| color | text | ✓ |  |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_projects_company_id`, `projects_pkey1`, `projects_project_code_key`

---

### `partners`

**RLS:** ✅ | **Sorok:** ~1151

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| company_id | uuid | ✓ |  |
| tax_number | text | — |  |
| name | text | — |  |
| partner_type | text | — | `'both'::text` |
| address | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| default_project_id | uuid | ✓ |  |
| email | text | ✓ |  |
| exclude_from_accounting | boolean | — | `false` |

**FK:** `company_id` → `companies.id`, `default_project_id` → `projects.id`

**Indexek:** `idx_partners_company_tax`, `idx_partners_default_project`, `idx_partners_exclude`, `partners_company_id_tax_number_key`

**⚠️ tax_number konvenciók:**
- Magyar partnerek: valós adószám (`12345678-2-42`)
- EU/külföldi VAT-tal rendelkező partnerek: valós VAT ID (`DE328252554`, `EU372041333`)
- Külföldi partnerek VAT nélkül: szintetikus ID `FOREIGN:<normalized_name>` (pl. `FOREIGN:anthropicpbc`)
- A normalizálás: kisbetűsítés + nem alfanumerikus karakterek eltávolítása
- A frontend elrejti a `FOREIGN:` prefixes értékeket — lásd [P-044](../../product/decisions/P-044-foreign-partner-display.md)

**partner_type logika:** Automatikus upgrade `'both'`-ra ha eltérő irányú számlán jelenik meg (worker + NAV sync) — lásd [A-024](../decisions/A-024-partner-upsert-strategy.md)

---

### `report_uploads`

**RLS:** ✅ | **Sorok:** ~6

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| company_id | uuid | ✓ |  |
| file_name | text | — |  |
| file_url | text | — |  |
| file_size | bigint | ✓ |  |
| file_type | text | ✓ |  |
| report_type | text | — |  |
| upload_status | text | — | `'uploaded'::text` |
| processing_status | text | — | `'pending'::text` |
| error_message | text | ✓ |  |
| metadata | jsonb | ✓ | `'{}'::jsonb` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_report_uploads_company`, `idx_report_uploads_company_created`, `idx_report_uploads_user`

---

### `courier_reports`

**RLS:** ✅ | **Sorok:** ~44

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| upload_id | uuid | — |  |
| report_type | text | — |  |
| report_number | text | ✓ |  |
| package_number | text | ✓ |  |
| reference_number | text | ✓ |  |
| delivery_date | date | ✓ |  |
| cod_amount | numeric | ✓ |  |
| recipient_name | text | ✓ |  |
| recipient_address | text | ✓ |  |
| matched_transaction_id | uuid | ✓ |  |
| matched_nav_invoice_id | uuid | ✓ |  |
| match_status | text | — | `'unmatched'::text` |
| match_confidence | double precision | ✓ | `0` |
| match_reason | text | ✓ |  |
| raw_data | jsonb | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| row_type | text | — | `'item'::text` |

**FK:** `company_id` → `companies.id`, `matched_nav_invoice_id` → `nav_invoices.id`, `matched_transaction_id` → `transactions.id`, `upload_id` → `report_uploads.id`

**Indexek:** `idx_courier_reports_company`, `idx_courier_reports_match_status`, `idx_courier_reports_matched_nav_invoice`, `idx_courier_reports_matched_transaction`, `idx_courier_reports_upload`

---

### `tax`

**RLS:** ✅ | **Sorok:** ~1

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| adonem | text | — |  |
| osszeg | numeric | — |  |
| datum | date | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| company_id | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_tax_company_id`, `idx_tax_user_id`

---

### `reverse_charge_entries`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| nav_invoice_id | uuid | ✓ |  |
| invoice_id | uuid | ✓ |  |
| category | text | — |  |
| net_amount | numeric | — |  |
| vat_rate | numeric | — | `0.27` |
| vat_amount | numeric | — |  |
| invoice_received_date | date | ✓ |  |
| payment_date | date | ✓ |  |
| deadline_date | date | ✓ |  |
| effective_vat_date | date | — |  |
| vat_period_year | integer | — |  |
| vat_period_month | integer | — |  |
| status | text | — | `'pending'::text` |
| detail_data | jsonb | ✓ | `'{}'::jsonb` |
| is_deductible | boolean | — | `true` |
| deduction_ratio | numeric | — | `1.0` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `invoice_id` → `invoices.id`, `nav_invoice_id` → `nav_invoices.id`

**Indexek:** `idx_rce_company`, `idx_rce_invoice`, `idx_rce_nav_invoice`, `idx_rce_period`, `idx_rce_status`

---

### `project_labor_costs` — VIEW

> Projekt munkaerő-költség összesítő nézet. A `time_entries` és `employee_rates` táblákból aggregálva.

**RLS:** ✅ | **Sorok:** N/A (view)

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| project_id | uuid | ✓ | |
| company_id | uuid | ✓ | |
| project_name | text | ✓ | |
| total_hours | numeric | ✓ | |
| total_labor_cost | numeric | ✓ | |

---
