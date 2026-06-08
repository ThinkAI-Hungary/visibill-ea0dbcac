-- =====================================================
-- Migration: Fix permissive RLS + search_path mutable
-- Applied: 2026-06-08
-- =====================================================

-- =====================================================
-- 1. Permissive RLS Fix (USING true → company_id check)
-- =====================================================

-- missing_items: tighten to accountant's companies
DROP POLICY IF EXISTS "missing_items_portal_update_auth" ON public.accounty_missing_items;
CREATE POLICY "missing_items_portal_update_auth" ON public.accounty_missing_items
  FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ))
  WITH CHECK (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ));

-- uploads: tighten update
DROP POLICY IF EXISTS "uploads_auth_update" ON public.accounty_uploads;
CREATE POLICY "uploads_auth_update" ON public.accounty_uploads
  FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ));

-- uploads: tighten insert
DROP POLICY IF EXISTS "uploads_insert" ON public.accounty_uploads;
CREATE POLICY "uploads_insert" ON public.accounty_uploads
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT aa.company_id FROM accounty_assignments aa
    WHERE aa.accountant_user_id = (SELECT auth.uid())
  ));

-- =====================================================
-- 2. Search Path Fix (all SECURITY DEFINER functions)
-- =====================================================
ALTER FUNCTION public.calculate_vat_return SET search_path TO 'public';
ALTER FUNCTION public.check_request SET search_path TO 'public';
ALTER FUNCTION public.claim_invoice_jobs SET search_path TO 'public';
ALTER FUNCTION public.create_comment_event SET search_path TO 'public';
ALTER FUNCTION public.create_ticket_created_event SET search_path TO 'public';
ALTER FUNCTION public.create_ticket_status_event SET search_path TO 'public';
ALTER FUNCTION public.enqueue_report_job SET search_path TO 'public';
ALTER FUNCTION public.freeze_annual_data SET search_path TO 'public';
ALTER FUNCTION public.generate_ticket_number SET search_path TO 'public';
ALTER FUNCTION public.get_accounty_company_names SET search_path TO 'public';
ALTER FUNCTION public.get_accounty_company_summary SET search_path TO 'public';
ALTER FUNCTION public.get_bs_report SET search_path TO 'public';
ALTER FUNCTION public.get_gl_categorized_items SET search_path TO 'public';
ALTER FUNCTION public.get_invoice_aggregates SET search_path TO 'public';
ALTER FUNCTION public.get_pnl_report SET search_path TO 'public';
ALTER FUNCTION public.get_user_emails_for_management SET search_path TO 'public';
ALTER FUNCTION public.global_audit_trigger_func SET search_path TO 'public';
ALTER FUNCTION public.on_company_created SET search_path TO 'public';
ALTER FUNCTION public.pgmq_archive SET search_path TO 'public';
ALTER FUNCTION public.pgmq_delete SET search_path TO 'public';
ALTER FUNCTION public.pgmq_metrics SET search_path TO 'public';
ALTER FUNCTION public.pgmq_read SET search_path TO 'public';
ALTER FUNCTION public.rematch_courier_report SET search_path TO 'public';
ALTER FUNCTION public.save_bs_mappings SET search_path TO 'public';
ALTER FUNCTION public.save_bs_prior_year SET search_path TO 'public';
ALTER FUNCTION public.trigger_enqueue_gl_job SET search_path TO 'public';
ALTER FUNCTION public.trigger_enqueue_invoice_job SET search_path TO 'public';
ALTER FUNCTION public.trigger_enqueue_transaction_job SET search_path TO 'public';
ALTER FUNCTION public.user_is_company_member SET search_path TO 'public';
ALTER FUNCTION public.validate_annual_report SET search_path TO 'public';
ALTER FUNCTION public.accounty_set_updated_at SET search_path TO 'public';
ALTER FUNCTION public.update_vat_updated_at SET search_path TO 'public';
ALTER FUNCTION public.update_annual_reports_updated_at SET search_path TO 'public';
