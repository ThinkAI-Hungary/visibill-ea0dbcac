# 🔐 Auth & Felhasználók

> Felhasználói profilok, előfizetések, beállítások, NAV credentials.

**Táblák ebben a csoportban:** 6

---

### `profiles`

**RLS:** ✅ | **Sorok:** ~56

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| name | text | ✓ |  |
| position | text | ✓ |  |
| company | text | ✓ |  |
| avatar_url | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| has_completed_tour | boolean | ✓ | `false` |
| email_verified | boolean | — | `true` |
| email_verify_token | text | ✓ |  |
| role | text | — | `'user'::text` |
| is_support_admin | boolean | ✓ | `false` |
| eaisybill_access | boolean | — | `true` |
| eaisybooks_access | boolean | — | `false` |
| registration_source | text | ✓ |  |

**FK:** `user_id` → `auth.users.id`

**Indexek:** `profiles_user_id_key`

---

### `user_subscriptions`

**RLS:** ✅ | **Sorok:** ~56

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| tier | text | — | `'teszt'::text` |
| invoice_limit | integer | — | `999999` |
| invoices_used | integer | — | `0` |
| period_start | timestamp with time zone | — | `now()` |
| period_end | timestamp with time zone | — | `(now() + '1 mon'::interval)` |
| stripe_customer_id | text | ✓ |  |
| stripe_subscription_id | text | ✓ |  |
| stripe_product_id | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `user_id` → `auth.users.id`

**Indexek:** `user_subscriptions_user_id_key`

---

### `user_email_preferences`

**RLS:** ✅ | **Sorok:** ~54

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| invoice_processed | boolean | ✓ | `true` |
| invoice_failed | boolean | ✓ | `true` |
| subscription_warnings | boolean | ✓ | `true` |
| monthly_summary | boolean | ✓ | `false` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |
| weekly_summary | boolean | ✓ | `true` |
| payment_reminders | boolean | ✓ | `true` |
| team_notifications | boolean | ✓ | `true` |
| bank_statement_processed | boolean | ✓ | `true` |
| salary_processed | boolean | ✓ | `true` |
| nav_sync_complete | boolean | ✓ | `true` |
| transaction_matched | boolean | ✓ | `true` |
| email_invoice_processed | boolean | ✓ | `true` |
| missing_invoices | boolean | ✓ | `true` |

**FK:** `user_id` → `auth.users.id`

**Indexek:** `user_email_preferences_user_id_key`

---

### `user_nav_credentials`

**RLS:** ✅ | **Sorok:** ~11

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | ✓ |  |
| nav_username | text | — |  |
| nav_tax_number | text | — |  |
| software_dev_name | text | ✓ |  |
| software_dev_contact | text | ✓ |  |
| is_test_environment | boolean | ✓ | `true` |
| password_secret_id | uuid | ✓ |  |
| sign_key_secret_id | uuid | ✓ |  |
| exchange_key_secret_id | uuid | ✓ |  |
| software_id | text | ✓ |  |
| last_validated_at | timestamp with time zone | ✓ |  |
| validation_status | text | ✓ | `'pending'::text` |
| validation_error | text | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |
| company_id | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_user_nav_credentials_company_id`, `user_nav_credentials_user_id_company_id_key`

---

### `settings`

**RLS:** ✅ | **Sorok:** ~10

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| category | text | — |  |
| key | text | — |  |
| value | jsonb | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**Indexek:** `idx_settings_user_category`, `settings_user_id_category_key_key`

---

### `nylas_tokens`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| grant_id | text | — |  |
| access_token | text | — |  |
| refresh_token | text | ✓ |  |
| email_address | text | — |  |
| provider | text | — |  |
| expires_at | timestamp with time zone | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**Indexek:** `nylas_tokens_user_id_email_address_key`

---

