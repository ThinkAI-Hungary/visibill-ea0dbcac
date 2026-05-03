-- ============================================================
-- VISIBILL DATABASE MIGRATION - PART 6: RLS Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_nav_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nav_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nav_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nav_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_overrides_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_upload_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nylas_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tao_depreciation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dunning_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sima_szamla_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vegszamla_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egyszerusitett_szamla_backup ENABLE ROW LEVEL SECURITY;

-- ===== PROFILES =====
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- ===== COMPANIES =====
CREATE POLICY "companies_select" ON public.companies FOR SELECT USING (user_is_company_member(id));
CREATE POLICY "companies_insert" ON public.companies FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "companies_update" ON public.companies FOR UPDATE USING (user_is_company_member(id));
CREATE POLICY "companies_delete" ON public.companies FOR DELETE USING (auth.uid() = owner_id);

-- ===== COMPANY_MEMBERS =====
CREATE POLICY "company_members_select" ON public.company_members FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "company_members_insert" ON public.company_members FOR INSERT WITH CHECK (is_company_admin(company_id) OR auth.uid() = user_id);
CREATE POLICY "company_members_update" ON public.company_members FOR UPDATE USING (is_company_admin(company_id));
CREATE POLICY "company_members_delete" ON public.company_members FOR DELETE USING (is_company_admin(company_id) OR auth.uid() = user_id);

-- ===== COMPANY_LOCATIONS =====
CREATE POLICY "company_locations_select" ON public.company_locations FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "company_locations_insert" ON public.company_locations FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "company_locations_update" ON public.company_locations FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "company_locations_delete" ON public.company_locations FOR DELETE USING (is_company_admin(company_id));

-- ===== COMPANY_SETTINGS =====
CREATE POLICY "company_settings_select" ON public.company_settings FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "company_settings_insert" ON public.company_settings FOR INSERT WITH CHECK (is_company_admin(company_id));
CREATE POLICY "company_settings_update" ON public.company_settings FOR UPDATE USING (is_company_admin(company_id));

-- ===== INVOICES =====
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE USING (user_is_company_member(company_id));

-- ===== INVOICE_ITEMS =====
CREATE POLICY "invoice_items_select" ON public.invoice_items FOR SELECT USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND user_is_company_member(i.company_id)));
CREATE POLICY "invoice_items_insert" ON public.invoice_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND user_is_company_member(i.company_id)));
CREATE POLICY "invoice_items_update" ON public.invoice_items FOR UPDATE USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND user_is_company_member(i.company_id)));
CREATE POLICY "invoice_items_delete" ON public.invoice_items FOR DELETE USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND user_is_company_member(i.company_id)));

-- ===== INVOICE_UPLOADS =====
CREATE POLICY "invoice_uploads_select" ON public.invoice_uploads FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "invoice_uploads_insert" ON public.invoice_uploads FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "invoice_uploads_update" ON public.invoice_uploads FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "invoice_uploads_delete" ON public.invoice_uploads FOR DELETE USING (user_is_company_member(company_id));

-- ===== CATEGORIES =====
CREATE POLICY "categories_select" ON public.categories FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "categories_insert" ON public.categories FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "categories_update" ON public.categories FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "categories_delete" ON public.categories FOR DELETE USING (user_is_company_member(company_id));

-- ===== TAX =====
CREATE POLICY "tax_select" ON public.tax FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "tax_insert" ON public.tax FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "tax_update" ON public.tax FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "tax_delete" ON public.tax FOR DELETE USING (user_is_company_member(company_id));

-- ===== SALARY =====
CREATE POLICY "salary_select" ON public.salary FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "salary_insert" ON public.salary FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "salary_update" ON public.salary FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "salary_delete" ON public.salary FOR DELETE USING (user_is_company_member(company_id));

-- ===== SALARY_FILES =====
CREATE POLICY "salary_files_select" ON public.salary_files FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "salary_files_insert" ON public.salary_files FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "salary_files_update" ON public.salary_files FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "salary_files_delete" ON public.salary_files FOR DELETE USING (user_is_company_member(company_id));

-- ===== TRANSACTIONS =====
CREATE POLICY "transactions_select" ON public.transactions FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "transactions_insert" ON public.transactions FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "transactions_update" ON public.transactions FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "transactions_delete" ON public.transactions FOR DELETE USING (user_is_company_member(company_id));

-- ===== TRANSACTION_UPLOADS =====
CREATE POLICY "transaction_uploads_select" ON public.transaction_uploads FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "transaction_uploads_insert" ON public.transaction_uploads FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "transaction_uploads_update" ON public.transaction_uploads FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "transaction_uploads_delete" ON public.transaction_uploads FOR DELETE USING (user_is_company_member(company_id));

-- ===== BANK_STATEMENTS =====
CREATE POLICY "bank_statements_select" ON public.bank_statements FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "bank_statements_insert" ON public.bank_statements FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "bank_statements_update" ON public.bank_statements FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "bank_statements_delete" ON public.bank_statements FOR DELETE USING (user_is_company_member(company_id));

