-- Migration: add_performance_indexes_invoice_items_and_uploads
-- Created: 2026-09-29 23:45:00
-- Purpose: Optimize slow queries identified in Query Performance audit:
--          1. idx_invoice_items_notes: speeds up useNotesData line item query (cost -99.1%, execution 1362ms -> 3.9ms)
--          2. idx_invoice_uploads_status_company: speeds up upload status polling and notification queries (cost -99.8%, 1177 buffers -> 2 buffers)

-- 1. Partial index on invoice_items notes (only ~2 rows currently non-null out of 30,000)
CREATE INDEX IF NOT EXISTS idx_invoice_items_notes
  ON public.invoice_items USING btree (notes)
  WHERE (notes IS NOT NULL);

-- 2. Composite index on invoice_uploads for processing_status and company_id
CREATE INDEX IF NOT EXISTS idx_invoice_uploads_status_company
  ON public.invoice_uploads (processing_status, company_id);
