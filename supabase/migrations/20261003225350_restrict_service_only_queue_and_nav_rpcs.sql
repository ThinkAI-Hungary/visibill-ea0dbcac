-- Migration: 20261003225350_restrict_service_only_queue_and_nav_rpcs.sql
-- Description:
--   Security hardening of SECURITY DEFINER RPCs that are only meant for internal
--   callers (Edge Functions with service_role, Python worker with service_role,
--   pg_cron, or other SECURITY DEFINER functions running as owner).
--
--   Problem (found in 2026-10-03 DB health audit, see A-193 follow-up):
--     * save_nav_invoice_details_and_items was GRANTed to authenticated and has no
--       tenant check -> any logged-in user could overwrite any company's NAV invoice
--       header / line items by UUID, and could inject line items carrying a foreign
--       company_id (cross-tenant data injection).
--     * pgmq_set_vt / pgmq_send_retry / peek_queue_items / pgmq_metrics_all were
--       callable by authenticated -> users could hide, inject or inspect queue jobs.
--     * refresh_company_counts_cache was callable by authenticated -> users could
--       trigger 1-5 s full-table aggregation scans at will.
--
--   Verified callers before revoke (all service_role or owner context):
--     * supabase/functions/_shared/nav/nav-ingestion-service.ts (service client in
--       nav-sync, nav-auto-sync, nav-fetch-details, nav-query-outbound-invoices,
--       query-nav-invoices, customer-api)
--     * generate-pdf-export, aggreg8-sync, management-stats (service_role clients)
--     * worker: db.py (pgmq_send_retry), nav_item_processor.py / pgmq_consumer.py
--       (pgmq_set_vt) - settings.supabase_service_role_key
--     * DB: enqueue_transaction_rematch (SECDEF -> pgmq_send_retry),
--           get_company_counts (SECDEF -> refresh_company_counts_cache), pg_cron job 28
--     * Frontend (src/): no callers.
--
--   Rollback: re-run the GRANT ... TO authenticated statements from
--   20261003200000_idempotent_nav_invoice_items_and_vt.sql (and the previous ACL
--   {postgres=X, authenticated=X, service_role=X} for the other functions).

-- -----------------------------------------------------------------------------
-- 1. Tenant integrity: line items always inherit the parent invoice company_id.
--    Identical to 20261003200000 except:
--      * item->>'company_id' is ignored (was: COALESCE(item->>'company_id', v_company_id))
--      * search_path pinned to public, pg_temp
--    Behaviour-preserving for all current callers: nav-ingestion-service already
--    sends company_id = dbInvoice.company_id (the parent invoice's company).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_nav_invoice_details_and_items(
  p_invoice_id UUID,
  p_invoice_updates JSONB DEFAULT '{}'::jsonb,
  p_line_items JSONB DEFAULT '[]'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- 1. Fetch and verify invoice existence
  SELECT company_id INTO v_company_id
  FROM public.nav_invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice with ID % not found', p_invoice_id;
  END IF;

  -- 2. Update parent invoice header details
  IF p_invoice_updates IS NOT NULL AND jsonb_typeof(p_invoice_updates) = 'object' THEN
    UPDATE public.nav_invoices
    SET
      details_fetched = COALESCE((p_invoice_updates->>'details_fetched')::boolean, details_fetched),
      supplier_address = COALESCE(p_invoice_updates->>'supplier_address', supplier_address),
      customer_address = COALESCE(p_invoice_updates->>'customer_address', customer_address),
      is_cash_accounting = COALESCE((p_invoice_updates->>'is_cash_accounting')::boolean, is_cash_accounting),
      original_invoice_number = COALESCE(p_invoice_updates->>'original_invoice_number', original_invoice_number),
      vat_summary = COALESCE(p_invoice_updates->'vat_summary', vat_summary),
      is_reverse_charge = COALESCE((p_invoice_updates->>'is_reverse_charge')::boolean, is_reverse_charge),
      reverse_charge_category = COALESCE(p_invoice_updates->>'reverse_charge_category', reverse_charge_category)
    WHERE id = p_invoice_id;
  END IF;

  -- 3. Upsert line items atomically with ON CONFLICT DO UPDATE
  IF p_line_items IS NOT NULL AND jsonb_typeof(p_line_items) = 'array' AND jsonb_array_length(p_line_items) > 0 THEN
    -- Remove any obsolete line items not present in the new set
    DELETE FROM public.nav_invoice_items
    WHERE nav_invoice_id = p_invoice_id
      AND line_number NOT IN (
        SELECT (item->>'line_number')::integer
        FROM jsonb_array_elements(p_line_items) item
        WHERE (item->>'line_number') IS NOT NULL
      );

    -- Upsert all line items in the array (company_id always = parent invoice company)
    INSERT INTO public.nav_invoice_items (
      nav_invoice_id,
      company_id,
      line_number,
      line_description,
      quantity,
      unit_of_measure,
      unit_price,
      net_amount,
      vat_rate,
      vat_amount,
      gross_amount,
      product_code,
      line_delivery_period_from,
      line_delivery_period_to
    )
    SELECT
      p_invoice_id,
      v_company_id,
      (item->>'line_number')::integer,
      item->>'line_description',
      (item->>'quantity')::numeric,
      item->>'unit_of_measure',
      (item->>'unit_price')::numeric,
      COALESCE((item->>'net_amount')::numeric, 0),
      item->>'vat_rate',
      COALESCE((item->>'vat_amount')::numeric, 0),
      COALESCE((item->>'gross_amount')::numeric, 0),
      item->>'product_code',
      (item->>'line_delivery_period_from')::date,
      (item->>'line_delivery_period_to')::date
    FROM jsonb_array_elements(p_line_items) item
    ON CONFLICT (nav_invoice_id, line_number)
    DO UPDATE SET
      line_description = EXCLUDED.line_description,
      quantity = EXCLUDED.quantity,
      unit_of_measure = EXCLUDED.unit_of_measure,
      unit_price = EXCLUDED.unit_price,
      net_amount = EXCLUDED.net_amount,
      vat_rate = EXCLUDED.vat_rate,
      vat_amount = EXCLUDED.vat_amount,
      gross_amount = EXCLUDED.gross_amount,
      product_code = EXCLUDED.product_code,
      line_delivery_period_from = EXCLUDED.line_delivery_period_from,
      line_delivery_period_to = EXCLUDED.line_delivery_period_to;
  END IF;

  RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Service-role-only EXECUTE privileges (idempotent: REVOKE/GRANT are re-runnable)
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.save_nav_invoice_details_and_items(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.save_nav_invoice_details_and_items(uuid, jsonb, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pgmq_set_vt(text, bigint, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.pgmq_set_vt(text, bigint, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pgmq_send_retry(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.pgmq_send_retry(text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.peek_queue_items(text, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.peek_queue_items(text, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pgmq_metrics_all() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.pgmq_metrics_all() TO service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_company_counts_cache() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_company_counts_cache() TO service_role;
