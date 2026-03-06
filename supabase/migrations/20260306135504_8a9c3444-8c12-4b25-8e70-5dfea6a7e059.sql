-- Backfill: reset paid=false for OUTBOUND nav_invoices that have no matched transaction
UPDATE nav_invoices ni
SET paid = false
WHERE ni.invoice_direction = 'OUTBOUND'
  AND ni.paid = true
  AND NOT EXISTS (
    SELECT 1
    FROM invoices i
    JOIN transactions t ON t.matched_invoice_id = i.id
    WHERE i.bizonylatsorszam = ni.invoice_number
      AND i.company_id = ni.company_id
  );