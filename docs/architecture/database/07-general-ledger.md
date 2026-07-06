# 📊 Főkönyv (General Ledger)

> Főkönyvi számlák, naplókönyvelés, GL import/audit, ÁFA kódok.

**Táblák ebben a csoportban:** 9

---

### `gl_accounts`

**RLS:** ✅ | **Sorok:** ~3921

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| preset_id | uuid | — |  |
| gl_number | character varying(50) | — |  |
| short_name | character varying(255) | — |  |
| description | text | ✓ |  |
| parent_id | uuid | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |
| company_id | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `parent_id` → `gl_accounts.id`, `preset_id` → `chart_of_accounts_presets.id`

**Indexek:** `gl_accounts_preset_id_gl_number_key`, `idx_gl_accounts_company_id`, `idx_gl_accounts_parent_id`, `idx_gl_accounts_preset_id`

---

### `gl_journal_entries`

**RLS:** ✅ | **Sorok:** ~71261

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| import_id | uuid | — |  |
| company_id | uuid | — |  |
| voucher_id | integer | ✓ |  |
| voucher_number | text | ✓ |  |
| voucher_date | date | ✓ |  |
| entry_index | integer | ✓ |  |
| description | text | ✓ |  |
| debit_account | text | — |  |
| credit_account | text | — |  |
| amount | numeric | — |  |
| foreign_amount | numeric | ✓ |  |
| foreign_currency | text | ✓ |  |
| exchange_rate | numeric | ✓ |  |
| vat_base | numeric | ✓ |  |
| vat_rate | text | ✓ |  |
| partner_code | text | ✓ |  |
| partner_name | text | ✓ |  |
| service_date | date | ✓ |  |
| payment_due_date | date | ✓ |  |
| cost_center | text | ✓ |  |
| work_number | text | ✓ |  |

**FK:** `company_id` → `companies.id`, `import_id` → `gl_audit_imports.id`

**Indexek:** `idx_gl_journal_company`, `idx_gl_journal_credit`, `idx_gl_journal_debit`, `idx_gl_journal_import`

---

### `gl_overrides_log`

**RLS:** ✅ | **Sorok:** ~76

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| item_id | uuid | — |  |
| original_gl_account_id | uuid | ✓ |  |
| new_gl_account_id | uuid | — |  |
| user_id | uuid | — |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| company_id | uuid | ✓ |  |
| source_table | text | ✓ |  |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_overrides_company_id`, `idx_overrides_transaction_id`

---

### `gl_upload_notifications`

**RLS:** ✅ | **Sorok:** ~705

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| message | text | — |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| processing_status | text | — | `'pending'::text` |
| target_preset_id | uuid | ✓ |  |
| items_processed | integer | ✓ | `0` |
| items_total | integer | ✓ | `0` |
| error_message | text | ✓ |  |
| processed_at | timestamp with time zone | ✓ |  |

**Indexek:** `idx_gl_notifications_pending`

---

### `gl_audit_imports`

**RLS:** ✅ | **Sorok:** ~1

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| file_name | text | — |  |
| source_program | text | ✓ |  |
| source_version | text | ✓ |  |
| period_start | date | — |  |
| period_end | date | — |  |
| currency | text | ✓ | `'HUF'::text` |
| account_count | integer | ✓ | `0` |
| partner_count | integer | ✓ | `0` |
| voucher_count | integer | ✓ | `0` |
| entry_count | integer | ✓ | `0` |
| processing_status | text | ✓ | `'pending'::text` |
| error_message | text | ✓ |  |
| preset_id | uuid | ✓ |  |
| imported_at | timestamp with time zone | ✓ | `now()` |
| imported_by | uuid | ✓ |  |
| storage_path | text | ✓ |  |

**FK:** `company_id` → `companies.id`, `imported_by` → `auth.users.id`, `preset_id` → `chart_of_accounts_presets.id`

**Indexek:** `idx_gl_audit_imports_company`

---

### `gl_audit_accounts`

**RLS:** ✅ | **Sorok:** ~661

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| import_id | uuid | — |  |
| company_id | uuid | — |  |
| account_code | text | — |  |
| account_name | text | — |  |

**FK:** `company_id` → `companies.id`, `import_id` → `gl_audit_imports.id`

**Indexek:** `idx_gl_audit_accounts_import`

---

### `gl_audit_partners`

**RLS:** ✅ | **Sorok:** ~3784

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| import_id | uuid | — |  |
| company_id | uuid | — |  |
| partner_code | text | — |  |
| partner_name | text | — |  |
| tax_number | text | ✓ |  |
| eu_tax_number | text | ✓ |  |

**FK:** `company_id` → `companies.id`, `import_id` → `gl_audit_imports.id`

**Indexek:** `idx_gl_audit_partners_import`

---

### `chart_of_accounts_presets`

**RLS:** ✅ | **Sorok:** ~5

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | ✓ |  |
| type | character varying(20) | — |  |
| name | character varying(255) | — |  |
| is_active | boolean | ✓ | `true` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_presets_company_id`

---

### `vat_codes`

**RLS:** ✅ | **Sorok:** ~45

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| code | text | — |  |
| label | text | — |  |
| vat_percent | numeric | — | `27.00` |
| direction | text | — |  |
| is_deductible | boolean | — | `true` |
| is_reverse_charge | boolean | — | `false` |
| is_eu | boolean | — | `false` |
| target_rows | jsonb | — | `'[]'::jsonb` |
| sort_order | integer | — | `0` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| fad_category | text | ✓ |  |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_vat_codes_company`, `vat_codes_company_id_code_key`

---

