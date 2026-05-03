-- ============================================================
-- VISIBILL DATABASE MIGRATION - PART 3: Indexes
-- ============================================================

-- asset_events
CREATE INDEX IF NOT EXISTS idx_asset_events_asset ON public.asset_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_events_company_id ON public.asset_events(company_id);
CREATE INDEX IF NOT EXISTS idx_asset_events_user_id ON public.asset_events(user_id);
-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
-- bank
CREATE INDEX IF NOT EXISTS idx_bank_statement_uploads_company_id ON public.bank_statement_uploads(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_status ON public.bank_statements(status);
CREATE INDEX IF NOT EXISTS idx_bank_statements_user_id ON public.bank_statements(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON public.bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_statement_id ON public.bank_transactions(bank_statement_id);
-- categories
CREATE INDEX IF NOT EXISTS idx_categories_company_id ON public.categories(company_id);
-- chart_of_accounts_presets
CREATE INDEX IF NOT EXISTS idx_presets_company_id ON public.chart_of_accounts_presets(company_id);
-- company_locations
CREATE INDEX IF NOT EXISTS idx_company_locations_company ON public.company_locations(company_id);
-- backup tables
CREATE INDEX IF NOT EXISTS idx_egyszerusitett_szamla_backup_date ON public.egyszerusitett_szamla_backup(kibocsatas_datuma);
CREATE INDEX IF NOT EXISTS idx_egyszerusitett_szamla_backup_user_id ON public.egyszerusitett_szamla_backup(user_id);
CREATE INDEX IF NOT EXISTS idx_proforma_backup_date ON public.proforma_backup(kibocsatas_datuma);
CREATE INDEX IF NOT EXISTS idx_proforma_backup_user_id ON public.proforma_backup(user_id);
CREATE INDEX IF NOT EXISTS idx_sima_szamla_backup_date ON public.sima_szamla_backup(kibocsatas_datuma);
CREATE INDEX IF NOT EXISTS idx_sima_szamla_backup_user_id ON public.sima_szamla_backup(user_id);
CREATE INDEX IF NOT EXISTS idx_vegszamla_backup_date ON public.vegszamla_backup(kibocsatas_datuma);
CREATE INDEX IF NOT EXISTS idx_vegszamla_backup_user_id ON public.vegszamla_backup(user_id);
-- email_aliases
CREATE UNIQUE INDEX IF NOT EXISTS email_aliases_alias_email_unique ON public.email_aliases(alias_email) WHERE alias_email IS NOT NULL AND alias_email <> '';
-- employee_rates
CREATE INDEX IF NOT EXISTS idx_employee_rates_company_id ON public.employee_rates(company_id);
-- feedback
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
-- fixed_assets
CREATE INDEX IF NOT EXISTS idx_fixed_assets_activated_by_user_id ON public.fixed_assets(activated_by_user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_company ON public.fixed_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_gl_account_id ON public.fixed_assets(gl_account_id) WHERE gl_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fixed_assets_location_id ON public.fixed_assets(location_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_status ON public.fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_tao_template_id ON public.fixed_assets(tao_template_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_user_id ON public.fixed_assets(user_id);
-- gl_accounts
CREATE INDEX IF NOT EXISTS idx_gl_accounts_company_id ON public.gl_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_parent_id ON public.gl_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_preset_id ON public.gl_accounts(preset_id);
-- gl_overrides_log
CREATE INDEX IF NOT EXISTS idx_overrides_company_id ON public.gl_overrides_log(company_id);
CREATE INDEX IF NOT EXISTS idx_overrides_transaction_id ON public.gl_overrides_log(item_id);
-- invoice_items
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_bizonylatsorszam_company ON public.invoices(bizonylatsorszam, company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_cash_fizmod ON public.invoices(company_id, kibocsatas_datuma) WHERE fizetesi_mod ILIKE '%készpénz%' AND reference_number IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_company_date ON public.invoices(company_id, kibocsatas_datuma DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_company_direction_date ON public.invoices(company_id, invoice_direction, kibocsatas_datuma);
CREATE INDEX IF NOT EXISTS idx_invoices_company_fizmod ON public.invoices(company_id, fizetesi_mod) WHERE reference_number IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_gl_account_id ON public.invoices(gl_account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_gl_classifications ON public.invoices USING gin(gl_classifications);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_uploads_id ON public.invoices(invoice_uploads_id);
CREATE INDEX IF NOT EXISTS idx_invoices_outbound_unpaid ON public.invoices(company_id, invoice_direction, kibocsatas_datuma) WHERE invoice_direction = 'OUTBOUND' AND transaction_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON public.invoices(category_id);
CREATE INDEX IF NOT EXISTS idx_invoices_reference_number ON public.invoices(reference_number) WHERE reference_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_statusz ON public.invoices(statusz);
CREATE INDEX IF NOT EXISTS idx_invoices_transaction_id ON public.invoices(transaction_id);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON public.invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
-- leave_requests
CREATE INDEX IF NOT EXISTS idx_leave_requests_company ON public.leave_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON public.leave_requests(user_id);
-- nav_invoice_items
CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_gl_classifications ON public.nav_invoice_items USING gin(gl_classifications);
CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_nav_invoice_id ON public.nav_invoice_items(nav_invoice_id);
-- nav_invoices
CREATE INDEX IF NOT EXISTS idx_nav_invoices_cash_payment ON public.nav_invoices(company_id, invoice_direction, invoice_issue_date) WHERE payment_method = ANY(ARRAY['CASH','KÉSZPÉNZ']);
CREATE INDEX IF NOT EXISTS idx_nav_invoices_category_id ON public.nav_invoices(category_id);
CREATE INDEX IF NOT EXISTS idx_nav_invoices_company_date ON public.nav_invoices(company_id, invoice_issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_nav_invoices_company_direction ON public.nav_invoices(company_id, invoice_direction, invoice_issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_nav_invoices_company_direction_date ON public.nav_invoices(company_id, invoice_direction, invoice_issue_date);
CREATE INDEX IF NOT EXISTS idx_nav_invoices_company_payment ON public.nav_invoices(company_id, invoice_direction, payment_method);
CREATE INDEX IF NOT EXISTS idx_nav_invoices_details_fetched ON public.nav_invoices(details_fetched) WHERE details_fetched = false;
CREATE INDEX IF NOT EXISTS idx_nav_invoices_gl_account_id ON public.nav_invoices(gl_account_id);
CREATE INDEX IF NOT EXISTS idx_nav_invoices_gl_classifications ON public.nav_invoices USING gin(gl_classifications);
CREATE INDEX IF NOT EXISTS idx_nav_invoices_outbound_unpaid ON public.nav_invoices(company_id, invoice_direction, invoice_issue_date) WHERE invoice_direction = 'OUTBOUND' AND transaction_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_nav_invoices_project_id ON public.nav_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_nav_invoices_supplier_partner ON public.nav_invoices(supplier_partner_id) WHERE supplier_partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nav_invoices_transaction_id ON public.nav_invoices(transaction_id);
CREATE INDEX IF NOT EXISTS idx_nav_invoices_user_id ON public.nav_invoices(user_id);
-- nav_sync_logs
CREATE INDEX IF NOT EXISTS idx_nav_sync_logs_company_id ON public.nav_sync_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_nav_sync_logs_user_id ON public.nav_sync_logs(user_id);
-- nylas_tokens
CREATE INDEX IF NOT EXISTS idx_nylas_tokens_user_id ON public.nylas_tokens(user_id);
-- partners
CREATE INDEX IF NOT EXISTS idx_partners_company_tax ON public.partners(company_id, tax_number);
CREATE INDEX IF NOT EXISTS idx_partners_default_project ON public.partners(default_project_id) WHERE default_project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_user_id ON public.partners(user_id);
-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email_verify_token ON public.profiles(email_verify_token) WHERE email_verify_token IS NOT NULL;
-- projects
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON public.projects(company_id);
-- salary
CREATE INDEX IF NOT EXISTS idx_salary_company_datum ON public.salary(company_id, "dátum" DESC);
CREATE INDEX IF NOT EXISTS idx_salary_company_datum_tipus ON public.salary(company_id, "dátum", tipus);
CREATE INDEX IF NOT EXISTS idx_salary_company_id ON public.salary(company_id);
CREATE INDEX IF NOT EXISTS idx_salary_salary_file_id ON public.salary(salary_file_id);
CREATE INDEX IF NOT EXISTS idx_salary_transaction_id ON public.salary(transaction_id);
CREATE INDEX IF NOT EXISTS idx_salary_user_id ON public.salary(user_id);
-- salary_files
CREATE INDEX IF NOT EXISTS idx_salary_files_company_id ON public.salary_files(company_id);
-- settings
CREATE INDEX IF NOT EXISTS idx_settings_user_category ON public.settings(user_id, category);
-- tax
CREATE INDEX IF NOT EXISTS idx_tax_company_id ON public.tax(company_id);
-- time_entries
CREATE INDEX IF NOT EXISTS idx_time_entries_company_date ON public.time_entries(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON public.time_entries(user_id, date);
-- transactions
CREATE INDEX IF NOT EXISTS idx_transactions_cash_types ON public.transactions(company_id, transaction_date) WHERE type = ANY(ARRAY['atm készpénzfelvét','pénztári kp felvét','pénztári kp befizetés','kp befizetés atm-en keresztül']);
CREATE INDEX IF NOT EXISTS idx_transactions_company_date ON public.transactions(company_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_company_date_currency ON public.transactions(company_id, transaction_date DESC, currency);
CREATE INDEX IF NOT EXISTS idx_transactions_company_matched ON public.transactions(company_id, matched_invoice_id) WHERE matched_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_company_type ON public.transactions(company_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_gl_account_id ON public.transactions(gl_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_gl_classifications ON public.transactions USING gin(gl_classifications);
CREATE INDEX IF NOT EXISTS idx_transactions_upload_id ON public.transactions(upload_id);
-- user_nav_credentials
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_nav_credentials_company_id ON public.user_nav_credentials(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_nav_credentials_user_id ON public.user_nav_credentials(user_id);
