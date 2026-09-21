# 📄 Számlák

> Számlafeldolgozás, feltöltések, tételmutató, backup táblák.

**Táblák ebben a csoportban:** 10

---

### `invoices`

**RLS:** ✅ | **Sorok:** ~1115

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| category_id | uuid | ✓ |  |
| bizonylatsorszam | text | — |  |
| kibocsatas_datuma | date | — |  |
| elado_vat_id | text | ✓ |  |
| elado_nev | text | — |  |
| elado_cim | text | ✓ |  |
| vevo_nev | text | — |  |
| vevo_cim | text | ✓ |  |
| vevo_vat_id | text | ✓ |  |
| teljesites_datuma | date | ✓ |  |
| adoalap_osszesen | numeric | — | `0` |
| afa_kulcsok_bontasban | text | ✓ |  |
| afa_osszeg_osszesen | numeric | — | `0` |
| brutto_vegosszeg | numeric | — | `0` |
| forditott_adozas | boolean | ✓ | `false` |
| adomentesseg_hivatkozas | text | ✓ |  |
| onszamlazas | boolean | ✓ | `false` |
| penzforgalmi_elszamolas | boolean | ✓ | `false` |
| penznem | text | ✓ | `'HUF'::text` |
| statusz | text | ✓ | `'feldolgozas_alatt'::text` |
| melleklet_url | text | ✓ |  |
| email_uzenet_id | text | ✓ |  |
| feldolgozva | timestamp with time zone | ✓ |  |
| letrehozva | timestamp with time zone | — | `now()` |
| frissitve | timestamp with time zone | — | `now()` |
| invoice_type | text | — | `'sima_szla'::text` |
| termek_szolgaltatas_tipusa | text | ✓ |  |
| dokumentum_azonosito | text | ✓ |  |
| fizetendo_osszeg | numeric | ✓ |  |
| fizetesi_mod | text | ✓ |  |
| bankszamlaszam_iban | text | ✓ |  |
| adojogi_megjegyzes | text | ✓ |  |
| fizetesi_hatarido | date | ✓ |  |
| elolegszamla_hivatkozas | text | ✓ |  |
| elszamolt_eloleg_osszeg | numeric | ✓ |  |
| fizetve | boolean | ✓ | `false` |
| project_id | uuid | ✓ |  |
| image_url | text | ✓ |  |
| company_id | uuid | ✓ |  |
| invoice_direction | text | ✓ |  |
| reference_number | text | ✓ |  |
| invoice_uploads_id | uuid | ✓ |  |
| transaction_id | uuid | ✓ |  |
| gl_account_id | uuid | ✓ |  |
| gl_is_manually_overridden | boolean | ✓ | `false` |
| gl_ai_confidence_score | numeric | ✓ |  |
| gl_reasoning | text | ✓ |  |
| gl_classifications | jsonb | ✓ | `'{}'::jsonb` |
| exclude_from_accounting | boolean | — | `false` |
| reverse_charge_category | text | ✓ |  |
| position_numbers | ARRAY | ✓ |  |
| shipment_match_status | text | ✓ |  |
| planned_payment_date | date | ✓ |  |
| selexped_registry_number | text | ✓ |  |
| intermediary_service | boolean | — | `false` |
| is_manual_payment | boolean | ✓ | `false` |
| manual_payment_date | date | ✓ |  |
| manual_payment_type | text | ✓ |  |
| manual_payment_note | text | ✓ |  |
| confidence_score | numeric | ✓ |  |
| nav_status | text | ✓ | `'missing_nav'::text` |
| approved_at | timestamp with time zone | ✓ |  |
| approved_by | uuid | ✓ |  |
| approval_note | text | ✓ |  |

**FK:** `category_id` → `categories.id`, `company_id` → `companies.id`, `gl_account_id` → `gl_accounts.id`, `invoice_uploads_id` → `invoice_uploads.id`, `project_id` → `projects.id`, `transaction_id` → `transactions.id`, `approved_by` → `auth.users.id`

**Indexek:** `idx_invoices_bizonylatsorszam_company`, `idx_invoices_cash_fizmod`, `idx_invoices_category_id`, `idx_invoices_company_date`, `idx_invoices_company_direction_date`, `idx_invoices_company_dir_date_desc`, `idx_invoices_company_fizmod`, `idx_invoices_company_nav_status`, `idx_invoices_exclude`, `idx_invoices_gl_account_id`, `idx_invoices_invoice_uploads_id`, `idx_invoices_outbound_unpaid`, `idx_invoices_project_id`, `idx_invoices_reference_number`, `idx_invoices_search_trgm` (GIN trigram), `idx_invoices_statusz`, `idx_invoices_transaction_id`, `idx_invoices_user_id`, `invoices_company_id_bizonylatsorszam_key`