-- ===== BANK_TRANSACTIONS =====
CREATE POLICY "bank_transactions_select" ON public.bank_transactions FOR SELECT USING (EXISTS (SELECT 1 FROM bank_statements bs WHERE bs.id = bank_statement_id AND user_is_company_member(bs.company_id)));
CREATE POLICY "bank_transactions_insert" ON public.bank_transactions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM bank_statements bs WHERE bs.id = bank_statement_id AND user_is_company_member(bs.company_id)));

-- ===== BANK_STATEMENT_UPLOADS =====
CREATE POLICY "bank_statement_uploads_select" ON public.bank_statement_uploads FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "bank_statement_uploads_insert" ON public.bank_statement_uploads FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "bank_statement_uploads_update" ON public.bank_statement_uploads FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "bank_statement_uploads_delete" ON public.bank_statement_uploads FOR DELETE USING (user_is_company_member(company_id));

-- ===== SETTINGS =====
CREATE POLICY "settings_select" ON public.settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "settings_insert" ON public.settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "settings_update" ON public.settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "settings_delete" ON public.settings FOR DELETE USING (auth.uid() = user_id);

-- ===== USER_SUBSCRIPTIONS =====
CREATE POLICY "user_subscriptions_select" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_subscriptions_insert" ON public.user_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_subscriptions_update" ON public.user_subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- ===== USER_EMAIL_PREFERENCES =====
CREATE POLICY "user_email_preferences_select" ON public.user_email_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_email_preferences_insert" ON public.user_email_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_email_preferences_update" ON public.user_email_preferences FOR UPDATE USING (auth.uid() = user_id);

-- ===== USER_NAV_CREDENTIALS =====
CREATE POLICY "user_nav_credentials_select" ON public.user_nav_credentials FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "user_nav_credentials_insert" ON public.user_nav_credentials FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "user_nav_credentials_update" ON public.user_nav_credentials FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "user_nav_credentials_delete" ON public.user_nav_credentials FOR DELETE USING (user_is_company_member(company_id));

-- ===== EMAIL_ALIASES =====
CREATE POLICY "email_aliases_select" ON public.email_aliases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "email_aliases_insert" ON public.email_aliases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "email_aliases_update" ON public.email_aliases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "email_aliases_delete" ON public.email_aliases FOR DELETE USING (auth.uid() = user_id);

-- ===== NAV_INVOICES =====
CREATE POLICY "nav_invoices_select" ON public.nav_invoices FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "nav_invoices_insert" ON public.nav_invoices FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "nav_invoices_update" ON public.nav_invoices FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "nav_invoices_delete" ON public.nav_invoices FOR DELETE USING (user_is_company_member(company_id));

-- ===== NAV_INVOICE_ITEMS =====
CREATE POLICY "nav_invoice_items_select" ON public.nav_invoice_items FOR SELECT USING (EXISTS (SELECT 1 FROM nav_invoices ni WHERE ni.id = nav_invoice_id AND user_is_company_member(ni.company_id)));
CREATE POLICY "nav_invoice_items_insert" ON public.nav_invoice_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM nav_invoices ni WHERE ni.id = nav_invoice_id AND user_is_company_member(ni.company_id)));
CREATE POLICY "nav_invoice_items_update" ON public.nav_invoice_items FOR UPDATE USING (EXISTS (SELECT 1 FROM nav_invoices ni WHERE ni.id = nav_invoice_id AND user_is_company_member(ni.company_id)));
CREATE POLICY "nav_invoice_items_delete" ON public.nav_invoice_items FOR DELETE USING (EXISTS (SELECT 1 FROM nav_invoices ni WHERE ni.id = nav_invoice_id AND user_is_company_member(ni.company_id)));

-- ===== NAV_SYNC_LOGS =====
CREATE POLICY "nav_sync_logs_select" ON public.nav_sync_logs FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "nav_sync_logs_insert" ON public.nav_sync_logs FOR INSERT WITH CHECK (user_is_company_member(company_id));

-- ===== PROJECTS =====
CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "projects_insert" ON public.projects FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "projects_update" ON public.projects FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "projects_delete" ON public.projects FOR DELETE USING (user_is_company_member(company_id));

-- ===== AUDIT_LOGS =====
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT WITH CHECK (user_is_company_member(company_id));

-- ===== GL_OVERRIDES_LOG =====
CREATE POLICY "gl_overrides_select" ON public.gl_overrides_log FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "gl_overrides_insert" ON public.gl_overrides_log FOR INSERT WITH CHECK (user_is_company_member(company_id));

-- ===== GL_UPLOAD_NOTIFICATIONS =====
CREATE POLICY "gl_upload_notifications_select" ON public.gl_upload_notifications FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "gl_upload_notifications_insert" ON public.gl_upload_notifications FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "gl_upload_notifications_delete" ON public.gl_upload_notifications FOR DELETE USING (user_is_company_member(company_id));

