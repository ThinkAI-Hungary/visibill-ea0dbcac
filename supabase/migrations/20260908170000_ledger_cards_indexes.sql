-- Migration: 20260908170000_ledger_cards_indexes.sql
-- Description: Covering performance indexes for General Ledger & Analytic Cards RPC functions and queries.

CREATE INDEX IF NOT EXISTS idx_acc_journal_lines_gl_account ON public.acc_journal_lines(gl_account_id);
CREATE INDEX IF NOT EXISTS idx_acc_journal_lines_header ON public.acc_journal_lines(header_id);
CREATE INDEX IF NOT EXISTS idx_acc_journal_headers_company_posting ON public.acc_journal_headers(company_id, posting_date);
CREATE INDEX IF NOT EXISTS idx_acc_journal_headers_company_doc ON public.acc_journal_headers(company_id, document_date);
CREATE INDEX IF NOT EXISTS idx_acc_journal_headers_company_partner ON public.acc_journal_headers(company_id, partner_id);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_preset_number ON public.gl_accounts(preset_id, gl_number);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_company_number ON public.gl_accounts(company_id, gl_number);
