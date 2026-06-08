-- =====================================================
-- Migration: Add missing foreign key indexes
-- Risk: ZERO — indexes only improve performance, never break functionality
-- Note: Run outside transactions for CONCURRENTLY support on production
-- These were applied via execute_sql (without CONCURRENTLY) on 2026-06-08
-- Ref: supabase-postgres-best-practices / schema-foreign-key-indexes
-- =====================================================

-- accounty tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_deadlines_completed_by
  ON public.accounty_deadlines(completed_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_messages_sender_user_id
  ON public.accounty_messages(sender_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_missing_items_ignored_by
  ON public.accounty_missing_items(ignored_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_missing_items_resolved_by
  ON public.accounty_missing_items(resolved_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_payroll_cycles_approved_by
  ON public.accounty_payroll_cycles(approved_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_portal_tokens_created_by
  ON public.accounty_portal_tokens(created_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_timesheets_verified_by
  ON public.accounty_timesheets(verified_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounty_uploads_uploaded_by
  ON public.accounty_uploads(uploaded_by);

-- bs (balance sheet) tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bs_mapping_bs_structure_id
  ON public.bs_mapping(bs_structure_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bs_mapping_gl_account_id
  ON public.bs_mapping(gl_account_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bs_mapping_preset_id
  ON public.bs_mapping(preset_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bs_mapping_user_id
  ON public.bs_mapping(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bs_prior_year_bs_structure_id
  ON public.bs_prior_year(bs_structure_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bs_prior_year_user_id
  ON public.bs_prior_year(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bs_structure_parent_id
  ON public.bs_structure(parent_id);

-- core tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_project_id
  ON public.invoices(project_id);

-- vat tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vat_return_m_lines_partner_id
  ON public.vat_return_m_lines(partner_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vat_returns_user_id
  ON public.vat_returns(user_id);
