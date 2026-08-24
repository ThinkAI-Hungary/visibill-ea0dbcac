# 🛠️ Platform & Üzemeltetés

> Hibalogok, audit trail, LLM költségek, API kulcsok, email aliasok, devizaárfolyamok, visszajelzések.

**Táblák ebben a csoportban:** 9

---

### `app_error_logs`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| created_at | timestamp with time zone | — | `now()` |
| user_id | uuid | ✓ |  |
| company_id | uuid | ✓ |  |
| error_type | text | — |  |
| severity | text | ✓ | `'error'::text` |
| component | text | ✓ |  |
| action | text | ✓ |  |
| message | text | — |  |
| stack_trace | text | ✓ |  |
| context | jsonb | ✓ | `'{}'::jsonb` |
| url | text | ✓ |  |
| user_agent | text | ✓ |  |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_app_error_logs_company`, `idx_app_error_logs_created`, `idx_app_error_logs_severity`, `idx_app_error_logs_type`, `idx_app_error_logs_user`

---

### `audit_logs`

**RLS:** ✅ | **Sorok:** ~5956

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| user_id | uuid | ✓ |  |
| action | USER-DEFINED | — |  |
| entity | USER-DEFINED | — |  |
| entity_name | text | ✓ |  |
| details | jsonb | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_audit_logs_company_id`, `idx_audit_logs_created_at`, `idx_audit_logs_user_id`

**`audit_action_type` enum értékek:** `feltöltés`, `módosítás`, `törlés`, `párosítás`, `aktiválás`, `létrehozás`, `átirányítás`

> **`átirányítás`** (2026-07-02): A worker `company_router.py` INSERT-eli, amikor egy multi-company user számláját
> adószám alapján automatikusan átmozgatja egy másik céghez. A `details` JSONB tartalmazza:
> `routing_reason`, `from_company_id`, `from_company_name`, `to_company_id`, `to_company_name`, `bizonylatsorszam`.

---

### `llm_koltsegek`

> LLM token-használat és költségek nyomonkövetése fájl-feldolgozásonként

**RLS:** ✅ | **Sorok:** ~1275

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| created_at | timestamp with time zone | — | `now()` |
| file_name | text | — |  |
| pipeline | text | — |  |
| upload_id | uuid | ✓ |  |
| user_id | uuid | ✓ |  |
| company_id | uuid | ✓ |  |
| input_tokens | integer | — | `0` |
| output_tokens | integer | — | `0` |
| total_tokens | integer | ✓ |  |
| model_name | text | — |  |
| estimated_cost_usd | numeric | ✓ |  |
| llm_calls | integer | — | `1` |
| processing_duration_ms | integer | ✓ |  |
| worker_id | text | ✓ |  |
| metadata | jsonb | ✓ | `'{}'::jsonb` |

**Indexek:** `idx_llm_koltsegek_company`, `idx_llm_koltsegek_created`, `idx_llm_koltsegek_model`, `idx_llm_koltsegek_pipeline`, `idx_llm_koltsegek_metadata` (GIN)

> **Megjegyzés (2026-08-24):** A `metadata` (`jsonb`) oszlop és a GIN index (ld. [A-041](../decisions/A-041-mailgun-concurrent-dedup.md), `20260824_add_metadata_to_llm_koltsegek.sql`) a Mailgun Webhook Layer 2 idempotency ellenőrzéséhez került bevezetésre (`mailgun_message_id` audit tracking).
> **Megjegyzés (2026-06-28):** A `model_name` mező korábban csak a fő LLM modellt (pl. `deepseek/deepseek-chat`) tartalmazta. 2026-06-28-tól a Vision OCR költségek (gpt-4o) is trackelve vannak a `VisionCostAccumulator` → `drain_vision_costs()` mechanizmuson keresztül. Egy rekordban a `model_name` az elsődleges modellt mutatja, de az `estimated_cost_usd` **per-model árazással** számolódik (DeepSeek + gpt-4o külön). Ld. [A-007](../decisions/A-007-llm-strategy.md), [Worker ADR-026](../../../../worker/docs/DECISIONS.md).

