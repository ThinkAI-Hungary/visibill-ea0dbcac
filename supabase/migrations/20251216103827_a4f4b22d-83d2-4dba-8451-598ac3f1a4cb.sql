-- Reset details_fetched for all invoices to trigger line item fetching
UPDATE nav_invoices SET details_fetched = false;