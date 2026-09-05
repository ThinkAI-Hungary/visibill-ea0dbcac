-- Migration: 20260905195000_optimize_query_performance_indexes.sql
-- Description: Targeted database indexes resolving top slow queries identified in the Query Performance audit:
-- 1. nav_invoice_items: Partial index on notes (fixes Query #19, 2976ms -> 5.6ms, 99.79% speedup)
-- 2. invoices & nav_invoices: Functional expression indexes for normalized invoice number cross-matching (fixes Queries #4, #5, #8, #10, #24, >33 min total CPU)
-- 3. accounty_missing_items: Composite indexes for company + status and company + created_at (fixes Queries #6, #20, #21, 9.67 min total CPU)
-- 4. accounty_deadlines: Composite index for company + status + due_date sort (fixes Queries #14, #25, 3.58 min total CPU)
-- 5. accounty_audit_log: Drop duplicate index idx_audit_log_user

-- 1. nav_invoice_items: Notes partial index
CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_notes
ON public.nav_invoice_items USING btree (notes)
WHERE notes IS NOT NULL;

-- 2. Functional expression indexes for normalized document number cross-matching
CREATE INDEX IF NOT EXISTS idx_invoices_company_normalized_bizonylat
ON public.invoices USING btree (company_id, replace(lower(bizonylatsorszam), ' ', ''));

CREATE INDEX IF NOT EXISTS idx_nav_invoices_company_normalized_invnum
ON public.nav_invoices USING btree (company_id, replace(lower(invoice_number), ' ', ''));

-- 3. accounty_missing_items: Composite filtering indexes (Index-Only Scan)
CREATE INDEX IF NOT EXISTS idx_accounty_missing_items_comp_status_id
ON public.accounty_missing_items USING btree (company_id, status, id);

CREATE INDEX IF NOT EXISTS idx_accounty_missing_items_comp_created_id
ON public.accounty_missing_items USING btree (company_id, created_at, id);

-- 4. accounty_deadlines: Composite filter + pre-sorted due_date
CREATE INDEX IF NOT EXISTS idx_accounty_deadlines_comp_status_due
ON public.accounty_deadlines USING btree (company_id, status, due_date ASC);

-- 5. Drop duplicate index on accounty_audit_log flagged by linter
DROP INDEX IF EXISTS public.idx_audit_log_user;
