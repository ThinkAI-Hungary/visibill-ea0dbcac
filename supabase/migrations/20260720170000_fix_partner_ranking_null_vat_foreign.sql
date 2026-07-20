-- Migration: Fix get_partner_ranking RPC
-- Fix #1: Add $ anchor to ^[0-9]{8} regex → prevents 9-digit US EINs (e.g. 30-0944024 → 300944024) from being wrongly treated as Hungarian
-- Fix #2: NULL vat_id invoices are now matched to partners by exact name → included in ranking
-- Fix #3: FOREIGN: partners (no VAT at all) are included using full FOREIGN:xxx as grouping key
-- Together: all partners (Hungarian, foreign with EU VAT, foreign without VAT) appear in Top 10

CREATE OR REPLACE FUNCTION public.get_partner_ranking(p_company_id uuid)
RETURNS TABLE(partner_tax_number text, partner_name text, direction text, invoice_count numeric, total_gross numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH raw_data AS (

    -- 1. NAV invoices — suppliers (INBOUND, Hungarian companies)
    SELECT
      substring(n.supplier_tax_number from 1 for 8) as ptax,
      n.supplier_name as pname,
      'supplier'::text as dir,
      n.id as invoice_id,
      CASE WHEN n.currency != 'HUF' AND n.currency IS NOT NULL THEN
        coalesce(n.invoice_gross_amount, 0) * coalesce(
          (SELECT der.rate FROM daily_exchange_rates der
           WHERE der.currency = n.currency AND der.rate_date <= n.invoice_issue_date
           ORDER BY der.rate_date DESC LIMIT 1), 1)
      ELSE coalesce(n.invoice_gross_amount, 0)
      END as gross_huf
    FROM nav_invoices n
    WHERE n.company_id = p_company_id
      AND n.invoice_direction = 'INBOUND'
      AND n.supplier_tax_number IS NOT NULL

    UNION ALL

    -- 2. NAV invoices — customers (OUTBOUND, Hungarian companies)
    SELECT
      substring(n.customer_tax_number from 1 for 8),
      n.customer_name,
      'customer'::text,
      n.id,
      CASE WHEN n.currency != 'HUF' AND n.currency IS NOT NULL THEN
        coalesce(n.invoice_gross_amount, 0) * coalesce(
          (SELECT der.rate FROM daily_exchange_rates der
           WHERE der.currency = n.currency AND der.rate_date <= n.invoice_issue_date
           ORDER BY der.rate_date DESC LIMIT 1), 1)
      ELSE coalesce(n.invoice_gross_amount, 0)
      END
    FROM nav_invoices n
    WHERE n.company_id = p_company_id
      AND n.invoice_direction = 'OUTBOUND'
      AND n.customer_tax_number IS NOT NULL

    UNION ALL

    -- 3. Uploaded invoices — non-Hungarian suppliers, non-NULL vat_id (INBOUND)
    --    Fix #1: changed '^[0-9]{8}' → '^[0-9]{8}$' to require EXACTLY 8 digits
    --    This prevents US EINs like 30-0944024 (→ 300944024, 9 digits) from being excluded
    SELECT
      substring(
        regexp_replace(replace(i.elado_vat_id, '-', ''), '^HU', '', 'i')
        from 1 for 8),
      i.elado_nev,
      'supplier'::text,
      i.id,
      CASE WHEN i.penznem != 'HUF' AND i.penznem IS NOT NULL THEN
        coalesce(i.brutto_vegosszeg, 0) * coalesce(
          (SELECT der.rate FROM daily_exchange_rates der
           WHERE der.currency = i.penznem AND der.rate_date <= i.kibocsatas_datuma::date
           ORDER BY der.rate_date DESC LIMIT 1), 1)
      ELSE coalesce(i.brutto_vegosszeg, 0)
      END
    FROM invoices i
    WHERE i.company_id = p_company_id
      AND i.elado_vat_id IS NOT NULL
      AND i.invoice_direction = 'INBOUND'
      AND NOT (regexp_replace(replace(i.elado_vat_id, '-', ''), '^HU', '', 'i') ~ '^[0-9]{8}$')

    UNION ALL

    -- 4. Uploaded invoices — non-Hungarian customers, non-NULL vat_id (OUTBOUND)
    --    Fix #1: same $ anchor fix
    SELECT
      substring(
        regexp_replace(replace(i.vevo_vat_id, '-', ''), '^HU', '', 'i')
        from 1 for 8),
      i.vevo_nev,
      'customer'::text,
      i.id,
      CASE WHEN i.penznem != 'HUF' AND i.penznem IS NOT NULL THEN
        coalesce(i.brutto_vegosszeg, 0) * coalesce(
          (SELECT der.rate FROM daily_exchange_rates der
           WHERE der.currency = i.penznem AND der.rate_date <= i.kibocsatas_datuma::date
           ORDER BY der.rate_date DESC LIMIT 1), 1)
      ELSE coalesce(i.brutto_vegosszeg, 0)
      END
    FROM invoices i
    WHERE i.company_id = p_company_id
      AND i.vevo_vat_id IS NOT NULL
      AND i.invoice_direction = 'OUTBOUND'
      AND NOT (regexp_replace(replace(i.vevo_vat_id, '-', ''), '^HU', '', 'i') ~ '^[0-9]{8}$')

    UNION ALL

    -- 5. NEW: Uploaded invoices — NULL vat_id suppliers (INBOUND)
    --    Fix #2 + #3: join to partners by exact name match
    --    Non-FOREIGN partners: use 8-char normalized tax (merges with branch 3 entries for same partner)
    --    FOREIGN: partners: use full FOREIGN:xxx key (unique per partner, handled by frontend)
    SELECT
      CASE
        WHEN mp.tax_number LIKE 'FOREIGN:%' THEN mp.tax_number
        ELSE substring(regexp_replace(replace(mp.tax_number, '-', ''), '^HU', '', 'i') from 1 for 8)
      END,
      i.elado_nev,
      'supplier'::text,
      i.id,
      CASE WHEN i.penznem != 'HUF' AND i.penznem IS NOT NULL THEN
        coalesce(i.brutto_vegosszeg, 0) * coalesce(
          (SELECT der.rate FROM daily_exchange_rates der
           WHERE der.currency = i.penznem AND der.rate_date <= i.kibocsatas_datuma::date
           ORDER BY der.rate_date DESC LIMIT 1), 1)
      ELSE coalesce(i.brutto_vegosszeg, 0)
      END
    FROM invoices i
    JOIN LATERAL (
      SELECT p.tax_number
      FROM partners p
      WHERE p.company_id = i.company_id
        AND lower(i.elado_nev) = lower(p.name)
      LIMIT 1
    ) mp ON true
    WHERE i.company_id = p_company_id
      AND i.elado_vat_id IS NULL
      AND i.invoice_direction = 'INBOUND'

    UNION ALL

    -- 6. NEW: Uploaded invoices — NULL vat_id customers (OUTBOUND)
    --    Same logic as branch 5 for customer direction
    SELECT
      CASE
        WHEN mp.tax_number LIKE 'FOREIGN:%' THEN mp.tax_number
        ELSE substring(regexp_replace(replace(mp.tax_number, '-', ''), '^HU', '', 'i') from 1 for 8)
      END,
      i.vevo_nev,
      'customer'::text,
      i.id,
      CASE WHEN i.penznem != 'HUF' AND i.penznem IS NOT NULL THEN
        coalesce(i.brutto_vegosszeg, 0) * coalesce(
          (SELECT der.rate FROM daily_exchange_rates der
           WHERE der.currency = i.penznem AND der.rate_date <= i.kibocsatas_datuma::date
           ORDER BY der.rate_date DESC LIMIT 1), 1)
      ELSE coalesce(i.brutto_vegosszeg, 0)
      END
    FROM invoices i
    JOIN LATERAL (
      SELECT p.tax_number
      FROM partners p
      WHERE p.company_id = i.company_id
        AND lower(i.vevo_nev) = lower(p.name)
      LIMIT 1
    ) mp ON true
    WHERE i.company_id = p_company_id
      AND i.vevo_vat_id IS NULL
      AND i.invoice_direction = 'OUTBOUND'

  )
  SELECT
    rd.ptax                            as partner_tax_number,
    max(rd.pname)                      as partner_name,
    rd.dir                             as direction,
    count(DISTINCT rd.invoice_id)::numeric as invoice_count,
    sum(rd.gross_huf)                  as total_gross
  FROM raw_data rd
  WHERE rd.ptax IS NOT NULL AND rd.ptax != ''
  GROUP BY rd.ptax, rd.dir
  ORDER BY sum(rd.gross_huf) DESC;
END;
$function$;
