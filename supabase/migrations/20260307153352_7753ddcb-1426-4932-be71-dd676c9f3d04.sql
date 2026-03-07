
ALTER TABLE invoices ADD COLUMN reference_number TEXT;
CREATE INDEX idx_invoices_reference_number ON invoices(reference_number) WHERE reference_number IS NOT NULL;
CREATE INDEX idx_invoices_bizonylatsorszam_company ON invoices(bizonylatsorszam, company_id);
