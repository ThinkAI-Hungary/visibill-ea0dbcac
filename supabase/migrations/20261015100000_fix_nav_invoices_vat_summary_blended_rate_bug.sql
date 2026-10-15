-- =============================================================================
-- Migration: 20261015100000_fix_nav_invoices_vat_summary_blended_rate_bug.sql
-- Description: Fixes blended average tax rate bug in backfill_nav_invoices_vat_summary
--              where items with 0 Ft VAT (e.g. hatósági díjak, illetékek) were falsely
--              labeled as 18% or 27% based on the invoice header ratio.
-- =============================================================================

-- 1. Create or replace the backfill function with robust item-level rate detection
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
        -- Kifejezett ÁFA kulcsok pozitív ÁFA összegnél
        WHEN nii.vat_rate IN ('0.27', '27', '27.0', '27.00') AND COALESCE(nii.vat_amount, 0) > 0 THEN '27%'
        WHEN nii.vat_rate IN ('0.05', '5', '5.0', '5.00') AND COALESCE(nii.vat_amount, 0) > 0 THEN '5%'
        WHEN nii.vat_rate IN ('0.18', '18', '18.0', '18.00') AND COALESCE(nii.vat_amount, 0) > 0 THEN '18%'
        -- Mentességek és különleges jogcímek
        WHEN nii.vat_rate ILIKE '%AAM%' THEN 'AAM'
        WHEN nii.vat_rate ILIKE '%TAM%' THEN 'TAM'
        WHEN nii.vat_rate ILIKE '%KBAET%' THEN 'KBAET'
        WHEN nii.vat_rate ILIKE '%DOMESTIC_REVERSE_CHARGE%' OR nii.vat_rate ILIKE '%FAD%' THEN 'FAD'
        WHEN nii.vat_rate ILIKE '%ATHK%' OR nii.vat_rate ILIKE '%ATK%' THEN 'ATK'
        WHEN nii.vat_rate ILIKE '%EUK%' THEN 'EUK'
        WHEN nii.vat_rate ILIKE '%AHK%' THEN 'AHK'
        -- Hatósági díjak, illetékek vagy 0 Ft ÁFA
        WHEN COALESCE(nii.vat_amount, 0) = 0 AND (nii.line_description ILIKE '%illeték%' OR nii.line_description ILIKE '%hatósági%') THEN 'ATK'
        WHEN COALESCE(nii.vat_amount, 0) = 0 THEN '0%'
        -- Tétel saját ÁFA aránya
        WHEN nii.net_amount > 0 AND ROUND(nii.vat_amount / nii.net_amount, 2) = 0.27 THEN '27%'
        WHEN nii.net_amount > 0 AND ROUND(nii.vat_amount / nii.net_amount, 2) = 0.18 THEN '18%'
        WHEN nii.net_amount > 0 AND ROUND(nii.vat_amount / nii.net_amount, 2) = 0.05 THEN '5%'
        -- Fejléc fallback kizárólag pozitív ÁFA összegű tétel esetén
        WHEN COALESCE(nii.vat_amount, 0) > 0 AND s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.27 THEN '27%'
        WHEN COALESCE(nii.vat_amount, 0) > 0 AND s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.18 THEN '18%'
        WHEN COALESCE(nii.vat_amount, 0) > 0 AND s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.05 THEN '5%'
        ELSE COALESCE(nii.vat_rate, '0%')
      END as rate_label,
      CASE 
        WHEN COALESCE(nii.vat_amount, 0) = 0 THEN 0
        WHEN nii.vat_rate IN ('0.27', '27', '27.0', '27.00') THEN 0.27
        WHEN nii.vat_rate IN ('0.05', '5', '5.0', '5.00') THEN 0.05
        WHEN nii.vat_rate IN ('0.18', '18', '18.0', '18.00') THEN 0.18
        WHEN nii.net_amount > 0 AND ROUND(nii.vat_amount / nii.net_amount, 2) = 0.27 THEN 0.27
        WHEN nii.net_amount > 0 AND ROUND(nii.vat_amount / nii.net_amount, 2) = 0.18 THEN 0.18
        WHEN nii.net_amount > 0 AND ROUND(nii.vat_amount / nii.net_amount, 2) = 0.05 THEN 0.05
        WHEN COALESCE(nii.vat_amount, 0) > 0 AND s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.27 THEN 0.27
        WHEN COALESCE(nii.vat_amount, 0) > 0 AND s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.18 THEN 0.18
        WHEN COALESCE(nii.vat_amount, 0) > 0 AND s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.05 THEN 0.05
        ELSE 0
      END as rate_percent,
      CASE 
        WHEN nii.vat_rate ILIKE '%AAM%' OR nii.vat_rate ILIKE '%TAM%' OR nii.vat_rate ILIKE '%KBAET%' THEN 'exemption'
        WHEN nii.vat_rate ILIKE '%DOMESTIC_REVERSE_CHARGE%' OR nii.vat_rate ILIKE '%FAD%' THEN 'reverse_charge'
        WHEN nii.vat_rate ILIKE '%ATHK%' OR nii.vat_rate ILIKE '%ATK%' OR nii.vat_rate ILIKE '%EUK%' OR nii.vat_rate ILIKE '%AHK%' OR (COALESCE(nii.vat_amount, 0) = 0 AND (nii.line_description ILIKE '%illeték%' OR nii.line_description ILIKE '%hatósági%')) THEN 'out_of_scope'
        WHEN COALESCE(nii.vat_amount, 0) = 0 THEN 'out_of_scope'
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
              WHEN COALESCE(s.invoice_vat_amount, 0) = 0 THEN 0
              WHEN s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.27 THEN 0.27
              WHEN s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.18 THEN 0.18
              WHEN s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.05 THEN 0.05
              WHEN s.invoice_net_amount > 0 THEN ROUND(s.invoice_vat_amount / s.invoice_net_amount, 4)
              ELSE 0
            END,
            'vatRateLiteral', CASE 
              WHEN COALESCE(s.is_reverse_charge, false) THEN 'FAD'
              WHEN COALESCE(s.invoice_vat_amount, 0) = 0 THEN '0%'
              WHEN s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.27 THEN '27%'
              WHEN s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.18 THEN '18%'
              WHEN s.invoice_net_amount > 0 AND ROUND(s.invoice_vat_amount / s.invoice_net_amount, 2) = 0.05 THEN '5%'
              WHEN s.invoice_net_amount > 0 THEN ROUND(s.invoice_vat_amount / s.invoice_net_amount * 100) || '%'
              ELSE '0%'
            END,
            'category', CASE 
              WHEN COALESCE(s.is_reverse_charge, false) THEN 'reverse_charge'
              WHEN COALESCE(s.invoice_vat_amount, 0) = 0 THEN 'out_of_scope'
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