---

### `feedback`

**RLS:** ✅ | **Sorok:** ~15

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| company_id | uuid | ✓ |  |
| company_name | text | ✓ |  |
| type | text | — |  |
| message | text | — |  |
| user_email | text | ✓ |  |
| user_name | text | ✓ |  |
| status | text | — | `'new'::text` |
| slack_sent | boolean | — | `false` |
| slack_sent_at | timestamp with time zone | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| ticket_number | text | ✓ |  |
| priority | text | ✓ | `'medium'::text` |
| page_url | text | ✓ |  |
| attachments | ARRAY | ✓ |  |
| service | text | ✓ |  |
| assigned_to | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`, `assigned_to` → `auth.users.id`

**Indexek:** `idx_feedback_company_id`, `idx_feedback_status`, `idx_feedback_user_id`

---

### `daily_exchange_rates`

**RLS:** ✅ | **Sorok:** ~4706

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| rate_date | date | — |  |
| currency | text | — |  |
| rate | numeric | — |  |
| source | text | — | `'MNB'::text` |
| created_at | timestamp with time zone | — | `now()` |

**Indexek:** `daily_exchange_rates_rate_date_currency_source_key`, `idx_der_date_currency`

---

### `api_keys`

> API kulcsok külső integrációkhoz (OpenClaw). A nyers kulcs soha nem tárolódik, csak SHA-256 hash.

**RLS:** ✅ | **Sorok:** ~1

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | ✓ |  |
| created_by | uuid | ✓ |  |
| key_hash | text | — |  |
| key_prefix | text | — |  |
| name | text | — | `'API Key'::text` |
| scope | text | — | `'read'::text` |
| is_active | boolean | — | `true` |
| last_used_at | timestamp with time zone | ✓ |  |
| expires_at | timestamp with time zone | ✓ |  |
| rate_limit_per_minute | integer | — | `100` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_api_keys_company_id`, `idx_api_keys_key_hash`

---

### `email_aliases`

**RLS:** ✅ | **Sorok:** ~12

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| alias_email | text | — |  |
| company_name | text | — |  |
| status | text | — | `'active'::text` |
| mailgun_route_id | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| verified_at | timestamp with time zone | ✓ |  |
| company_id | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `email_aliases_alias_email_key`, `email_aliases_alias_email_unique`, `email_aliases_user_id_company_name_key`, `idx_email_aliases_company_id`

---

### `outgoing_emails`

**RLS:** ✅ | **Sorok:** ~21

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | ✓ |  |
| company_id | text | — |  |
| company_name | text | — |  |
| recipient_email | text | — |  |
| subject | text | — |  |
| category | text | — | `'normal'::text` |
| message_id | text | ✓ |  |
| portal_link | text | ✓ |  |
| missing_item_ids | jsonb | ✓ | `'[]'::jsonb` |
| status | text | — | `'sent'::text` |
| error_message | text | ✓ |  |
| resend_id | text | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `user_id` → `auth.users.id`

**Indexek:** `idx_outgoing_emails_company_id`, `idx_outgoing_emails_created_at`, `idx_outgoing_emails_user_id`

---

### `dunning_sends`

**RLS:** ✅ | **Sorok:** ~7

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| company_id | uuid | — |  |
| debtor_company_name | text | — |  |
| debtor_tax_number | text | ✓ |  |
| debtor_email | text | — |  |
| invoice_ids | ARRAY | — | `'{}'::text[]` |
| sent_at | timestamp with time zone | — | `now()` |
| status | text | — | `'sent'::text` |
| error_message | text | ✓ |  |
| total_amount | numeric | ✓ | `0` |
| currency | text | ✓ | `'HUF'::text` |
| created_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_dunning_sends_company_id`, `idx_dunning_sends_user_id`

---

