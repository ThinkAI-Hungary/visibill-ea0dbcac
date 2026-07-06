# 🏛️ NAV Integráció

> NAV Online Számla rendszer — bejövő/kimenő számlák, szinkron logok.

**Táblák ebben a csoportban:** 3

---

### `nav_invoices`

**RLS:** ✅ | **Sorok:** ~9229

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | ✓ |  |
| invoice_number | text | — |  |
| invoice_direction | text | ✓ |  |
| invoice_operation | text | ✓ |  |
| supplier_tax_number | text | ✓ |  |
| customer_tax_number | text | ✓ |  |
| invoice_issue_date | date | ✓ |  |
| invoice_delivery_date | date | ✓ |  |
| invoice_net_amount | numeric | ✓ |  |
| invoice_vat_amount | numeric | ✓ |  |
| invoice_gross_amount | numeric | ✓ |  |
| payment_method | text | ✓ |  |
| currency | text | ✓ | `'HUF'::text` |
| fetched_at | timestamp with time zone | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| company_id | uuid | ✓ |  |
| paid | boolean | ✓ | `false` |
| submitted | boolean | ✓ | `false` |
| supplier_name | text | ✓ |  |
| supplier_address | text | ✓ |  |
| customer_name | text | ✓ |  |
| customer_address | text | ✓ |  |
| payment_date | date | ✓ |  |
| details_fetched | boolean | ✓ | `false` |
| project_id | uuid | ✓ |  |
| category_id | uuid | ✓ |  |
| ai_categorization_reason | text | ✓ |  |
| supplier_partner_id | uuid | ✓ |  |
| transaction_id | uuid | ✓ |  |
| gl_account_id | uuid | ✓ |  |
| gl_is_manually_overridden | boolean | ✓ | `false` |
| gl_ai_confidence_score | numeric | ✓ |  |
| gl_reasoning | text | ✓ |  |
| gl_classifications | jsonb | ✓ | `'{}'::jsonb` |
| exclude_from_accounting | boolean | — | `false` |
| is_reverse_charge | boolean | ✓ | `false` |
| reverse_charge_category | text | ✓ |  |
| rc_confidence | text | ✓ | `'auto'::text` |
| rc_vat_date | date | ✓ |  |

**FK:** `category_id` → `categories.id`, `company_id` → `companies.id`, `gl_account_id` → `gl_accounts.id`, `project_id` → `projects.id`, `supplier_partner_id` → `partners.id`, `transaction_id` → `transactions.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_nav_invoices_cash_payment`, `idx_nav_invoices_category_id`, `idx_nav_invoices_company_date`, `idx_nav_invoices_company_direction_date`, `idx_nav_invoices_company_payment`, `idx_nav_invoices_exclude`, `idx_nav_invoices_gl_account_id`, `idx_nav_invoices_outbound_unpaid`, `idx_nav_invoices_project_id`, `idx_nav_invoices_reverse_charge`, `idx_nav_invoices_supplier_partner`, `idx_nav_invoices_transaction_id`, `idx_nav_invoices_user_id`, `nav_invoices_company_id_invoice_number_key`

---

### `nav_invoice_items`

**RLS:** ✅ | **Sorok:** ~42696

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| nav_invoice_id | uuid | — |  |
| line_number | integer | — |  |
| line_description | text | ✓ |  |
| quantity | numeric | ✓ |  |
| unit_of_measure | text | ✓ |  |
| unit_price | numeric | ✓ |  |
| net_amount | numeric | ✓ |  |
| vat_rate | text | ✓ |  |
| vat_amount | numeric | ✓ |  |
| gross_amount | numeric | ✓ |  |
| product_code | text | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| gl_classifications | jsonb | ✓ | `'{}'::jsonb` |
| exclude_from_accounting | boolean | — | `false` |

**FK:** `nav_invoice_id` → `nav_invoices.id`

**Indexek:** `idx_nav_invoice_items_nav_invoice_id`

---

### `nav_sync_logs`

**RLS:** ✅ | **Sorok:** ~1891

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | ✓ |  |
| sync_type | text | — |  |
| invoice_direction | text | ✓ |  |
| date_from | date | ✓ |  |
| date_to | date | ✓ |  |
| invoices_fetched | integer | ✓ | `0` |
| status | text | — |  |
| error_message | text | ✓ |  |
| duration_ms | integer | ✓ |  |
| started_at | timestamp with time zone | ✓ | `now()` |
| completed_at | timestamp with time zone | ✓ |  |
| company_id | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_nav_sync_logs_company_id`, `idx_nav_sync_logs_user_id`, `nav_sync_logs_started_at_idx`

---

