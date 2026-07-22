-- Migration: Update reference_number for vegszamla invoices to match elolegszamla_hivatkozas
-- Enables invoice chaining for final invoices (vegszamla ↔ elolegszamla)

UPDATE invoices
SET reference_number = elolegszamla_hivatkozas
WHERE invoice_type = 'vegszamla'
  AND reference_number IS NULL
  AND elolegszamla_hivatkozas IS NOT NULL;
