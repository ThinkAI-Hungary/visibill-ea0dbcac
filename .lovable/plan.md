

## Plan: Backfill `invoice_direction` for Existing Invoices

### Problem
Existing invoices have `invoice_direction = NULL`. We need to set it to `INBOUND` (company is buyer/vevő) or `OUTBOUND` (company is seller/eladó).

### Current Data
| Company | Tax Number | Invoices to Update |
|---------|-----------|-------------------|
| Taxology Kft | 14160877-2-43 | 6 |
| Think Ai Kft | 32478620-2-43 | 74 |
| Mauroni Events KFT. | *(none)* | 14 |

### Matching Logic

**Step 1 — Tax number match** (most reliable):
- Normalize tax numbers by stripping `HU` prefix and `-` dashes, then take first 8 digits
- If normalized company tax = normalized `vevo_vat_id` → `INBOUND`
- If normalized company tax = normalized `elado_vat_id` → `OUTBOUND`

**Step 2 — Name match** (fallback for companies without tax_number, like Mauroni):
- Case-insensitive check: if company name appears in `vevo_nev` → `INBOUND`
- If company name appears in `elado_nev` → `OUTBOUND`

### SQL to Execute (via insert tool — data update, not schema change)

```sql
-- Step 1: Tax number match — company is buyer (INBOUND)
UPDATE invoices i
SET invoice_direction = 'INBOUND'
FROM companies c
WHERE i.company_id = c.id
  AND i.invoice_direction IS NULL
  AND c.tax_number IS NOT NULL
  AND LEFT(REGEXP_REPLACE(REPLACE(i.vevo_vat_id, 'HU', ''), '[^0-9]', '', 'g'), 8)
    = LEFT(REGEXP_REPLACE(c.tax_number, '[^0-9]', '', 'g'), 8);

-- Step 2: Tax number match — company is seller (OUTBOUND)
UPDATE invoices i
SET invoice_direction = 'OUTBOUND'
FROM companies c
WHERE i.company_id = c.id
  AND i.invoice_direction IS NULL
  AND c.tax_number IS NOT NULL
  AND LEFT(REGEXP_REPLACE(REPLACE(i.elado_vat_id, 'HU', ''), '[^0-9]', '', 'g'), 8)
    = LEFT(REGEXP_REPLACE(c.tax_number, '[^0-9]', '', 'g'), 8);

-- Step 3: Name fallback — company is buyer (INBOUND)
UPDATE invoices i
SET invoice_direction = 'INBOUND'
FROM companies c
WHERE i.company_id = c.id
  AND i.invoice_direction IS NULL
  AND LOWER(i.vevo_nev) ILIKE '%' || LOWER(SPLIT_PART(c.name, ' ', 1)) || '%';

-- Step 4: Name fallback — company is seller (OUTBOUND)
UPDATE invoices i
SET invoice_direction = 'OUTBOUND'
FROM companies c
WHERE i.company_id = c.id
  AND i.invoice_direction IS NULL
  AND LOWER(i.elado_nev) ILIKE '%' || LOWER(SPLIT_PART(c.name, ' ', 1)) || '%';
```

### Risk
- The name fallback uses the first word of the company name (e.g. "Mauroni", "Think", "Taxology") which should be specific enough
- Any invoices that still can't be matched will remain `NULL` — we can review those manually after

