-- =============================================================================
-- Migration: 20260920200000_backfill_nav_invoices_vat_summary.sql
-- Description: Creates the batch backfill function for nav_invoices.vat_summary
--              from existing nav_invoice_items and headers, and executes it.
-- Architecture: ADR A-132, PRD P-099
-- =============================================================================

CREATE OR REPLACE FUNCTION public.backfill_nav_invoices_vat_summary(p_batch_size integer DEFAULT 5000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  WITH batch AS (
    SELECT id
    FROM nav_invoices
    WHERE vat_summary IS NULL
    LIMIT p_batch_size
  ),
  invoices_with_items AS (
    SELECT DISTINCT nav_invoice_id as id
    FROM nav_invoice_items
    WHERE nav_invoice_id IN (SELECT id FROM batch)
  ),
  aggregated_rates AS (
    SELECT 
      nii.nav_invoice_id,
      CASE 
        WHEN nii.vat_rate IN ('0.27', '27', '27.0', '27.00') THEN '27%'
        WHEN nii.vat_rate IN ('0.05', '5', '5.0', '5.00') THEN '5%'
        WHEN nii.vat_rate IN ('0.18', '18', '18.0', '18.00') THEN '18%'
        WHEN nii.vat_rate ILIKE '%AAM%' THEN 'AAM'
        WHEN nii.vat_rate ILIKE '%TAM%' THEN 'TAM'
        WHEN nii.vat_rate ILIKE '%KBAET%' THEN 'KBAET'
        WHEN nii.vat_rate ILIKE '%DOMESTIC_REVERSE_CHARGE%' OR nii.vat_rate ILIKE '%FAD%' THEN 'FAD'
        WHEN nii.vat_rate ILIKE '%ATHK%' THEN 'ATHK'
        WHEN nii.vat_rate ILIKE '%EUK%' THEN 'EUK'
        WHEN nii.vat_rate ILIKE '%AHK%' THEN 'AHK'
        WHEN nii.vat_rate IS NULL AND s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.27 THEN '27%'
        WHEN nii.vat_rate IS NULL AND s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.05 THEN '5%'
        WHEN nii.vat_rate IS NULL AND s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.18 THEN '18%'
        ELSE COALESCE(nii.vat_rate, '0%')
      END as rate_label,
      CASE 
        WHEN nii.vat_rate IN ('0.27', '27', '27.0', '27.00') THEN 0.27
        WHEN nii.vat_rate IN ('0.05', '5', '5.0', '5.00') THEN 0.05
        WHEN nii.vat_rate IN ('0.18', '18', '18.0', '18.00') THEN 0.18
        WHEN nii.vat_rate IS NULL AND s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.27 THEN 0.27
        WHEN nii.vat_rate IS NULL AND s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.05 THEN 0.05
        WHEN nii.vat_rate IS NULL AND s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.18 THEN 0.18
        ELSE 0
      END as rate_percent,
      CASE 
        WHEN nii.vat_rate ILIKE '%AAM%' OR nii.vat_rate ILIKE '%TAM%' OR nii.vat_rate ILIKE '%KBAET%' THEN 'exemption'
        WHEN nii.vat_rate ILIKE '%DOMESTIC_REVERSE_CHARGE%' OR nii.vat_rate ILIKE '%FAD%' THEN 'reverse_charge'
        WHEN nii.vat_rate ILIKE '%ATHK%' OR nii.vat_rate ILIKE '%EUK%' OR nii.vat_rate ILIKE '%AHK%' THEN 'out_of_scope'
        ELSE 'percentage'
      END as rate_cat,
      COALESCE(SUM(nii.net_amount), 0) as net,
      COALESCE(SUM(nii.vat_amount), 0) as vat,
      COALESCE(SUM(COALESCE(nii.gross_amount, nii.net_amount + nii.vat_amount)), 0) as gross
    FROM nav_invoice_items nii
    JOIN nav_invoices s ON s.id = nii.nav_invoice_id
    WHERE s.id IN (SELECT id FROM invoices_with_items)
    GROUP BY nii.nav_invoice_id, rate_label, rate_percent, rate_cat
  ),
  item_summaries AS (
    SELECT 
      s.id,
      jsonb_build_object(
        'vatSummaries', jsonb_agg(
          jsonb_build_object(
            'vatPercentage', ar.rate_percent,
            'vatRateLiteral', ar.rate_label,
            'category', ar.rate_cat,
            'netAmount', ar.net,
            'vatAmount', ar.vat,
            'grossAmount', ar.gross,
            'netAmountHUF', ar.net,
            'vatAmountHUF', ar.vat,
            'grossAmountHUF', ar.gross,
            'isReverseCharge', ar.rate_cat = 'reverse_charge'
          )
        ),
        'invoiceNetAmount', s.invoice_net_amount,
        'invoiceNetAmountHUF', s.invoice_net_amount,
        'invoiceVatAmount', s.invoice_vat_amount,
        'invoiceVatAmountHUF', s.invoice_vat_amount,
        'invoiceGrossAmount', s.invoice_gross_amount,
        'invoiceGrossAmountHUF', s.invoice_gross_amount,
        'hasReverseCharge', bool_or(ar.rate_cat = 'reverse_charge' OR COALESCE(s.is_reverse_charge, false))
      ) as summary
    FROM nav_invoices s
    JOIN aggregated_rates ar ON ar.nav_invoice_id = s.id
    WHERE s.id IN (SELECT id FROM invoices_with_items)
    GROUP BY s.id, s.invoice_net_amount, s.invoice_vat_amount, s.invoice_gross_amount, s.is_reverse_charge
  ),
  header_summaries AS (
    SELECT 
      s.id,
      jsonb_build_object(
        'vatSummaries', jsonb_build_array(
          jsonb_build_object(
            'vatPercentage', CASE 
              WHEN s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.27 THEN 0.27
              WHEN s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.18 THEN 0.18
              WHEN s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.05 THEN 0.05
              WHEN s.invoice_vat_amount = 0 OR s.invoice_vat_amount IS NULL THEN 0
              WHEN s.invoice_net_amount > 0 THEN ROUND(s.invoice_vat_amount / s.invoice_net_amount, 4)
              ELSE 0
            END,
            'vatRateLiteral', CASE 
              WHEN COALESCE(s.is_reverse_charge, false) THEN 'FAD'
              WHEN s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.27 THEN '27%'
              WHEN s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.18 THEN '18%'
              WHEN s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.05 THEN '5%'
              WHEN s.invoice_vat_amount = 0 OR s.invoice_vat_amount IS NULL THEN '0%'
              WHEN s.invoice_net_amount > 0 THEN ROUND(s.invoice_vat_amount / s.invoice_net_amount * 100) || '%'
              ELSE '0%'
            END,
            'category', CASE 
              WHEN COALESCE(s.is_reverse_charge, false) THEN 'reverse_charge'
              WHEN s.invoice_vat_amount = 0 OR s.invoice_vat_amount IS NULL THEN 'percentage'
              ELSE 'percentage'
            END,
            'netAmount', COALESCE(s.invoice_net_amount, 0),
            'vatAmount', COALESCE(s.invoice_vat_amount, 0),
            'grossAmount', COALESCE(s.invoice_gross_amount, 0),
            'netAmountHUF', COALESCE(s.invoice_net_amount, 0),
            'vatAmountHUF', COALESCE(s.invoice_vat_amount, 0),
            'grossAmountHUF', COALESCE(s.invoice_gross_amount, 0),
            'isReverseCharge', COALESCE(s.is_reverse_charge, false)
          )
        ),
        'invoiceNetAmount', s.invoice_net_amount,
        'invoiceNetAmountHUF', s.invoice_net_amount,
        'invoiceVatAmount', s.invoice_vat_amount,
        'invoiceVatAmountHUF', s.invoice_vat_amount,
        'invoiceGrossAmount', s.invoice_gross_amount,
        'invoiceGrossAmountHUF', s.invoice_gross_amount,
        'hasReverseCharge', COALESCE(s.is_reverse_charge, false)
      ) as summary
    FROM nav_invoices s
    WHERE s.id IN (SELECT id FROM batch)
      AND s.id NOT IN (SELECT id FROM invoices_with_items)
  ),
  all_updates AS (
    SELECT id, summary FROM item_summaries
    UNION ALL
    SELECT id, summary FROM header_summaries
  )
  UPDATE nav_invoices ni
  SET vat_summary = au.summary
  FROM all_updates au
  WHERE ni.id = au.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

COMMENT ON FUNCTION public.backfill_nav_invoices_vat_summary(integer) IS
'Batch backfills vat_summary JSONB on nav_invoices using existing line items or invoice headers without NAV API queries.';
