# 🚚 Szállítmányozás

> Fuvar import, fuvarokmányok, számla-párosítás.

**Táblák ebben a csoportban:** 4

---

### `shipments`

**RLS:** ✅ | **Sorok:** ~80

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| position_number | text | — |  |
| pickup_date | timestamp with time zone | ✓ |  |
| delivery_date | timestamp with time zone | ✓ |  |
| carrier_name | text | ✓ |  |
| calculated_amount_huf | numeric | ✓ |  |
| calculated_amount_eur | numeric | ✓ |  |
| match_status | text | — | `'unmatched'::text` |
| matched_invoice_id | uuid | ✓ |  |
| import_batch_id | uuid | ✓ |  |
| source_row_data | jsonb | — | `'{}'::jsonb` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `import_batch_id` → `shipment_import_batches.id`, `matched_invoice_id` → `invoices.id`

**Indexek:** `idx_shipments_carrier`, `idx_shipments_company_pos`, `idx_shipments_match_status`, `idx_shipments_matched_invoice`, `shipments_company_id_position_number_key`

---

### `shipment_import_batches`

**RLS:** ✅ | **Sorok:** ~1

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| uploaded_by | uuid | ✓ |  |
| file_name | text | — |  |
| file_path | text | — |  |
| total_rows | integer | — | `0` |
| imported_rows | integer | — | `0` |
| skipped_rows | integer | — | `0` |
| errors | jsonb | — | `'[]'::jsonb` |
| status | text | — | `'processing'::text` |
| created_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `uploaded_by` → `auth.users.id`

**Indexek:** `idx_shipment_import_batches_company`

---

### `transport_documents`

**RLS:** ✅ | **Sorok:** ~9

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| position_number | text | ✓ |  |
| document_type | text | — | `'cmr'::text` |
| file_path | text | — |  |
| file_name | text | — |  |
| file_size | integer | — |  |
| mime_type | text | — |  |
| linked_invoice_id | uuid | ✓ |  |
| linked_shipment_id | uuid | ✓ |  |
| match_confidence | numeric | ✓ |  |
| source_email_id | text | ✓ |  |
| metadata | jsonb | — | `'{}'::jsonb` |
| status | text | — | `'unprocessed'::text` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `linked_invoice_id` → `invoices.id`, `linked_shipment_id` → `shipments.id`

**Indexek:** `idx_cmr_docs_company_pos`, `idx_cmr_docs_linked_invoice`, `idx_cmr_docs_linked_shipment`, `idx_cmr_docs_status`

---

### `shipment_matches`

**RLS:** ✅ | **Sorok:** ~1

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| company_id | uuid | — |  |
| invoice_id | uuid | — |  |
| shipment_id | uuid | ✓ |  |
| match_type | text | ✓ |  |
| confidence_score | numeric | ✓ |  |
| match_details | jsonb | — | `'{}'::jsonb` |
| discrepancies | jsonb | — | `'[]'::jsonb` |
| status | text | — | `'pending'::text` |
| resolved_by | uuid | ✓ |  |
| resolved_at | timestamp with time zone | ✓ |  |
| created_at | timestamp with time zone | — | `now()` |

**FK:** `company_id` → `companies.id`, `invoice_id` → `invoices.id`, `resolved_by` → `auth.users.id`, `shipment_id` → `shipments.id`

**Indexek:** `idx_shipment_matches_invoice`, `idx_shipment_matches_pending_shipment`, `idx_shipment_matches_shipment`, `idx_shipment_matches_status`, `uq_shipment_matches_invoice_shipment`

---

### `cmr_documents` — VIEW

> CMR fuvarokmányok nézet a `transport_documents` tábla alapján. Fuvarlevél fájlok, számla/fuvar összekapcsolás.

**RLS:** ✅ | **Sorok:** N/A (view)

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | ✓ | |
| company_id | uuid | ✓ | |
| position_number | text | ✓ | |
| document_type | text | ✓ | |
| file_path | text | ✓ | |
| file_name | text | ✓ | |
| file_size | integer | ✓ | |
| mime_type | text | ✓ | |
| linked_invoice_id | uuid | ✓ | |
| linked_shipment_id | uuid | ✓ | |
| match_confidence | numeric | ✓ | |
| source_email_id | text | ✓ | |
| metadata | jsonb | ✓ | |
| status | text | ✓ | |
| created_at | timestamptz | ✓ | |
| updated_at | timestamptz | ✓ | |

---
