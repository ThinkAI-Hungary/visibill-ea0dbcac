# 📘 eaisyBooks — Alap

> Könyvelő-ügyfél hozzárendelések, adóprofil, határidők, hiányzó dokumentumok, portál tokenek, kommunikáció.

**Táblák ebben a csoportban:** 15

---

### `accounty_assignments`

> Könyvelő-felhasználó ↔ ügyfélcég hozzárendelés. Senior = teljes rálátás, Junior = csak saját ügyfelek.

**RLS:** ✅ | **Sorok:** ~61

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| accountant_user_id | uuid | — |  |
| company_id | uuid | — |  |
| accounting_firm_id | uuid | ✓ |  |
| role | text | — | `'könyvelő'::text` |
| is_primary | boolean | ✓ | `false` |
| assigned_at | timestamp with time zone | ✓ | `now()` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |
| kanban_status | text | ✓ | `'aktiv'::text` |
| source | text | — | `'manual'::text` |
| is_main_accountant | boolean | — | `false` |

**FK:** `accountant_user_id` → `auth.users.id`, `accounting_firm_id` → `companies.id`, `company_id` → `companies.id`

**Indexek:** `accounty_assignments_accountant_user_id_company_id_key`, `idx_accounty_assignments_accountant`, `idx_accounty_assignments_company`, `idx_accounty_assignments_firm`, `idx_one_main_accountant_per_company`

---

### `accounty_tax_profiles`

> Cég adózási profil: ÁFA gyakoriság, járulék gyakoriság, KATA/KIVA státusz. 1:1 kapcsolat a companies táblával.

**RLS:** ✅ | **Sorok:** ~28

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| vat_frequency | text | ✓ | `'monthly'::text` |
| contribution_frequency | text | ✓ | `'monthly'::text` |
| is_kata | boolean | ✓ | `false` |
| is_kiva | boolean | ✓ | `false` |
| tax_group | text | ✓ |  |
| nav_synced | boolean | ✓ | `false` |
| last_nav_sync_at | timestamp with time zone | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |
| has_payroll | boolean | ✓ | `false` |
| payroll_settings | jsonb | ✓ | `'{}'::jsonb` |

**FK:** `company_id` → `companies.id`

**Indexek:** `accounty_tax_profiles_company_id_key`

---

### `accounty_deadlines`

> Könyvelési és adóügyi határidők cégenként. Automatikusan generálódnak az accounty_tax_profiles alapján, vagy manuálisan hozzáadhatóak.

**RLS:** ✅ | **Sorok:** ~692

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| deadline_type | text | — |  |
| title | text | ✓ |  |
| due_date | date | — |  |
| status | text | ✓ | `'pending'::text` |
| is_manual_override | boolean | ✓ | `false` |
| completed_at | timestamp with time zone | ✓ |  |
| completed_by | uuid | ✓ |  |
| notes | text | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `completed_by` → `auth.users.id`

**Indexek:** `idx_accounty_deadlines_company`, `idx_accounty_deadlines_completed_by`, `idx_accounty_deadlines_due_date`, `idx_accounty_deadlines_status`

---

### `accounty_missing_items`

> Az Accounty modul központi entitása: detektált hiányzó dokumentumok és tételek. Minden detektor (NAV, Bank, Bér) ide ír.

**RLS:** ✅ | **Sorok:** ~5893

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| category | text | — |  |
| title | text | — |  |
| subtitle | text | ✓ |  |
| source | text | — |  |
| priority | text | ✓ | `'medium'::text` |
| status | text | ✓ | `'open'::text` |
| details | text | ✓ |  |
| amount | numeric | ✓ |  |
| invoice_number | text | ✓ |  |
| item_date | date | ✓ |  |
| resolve_route | text | ✓ |  |
| nav_invoice_id | uuid | ✓ |  |
| transaction_id | uuid | ✓ |  |
| notification_count | integer | ✓ | `0` |
| last_notified_at | timestamp with time zone | ✓ |  |
| escalation_level | integer | ✓ | `0` |
| is_ignored | boolean | ✓ | `false` |
| ignored_at | timestamp with time zone | ✓ |  |
| ignored_by | uuid | ✓ |  |
| resolved_at | timestamp with time zone | ✓ |  |
| resolved_by | uuid | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |
| uploaded_files | ARRAY | ✓ | `'{}'::text[]` |