-- ===== EMPLOYEE_RATES =====
CREATE POLICY "employee_rates_select" ON public.employee_rates FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "employee_rates_insert" ON public.employee_rates FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "employee_rates_update" ON public.employee_rates FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "employee_rates_delete" ON public.employee_rates FOR DELETE USING (is_company_admin(company_id));

-- ===== TIME_ENTRIES =====
CREATE POLICY "time_entries_select" ON public.time_entries FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "time_entries_insert" ON public.time_entries FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "time_entries_update" ON public.time_entries FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "time_entries_delete" ON public.time_entries FOR DELETE USING (user_is_company_member(company_id));

-- ===== LEAVE_REQUESTS =====
CREATE POLICY "leave_requests_select" ON public.leave_requests FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "leave_requests_insert" ON public.leave_requests FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "leave_requests_update" ON public.leave_requests FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "leave_requests_delete" ON public.leave_requests FOR DELETE USING (auth.uid() = user_id OR is_company_admin(company_id));

-- ===== FIXED_ASSETS =====
CREATE POLICY "fixed_assets_select" ON public.fixed_assets FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "fixed_assets_insert" ON public.fixed_assets FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "fixed_assets_update" ON public.fixed_assets FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "fixed_assets_delete" ON public.fixed_assets FOR DELETE USING (user_is_company_member(company_id));

-- ===== ASSET_EVENTS =====
CREATE POLICY "asset_events_select" ON public.asset_events FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "asset_events_insert" ON public.asset_events FOR INSERT WITH CHECK (user_is_company_member(company_id));

-- ===== PARTNERS =====
CREATE POLICY "partners_select" ON public.partners FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "partners_insert" ON public.partners FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "partners_update" ON public.partners FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "partners_delete" ON public.partners FOR DELETE USING (user_is_company_member(company_id));

-- ===== NYLAS_TOKENS =====
CREATE POLICY "nylas_tokens_select" ON public.nylas_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "nylas_tokens_insert" ON public.nylas_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nylas_tokens_update" ON public.nylas_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "nylas_tokens_delete" ON public.nylas_tokens FOR DELETE USING (auth.uid() = user_id);

-- ===== TAO_DEPRECIATION_TEMPLATES =====
CREATE POLICY "tao_templates_select" ON public.tao_depreciation_templates FOR SELECT TO authenticated USING (true);

-- ===== CHART_OF_ACCOUNTS_PRESETS =====
CREATE POLICY "presets_select" ON public.chart_of_accounts_presets FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "presets_insert" ON public.chart_of_accounts_presets FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "presets_update" ON public.chart_of_accounts_presets FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "presets_delete" ON public.chart_of_accounts_presets FOR DELETE USING (user_is_company_member(company_id));

-- ===== GL_ACCOUNTS =====
CREATE POLICY "gl_accounts_select" ON public.gl_accounts FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "gl_accounts_insert" ON public.gl_accounts FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "gl_accounts_update" ON public.gl_accounts FOR UPDATE USING (user_is_company_member(company_id));
CREATE POLICY "gl_accounts_delete" ON public.gl_accounts FOR DELETE USING (user_is_company_member(company_id));

-- ===== HP_SETTINGS =====
CREATE POLICY "hp_settings_select" ON public.hp_settings FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "hp_settings_insert" ON public.hp_settings FOR INSERT WITH CHECK (user_is_company_member(company_id));
CREATE POLICY "hp_settings_update" ON public.hp_settings FOR UPDATE USING (user_is_company_member(company_id));

-- ===== FEEDBACK =====
CREATE POLICY "feedback_insert" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "feedback_select" ON public.feedback FOR SELECT USING (auth.uid() = user_id);

-- ===== DUNNING_SENDS =====
CREATE POLICY "dunning_sends_select" ON public.dunning_sends FOR SELECT USING (user_is_company_member(company_id));
CREATE POLICY "dunning_sends_insert" ON public.dunning_sends FOR INSERT WITH CHECK (user_is_company_member(company_id));

-- ===== BACKUP TABLES =====
CREATE POLICY "sima_szamla_backup_select" ON public.sima_szamla_backup FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sima_szamla_backup_all" ON public.sima_szamla_backup USING (auth.uid() = user_id);
CREATE POLICY "vegszamla_backup_select" ON public.vegszamla_backup FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vegszamla_backup_all" ON public.vegszamla_backup USING (auth.uid() = user_id);
CREATE POLICY "proforma_backup_select" ON public.proforma_backup FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "proforma_backup_all" ON public.proforma_backup USING (auth.uid() = user_id);
CREATE POLICY "egyszerusitett_szamla_backup_select" ON public.egyszerusitett_szamla_backup FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "egyszerusitett_szamla_backup_all" ON public.egyszerusitett_szamla_backup USING (auth.uid() = user_id);

-- ===== EXTENSIONS =====
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;
