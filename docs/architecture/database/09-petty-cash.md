# 🏦 Házipénztár

> Házipénztár pénztárgépek, nyitó egyenlegek, tételek, szabályok.

**Táblák ebben a csoportban:** 8

---

### `petty_cash_registers`

**RLS:** ✅ | **Sorok:** ~2

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| name | text | — |  |
| location | text | ✓ |  |
| currencies | ARRAY | — | `'{HUF}'::text[]` |
| is_default | boolean | — | `false` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

**Indexek:** `idx_pcr_company`, `idx_pcr_one_default`

---

### `petty_cash_opening_balances`

**RLS:** ✅ | **Sorok:** ~2

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| register_id | uuid | — |  |
| currency | text | — | `'HUF'::text` |
| amount | numeric | — | `0` |
| start_date | date | ✓ |  |

**FK:** `register_id` → `petty_cash_registers.id`

**Indexek:** `petty_cash_opening_balances_register_id_currency_key`

---

### `petty_cash_entries`

**RLS:** ✅ | **Sorok:** ~34

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| register_id | uuid | — |  |
| entry_date | date | — |  |
| description | text | ✓ |  |
| amount | numeric | — |  |
| currency | text | — | `'HUF'::text` |
| source_type | text | — |  |
| source_id | uuid | ✓ |  |
| source_table | text | ✓ |  |
| routed_by | text | — | `'default'::text` |
| partner_id | uuid | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`, `register_id` → `petty_cash_registers.id`, `partner_id` → `partners.id`

**Indexek:** `idx_pce_company_date`, `idx_pce_register_date`, `idx_pce_source`

**Kapcsolódó RPC — Számlakiegyenlítés (`settle_invoices_via_petty_cash`):**
A `settle_invoices_via_petty_cash(p_company_id, p_register_id, p_entry_date, p_invoice_ids, p_description)` eljárás kétirányú:
- **Kimenő (vevői) számlák:** `+brutto_vegosszeg` (pénztári bevétel).
- **Bejövő (szállítói) számlák:** `-brutto_vegosszeg` (pénztári kiadás).
- Egyedi számla esetén a `partner_id`-t intelligensen feloldja a `public.partners` táblából az adószám (`adoszam`) vagy partnernév (`partner_nev`) alapján (mivel a manuális `invoices` táblában nincs fizikai `partner_id` oszlop), beállítja a `source_type = 'invoice_settlement'` értéket, és atomi tranzakcióban a számlákat `fizetve = true` állapotra állítja. Lásd [A-155](../decisions/A-155-petty-cash-inbound-settlement-and-period-closing.md).

---

### `petty_cash_routing_rules`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| target_register_id | uuid | — |  |
| priority | integer | — | `0` |
| match_currency | text | ✓ |  |
| match_source_type | text | ✓ |  |
| match_description_pattern | text | ✓ |  |
| match_partner_pattern | text | ✓ |  |
| is_active | boolean | — | `true` |
| created_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `target_register_id` → `petty_cash_registers.id`

**Indexek:** `idx_pcrr_company`

---

### `hp_settings`

**RLS:** ✅ | **Sorok:** ~2

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| created_by | uuid | ✓ |  |
| start_date | date | ✓ |  |
| opening_balance | numeric | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

**Indexek:** `idx_hp_settings_created_by`, `unique_company_settings`

---

### `opg_cash_registers`

> NAV Online Pénztárgépek (OPG) törzsadatai, AP kód nyilvántartás és házipénztár illesztés.

**RLS:** ✅ | **Sorok:** ~5

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| ap_code | text | — |  |
| name | text | — |  |
| location | text | ✓ |  |
| status | text | — | `'active'::text` |
| petty_cash_register_id | uuid | ✓ |  |
| cash_booking_mode | text | — | `'daily_z_summary'::text` |
| sync_interval_minutes | integer | — | `60` |
| last_successful_sync_at | timestamp with time zone | ✓ |  |
| last_failed_sync_at | timestamp with time zone | ✓ |  |
| last_error_message | text | ✓ |  |
| metadata | jsonb | ✓ | `'{}'::jsonb` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `petty_cash_register_id` → `petty_cash_registers.id`, `created_by` → `auth.users.id`

**Indexek:** `idx_opg_cash_registers_company`, `idx_opg_cash_registers_status`, `idx_opg_cash_registers_pcr`, `uq_opg_cash_registers_company_ap`

---

### `opg_transactions`

> Pénztárgépi nyugták, egyszerűsített számlák, Z-zárások és sztornó bizonylatok tételei.

**RLS:** ✅ | **Sorok:** ~100

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| opg_id | uuid | — |  |
| external_transaction_id | text | — |  |
| receipt_number | text | — |  |
| transaction_date | date | — |  |
| transaction_time | time | — |  |
| transaction_type | text | — | `'receipt'::text` |
| total_gross_amount | numeric(15,2) | — | `0` |
| cash_amount | numeric(15,2) | — | `0` |
| card_amount | numeric(15,2) | — | `0` |
| szep_card_amount | numeric(15,2) | — | `0` |
| voucher_amount | numeric(15,2) | — | `0` |
| other_payment_amount | numeric(15,2) | — | `0` |
| payment_method_breakdown | jsonb | — | `'{"cash": 0, "card": 0, "szep_card": 0, "voucher": 0, "other": 0}'::jsonb` |
| vat_breakdown | jsonb | — | `'{}'::jsonb` |
| processing_status | text | — | `'new'::text` |
| cash_entry_id | uuid | ✓ |  |
| source_payload | jsonb | ✓ |  |
| error_message | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `opg_id` → `opg_cash_registers.id`, `cash_entry_id` → `petty_cash_entries.id`

**Indexek:** `idx_opg_transactions_company_date`, `idx_opg_transactions_opg_date`, `idx_opg_transactions_status`, `idx_opg_transactions_cash_entry`, `idx_opg_transactions_external_id`, `uq_opg_transactions_company_external`

---

### `opg_sync_logs`

> OPG M2M és manuális szinkronizációs audit napló.

**RLS:** ✅ | **Sorok:** ~50

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| opg_id | uuid | ✓ |  |
| started_at | timestamp with time zone | — | `now()` |
| finished_at | timestamp with time zone | ✓ |  |
| period_from | date | ✓ |  |
| period_to | date | ✓ |  |
| records_fetched | integer | — | `0` |
| records_new | integer | — | `0` |
| records_duplicated | integer | — | `0` |
| records_errors | integer | — | `0` |
| status | text | — | `'running'::text` |
| error_message | text | ✓ |  |
| created_by | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `opg_id` → `opg_cash_registers.id`, `created_by` → `auth.users.id`

**Indexek:** `idx_opg_sync_logs_company_time`, `idx_opg_sync_logs_opg`

---

