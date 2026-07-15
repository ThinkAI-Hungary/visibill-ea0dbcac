# 🏢 Cégek & Tagság

> Cégek, tagságok, beállítások, telephely.

**Táblák ebben a csoportban:** 6

---

### `companies`

**RLS:** ✅ | **Sorok:** ~31

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| name | text | — |  |
| tax_number | text | ✓ |  |
| address | text | ✓ |  |
| owner_id | uuid | — |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| share_token | text | ✓ |  |
| share_token_created_at | timestamp with time zone | ✓ |  |

**FK:** `owner_id` → `auth.users.id`

**Indexek:** `companies_share_token_key`, `idx_companies_owner_id`

---

### `company_members`

**RLS:** ✅ | **Sorok:** ~49

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| company_id | uuid | — |  |
| created_at | timestamp with time zone | — | `now()` |
| role | text | — | `'member'::text` |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `company_members_user_id_company_id_key`, `idx_company_members_company_user`

---

### `company_settings`

**RLS:** ✅ | **Sorok:** ~1

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| work_start_time | time without time zone | — | `'09:00:00'::time without time zone` |
| work_end_time | time without time zone | — | `'17:00:00'::time without time zone` |
| admin_deadline | time without time zone | — | `'20:00:00'::time without time zone` |
| monthly_working_hours | numeric | — | `168` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`

**Indexek:** `company_settings_company_id_key`

---

### `company_locations`

**RLS:** ✅ | **Sorok:** ~6

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| name | text | — |  |
| address | text | — |  |
| location_type | text | — | `'branch'::text` |
| is_default | boolean | ✓ | `false` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_company_locations_company`

---

### `company_fx_settings`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| rate_source | text | — | `'MNB'::text` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`

**Indexek:** `company_fx_settings_company_id_key`

---

### `company_email_settings`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| user_id | uuid | — |  |
| imap_host | text | ✓ |  |
| imap_port | integer | ✓ |  |
| imap_username | text | ✓ |  |
| imap_password_secret_id | uuid | ✓ |  |
| imap_encryption | text | — | `'SSL/TLS'::text` |
| imap_status | text | — | `'pending'::text` |
| imap_last_validated_at | timestamp with time zone | ✓ |  |
| imap_validation_error | text | ✓ |  |
| smtp_host | text | ✓ |  |
| smtp_port | integer | ✓ |  |
| smtp_username | text | ✓ |  |
| smtp_password_secret_id | uuid | ✓ |  |
| smtp_encryption | text | — | `'SSL/TLS'::text` |
| smtp_status | text | — | `'pending'::text` |
| smtp_last_validated_at | timestamp with time zone | ✓ |  |
| smtp_validation_error | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `company_email_settings_company_id_key`


---

