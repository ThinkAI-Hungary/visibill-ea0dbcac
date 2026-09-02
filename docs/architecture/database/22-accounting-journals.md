# 📄 Könyvelési Naplók (Accounting Journals)

> Kettős könyvviteli naplók, tétel fejek és sorok, ugrásmentes folyósorszámozás, zárt időszakok és esemény audit naplózás.

**Táblák ebben a csoportban:** 6

---

### `acc_journals`

**RLS:** ✅ | **Sorok:** Cégenként ~9 alapértelmezett napló

| Oszlop | Típus | Null | Default | Leírás |
|--------|-------|------|---------|--------|
| `id` | uuid | — | `gen_random_uuid()` | Elsődleges kulcs |
| `company_id` | uuid | — | — | FK → `companies.id` (CASCADE) |
| `code` | varchar(8) | — | — | Napló kódja (pl. `V`, `SZ`, `B1`, `P1`, `VE`, `BÉR`, `NY`, `Z`) |
| `name` | text | — | — | Napló megnevezése |
| `type` | varchar(32) | — | — | Típus: `CUSTOMER`, `SUPPLIER`, `BANK`, `PETTY_CASH`, `MIXED`, `SYSTEM`, `OPENING`, `CLOSING` |
| `connected_gl_account` | varchar(10) | ✓ | NULL | Kapcsolódó alapértelmezett főkönyvi számlaszám |
| `currency` | char(3) | — | `'HUF'` | Napló alapértelmezett devizaneme |
| `is_active` | boolean | — | `true` | Aktív-e a napló |
| `created_at` | timestamptz | — | `now()` | Létrehozás időpontja |

**Egyediség:** `UNIQUE (company_id, code)`

---

### `acc_journal_headers`

**RLS:** ✅ | **Sorok:** ~Dynamic (könyvelési tételek száma)

| Oszlop | Típus | Null | Default | Leírás |
|--------|-------|------|---------|--------|
| `id` | uuid | — | `gen_random_uuid()` | Elsődleges kulcs |
| `company_id` | uuid | — | — | FK → `companies.id` (CASCADE) |
| `journal_id` | uuid | — | — | FK → `acc_journals.id` (RESTRICT) |
| `accounting_year` | smallint | — | — | Könyvelési üzleti év (pl. 2026) |
| `journal_number` | integer | ✓ | NULL | Folyósorszám a naplón belül (könyveléskor kapja meg) |
| `status` | varchar(32) | — | `'KEZI_PISZKOZAT'` | Státusz: `KEZI_PISZKOZAT`, `AUTO_PISZKOZAT`, `KONYVELT`, `SZTORNOZOTT` |
| `entry_type` | varchar(32) | — | `'NORMAL'` | Típus: `NORMAL`, `SZTORNO`, `HELYESBITO`, `NYITO`, `ZARO` |
| `source` | varchar(32) | — | `'KEZI'` | Forrás: `KEZI`, `SZAMLA_AUTO`, `BANK_AUTO`, `BER_AUTO`, `IMPORT` |
| `posting_date` | date | — | — | Könyvelési (teljesítési/számviteli) dátum |
| `document_date` | date | — | — | Bizonylat keltének dátuma |
| `posting_timestamp` | timestamptz | ✓ | NULL | Könyvelés végrehajtásának időpontja |
| `document_id` | varchar(64) | — | — | Bizonylatszám / hivatkozási szám |
| `partner_id` | uuid | ✓ | NULL | FK → `partners.id` |
| `description` | varchar(255) | — | — | Tétel szöveges megnevezése |
| `justification` | text | ✓ | NULL | Indoklás / megjegyzés (sztornó esetén kötelező) |
| `currency` | char(3) | — | `'HUF'` | Bizonylat devizaneme |
| `exchange_rate` | numeric(12,6) | ✓ | NULL | Alkalmazott devizaárfolyam |
| `exchange_rate_date` | date | ✓ | NULL | Árfolyam érvényességi dátuma |
| `stornoed_entry_id` | uuid | ✓ | NULL | FK → `acc_journal_headers.id` (Sztornózott tétel hivatkozása) |
| `original_entry_id` | uuid | ✓ | NULL | FK → `acc_journal_headers.id` (Eredeti tétel hivatkozása) |
| `ai_recommendation` | jsonb | ✓ | NULL | AI javaslat adatok |
| `confidence` | numeric(4,3) | ✓ | NULL | AI magabiztossági szint |
| `import_key` | varchar(128) | ✓ | NULL | Külső szoftverből importált azonosító |
| `created_by` | uuid | ✓ | NULL | FK → `auth.users.id` |
| `created_at` | timestamptz | — | `now()` | Létrehozás időpontja |
| `posted_by` | uuid | ✓ | NULL | FK → `auth.users.id` |
| `posted_at` | timestamptz | ✓ | NULL | Könyvelés időpontja |

