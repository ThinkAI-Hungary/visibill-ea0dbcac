-- Migration: 20261003200000_idempotent_nav_invoice_items_and_vt.sql
-- Description:
--   1. Clean up existing duplicate (nav_invoice_id, line_number) rows in nav_invoice_items.
--   2. Add unique constraint on nav_invoice_items(nav_invoice_id, line_number).
--   3. Create atomic, race-condition-free RPC save_nav_invoice_details_and_items using ON CONFLICT DO UPDATE.
--   4. Expose public.pgmq_set_vt wrapper for worker visibility postponement (e.g. NAV 503 maintenance window).

-- Step 1: Clean up duplicate rows keeping the latest record
DELETE FROM public.nav_invoice_items a
USING public.nav_invoice_items b
WHERE a.nav_invoice_id = b.nav_invoice_id
  AND a.line_number = b.line_number
  AND a.id < b.id;

-- Step 2: Add unique index on nav_invoice_items(nav_invoice_id, line_number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_nav_invoice_items_unique_line
ON public.nav_invoice_items (nav_invoice_id, line_number);

-- Step 3: Atomic RPC function to persist invoice details and line items in a single transaction
CREATE OR REPLACE FUNCTION public.save_nav_invoice_details_and_items(
  p_invoice_id UUID,
  p_invoice_updates JSONB DEFAULT '{}'::jsonb,
  p_line_items JSONB DEFAULT '[]'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    -- Upsert all line items in the array
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
      COALESCE((item->>'company_id')::uuid, v_company_id),
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

-- Security & Permissions for save_nav_invoice_details_and_items
REVOKE ALL ON FUNCTION public.save_nav_invoice_details_and_items(UUID, JSONB, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_nav_invoice_details_and_items(UUID, JSONB, JSONB) TO authenticated, service_role;

-- Step 4: Wrapper function for pgmq.set_vt
CREATE OR REPLACE FUNCTION public.pgmq_set_vt(
  queue_name text,
  msg_id bigint,
  vt integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN to_jsonb(pgmq.set_vt(queue_name, msg_id, vt));
END;
$$;

-- Security & Permissions for pgmq_set_vt
REVOKE ALL ON FUNCTION public.pgmq_set_vt(text, bigint, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pgmq_set_vt(text, bigint, integer) TO authenticated, service_role;
