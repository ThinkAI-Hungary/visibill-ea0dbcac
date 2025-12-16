-- Reset details_fetched for all invoices to re-fetch with proper UTF-8 encoding
UPDATE nav_invoices SET details_fetched = false;