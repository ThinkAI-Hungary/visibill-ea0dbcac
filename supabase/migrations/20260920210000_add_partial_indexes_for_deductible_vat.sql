-- Migration: 20260920210000_add_partial_indexes_for_deductible_vat.sql
-- Description: Add partial B-tree indexes for fast O(1) page-level batch lookup of items with < 100% deductibility (telecom 70/30, passenger car leasing 50/50, 0% representation, etc.)

CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_partial_deductible 
ON public.nav_invoice_items (nav_invoice_id) 
WHERE deductible_percentage < 100;

CREATE INDEX IF NOT EXISTS idx_invoice_items_partial_deductible 
ON public.invoice_items (invoice_id) 
WHERE deductible_percentage < 100;

COMMENT ON INDEX public.idx_nav_invoice_items_partial_deductible IS 'Fast partial index for items with partial or restricted VAT deductibility (< 100%)';
COMMENT ON INDEX public.idx_invoice_items_partial_deductible IS 'Fast partial index for items with partial or restricted VAT deductibility (< 100%)';