> **Párosítási és Fizetettségi Szabály (A-098):**
> A szerveroldali lekérdező RPC-k (`get_filtered_submitted_invoices`, `get_invoice_kpis`, `get_filtered_nav_invoices`) a készpénzes (`LOWER(fizetesi_mod) IN ('készpénz', 'keszpenz', 'cash')` vagy `ILIKE`) és a manuálisan lezárt (`is_manual_payment = true`) számlákat automatikusan teljes mértékben kiegyenlítettnek minősítik (`paid_amount = gross_abs`, `remaining_amount = 0`, `match_status = 'matched'`), függetlenül attól, hogy van-e hozzájuk banki bankszámlakivonat-tranzakció.


---

### `invoice_items`

**RLS:** ✅ | **Sorok:** ~3024

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| invoice_id | uuid | — |  |
| line_number | integer | — |  |
| line_description | text | ✓ |  |
| quantity | numeric | ✓ |  |
| unit_of_measure | text | ✓ |  |
| unit_price | numeric | ✓ |  |
| net_amount | numeric | ✓ |  |
| vat_rate | text | ✓ |  |
| vat_amount | numeric | ✓ |  |
| gross_amount | numeric | ✓ |  |
| product_code | text | ✓ |  |
| gl_classifications | jsonb | ✓ | `'{}'::jsonb` |
| project_id | uuid | ✓ | NULL |
| notes | text | ✓ | NULL |
| created_at | timestamp with time zone | ✓ | `now()` |
| exclude_from_accounting | boolean | — | `false` |
| deductible_percentage | numeric(5,2) | — | `100.00` |
| net_weight_kg | numeric | ✓ | NULL | Nettó tömeg kilogrammban (6/B melléklet szerinti acélipari nyilatkozathoz, lásd [A-131](../decisions/A-131-nav-2665-vat-return-restructuring-and-steel-reporting.md)) |
| vat_code | text | ✓ | NULL | Kézzel felülbírált vagy gépi tanulás által felismert ÁFA kód szöveges azonosítója (pl. 27, 05, FAD, TAM), lásd [A-135](../decisions/A-135-dual-vat-code-system-and-reverse-charge-recognition.md) |
| vat_code_id | uuid | ✓ | NULL | Hivatkozás a konkrét ÁFA kód törzsrekordra (`public.vat_codes`), lásd [A-136](../decisions/A-136-invoice-vat-code-overrides-and-machine-learning.md) |
| is_vat_code_manual | boolean | — | `false` | Jelzi, ha az ÁFA kód manuálisan lett felülbírálva a felhasználó által |

**FK:** `invoice_id` → `invoices.id`, `project_id` → `projects.id`, `vat_code_id` → `vat_codes.id`

**Indexek:** `idx_invoice_items_invoice_id`, `idx_invoice_items_vat_code_id`, `idx_invoice_items_partial_deductible` (`invoice_id` WHERE `deductible_percentage < 100`) — O(1) részleges index nem levonható ÁFA-tételekhez (lásd [A-134](../decisions/A-134-non-deductible-vat-lifecycle-and-partial-indexes.md))

---

### `invoice_uploads`

**RLS:** ✅ | **Sorok:** ~2055

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
| document_category | text | — | `'invoice'::text` |

**FK:** `company_id` → `companies.id`

**Indexek:** `idx_invoice_uploads_company_created`, `idx_invoice_uploads_company_id`

---

### `sima_szamla_backup`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| bizonylatsorszam | text | — |  |
| kibocsatas_datuma | date | — |  |
| elado_vat_id | text | ✓ |  |
| elado_nev | text | — |  |
| elado_cim | text | ✓ |  |
| vevo_nev | text | — |  |
| vevo_cim | text | ✓ |  |
| vevo_vat_id | text | ✓ |  |
| teljesites_datuma | date | ✓ |  |
| adoalap_osszesen | numeric | ✓ | `0` |
| afa_kulcsok_bontasban | text | ✓ |  |
| afa_osszeg_osszesen | numeric | ✓ | `0` |
| brutto_vegosszeg | numeric | ✓ | `0` |
| forditott_adozas | boolean | ✓ | `false` |
| adomentesseg_hivatkozas | text | ✓ |  |
| onszamlazas | boolean | ✓ | `false` |
| penzforgalmi_elszamolas | boolean | ✓ | `false` |
| penznem | text | ✓ | `'HUF'::text` |
| statusz | text | ✓ | `'feldolgozas_alatt'::text` |
| category_id | uuid | ✓ |  |
| melleklet_url | text | ✓ |  |
| email_uzenet_id | text | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| project_id | uuid | ✓ |  |

