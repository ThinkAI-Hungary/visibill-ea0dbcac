-- Migration: 20260905200000_fix_function_search_path_mutable.sql
-- Description: Pin search_path = public on all application functions to eliminate
-- Function Search Path Mutable security warnings and prevent Search Path Injection (CVE-2018-1058).

-- ============================================================================
-- 1. SECURITY DEFINER Functions (31 functions - High Priority Security Fix)
-- ============================================================================
ALTER FUNCTION public.acc_generate_post_opening_reconciliations(p_company_id uuid, p_user_id uuid, p_year smallint) SET search_path = public;
ALTER FUNCTION public.acc_get_next_journal_number(p_journal_id uuid, p_year smallint) SET search_path = public;
ALTER FUNCTION public.acc_log_journal_audit() SET search_path = public;
ALTER FUNCTION public.acc_post_journal_entry(p_header_id uuid, p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.acc_seed_default_journals(p_company_id uuid) SET search_path = public;
ALTER FUNCTION public.acc_storno_journal_entry(p_header_id uuid, p_user_id uuid, p_reason text, p_create_correction boolean) SET search_path = public;
ALTER FUNCTION public.acc_validate_and_post_opening_entry(p_header_id uuid, p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.apply_item_project_rules() SET search_path = public;
ALTER FUNCTION public.cleanup_pdf_exports() SET search_path = public;
ALTER FUNCTION public.delete_audit_import(p_import_id uuid) SET search_path = public;
ALTER FUNCTION public.delete_upload_with_data(p_upload_id uuid, p_upload_type text) SET search_path = public;
ALTER FUNCTION public.generate_ticket_number() SET search_path = public;
ALTER FUNCTION public.get_accounty_dashboard_kpis(p_company_ids uuid[], p_now_date date, p_week_date date) SET search_path = public;
ALTER FUNCTION public.get_bs_report(p_company_id uuid, p_preset_id uuid, p_date_to date, p_fiscal_year integer, p_exchange_rates jsonb) SET search_path = public;
ALTER FUNCTION public.get_company_counts() SET search_path = public;
ALTER FUNCTION public.get_ev_ytd_revenue_by_company(p_tax_year integer) SET search_path = public;
ALTER FUNCTION public.get_gl_number_from_classifications(classifications jsonb) SET search_path = public;
ALTER FUNCTION public.get_management_files(p_page integer, p_page_size integer, p_sort_by text, p_sort_dir text, p_search text, p_company_id uuid, p_user_id uuid, p_file_type text, p_status text, p_date_from timestamp with time zone, p_date_to timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.get_missing_counts_by_company(p_company_ids uuid[]) SET search_path = public;
ALTER FUNCTION public.get_nav_credentials(p_user_id uuid, p_company_id uuid) SET search_path = public;
ALTER FUNCTION public.get_nav_invoice_aggregates(p_company_id uuid, p_date_from date, p_date_to date) SET search_path = public;
ALTER FUNCTION public.get_partner_monthly_cash_total(p_company_id uuid, p_partner_id uuid, p_partner_name text, p_date date) SET search_path = public;
ALTER FUNCTION public.get_unread_ticket_count(p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.peek_queue_items(queue_name text, max_items integer) SET search_path = public;
ALTER FUNCTION public.save_item_project_rule_and_retroactive(p_company_id uuid, p_line_description text, p_gl_number text, p_project_id uuid, p_user_id uuid) SET search_path = public;
ALTER FUNCTION public.sync_accounty_employee_to_rates() SET search_path = public;
ALTER FUNCTION public.sync_accounty_employment_to_rates() SET search_path = public;
ALTER FUNCTION public.sync_ev_fixed_assets() SET search_path = public;
ALTER FUNCTION public.validate_annual_report(p_report_id uuid) SET search_path = public;
ALTER FUNCTION public.worker_daily_counts(days_back integer) SET search_path = public;
ALTER FUNCTION public.worker_pipeline_stats(since_ts timestamp with time zone) SET search_path = public;

-- ============================================================================
-- 2. SECURITY INVOKER Functions (16 functions - Triggers and Utilities)
-- ============================================================================
ALTER FUNCTION public.acc_check_journal_balance() SET search_path = public;
ALTER FUNCTION public.acc_enforce_header_immutability() SET search_path = public;
ALTER FUNCTION public.acc_enforce_line_immutability() SET search_path = public;
ALTER FUNCTION public.accounty_ai_session_touch() SET search_path = public;
ALTER FUNCTION public.auto_detect_reverse_charge() SET search_path = public;
ALTER FUNCTION public.fn_accounty_check_period_closed() SET search_path = public;
ALTER FUNCTION public.fn_accounty_prevent_closed_update() SET search_path = public;
ALTER FUNCTION public.get_audit_gl_balances(p_import_id uuid, p_date_from date, p_date_to date) SET search_path = public;
ALTER FUNCTION public.get_courier_reports_counts_by_upload(p_upload_ids uuid[]) SET search_path = public;
ALTER FUNCTION public.get_reconciliation_status(p_company_id uuid, p_preset_id uuid, p_date_to date) SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.seed_fad_vat_codes(p_company_id uuid) SET search_path = public;
ALTER FUNCTION public.suggest_gl_mappings(p_company_id uuid, p_preset_id uuid) SET search_path = public;
ALTER FUNCTION public.update_accounty_push_prefs_updated_at() SET search_path = public;
ALTER FUNCTION public.update_accounty_push_subs_updated_at() SET search_path = public;
ALTER FUNCTION public.update_pdf_export_jobs_updated_at() SET search_path = public;
