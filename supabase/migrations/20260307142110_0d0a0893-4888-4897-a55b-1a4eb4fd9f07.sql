-- One-time data fix: mark NAV invoices as paid where a matching transaction already exists
UPDATE nav_invoices ni
SET paid = true
FROM transactions t
WHERE t.matched_invoice_id = ni.id
  AND (ni.paid IS NULL OR ni.paid = false);