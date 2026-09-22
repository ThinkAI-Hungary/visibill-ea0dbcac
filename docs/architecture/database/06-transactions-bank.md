# 💳 Tranzakciók & Bank

> Banki tranzakciók, számla-tranzakció párosítás, bankkivonatok, SZÉP kártya.

**Táblák ebben a csoportban:** 13

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
| a8_transaction_id | text | ✓ | NULL (A-119: Aggreg8 PSD2 API egyedi azonosító) |
| fee_amount | numeric | ✓ | NULL (A-139: Kártyás elszámolási jutalék / díj, pl. SimplePay) |

**FK:** `company_id` → `companies.id`, `gl_account_id` → `gl_accounts.id`, `upload_id` → `transaction_uploads.id`

**Indexek:** `idx_transactions_a8_tx_id` (UNIQUE parciális), `idx_transactions_cash_types`, `idx_transactions_company_date`, `idx_transactions_company_date_currency`, `idx_transactions_company_matched`, `idx_transactions_company_type`, `idx_transactions_gl_account_id`, `idx_transactions_upload_id`, `unique_transaction_entry` (UNIQUE: `company_id, transaction_date, description, amount`)

**Triggerek:**
- `reset_paid_on_transaction_unmatch` (`BEFORE UPDATE OF matched_invoice_id`): Számla lekapcsolásakor vagy átkapcsolásakor (`NEW IS NULL OR NEW <> OLD`) rendezi az előző számla státuszát (`paid = false, transaction_id = NULL`), ha nincs egyéb kapcsolata (A-128).
- `trg_reset_paid_on_transaction_delete` (`BEFORE DELETE`): Tranzakció törlésekor rendezi a korábban hozzá kapcsolt számla státuszát (`paid = false, transaction_id = NULL`).

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

**Triggerek:**
- `trg_mark_invoice_paid_on_multi_match` (`AFTER INSERT`): Multi-match létrejöttekor beállítja a `paid = true` állapotot a számlán.
- `trg_reset_paid_on_multi_match_delete` (`BEFORE DELETE`): Multi-match törlésekor/lekapcsolásakor visszaállítja a számla állapotát (`paid = false, transaction_id = NULL`), amennyiben más tranzakció nem kapcsolódik hozzá (A-128).

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
| bank_statement_id | uuid | ✓ | NULL (A-119: PSD2 Open Bankingnél opcionális) |
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
| company_id | uuid | ✓ | NULL (FK → companies.id) |
| a8_transaction_id | text | ✓ | NULL (A-119: Aggreg8 PSD2 API egyedi azonosító) |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `bank_statement_id` → `bank_statements.id`, `company_id` → `companies.id`

**Indexek:** `idx_bank_transactions_a8_id`, `idx_bank_transactions_company_id`, `idx_bank_transactions_ordinal`, `idx_bank_transactions_statement_id`

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

### `payment_transfers`

> Kifizetésre előkészített és banki export állományba (GIRO/SEPA/OTP) gyűjtött utalási tételek.

**RLS:** ✅ | **Sorok:** Dinamikus

| Oszlop | Típus | Null | Default | Leírás |
|--------|-------|------|---------|--------|
| `id` | uuid | — | `gen_random_uuid()` | Elsődleges kulcs |
| `company_id` | uuid | — | — | FK → `companies.id` (CASCADE) |
| `bank_account_id` | uuid | ✓ | NULL | FK → `company_bank_accounts.id` (Indító bankszámla) |
| `partner_name` | text | — | — | Kedvezményezett neve |
| `partner_account` | text | — | — | Kedvezményezett bankszámlaszáma / IBAN |
| `amount` | decimal(15,2) | — | — | Átutalandó összeg |
| `currency` | text | — | `'HUF'` | Utalás devizaneme |
| `narrative` | text | ✓ | NULL | Átutalási közlemény |
| `invoice_ids` | uuid[] | — | — | Hivatkozott számlák azonosítói |
| `invoice_sources` | text[] | — | — | Számla források (`'nav'`, `'manual'`) |
| `status` | text | — | `'pending'` | Státusz: `'pending'`, `'sent'`, `'matched'` |
| `matched_transaction_id` | uuid | ✓ | NULL | FK → `transactions.id` (Beérkezett banki tétel) |
| `created_at` | timestamp with time zone | — | `now()` | Létrehozás ideje |
| `updated_at` | timestamp with time zone | — | `now()` | Módosítás ideje |

**FK:** `bank_account_id` → `company_bank_accounts.id`, `company_id` → `companies.id`, `matched_transaction_id` → `transactions.id`

---

### `transaction_rules`

> Automatikus tranzakció-kategorizálási és partner-felismerési szabályok.

**RLS:** ✅ | **Sorok:** Dinamikus