**Egyediség:** `UNIQUE (journal_id, accounting_year, journal_number)`

---

### `acc_journal_lines`

**RLS:** ✅ | **Sorok:** ~Dynamic (T/K sorok száma)

| Oszlop | Típus | Null | Default | Leírás |
|--------|-------|------|---------|--------|
| `id` | uuid | — | `gen_random_uuid()` | Elsődleges kulcs |
| `header_id` | uuid | — | — | FK → `acc_journal_headers.id` (CASCADE) |
| `sequence_number` | smallint | — | — | Sorszám a tételen belül (1, 2, 3...) |
| `gl_account_id` | uuid | ✓ | NULL | FK → `gl_accounts.id` (Főkönyvi számlaszám) |
| `dc_type` | char(1) | — | — | `'T'` (Tartozik) vagy `'K'` (Követel) |
| `amount` | numeric(18,2) | — | — | Tétel összege könyvelési devizában (> 0) |
| `foreign_amount` | numeric(18,2) | ✓ | NULL | Eredeti deviza összege |
| `vat_code` | varchar(16) | ✓ | NULL | ÁFA kód azonosító |
| `vat_role` | varchar(16) | ✓ | NULL | `'ALAP'`, `'AFA'`, `'NONE'` |
| `parent_line_id` | uuid | ✓ | NULL | FK → `acc_journal_lines.id` (Összekapcsolt ÁFA alap sor) |
| `project_id` | uuid | ✓ | NULL | FK → `projects.id` |
| `cost_center_id` | uuid | ✓ | NULL | Költséghely azonosító |
| `confidence` | numeric(4,3) | ✓ | NULL | AI magabiztossági szint |
| `description` | varchar(255) | ✓ | NULL | Sor szintű megjegyzés |

**Egyediség:** `UNIQUE (header_id, sequence_number)`

---

### `acc_journal_counters`

**RLS:** ✅ | **Sorok:** Naplónként és évenként 1 sor

| Oszlop | Típus | Null | Default | Leírás |
|--------|-------|------|---------|--------|
| `journal_id` | uuid | — | — | FK → `acc_journals.id` (CASCADE) |
| `accounting_year` | smallint | — | — | Könyvelési év |
| `last_number` | integer | — | `0` | Utolsó kiadott folyósorszám |

**PK:** `(journal_id, accounting_year)`

---

### `acc_accounting_periods`

**RLS:** ✅ | **Sorok:** Év / hónap periódusok cégenként

| Oszlop | Típus | Null | Default | Leírás |
|--------|-------|------|---------|--------|
| `id` | uuid | — | `gen_random_uuid()` | Elsődleges kulcs |
| `company_id` | uuid | — | — | FK → `companies.id` (CASCADE) |
| `year` | smallint | — | — | Időszak éve |
| `month` | smallint | — | — | Időszak hónapja (1-12) |
| `is_closed` | boolean | — | `false` | Zárt-e a periódus |
| `closed_at` | timestamptz | ✓ | NULL | Zárás időpontja |
| `closed_by` | uuid | ✓ | NULL | FK → `auth.users.id` |