**FK:** `company_id` → `companies.id`, `ignored_by` → `auth.users.id`, `nav_invoice_id` → `nav_invoices.id`, `resolved_by` → `auth.users.id`, `transaction_id` → `transactions.id`

**Indexek:** `idx_accounty_missing_items_category`, `idx_accounty_missing_items_company`, `idx_accounty_missing_items_ignored_by`, `idx_accounty_missing_items_nav_invoice`, `idx_accounty_missing_items_resolved_by`, `idx_accounty_missing_items_source`, `idx_accounty_missing_items_status`, `idx_accounty_missing_items_transaction`

---

### `accounty_communication_preferences`

> Ügyfélcég kommunikációs beállításai: értesítési csatornák, gyakoriság, GDPR opt-in. 1:1 kapcsolat a companies táblával.

**RLS:** ✅ | **Sorok:** ~1

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| contact_name | text | ✓ |  |
| contact_email | text | ✓ |  |
| contact_phone | text | ✓ |  |
| channel_email | boolean | ✓ | `true` |
| channel_viber | boolean | ✓ | `false` |
| channel_sms | boolean | ✓ | `false` |
| channel_phone | boolean | ✓ | `false` |
| preferred_language | text | ✓ | `'hu'::text` |
| reminder_frequency | text | ✓ | `'normal'::text` |
| auto_reminder | boolean | ✓ | `true` |
| gdpr_opted_in | boolean | ✓ | `false` |
| gdpr_opted_in_at | timestamp with time zone | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`

**Indexek:** `accounty_communication_preferences_company_id_key`

---

### `accounty_portal_tokens`

> Magic Link tokenek az ügyfélportálhoz. Bejelentkezés nélküli hozzáférés a hiányzó dokumentumok feltöltéséhez.

**RLS:** ✅ | **Sorok:** ~84

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| token | text | — |  |
| created_by | uuid | — |  |
| expires_at | timestamp with time zone | — |  |
| is_active | boolean | ✓ | `true` |
| last_used_at | timestamp with time zone | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| visit_count | integer | ✓ | `0` |
| last_accessed_at | timestamp with time zone | ✓ |  |
| requested_item_ids | ARRAY | ✓ | `'{}'::uuid[]` |

**FK:** `company_id` → `companies.id`, `created_by` → `auth.users.id`

**Indexek:** `accounty_portal_tokens_token_key`, `idx_accounty_portal_tokens_active`, `idx_accounty_portal_tokens_company`, `idx_accounty_portal_tokens_created_by`, `idx_accounty_portal_tokens_token`

---

### `accounty_audit_log`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | ✓ |  |
| user_name | text | ✓ |  |
| action | text | — |  |
| entity_type | text | — |  |
| entity_id | text | ✓ |  |
| company_id | uuid | ✓ |  |
| company_name | text | ✓ |  |
| details | jsonb | ✓ | `'{}'::jsonb` |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_audit_log_action`, `idx_audit_log_company_id`, `idx_audit_log_created_at`, `idx_audit_log_user`, `idx_audit_log_user_id`

---

### `accounty_messages`

**RLS:** ✅ | **Sorok:** ~3

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| sender_user_id | uuid | ✓ |  |
| sender_name | text | — |  |
| message | text | — |  |
| is_from_client | boolean | ✓ | `false` |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `sender_user_id` → `auth.users.id`

**Indexek:** `idx_accounty_messages_company`, `idx_accounty_messages_created`, `idx_accounty_messages_sender_user_id`

---

### `accounty_uploads`

**RLS:** ✅ | **Sorok:** ~3

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| missing_item_id | uuid | ✓ |  |
| file_name | text | — |  |
| file_path | text | ✓ |  |
| file_type | text | ✓ |  |
| file_size_bytes | bigint | ✓ |  |
| storage_bucket | text | ✓ | `'accounty_uploads'::text` |
| upload_source | text | ✓ | `'portal'::text` |
| status | text | — | `'pending'::text` |
| error_message | text | ✓ |  |
| uploaded_by | uuid | ✓ |  |
| portal_token | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| completed_at | timestamp with time zone | ✓ |  |

**FK:** `company_id` → `companies.id`, `missing_item_id` → `accounty_missing_items.id`, `uploaded_by` → `auth.users.id`

**Indexek:** `idx_accounty_uploads_company`, `idx_accounty_uploads_missing_item`, `idx_accounty_uploads_status`, `idx_accounty_uploads_uploaded_by`