| Oszlop | Típus | Null | Default | Leírás |
|--------|-------|------|---------|--------|
| `id` | uuid | — | `gen_random_uuid()` | Elsődleges kulcs |
| `company_id` | uuid | — | — | FK → `companies.id` (CASCADE) |
| `pattern` | text | — | — | Keresési minta (leírásban vagy partnerben) |
| `match_field` | text | — | `'description'` | Mező: `'description'`, `'partner_name'` |
| `gl_account_id` | uuid | ✓ | NULL | FK → `gl_accounts.id` |
| `category_id` | uuid | ✓ | NULL | FK → `categories.id` |
| `is_active` | boolean | — | `true` | Aktív-e a szabály |
| `created_at` | timestamp with time zone | — | `now()` | Létrehozás ideje |

**FK:** `category_id` → `categories.id`, `company_id` → `companies.id`, `gl_account_id` → `gl_accounts.id`

---

### `aggreg8_consents`

> Aggreg8 PSD2 Open Banking felhasználói hozzájárulások (180 napos érvényesség, banki kapcsolat).

**RLS:** ✅ | **Sorok:** Dinamikus

| Oszlop | Típus | Null | Default | Leírás |
|--------|-------|------|---------|--------|
| `id` | uuid | — | `gen_random_uuid()` | Elsődleges kulcs |
| `company_id` | uuid | — | — | FK → `companies.id` (CASCADE) |
| `info_sharing_consent_id` | text | — | — | Aggreg8 egyedi hozzájárulás azonosító (UNIQUE) |
| `a8_user_id` | text | ✓ | NULL | Aggreg8 felhasználó azonosító |
| `bank_id` | text | ✓ | NULL | Bank kódja / neve (pl. OTP, Erste) |
| `status` | text | — | `'active'` | Státusz: `'active'`, `'expired'`, `'deleted'` |
| `valid_until` | timestamp with time zone | ✓ | NULL | 180 napos PSD2 engedély lejárata |
| `access_token` | text | ✓ | NULL | Banki hozzáférési token |
| `refresh_token` | text | ✓ | NULL | Banki frissítő token |
| `token_expires_at` | timestamp with time zone | ✓ | NULL | Token érvényességi ideje |
| `metadata` | jsonb | ✓ | `'{}'::jsonb` | További banki metaadatok |
| `created_at` | timestamp with time zone | — | `now()` | Létrehozás ideje |
| `updated_at` | timestamp with time zone | — | `now()` | Módosítás ideje |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_aggreg8_consents_company`, `idx_aggreg8_consents_consent_id`

---

### `aggreg8_accounts`

> Az Aggreg8-on keresztül csatlakoztatott bankszámlák és egyenlegek.

**RLS:** ✅ | **Sorok:** Dinamikus

| Oszlop | Típus | Null | Default | Leírás |
|--------|-------|------|---------|--------|
| `id` | uuid | — | `gen_random_uuid()` | Elsődleges kulcs |
| `company_id` | uuid | — | — | FK → `companies.id` (CASCADE) |
| `consent_id` | uuid | — | — | FK → `aggreg8_consents.id` (CASCADE) |
| `account_id` | text | — | — | Aggreg8 belső számlaazonosító |
| `account_number` | text | ✓ | NULL | Bankszámlaszám / IBAN |
| `currency` | text | — | `'HUF'` | Számla devizaneme |
| `account_name` | text | ✓ | NULL | Számla elnevezése |
| `balance` | numeric | ✓ | NULL | Aktuális könyvelt egyenleg |
| `available_balance` | numeric | ✓ | NULL | Rendelkezésre álló egyenleg |
| `last_synced_at` | timestamp with time zone | ✓ | NULL | Utolsó sikeres szinkronizáció ideje |
| `created_at` | timestamp with time zone | — | `now()` | Létrehozás ideje |
| `updated_at` | timestamp with time zone | — | `now()` | Módosítás ideje |

**FK:** `company_id` → `companies.id`, `consent_id` → `aggreg8_consents.id`

**Indexek:** `idx_aggreg8_accounts_company`, `idx_aggreg8_accounts_consent`, `unique_aggreg8_account_per_consent`

---

### `aggreg8_settings`

> Rendszerszintű Aggreg8 AIS partner hitelesítő token gyorsítótár.

**RLS:** ✅ | **Sorok:** 1-2 (sandbox / prod)

| Oszlop | Típus | Null | Default | Leírás |
|--------|-------|------|---------|--------|
| `id` | uuid | — | `gen_random_uuid()` | Elsődleges kulcs |
| `environment` | text | — | `'sandbox'` | Környezet: `'sandbox'` vagy `'prod'` |
| `customer_token` | text | ✓ | NULL | Érvényes partner customer token |
| `token_expires_at` | timestamp with time zone | ✓ | NULL | Partner token lejárati ideje (~175 perc) |
| `created_at` | timestamp with time zone | — | `now()` | Létrehozás ideje |
| `updated_at` | timestamp with time zone | — | `now()` | Módosítás ideje |

