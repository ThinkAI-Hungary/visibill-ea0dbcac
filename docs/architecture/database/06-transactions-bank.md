# 💳 Tranzakciók & Bank

> Banki tranzakciók, számla-tranzakció párosítás, bankkivonatok, SZÉP kártya.

**Táblák ebben a csoportban:** 8

---

### `transactions`

**RLS:** ✅ | **Sorok:** ~3056

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| created_at | timestamp with time zone | ✓ | `now()` |
| transaction_date | date | — |  |
| description | text | ✓ |  |
| amount | numeric | — |  |
| currency | character(3) | ✓ | `'HUF'::bpchar` |
| type | text | ✓ |  |
| matched_invoice_id | uuid | ✓ |  |
| match_type | text | ✓ |  |
| confidence_score | double precision | ✓ | `0` |
| is_verified | boolean | ✓ | `false` |
| upload_id | uuid | ✓ |  |
| company_id | uuid | — |  |
| reason | text | ✓ |  |
| gl_account_id | uuid | ✓ |  |
| gl_is_manually_overridden | boolean | ✓ | `false` |
| gl_ai_confidence_score | numeric | ✓ |  |
| gl_reasoning | text | ✓ |  |
| gl_classifications | jsonb | ✓ | `'{}'::jsonb` |
| terheles_datuma | date | ✓ |  |

**FK:** `company_id` → `companies.id`, `gl_account_id` → `gl_accounts.id`, `upload_id` → `transaction_uploads.id`

**Indexek:** `idx_transactions_cash_types`, `idx_transactions_company_date`, `idx_transactions_company_date_currency`, `idx_transactions_company_matched`, `idx_transactions_company_type`, `idx_transactions_gl_account_id`, `idx_transactions_upload_id`, `unique_transaction_entry`

---

### `transaction_uploads`

**RLS:** ✅ | **Sorok:** ~291

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | ✓ |  |
| company_id | uuid | — |  |
| file_name | text | — |  |
| file_size | bigint | ✓ |  |
| file_type | text | ✓ |  |
| file_url | text | — |  |
| upload_status | text | ✓ | `'uploaded'::text` |
| processing_status | text | ✓ | `'pending'::text` |
| error_message | text | ✓ |  |
| metadata | jsonb | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |
| bank_hint | text | ✓ |  |
| detected_bank | text | ✓ |  |

**FK:** `user_id` → `auth.users.id`

**Indexek:** `idx_transaction_uploads_company_created`, `idx_transaction_uploads_detected_bank`, `idx_transaction_uploads_user_id`

---

### `transaction_invoice_matches`

**RLS:** ✅ | **Sorok:** ~3

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| transaction_id | uuid | — |  |
| invoice_id | uuid | — |  |
| invoice_source | text | — | `'submitted'::text` |
| created_at | timestamp with time zone | — | `now()` |
| created_by | text | — | `'manual'::text` |

**FK:** `transaction_id` → `transactions.id`

**Indexek:** `idx_tim_invoice_id`, `idx_tim_transaction_id`, `transaction_invoice_matches_transaction_id_invoice_id_key`

---

### `match_transaction_overrides_log`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| transaction_id | uuid | — |  |
| original_invoice_id | uuid | ✓ |  |
| original_match_type | text | ✓ |  |
| corrected_invoice_id | uuid | ✓ |  |
| corrected_match_type | text | — |  |
| transaction_description | text | — |  |
| transaction_amount | numeric | — |  |
| original_partner_name | text | ✓ |  |
| corrected_partner_name | text | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`, `transaction_id` → `transactions.id`

---

### `bank_statements`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| file_name | text | — |  |
| file_url | text | ✓ |  |
| file_size | integer | ✓ |  |
| file_type | text | ✓ |  |
| bank_name | text | ✓ |  |
| account_number | text | ✓ |  |
| statement_period_start | date | ✓ |  |
| statement_period_end | date | ✓ |  |
| opening_balance | numeric | ✓ |  |
| closing_balance | numeric | ✓ |  |
| total_credits | numeric | ✓ | `0` |
| total_debits | numeric | ✓ | `0` |
| transaction_count | integer | ✓ | `0` |
| currency | text | ✓ | `'HUF'::text` |
| processed_at | timestamp with time zone | ✓ |  |
| status | text | ✓ | `'uploaded'::text` |
| error_message | text | ✓ |  |
| metadata | jsonb | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| company_id | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_bank_statements_company_id`

---

### `bank_transactions`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| bank_statement_id | uuid | — |  |
| transaction_date | date | — |  |
| value_date | date | ✓ |  |
| description | text | — |  |
| reference | text | ✓ |  |
| amount | numeric | — |  |
| balance | numeric | ✓ |  |
| transaction_type | text | ✓ |  |
| category | text | ✓ |  |
| counterparty_name | text | ✓ |  |
| counterparty_account | text | ✓ |  |
| currency | text | ✓ | `'HUF'::text` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `bank_statement_id` → `bank_statements.id`

**Indexek:** `idx_bank_transactions_statement_id`

---

### `bank_statement_uploads`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| file_name | text | — |  |
| file_size | integer | — |  |
| file_type | text | — |  |
| file_url | text | — |  |
| upload_status | text | — | `'uploaded'::text` |
| processing_status | text | — | `'pending'::text` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| error_message | text | ✓ |  |
| metadata | jsonb | ✓ |  |
| company_id | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_bank_statement_uploads_company_created`, `idx_bank_statement_uploads_company_id`

---

### `szep_card_transactions`

**RLS:** ✅ | **Sorok:** ~57

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| upload_id | uuid | ✓ |  |
| transaction_date | date | — |  |
| gross_amount | numeric | — |  |
| commission_amount | numeric | — | `0` |
| commission_vat | numeric | — | `0` |
| net_amount | numeric | — |  |
| currency | text | — | `'HUF'::text` |
| merchant_name | text | ✓ |  |
| sub_account | text | — |  |
| card_number_masked | text | ✓ |  |
| card_holder | text | ✓ |  |
| issuer_bank | text | ✓ |  |
| pos_terminal_id | text | ✓ |  |
| approval_code | text | ✓ |  |
| transaction_ref | text | ✓ |  |
| is_webshop | boolean | — | `false` |
| transfer_reference | text | ✓ |  |
| transfer_date | date | ✓ |  |
| bank_account | text | ✓ |  |
| status | text | — | `'Sikeres'::text` |
| is_reversal | boolean | — | `false` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `upload_id` → `transaction_uploads.id`

**Indexek:** `idx_szep_company_date`, `idx_szep_issuer_bank`, `idx_szep_sub_account`, `idx_szep_unique_transaction`, `idx_szep_upload`

---

