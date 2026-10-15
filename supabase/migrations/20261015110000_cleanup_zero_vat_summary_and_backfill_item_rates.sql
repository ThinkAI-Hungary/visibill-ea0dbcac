-- =============================================================================
-- Migration: 20261015110000_cleanup_zero_vat_summary_and_backfill_item_rates.sql
-- Description: 
--   1. Clean all corrupted vat_summary entries where vatAmount = 0 (including netAmount <= 0
--      rounding and zero-amount lines) to eliminate false 18%/27%/5% rates.
--   2. Backfill nav_invoice_items.vat_rate for rounding (0%) and bottle deposit (ATK).
--   3. Backfill nav_invoice_items.vat_rate from parent invoice vat_summary for unambiguous
--      single-zero-rate invoices (AAM, ATK, TAM, HO, FAD, 0%).
-- =============================================================================

-- 1. Clean all corrupted vat_summary entries with vatAmount = 0
WITH affected AS (
  SELECT ni.id,
    jsonb_set(
      ni.vat_summary,
      '{vatSummaries}',
      (
        SELECT jsonb_agg(
          CASE 
            WHEN COALESCE((elem->>'vatAmount')::numeric, 0) = 0 
                 AND (
                   COALESCE((elem->>'vatPercentage')::numeric, 0) > 0 
                   OR elem->>'vatRateLiteral' IN ('18%', '27%', '5%')
                 )
            THEN jsonb_set(
                   jsonb_set(
                     jsonb_set(elem, '{vatPercentage}', '0'::jsonb),
                     '{vatRateLiteral}', '"0%"'::jsonb
                   ),
                   '{category}', '"out_of_scope"'::jsonb
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
    WHERE COALESCE((vs->>'vatAmount')::numeric, 0) = 0 
      AND (
        COALESCE((vs->>'vatPercentage')::numeric, 0) > 0 
        OR vs->>'vatRateLiteral' IN ('18%', '27%', '5%')
      )
  )
)
UPDATE nav_invoices ni
SET vat_summary = affected.new_summary
FROM affected
WHERE ni.id = affected.id;

-- 2. Backfill known item categories by description
UPDATE public.nav_invoice_items
SET vat_rate = '0%'
WHERE vat_rate IS NULL 
  AND COALESCE(vat_amount, 0) = 0
  AND line_description ILIKE '%kerekítés%';

UPDATE public.nav_invoice_items
SET vat_rate = 'ATK'
WHERE vat_rate IS NULL 
  AND COALESCE(vat_amount, 0) = 0
  AND (
    line_description ILIKE '%visszav%' 
    OR line_description ILIKE '%drs%' 
    OR line_description ILIKE '%betétdíj%'
  );

-- 3. Backfill nav_invoice_items from parent invoice single-zero-rate summary
WITH single_zero_rates AS (
  SELECT 
    ni.id as nav_invoice_id,
    (
      SELECT elem
      FROM jsonb_array_elements(ni.vat_summary->'vatSummaries') elem
      WHERE COALESCE((elem->>'vatAmount')::numeric, 0) = 0
      LIMIT 1
    ) as zero_rate
  FROM nav_invoices ni
  WHERE ni.vat_summary IS NOT NULL
    AND (
      SELECT COUNT(*)
      FROM jsonb_array_elements(ni.vat_summary->'vatSummaries') elem
      WHERE COALESCE((elem->>'vatAmount')::numeric, 0) = 0
    ) = 1
),
resolved AS (
  SELECT 
    nii.id as item_id,
    CASE 
      WHEN s.zero_rate->>'outOfScopeCase' IS NOT NULL AND s.zero_rate->>'outOfScopeCase' <> '' THEN s.zero_rate->>'outOfScopeCase'
      WHEN s.zero_rate->>'exemptionCase' IS NOT NULL AND s.zero_rate->>'exemptionCase' <> '' THEN s.zero_rate->>'exemptionCase'
      WHEN s.zero_rate->>'category' = 'reverse_charge' OR s.zero_rate->>'vatRateLiteral' ILIKE '%FAD%' THEN 'FAD'
      WHEN s.zero_rate->>'vatRateLiteral' IS NOT NULL AND s.zero_rate->>'vatRateLiteral' NOT IN ('0%', 'Egyéb') THEN s.zero_rate->>'vatRateLiteral'
      ELSE '0%'
    END as target_vat_rate
  FROM nav_invoice_items nii
  JOIN single_zero_rates s ON s.nav_invoice_id = nii.nav_invoice_id
  WHERE nii.vat_rate IS NULL AND COALESCE(nii.vat_amount, 0) = 0
)
UPDATE public.nav_invoice_items nii
SET vat_rate = r.target_vat_rate
FROM resolved r
WHERE nii.id = r.item_id;