---

### `vegszamla_backup`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| szamlaszam | text | — |  |
| kibocsatas_datuma | date | — |  |
| elado_vat_id | text | ✓ |  |
| elado_nev | text | — |  |
| elado_cim | text | ✓ |  |
| vevo_nev | text | — |  |
| vevo_cim | text | ✓ |  |
| adoalap_osszesen | numeric | ✓ | `0` |
| afa_osszeg_osszesen | numeric | ✓ | `0` |
| elolegszamla_hivatkozas | text | ✓ |  |
| elszamolt_eloleg_osszeg | numeric | ✓ |  |
| brutto_vegosszeg | numeric | ✓ | `0` |
| teljesites_datuma | date | ✓ |  |
| forditott_adozas | boolean | ✓ | `false` |
| category_id | uuid | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| project_id | uuid | ✓ |  |

---

### `proforma_backup`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| dokumentum_azonosito | text | ✓ |  |
| kibocsatas_datuma | date | — |  |
| elado_vat_id | text | ✓ |  |
| fizetendo_osszeg | numeric | ✓ |  |
| fizetesi_mod | text | ✓ |  |
| vevo_nev | text | — |  |
| elado_nev | text | — |  |
| bankszamlaszam_iban | text | ✓ |  |
| adojogi_megjegyzes | text | ✓ |  |
| fizetesi_hatarido | date | ✓ |  |
| category_id | uuid | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| project_id | uuid | ✓ |  |

---

### `egyszerusitett_szamla_backup`

**RLS:** ✅ | **Sorok:** ~0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| elado_vat_id | text | ✓ |  |
| kibocsatas_datuma | date | — |  |
| termek_szolgaltatas_tipusa | text | ✓ |  |
| afa_osszeg | numeric | ✓ |  |
| adoalap_osszesen_netto | numeric | ✓ |  |
| elado_cim | text | ✓ |  |
| vevo_nev | text | — |  |
| elado_nev | text | — |  |
| category_id | uuid | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |
| project_id | uuid | ✓ |  |

---

### `pdf_export_jobs`

**RLS:** ✅ | **Sorok:** Aktív jobok (24h cleanup, 7d delete)

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — | |
| user_id | uuid | — | |
| status | text | — | `'queued'` |
| date_from | date | — | |
| date_to | date | — | |
| invoice_direction | text | ✓ | |
| total_invoices | integer | — | `0` |
| processed_invoices | integer | — | `0` |
| invoice_list | jsonb | ✓ | |
| base_name | text | ✓ | |
| result_urls | text[] | ✓ | |
| result_sizes | bigint[] | ✓ | |
| error_message | text | ✓ | |
| created_at | timestamptz | — | `now()` |
| updated_at | timestamptz | — | `now()` |
| completed_at | timestamptz | ✓ | |

**Státuszok:** `queued`, `pending`, `processing`, `completed`, `error`, `cancelled`, `downloaded`, `expired`

**FK:** `company_id` → `companies.id`, `user_id` → `auth.users.id`

**CHECK:** `status IN ('queued','pending','processing','completed','error','cancelled','downloaded','expired')`

**RLS policies:**
- SELECT: `user_id = auth.uid()` — user csak saját jobját látja
- UPDATE: `user_id = auth.uid()` — user csak saját jobját módosíthatja

**Indexek:** `idx_pdf_export_jobs_company_created`

---

### `vat_code_overrides_log`

**RLS:** ✅ | **Sorok:** 0

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — | |
| partner_tax_number | text | ✓ | |
| partner_name | text | ✓ | |
| item_description | text | ✓ | |
| original_vat_rate | text | ✓ | |
| original_vat_code | text | ✓ | |
| new_vat_code_id | uuid | — | |
| new_vat_code | text | — | |
| direction | text | ✓ | NULL (CHECK in `'inbound'`, `'outbound'`) |
| user_id | uuid | ✓ | NULL |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `company_id` → `companies.id`, `new_vat_code_id` → `vat_codes.id`, `user_id` → `auth.users.id`

**Indexek:** `idx_vat_code_overrides_company_partner` (`company_id, partner_tax_number, item_description`)

**RLS policies:**
- SELECT: Cégtagok számára (`company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())`)
- INSERT: Cégtagok számára (`company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())`)

> **Architektúra Döntés (2026-09-21):** Számlatételes ÁFA kód felülbírálások audit naplója és gépi tanulási bázisa — lásd [A-136](../decisions/A-136-invoice-vat-code-overrides-and-machine-learning.md).

