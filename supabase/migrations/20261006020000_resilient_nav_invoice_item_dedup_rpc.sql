-- Migration: 20261006020000_resilient_nav_invoice_item_dedup_rpc.sql
-- Description: Make save_nav_invoice_details_and_items resilient against duplicate or invalid line_number values
-- Prevents Postgres error 21000 ("ON CONFLICT DO UPDATE command cannot affect row a second time")
-- when NAV Online Számla XML contains duplicate <lineNumber> tags (e.g. modification rows, deposits, discounts)

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
    -- A) Delete obsolete line items not present in the normalized new set
    WITH parsed_input AS (
      SELECT
        arr.item,
        arr.ord::integer AS ord,
        (arr.item->>'line_number')::integer AS raw_line
      FROM jsonb_array_elements(p_line_items) WITH ORDINALITY AS arr(item, ord)
    ),
    stats AS (
      SELECT
        count(*) AS total_items,
        count(DISTINCT raw_line) FILTER (WHERE raw_line IS NOT NULL AND raw_line > 0) AS valid_distinct_lines,
        COALESCE(bool_and(raw_line IS NOT NULL AND raw_line > 0), false) AS all_positive
      FROM parsed_input
    ),
    normalized_items AS (
      SELECT
        CASE
          WHEN s.all_positive AND s.valid_distinct_lines = s.total_items THEN p.raw_line
          ELSE p.ord
        END AS safe_line_number
      FROM parsed_input p
      CROSS JOIN stats s
    )
    DELETE FROM public.nav_invoice_items
    WHERE nav_invoice_id = p_invoice_id
      AND line_number NOT IN (
        SELECT safe_line_number FROM normalized_items
      );

    -- B) Upsert all line items using safe, guaranteed-unique line numbers
    WITH parsed_input AS (
      SELECT
        arr.item,
        arr.ord::integer AS ord,
        (arr.item->>'line_number')::integer AS raw_line
      FROM jsonb_array_elements(p_line_items) WITH ORDINALITY AS arr(item, ord)
    ),
    stats AS (
      SELECT
        count(*) AS total_items,
        count(DISTINCT raw_line) FILTER (WHERE raw_line IS NOT NULL AND raw_line > 0) AS valid_distinct_lines,
        COALESCE(bool_and(raw_line IS NOT NULL AND raw_line > 0), false) AS all_positive
      FROM parsed_input
    ),
    normalized_items AS (
      SELECT
        p.item,
        CASE
          WHEN s.all_positive AND s.valid_distinct_lines = s.total_items THEN p.raw_line
          ELSE p.ord
        END AS safe_line_number
      FROM parsed_input p
      CROSS JOIN stats s
    )
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
      safe_line_number,
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
    FROM normalized_items
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

-- Security & Permissions: Strict service_role only (ADR A-193 §6)
REVOKE EXECUTE ON FUNCTION public.save_nav_invoice_details_and_items(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.save_nav_invoice_details_and_items(uuid, jsonb, jsonb) TO service_role;
