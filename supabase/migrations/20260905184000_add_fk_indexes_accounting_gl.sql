-- ===========================================================================
-- Batch FK-2: General Ledger & Accounting (Acc Module)
-- Missing Foreign Key Indexes (Performance Advisor: unindexed_foreign_keys)
-- Total indexes: 12
-- ===========================================================================

-- FK: acc_accounting_periods_closed_by_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_acc_accounting_periods_closed_by ON public.acc_accounting_periods(closed_by);

-- FK: acc_journal_audit_logs_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_acc_journal_audit_logs_company_id ON public.acc_journal_audit_logs(company_id);

-- FK: acc_journal_audit_logs_user_id_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_acc_journal_audit_logs_user_id ON public.acc_journal_audit_logs(user_id);

-- FK: acc_journal_headers_created_by_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_acc_journal_headers_created_by ON public.acc_journal_headers(created_by);

-- FK: acc_journal_headers_original_entry_id_fkey -> acc_journal_headers(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_acc_journal_headers_original_entry_id ON public.acc_journal_headers(original_entry_id);

-- FK: acc_journal_headers_partner_id_fkey -> partners(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_acc_journal_headers_partner_id ON public.acc_journal_headers(partner_id);

-- FK: acc_journal_headers_posted_by_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_acc_journal_headers_posted_by ON public.acc_journal_headers(posted_by);

-- FK: acc_journal_headers_stornoed_entry_id_fkey -> acc_journal_headers(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_acc_journal_headers_stornoed_entry_id ON public.acc_journal_headers(stornoed_entry_id);

-- FK: acc_journal_lines_parent_line_id_fkey -> acc_journal_lines(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_acc_journal_lines_parent_line_id ON public.acc_journal_lines(parent_line_id);

-- FK: acc_journal_lines_project_id_fkey -> projects(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_acc_journal_lines_project_id ON public.acc_journal_lines(project_id);

-- FK: gl_audit_imports_imported_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_gl_audit_imports_imported_by ON public.gl_audit_imports(imported_by);

-- FK: gl_audit_imports_preset_id_fkey -> chart_of_accounts_presets(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_gl_audit_imports_preset_id ON public.gl_audit_imports(preset_id);