**Egyediség:** `UNIQUE (company_id, year, month)`

---

### `acc_journal_audit_logs`

**RLS:** ✅ | **Sorok:** Audit trail bejegyzések

| Oszlop | Típus | Null | Default | Leírás |
|--------|-------|------|---------|--------|
| `id` | bigint | — | `IDENTITY` | Elsődleges kulcs |
| `company_id` | uuid | — | — | FK → `companies.id` (CASCADE) |
| `entity_type` | varchar(32) | — | — | Entitás típusa (pl. `'TETEL_FEJ'`, `'TETEL_SOR'`) |
| `entity_id` | uuid | — | — | Módosított entitás azonosítója |
| `event` | varchar(32) | — | — | Esemény: `'INSERT'`, `'UPDATE'`, `'DELETE'` |
| `old_status` | varchar(32) | ✓ | NULL | Korábbi státusz |
| `new_status` | varchar(32) | ✓ | NULL | Új státusz |
| `changes` | jsonb | ✓ | `'{}'` | Változások JSONB struktúrában |
| `reason` | text | ✓ | NULL | Módosítás indoklása |
| `user_id` | uuid | ✓ | NULL | FK → `auth.users.id` |
| `process_name` | varchar(64) | ✓ | NULL | Folyamat neve |
| `timestamp` | timestamptz | — | `now()` | Esemény időpontja |
| `transaction_id` | uuid | ✓ | NULL | Kapcsolódó tranzakció ID |

---

## ⚙️ Kapcsolódó RPC Függvények és Folyamatok

### 1. Javaslatok generálása (`acc_generate_drafts_from_ledger`)
- **Funkció:** `public.acc_generate_drafts_from_ledger(p_company_id uuid, p_preset_id uuid)`
- **Biztonság:** `SECURITY DEFINER SET search_path TO 'public'`
- **Leírás:** A `get_gl_categorized_items` alapján legenerálja a `GEPI_JAVASLAT` státuszú könyvelési tételeket.
- **GL Számla Feloldási Szabály:** A vezérlő számlák (311 vevők, 454 szállítók, 384/386 pénzforgalmi számlák) feloldása elsődlegesen a céghez tartozó `preset_id` (`WHERE preset_id = p_preset_id`), másodlagosan az egyedi `company_id` szerint történik.
- **Foreign Key Védelem:** A nil UUID-val rendelkező vagy a `gl_accounts` táblából hiányzó tételek kiszűrésre kerülnek, így megelőzve az `acc_journal_lines_gl_account_id_fkey` megsértését (23503).

### 2. Könyvelés és Sorszámozás (`acc_post_journal_entry`)
- **Funkció:** `public.acc_post_journal_entry(p_header_id uuid, p_user_id uuid)`
- **Validációk:** Zárt könyvelési időszak tiltása, kettős könyvviteli egyensúly kötelező ($\sum T = \sum K$), legalább 1 sor megléte.
- **Sorszámozás:** `acc_get_next_journal_number` hívásával szigorúan ugrásmentes folyósorszámot kap.

### 3. Sztornózás és Helyesbítés (`acc_storno_journal_entry`)
- **Funkció:** `public.acc_storno_journal_entry(p_header_id uuid, p_user_id uuid, p_reason text, p_create_correction boolean)`
- **Működés:** Az eredeti tételt `SZTORNOZOTT` állapotba helyezi, ellentétes előjelű stornó tételt könyvel le, és opcionálisan létrehoz egy módosítható `KEZI_PISZKOZAT` javító tételt.

### 4. Nyitó Varázsló Műveletek
- `acc_validate_and_post_opening_entry`: Sztv. 491. Technikai Nyitómérleg egyensúly és 1-4 számlaosztály ellenőrzése.
- `acc_generate_post_opening_reconciliations`: Nyitás utáni 419 átvezetés és előző évi ÁFA rendezés.
- `acc_check_opening_subledger_reconciliation`: Analitika és 311/454 nyitó egyeztetés.

