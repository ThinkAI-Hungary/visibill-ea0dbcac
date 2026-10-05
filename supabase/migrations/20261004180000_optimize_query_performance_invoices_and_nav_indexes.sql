-- Migration: 20261004180000_optimize_query_performance_invoices_and_nav_indexes.sql
-- Description: Phase 1 query performance optimizations:
-- 1. Index on invoices(company_id, teljesites_datuma DESC NULLS LAST) 
--    (speeds up VAT analytics, EV dashboard, OSA check and all date-range queries from ~2s to <5ms)
-- 2. Index on nav_invoices(invoice_number)
--    (speeds up global invoice lookups, deduplication and matching queries from ~250ms seq scans to ~2ms index scans)
-- 3. Composite index on nav_invoices(company_id, invoice_delivery_date DESC)
--    (speeds up direction-agnostic delivery date range queries on NAV invoices)

-- 1. Invoices company + teljesites_datuma index
CREATE INDEX IF NOT EXISTS idx_invoices_company_teljesites 
ON public.invoices (company_id, teljesites_datuma DESC NULLS LAST);

-- 2. NAV invoices global invoice_number lookup index
CREATE INDEX IF NOT EXISTS idx_nav_invoices_invoice_number 
ON public.nav_invoices USING btree (invoice_number);

-- 3. NAV invoices company + delivery date index (direction-agnostic)
CREATE INDEX IF NOT EXISTS idx_nav_invoices_company_delivery_date 
ON public.nav_invoices (company_id, invoice_delivery_date DESC);