-- 2. Clean up existing corrupted vat_summary entries where vatAmount = 0 but percentage > 0 or literal is 18%/27%/5%
WITH affected AS (
  SELECT ni.id,
    jsonb_set(
      ni.vat_summary,
      '{vatSummaries}',
      (
        SELECT jsonb_agg(
          CASE 
            WHEN (elem->>'vatAmount')::numeric = 0 
                 AND (elem->>'netAmount')::numeric > 0 
                 AND (
                   (elem->>'vatPercentage')::numeric > 0 
                   OR elem->>'vatRateLiteral' IN ('18%', '27%', '5%')
                 )
            THEN jsonb_set(
                   jsonb_set(
                     jsonb_set(
                       jsonb_set(elem, '{vatPercentage}', '0'::jsonb),
                       '{vatRateLiteral}', '"Hatályon kívüli (ATK)"'::jsonb
                     ),
                     '{category}', '"out_of_scope"'::jsonb
                   ),
                   '{outOfScopeCase}', '"ATK"'::jsonb
                 )
            ELSE elem
          END
        )
        FROM jsonb_array_elements(ni.vat_summary->'vatSummaries') as elem
      )
    ) as new_summary
  FROM nav_invoices ni
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(ni.vat_summary->'vatSummaries') as vs
    WHERE (vs->>'vatAmount')::numeric = 0 
      AND (vs->>'netAmount')::numeric > 0 
      AND (
        (vs->>'vatPercentage')::numeric > 0 
        OR vs->>'vatRateLiteral' IN ('18%', '27%', '5%')
      )
  )
)
UPDATE nav_invoices ni
SET vat_summary = affected.new_summary
FROM affected
WHERE ni.id = affected.id;

-- 3. Update nav_invoice_items with hatósági díjak / illetékek where vat_rate was NULL
UPDATE public.nav_invoice_items
SET vat_rate = 'ATK'
WHERE vat_rate IS NULL 
  AND (vat_amount = 0 OR vat_amount IS NULL)
  AND (line_description ILIKE '%hatósági%' OR line_description ILIKE '%illeték%');