---

### `accounty_documents`

**RLS:** ✅ | **Sorok:** ~8

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| employee_id | uuid | ✓ |  |
| title | text | — |  |
| doc_type | text | — | `'other'::text` |
| status | text | — | `'pending'::text` |
| file_url | text | ✓ | `''::text` |
| period | text | ✓ | `''::text` |
| generated_at | timestamp with time zone | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `employee_id` → `accounty_employees.id`

---

### `accounty_templates`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| category | text | — |  |
| name | text | — |  |
| subject | text | ✓ |  |
| body_markdown | text | — | `''::text` |
| body_html | text | ✓ |  |
| variables | jsonb | ✓ | `'[]'::jsonb` |
| version | integer | — | `1` |
| is_active | boolean | — | `true` |
| created_by | uuid | ✓ |  |
| updated_at | timestamp with time zone | — | `now()` |
| created_at | timestamp with time zone | — | `now()` |

**FK:** `created_by` → `auth.users.id`

---

### `accounty_template_versions`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| template_id | uuid | — |  |
| version | integer | — |  |
| body_markdown | text | — |  |
| body_html | text | ✓ |  |
| subject | text | ✓ |  |
| changed_by | uuid | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |

**FK:** `changed_by` → `auth.users.id`, `template_id` → `accounty_templates.id`

---

### `accounty_gdpr_requests`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| employee_id | uuid | ✓ |  |
| employee_name | text | — |  |
| request_type | text | — |  |
| status | text | — | `'pending'::text` |
| notes | text | ✓ |  |
| requested_at | timestamp with time zone | — | `now()` |
| handled_by | uuid | ✓ |  |
| completed_at | timestamp with time zone | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `handled_by` → `auth.users.id`

---

### `accounty_email_preferences`

> Felhasználónkénti email értesítési preferenciák az eaisyBooks modulhoz. 1:1 user_id. Upsert alapú mentés a frontendről.

**RLS:** ✅ | **Sorok:** ~5

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| missing_invoice_alert | boolean | — | `true` |
| deadline_reminder | boolean | — | `true` |
| client_status_change | boolean | — | `false` |
| approval_request | boolean | — | `true` |
| weekly_report | boolean | — | `true` |
| monthly_report | boolean | — | `false` |
| created_at | timestamptz | — | `now()` |
| updated_at | timestamptz | — | `now()` |

**FK:** `user_id` → `auth.users.id` ON DELETE CASCADE

**Indexek:** `accounty_email_preferences_pkey`, `accounty_email_preferences_user_id_key` (UNIQUE)

**Trigger:** `set_accounty_email_prefs_updated_at` → `extensions.moddatetime(updated_at)`

---

### `accounty_push_preferences`

> Felhasználónkénti push értesítési preferenciák az eaisyBooks modulhoz (Web Push pop-upok). 1:1 user_id. Upsert alapú mentés a frontendről.

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| enabled | boolean | — | `false` |
| missing_invoice_alert | boolean | — | `false` |
| deadline_reminder | boolean | — | `false` |
| client_status_change | boolean | — | `false` |
| approval_request | boolean | — | `false` |
| critical_alerts | boolean | — | `false` |
| created_at | timestamptz | — | `now()` |
| updated_at | timestamptz | — | `now()` |

**FK:** `user_id` → `auth.users.id` ON DELETE CASCADE

**Indexek:** `accounty_push_preferences_pkey`, `accounty_push_preferences_user_id_key` (UNIQUE)

**Trigger:** `set_accounty_push_prefs_updated_at` → custom plpgsql function

---

### `accounty_push_subscriptions`

> A böngészős Web Push értesítések feliratkozási adatait tárolja felhasználónként. Egy felhasználónak több eszköze (böngészője) is lehet.

**RLS:** ✅ | **Sorok:** Dinamikus

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| endpoint | text | — |  |
| auth_key | text | — |  |
| p256dh_key | text | — |  |
| created_at | timestamptz | — | `now()` |
| updated_at | timestamptz | — | `now()` |

**FK:** `user_id` → `auth.users.id` ON DELETE CASCADE

**Indexek:** `accounty_push_subscriptions_pkey`, `accounty_push_subscriptions_endpoint_key` (UNIQUE)

**Trigger:** `set_accounty_push_subs_updated_at` → custom plpgsql function

---
