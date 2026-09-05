# 🏢 Cégek & Tagság

> Cégek, tagságok, beállítások, telephely.

**Táblák ebben a csoportban:** 7

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
| gl_date_basis | text | — | `'kibocsatas'` (CHECK in `'kibocsatas'`, `'teljesites'`) |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`

**Indexek:** `company_settings_company_id_key`

> **Architektúra Döntés (2026-09-05):** A `company_settings` egyedi rekordjainak mentése atomi PostgREST upserttel (`onConflict: 'company_id'`) történik a kliensoldali TOCTOU és `23505 duplicate key` hibák kiküszöbölésére, parciális frissítési izolációval — lásd [A-093](../decisions/A-093-atomic-company-settings-upsert-and-partial-update-isolation.md).

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

### `company_email_accounts`

> Többprofilos IMAP & SMTP levelező fiókok kezelése cégekhez, titkosított Supabase Vault integrációval.

**RLS:** ✅ | **Sorok:** Dinamikus

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — | — |
| user_id | uuid | — | — |
| name | text | — | `'Levelező fiók'` |
| is_active | boolean | — | `true` |
| is_default_smtp | boolean | — | `false` |
| is_default_imap | boolean | — | `false` |
| is_imap_enabled | boolean | — | `true` |
| imap_host | text | ✓ | — |
| imap_port | integer | ✓ | `993` |
| imap_username | text | ✓ | — |
| imap_password_secret_id | uuid | ✓ | — |
| imap_encryption | text | — | `'SSL/TLS'` |
| imap_status | text | — | `'pending'` |
| imap_last_synced_at | timestamp with time zone | ✓ | — |
| imap_last_validated_at | timestamp with time zone | ✓ | — |
| imap_validation_error | text | ✓ | — |
| is_smtp_enabled | boolean | — | `true` |
| smtp_host | text | ✓ | — |
| smtp_port | integer | ✓ | `465` |
| smtp_username | text | ✓ | — |
| smtp_password_secret_id | uuid | ✓ | — |
| smtp_encryption | text | — | `'SSL/TLS'` |
| smtp_status | text | — | `'pending'` |
| smtp_last_validated_at | timestamp with time zone | ✓ | — |
| smtp_validation_error | text | ✓ | — |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:**  
* `company_id` → `companies.id (ON DELETE CASCADE)`  
* `user_id` → `auth.users.id (ON DELETE CASCADE)`  
* `imap_password_secret_id` → `vault.secrets.id (ON DELETE SET NULL)`  
* `smtp_password_secret_id` → `vault.secrets.id (ON DELETE SET NULL)`

**Indexek:**  
* `company_email_accounts_pkey` (PRIMARY KEY)  
* `idx_company_email_accounts_company_id` on `(company_id)`  
* `idx_company_email_accounts_active_imap` on `(is_active, is_imap_enabled)`  
* `idx_company_email_accounts_default_smtp` on `(company_id, is_default_smtp)`

---

### `company_bank_accounts`

> Cég saját forint és deviza bankszámlái kimenő és bejövő utalásokhoz és bizonylatgeneráláshoz.

**RLS:** ✅ | **Sorok:** Dinamikus

| Oszlop | Típus | Null | Default | Leírás |
|--------|-------|------|---------|--------|
| `id` | uuid | — | `gen_random_uuid()` | Elsődleges kulcs |
| `company_id` | uuid | — | — | FK → `companies.id` (CASCADE) |
| `bank_name` | text | — | — | Bank megnevezése (pl. OTP, K&H, Erste) |
| `account_number` | text | — | — | Bankszámlaszám / IBAN |
| `currency` | text | — | `'HUF'` | Számla devizaneme |
| `created_at` | timestamp with time zone | — | `now()` | Létrehozás ideje |
| `updated_at` | timestamp with time zone | — | `now()` | Módosítás ideje |

**FK:** `company_id` → `companies.id (ON DELETE CASCADE)`

**Indexek:** `company_bank_accounts_pkey`

---

