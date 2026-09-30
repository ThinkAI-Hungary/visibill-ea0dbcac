-- ============================================================================
-- Migration: 20260929235500_add_missing_foreign_key_indexes.sql
-- Description: Add covering indexes for all unindexed foreign keys identified
--              by Supabase Performance Linter (0001_unindexed_foreign_keys).
--              Prevents table-level ShareLock and sequential scans during
--              referenced table updates, deletes, and CASCADE actions.
-- ============================================================================

-- Block A: High-volume billing & petty cash
CREATE INDEX IF NOT EXISTS idx_nav_invoices_vat_code_fk 
  ON public.nav_invoices (vat_code_id);

CREATE INDEX IF NOT EXISTS idx_invoices_vat_code_fk 
  ON public.invoices (vat_code_id);

CREATE INDEX IF NOT EXISTS idx_petty_cash_entries_cancelled_by 
  ON public.petty_cash_entries (cancelled_by);

-- Block B: Financial & Accounting core
CREATE INDEX IF NOT EXISTS idx_acc_open_item_matches_inv_line 
  ON public.acc_open_item_matches (invoice_line_id);

CREATE INDEX IF NOT EXISTS idx_acc_open_item_matches_settling_line 
  ON public.acc_open_item_matches (settling_line_id);

CREATE INDEX IF NOT EXISTS idx_acc_open_item_matches_settled_by 
  ON public.acc_open_item_matches (settled_by);

CREATE INDEX IF NOT EXISTS idx_cash_receipts_partner_id 
  ON public.cash_receipts (partner_id);

CREATE INDEX IF NOT EXISTS idx_cash_receipts_created_by 
  ON public.cash_receipts (created_by);

CREATE INDEX IF NOT EXISTS idx_cash_receipts_cancelled_by 
  ON public.cash_receipts (cancelled_by);

CREATE INDEX IF NOT EXISTS idx_development_reserves_gl_account 
  ON public.development_reserves (gl_account_id);

CREATE INDEX IF NOT EXISTS idx_development_reserves_user_id 
  ON public.development_reserves (user_id);

CREATE INDEX IF NOT EXISTS idx_vat_code_overrides_log_new_vat_code 
  ON public.vat_code_overrides_log (new_vat_code_id);

CREATE INDEX IF NOT EXISTS idx_vat_code_overrides_log_user_id 
  ON public.vat_code_overrides_log (user_id);

-- Block C: Cash closing & reports
CREATE INDEX IF NOT EXISTS idx_cash_closing_protocols_cashier 
  ON public.cash_closing_protocols (cashier_user_id);

CREATE INDEX IF NOT EXISTS idx_cash_closing_protocols_controller 
  ON public.cash_closing_protocols (controller_user_id);

CREATE INDEX IF NOT EXISTS idx_cash_closing_protocols_balancing 
  ON public.cash_closing_protocols (balancing_entry_id);

CREATE INDEX IF NOT EXISTS idx_cash_reports_approved_by 
  ON public.cash_reports (approved_by);

CREATE INDEX IF NOT EXISTS idx_cash_reports_closed_by 
  ON public.cash_reports (closed_by);

CREATE INDEX IF NOT EXISTS idx_petty_cash_registers_cashier 
  ON public.petty_cash_registers (cashier_user_id);

CREATE INDEX IF NOT EXISTS idx_petty_cash_registers_controller 
  ON public.petty_cash_registers (controller_user_id);

-- Block D: User tracking & configuration
CREATE INDEX IF NOT EXISTS idx_auto_categorize_jobs_user_id 
  ON public.auto_categorize_jobs (user_id);

CREATE INDEX IF NOT EXISTS idx_accounty_upo_credentials_user_id 
  ON public.accounty_upo_credentials (user_id);

CREATE INDEX IF NOT EXISTS idx_changelog_entries_created_by 
  ON public.changelog_entries (created_by);

CREATE INDEX IF NOT EXISTS idx_company_accounting_policies_uploaded_by 
  ON public.company_accounting_policies (uploaded_by);

CREATE INDEX IF NOT EXISTS idx_company_minimax_credentials_user_id 
  ON public.company_minimax_credentials (user_id);

CREATE INDEX IF NOT EXISTS idx_denomination_sheets_created_by 
  ON public.denomination_sheets (created_by);

CREATE INDEX IF NOT EXISTS idx_invoice_item_rules_user_id 
  ON public.invoice_item_rules (user_id);

CREATE INDEX IF NOT EXISTS idx_nav_m2m_audit_logs_user_id 
  ON public.nav_m2m_audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_purchase_vouchers_created_by 
  ON public.purchase_vouchers (created_by);

CREATE INDEX IF NOT EXISTS idx_transaction_rules_user_id 
  ON public.transaction_rules (user_id);
