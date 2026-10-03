-- Migration: 20261003180000_optimize_query_performance_phase1_indexes.sql
-- Description: Phase 1 query performance optimizations:
-- 1. Partial index on transactions for unmatched items (eliminates seq scans on transactions list & get_unclassified_gl_items)
-- 2. Index on gl_upload_notifications(company_id, created_at DESC) (eliminates 231k seq scans)
-- 3. Composite and GIN indexes on invoice_uploads(company_id, file_name) and metadata (speeds up upload dedup & CMR attachments)
-- 4. Composite index on accounty_missing_items(company_id, source, status) (speeds up detector and status filtering)
-- 5. Index on acc_journal_headers(company_id) (speeds up acc_journal_lines RLS subquery lookups)

-- 1. Unmatched transactions partial index
CREATE INDEX IF NOT EXISTS idx_transactions_company_unmatched 
ON public.transactions (company_id, created_at DESC) 
WHERE (matched_invoice_id IS NULL);

-- 2. gl_upload_notifications company index
CREATE INDEX IF NOT EXISTS idx_gl_upload_notifications_company_created 
ON public.gl_upload_notifications (company_id, created_at DESC);

-- 3. invoice_uploads indexes
CREATE INDEX IF NOT EXISTS idx_invoice_uploads_comp_filename 
ON public.invoice_uploads (company_id, file_name);

CREATE INDEX IF NOT EXISTS idx_invoice_uploads_metadata_gin 
ON public.invoice_uploads USING gin (metadata);

-- 4. accounty_missing_items detector & status index
CREATE INDEX IF NOT EXISTS idx_accounty_missing_items_comp_src_status 
ON public.accounty_missing_items (company_id, source, status);

-- 5. acc_journal_headers company index
CREATE INDEX IF NOT EXISTS idx_acc_journal_headers_company_id 
ON public.acc_journal_headers (company_id);
