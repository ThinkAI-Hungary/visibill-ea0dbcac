# 📄 Számlák

> Számlafeldolgozás, feltöltések, tételmutató, backup táblák.

**Táblák ebben a csoportban:** 7

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

**FK:** `category_id` → `categories.id`, `company_id` → `companies.id`, `gl_account_id` → `gl_accounts.id`, `invoice_uploads_id` → `invoice_uploads.id`, `project_id` → `projects.id`, `transaction_id` → `transactions.id`

**Indexek:** `idx_invoices_bizonylatsorszam_company`, `idx_invoices_cash_fizmod`, `idx_invoices_category_id`, `idx_invoices_company_date`, `idx_invoices_company_direction_date`, `idx_invoices_company_fizmod`, `idx_invoices_exclude`, `idx_invoices_gl_account_id`, `idx_invoices_invoice_uploads_id`, `idx_invoices_outbound_unpaid`, `idx_invoices_project_id`, `idx_invoices_reference_number`, `idx_invoices_statusz`, `idx_invoices_transaction_id`, `idx_invoices_user_id`, `invoices_company_id_bizonylatsorszam_key`

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
| created_at | timestamp with time zone | ✓ | `now()` |
| exclude_from_accounting | boolean | — | `false` |

**FK:** `invoice_id` → `invoices.id`

**Indexek:** `idx_invoice_items_invoice_id`

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

