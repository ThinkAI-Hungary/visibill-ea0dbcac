-- ============================================================
-- VISIBILL DATABASE MIGRATION - PART 5: Triggers
-- ============================================================

-- updated_at triggers
CREATE OR REPLACE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_company_members_updated_at BEFORE UPDATE ON public.company_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_invoices_frissitve BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_frissitve_column();
CREATE OR REPLACE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_tax_updated_at BEFORE UPDATE ON public.tax FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_salary_updated_at BEFORE UPDATE ON public.salary FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_settings_updated_at_trigger BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_settings_updated_at();
CREATE OR REPLACE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION update_user_subscriptions_updated_at();
CREATE OR REPLACE TRIGGER update_email_aliases_updated_at BEFORE UPDATE ON public.email_aliases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_employee_rates_updated_at BEFORE UPDATE ON public.employee_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_bank_statements_updated_at BEFORE UPDATE ON public.bank_statements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_bank_transactions_updated_at BEFORE UPDATE ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_bank_statement_uploads_updated_at BEFORE UPDATE ON public.bank_statement_uploads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_salary_files_updated_at BEFORE UPDATE ON public.salary_files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_feedback_updated_at BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION update_feedback_updated_at();
CREATE OR REPLACE TRIGGER update_nylas_tokens_updated_at BEFORE UPDATE ON public.nylas_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_user_email_preferences_updated_at BEFORE UPDATE ON public.user_email_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_fixed_assets_updated_at BEFORE UPDATE ON public.fixed_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_company_locations_updated_at BEFORE UPDATE ON public.company_locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_hp_settings_updated_at BEFORE UPDATE ON public.hp_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_gl_accounts_updated_at BEFORE UPDATE ON public.gl_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_chart_of_accounts_presets_updated_at BEFORE UPDATE ON public.chart_of_accounts_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Business logic triggers
CREATE OR REPLACE TRIGGER trigger_on_company_created AFTER INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION on_company_created();
CREATE OR REPLACE TRIGGER trigger_initialize_email_preferences AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION initialize_email_preferences();
CREATE OR REPLACE TRIGGER trigger_initialize_user_subscription AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION initialize_user_subscription();
CREATE OR REPLACE TRIGGER generate_project_code BEFORE INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION generate_project_code();
CREATE OR REPLACE TRIGGER trigger_auto_approve_high_confidence BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION auto_approve_high_confidence();
CREATE OR REPLACE TRIGGER trigger_auto_match_salary_transaction BEFORE INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION auto_match_salary_transaction();
CREATE OR REPLACE TRIGGER trigger_mark_nav_invoice_paid_on_transaction_match AFTER INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION mark_nav_invoice_paid_on_transaction_match();
CREATE OR REPLACE TRIGGER trigger_reset_paid_on_transaction_delete AFTER DELETE ON public.transactions FOR EACH ROW EXECUTE FUNCTION reset_paid_on_transaction_delete();
CREATE OR REPLACE TRIGGER trigger_reset_paid_on_transaction_unmatch AFTER UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION reset_paid_on_transaction_unmatch();
CREATE OR REPLACE TRIGGER trigger_mark_nav_invoice_submitted AFTER INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION mark_nav_invoice_as_submitted();
CREATE OR REPLACE TRIGGER trigger_reset_nav_submitted_on_invoice_delete AFTER DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION reset_nav_submitted_on_invoice_delete();
CREATE OR REPLACE TRIGGER trigger_match_nav_invoice_on_insert BEFORE INSERT ON public.nav_invoices FOR EACH ROW EXECUTE FUNCTION match_nav_invoice_on_insert();
CREATE OR REPLACE TRIGGER trigger_clear_transaction_match_on_invoice_delete BEFORE DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION clear_transaction_match_on_invoice_delete();
CREATE OR REPLACE TRIGGER trigger_set_invoice_feldolgozva BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION set_invoice_feldolgozva_on_upload_link();
CREATE OR REPLACE TRIGGER trigger_mark_invoice_upload_completed AFTER INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION mark_invoice_upload_completed_on_invoice_insert();
CREATE OR REPLACE TRIGGER trigger_mark_transaction_upload_completed AFTER INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION mark_transaction_upload_completed_on_transaction_insert();
CREATE OR REPLACE TRIGGER trigger_mark_salary_file_completed AFTER INSERT ON public.salary FOR EACH ROW EXECUTE FUNCTION mark_salary_file_completed_on_salary_insert();
CREATE OR REPLACE TRIGGER enforce_invoice_single_project BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION enforce_invoice_single_project();
CREATE OR REPLACE TRIGGER sync_salary_to_employee_rates AFTER INSERT ON public.salary FOR EACH ROW EXECUTE FUNCTION sync_salary_to_employee_rates();

-- Audit triggers
CREATE OR REPLACE TRIGGER audit_invoices_insert AFTER INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION audit_insert_delete_func();
CREATE OR REPLACE TRIGGER audit_invoices_delete AFTER DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION audit_insert_delete_func();
CREATE OR REPLACE TRIGGER audit_invoice_uploads_insert AFTER INSERT ON public.invoice_uploads FOR EACH ROW EXECUTE FUNCTION audit_insert_delete_func();
CREATE OR REPLACE TRIGGER audit_invoice_uploads_delete AFTER DELETE ON public.invoice_uploads FOR EACH ROW EXECUTE FUNCTION audit_insert_delete_func();
CREATE OR REPLACE TRIGGER audit_invoice_uploads_update AFTER UPDATE ON public.invoice_uploads FOR EACH ROW EXECUTE FUNCTION audit_update_processed_func();
CREATE OR REPLACE TRIGGER audit_salary_files_insert AFTER INSERT ON public.salary_files FOR EACH ROW EXECUTE FUNCTION audit_insert_delete_func();
CREATE OR REPLACE TRIGGER audit_salary_files_delete AFTER DELETE ON public.salary_files FOR EACH ROW EXECUTE FUNCTION audit_insert_delete_func();
CREATE OR REPLACE TRIGGER audit_salary_files_update AFTER UPDATE ON public.salary_files FOR EACH ROW EXECUTE FUNCTION audit_update_processed_func();

-- Auth trigger on auth.users (handle_new_user)
CREATE OR REPLACE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
