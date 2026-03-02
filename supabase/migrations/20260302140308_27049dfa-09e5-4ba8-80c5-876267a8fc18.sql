
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
