# 📊 Főkönyv (General Ledger)

> Főkönyvi számlák, naplókönyvelés, GL import/audit, ÁFA kódok.

**Táblák ebben a csoportban:** 10

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
| currency | text | ✓ | `NULL` |
| is_multicurrency | boolean | — | `false` |
| requires_partner | boolean | — | `false` |
| requires_project | boolean | — | `false` |
| requires_cost_center | boolean | — | `false` |
| is_reconcilable | boolean | — | `false` |
| is_monthly_fx_reval | boolean | — | `false` |
| created_at | timestamp with time zone | ✓ | `now()` |
| updated_at | timestamp with time zone | ✓ | `now()` |
| company_id | uuid | ✓ |  |

**FK:** `company_id` → `companies.id`, `parent_id` → `gl_accounts.id`, `preset_id` → `chart_of_accounts_presets.id`

**Indexek:** `gl_accounts_preset_id_gl_number_key`, `idx_gl_accounts_company_id`, `idx_gl_accounts_parent_id`, `idx_gl_accounts_preset_id`, `idx_gl_accounts_multicurrency`, `idx_gl_accounts_requires_partner`, `idx_gl_accounts_requires_project`, `idx_gl_accounts_is_reconcilable`, `idx_gl_accounts_is_monthly_fx_reval`

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

**Kapcsolódó RPC-k és Életciklus Műveletek:**
- `check_chart_of_accounts_preset_usage(p_preset_id UUID)`: Függőségek és hivatkozások felmérése a sablonhoz tartozó számlákon (`acc_journal_lines`, `transactions`, `invoices`, `nav_invoices`, `fixed_assets`, `annual_reports`, `accrual_entries`).
- `delete_chart_of_accounts_preset(p_preset_id UUID, p_target_preset_id UUID)`: Tranzakciós törlés és automatikus tétel-átkötés (remapping) az azonos főkönyvi számú célszámlákra, szigorú immutability és multi-tenancy védelemmel (részletesen: [A-090](../decisions/A-090-safe-chart-of-accounts-preset-deletion-and-remapping.md)).

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
| legacy_code | text | ✓ | NULL | Alternatív / korábbi szoftverekből örökölt ÁFA kód (pl. 27, FAD, 05, TAM), lásd [A-135](../decisions/A-135-dual-vat-code-system-and-reverse-charge-recognition.md) |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_vat_codes_company`, `vat_codes_company_id_code_key`

---

### `gl_view_templates`

**RLS:** ✅ | **Sorok:** dinamikus

> Főkönyvi nézetválasztó, egyedi oszlopkonfigurációk és beépített/feltöltött nézetsablonok (A-248).

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | text | — | `gen_random_uuid()::text` |
| company_id | uuid | ✓ | |
| accounting_firm_id | uuid | ✓ | |
| name | text | — | |
| template_type | text | — | `'custom'` |
| description | text | ✓ | |
| columns | jsonb | — | `'[]'::jsonb` |
| source_file_name | text | ✓ | |
| created_by | uuid | ✓ | |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `accounting_firm_id` → `companies.id`, `created_by` → `auth.users.id`

**Indexek:** `idx_gl_view_templates_company_id`, `idx_gl_view_templates_type`

---

## ⚙️ Főkönyvi Lekérdező RPC Függvények & Nyitó Átgördítés (A-258)

A főkönyvi kivonatok és kartonok számítását PostgreSQL tárolt eljárások végzik, amelyek a Számviteli Törvény (Sztv.) folytonossági elvének megfelelően kezelik a nyitó és időszaki egyenlegeket:

### `get_gl_balances` / `get_gl_balances_json`
- **Szignatúra:** `(p_company_id uuid, p_start_date date, p_end_date date, p_include_drafts boolean)`
- **Biztonság:** `SECURITY DEFINER`, védve: `public.check_company_access(p_company_id)`
- **Működés:**
  - Aggregálja a főkönyvi számlák Tartozik/Követel forgalmát és számítja a nyitó és záró egyenlegeket.
  - **Évközi Nyitó Átgördítés (Rollforward — A-258):**
    - Ha `p_start_date` nem az üzleti év első napja (pl. 2026-10-01), az 1-4. számlaosztályok mérlegszámláira a rendszer a tárgyév kezdő napjától (`date_trunc('year', p_start_date)::date`) a lekérdezés kezdőnapjáig terjedő nyitó (`NYITO`) tételeket automatikusan beszámítja a nyitó egyenlegbe (`opening_debit` / `opening_credit`).
    - Az 5-9. eredményszámlák (költségek, ráfordítások, bevételek) kizárólag az adott évközi időszak tételeit mutatják, nyitó átgördítés nélkül (induló egyenleg = 0).
  - A `get_gl_balances_json` verzió optimalizált JSON struktúrában adja vissza az eredményt a kliensoldali hierarchikus fanézet számára.

### `get_gl_categorized_items`
- **Szignatúra:** `(p_company_id uuid, p_start_date date, p_end_date date, p_gl_account_id uuid DEFAULT NULL, ...)`
- **Biztonság:** `SECURITY DEFINER`, védve: `public.check_company_access(p_company_id)`
- **Működés:**
  - Tételes főkönyvi és analitikai listázás bizonylatszintű sorbontással.
  - Támogatja a rollforward nyitó tételek tételes megjelenítését és a göngyölített egyenlegek precíz kalkulációját.

### `acc_cascade_gl_account_settings` (A-265)
- **Szignatúra:** `(p_account_id uuid, p_company_id uuid, p_requires_partner boolean, p_requires_project boolean, p_requires_cost_center boolean, p_is_reconcilable boolean, p_is_monthly_fx_reval boolean)`
- **Biztonság:** `SECURITY DEFINER`
- **Működés:**
  - Csoportszámla beállításainak atomi kaszkádolása az alá tartozó összes analitikus alszámlára számlaszám-prefix (`LIKE parent_gl_number || '%'`) és `parent_id` alapján. Visszaadja a frissített alszámlák számát.

### `calculate_monthly_fx_revaluation` / `post_monthly_fx_revaluation` (A-265, BDR-078)
- **Szignatúra:**
  - `calculate_monthly_fx_revaluation(p_company_id uuid, p_cutoff_date date, p_user_id uuid)` -> `jsonb`
  - `post_monthly_fx_revaluation(p_company_id uuid, p_cutoff_date date, p_user_id uuid, p_selected_items jsonb, p_journal_id uuid)` -> `jsonb`
- **Biztonság:** `SECURITY DEFINER`
- **Működés:**
  - A fordulónapi hivatalos MNB devizaárfolyamok alapján kalkulálja a nyitott devizás követelések (316), kötelezettségek (4542), devizaszámlák (386) és devizapénztárak (382) nem realizált árfolyamkülönbözetét.
  - A feladás automatikusan kiállít és lekönyvel egy összevont vegyes könyvelési bizonylatot a cég `ARF` (vagy `VE`) naplójába az Sztv. 60. § szerint (nyereség: K 976, veszteség: T 876).
