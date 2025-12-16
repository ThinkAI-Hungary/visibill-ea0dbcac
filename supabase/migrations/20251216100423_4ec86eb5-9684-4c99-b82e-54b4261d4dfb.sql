-- Add new columns for detailed invoice data from queryInvoiceData
ALTER TABLE nav_invoices ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE nav_invoices ADD COLUMN IF NOT EXISTS supplier_address TEXT;
ALTER TABLE nav_invoices ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE nav_invoices ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE nav_invoices ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE nav_invoices ADD COLUMN IF NOT EXISTS details_fetched BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups of invoices needing detail fetch
CREATE INDEX IF NOT EXISTS idx_nav_invoices_details_fetched ON nav_invoices(details_fetched) WHERE details_fetched = FALSE;