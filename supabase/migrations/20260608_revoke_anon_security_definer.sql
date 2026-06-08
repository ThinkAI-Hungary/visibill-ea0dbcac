-- =====================================================
-- Migration: Revoke anon EXECUTE on SECURITY DEFINER functions
-- Risk: ZERO — frontend uses 'authenticated', worker uses 'service_role'
-- Ref: Supabase Security Advisor + ADR A-017
-- =====================================================

-- =====================================================
-- 1. Business RPC Functions (frontend-hívott)
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.freeze_annual_data(uuid, uuid, uuid, integer, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_annual_report(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pnl_report(uuid, uuid, date, date, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_bs_report(uuid, uuid, date, integer, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_invoice_aggregates FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_bs_mappings(uuid, uuid, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_bs_prior_year(uuid, integer, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rematch_courier_report(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_default_vat_codes FROM anon, PUBLIC;

-- =====================================================
-- 2. Filtered invoice query functions (2 overloads each)
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, numeric, numeric, text, text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date) FROM anon, PUBLIC;

-- =====================================================
-- 3. Management / Admin functions
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.get_user_emails_for_management(uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_accounty_company_summary(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_accounty_company_names(uuid[]) FROM anon, PUBLIC;

-- =====================================================
-- 4. Auth / Helper functions
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.check_request() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_is_company_member(uuid) FROM anon, PUBLIC;

-- =====================================================
-- 5. Queue functions (PGMQ wrappers — worker-only)
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.pgmq_read(text, integer, integer, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pgmq_archive(text, bigint) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pgmq_delete(text, bigint) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pgmq_metrics(text) FROM anon, PUBLIC;

-- =====================================================
-- 6. Trigger / Internal functions (should never be called via REST)
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.global_audit_trigger_func() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_report_job() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_enqueue_gl_job() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_enqueue_invoice_job() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_enqueue_transaction_job() FROM anon, PUBLIC;

-- =====================================================
-- 7. Worker claim functions
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.claim_gl_jobs FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_transaction_jobs FROM anon, PUBLIC;

-- =====================================================
-- 8. Other internal functions
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.on_company_created() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accounty_set_updated_at() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_vat_updated_at() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_annual_reports_updated_at() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_ticket_number() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_ticket_created_event() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_ticket_status_event() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_comment_event() FROM anon, PUBLIC;

-- =====================================================
-- Ensure 'authenticated' role can still EXECUTE business functions
-- (should be inherited from PUBLIC grant, but let's be explicit)
-- =====================================================
GRANT EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.freeze_annual_data(uuid, uuid, uuid, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_annual_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pnl_report(uuid, uuid, date, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bs_report(uuid, uuid, date, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_aggregates TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_bs_mappings(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_bs_prior_year(uuid, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rematch_courier_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_vat_codes TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, numeric, numeric, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_emails_for_management(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accounty_company_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accounty_company_names(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_request() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_company_member(uuid) TO authenticated;
