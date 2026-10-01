-- Migration: 20261001115500_fix_get_invoice_kpis_continuous_and_vat_columns.sql
-- Description: Drop obsolete 19-parameter overload and fix invalid column references in get_invoice_kpis:
--              1. Change ni.is_continuous_performance -> ni.is_continuous (42703 error on nav tab)
--              2. Change nii.invoice_id -> nii.nav_invoice_id in nav_invoice_items subquery
--              3. Align nav_invoice_items vat rate checks with get_filtered_nav_invoices

-- 1. Drop obsolete 19-argument overload if it exists
DROP FUNCTION IF EXISTS public.get_invoice_kpis(uuid, date, date, text, text, text, text, text, text, numeric, numeric, date, date, text, text, date, date, text, text);

-- 2. Recreate get_invoice_kpis
CREATE OR REPLACE FUNCTION public.get_invoice_kpis(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text,
  p_source text DEFAULT 'nav'::text,
  p_search text DEFAULT NULL::text,
  p_currency text DEFAULT NULL::text,
  p_project_id text DEFAULT NULL::text,
  p_category_id text DEFAULT NULL::text,
  p_payment_method text DEFAULT NULL::text,
  p_amount_min numeric DEFAULT NULL::numeric,
  p_amount_max numeric DEFAULT NULL::numeric,
  p_issue_date_from date DEFAULT NULL::date,
  p_issue_date_to date DEFAULT NULL::date,
  p_continuous text DEFAULT NULL::text,
  p_submitted text DEFAULT NULL::text,
  p_delivery_date_from date DEFAULT NULL::date,
  p_delivery_date_to date DEFAULT NULL::date,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_vat_rate text DEFAULT 'all'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total integer := 0;
  v_matched integer := 0;
  v_suggested integer := 0;
  v_unmatched integer := 0;
BEGIN
  IF p_source = 'nav' THEN
    WITH base_filtered AS (
      SELECT ni.id, ni.invoice_number, ni.invoice_gross_amount, ni.payment_method, ni.is_manual_payment, ni.transaction_id, ni.paid
      FROM nav_invoices ni
      WHERE ni.company_id = p_company_id
        AND ni.invoice_direction = p_direction
        AND (
          CASE 
            WHEN p_date_basis = 'teljesites' THEN
              (p_date_from IS NULL OR COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date)::date >= p_date_from)
              AND (p_date_to IS NULL OR COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date)::date <= p_date_to)
            ELSE
              (p_date_from IS NULL OR ni.invoice_issue_date >= p_date_from)
              AND (p_date_to IS NULL OR ni.invoice_issue_date <= p_date_to)
          END
        )
        AND (p_issue_date_from IS NULL OR ni.invoice_issue_date >= p_issue_date_from)
        AND (p_issue_date_to IS NULL OR ni.invoice_issue_date <= p_issue_date_to)
        AND (p_delivery_date_from IS NULL OR COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date) >= p_delivery_date_from)
        AND (p_delivery_date_to IS NULL OR COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date) <= p_delivery_date_to)
        AND (p_search IS NULL OR p_search = '' OR (
          ni.invoice_number ILIKE '%' || p_search || '%'
          OR ni.supplier_name ILIKE '%' || p_search || '%'
          OR ni.customer_name ILIKE '%' || p_search || '%'
          OR ni.supplier_tax_number ILIKE '%' || p_search || '%'
          OR ni.customer_tax_number ILIKE '%' || p_search || '%'
          OR ni.invoice_gross_amount::text ILIKE '%' || p_search || '%'
          OR ni.invoice_net_amount::text ILIKE '%' || p_search || '%'
        ))
        AND (p_currency IS NULL OR p_currency = 'all' OR ni.currency = p_currency)
        AND (p_submitted IS NULL OR p_submitted = 'all'
          OR (p_submitted = 'yes' AND ni.submitted = true)
          OR (p_submitted = 'no' AND (ni.submitted IS NULL OR ni.submitted = false)))
        AND (p_project_id IS NULL OR p_project_id = 'all'
          OR (p_project_id = 'none' AND ni.project_id IS NULL)
          OR ni.project_id = p_project_id::uuid)
        AND (p_category_id IS NULL OR p_category_id = 'all'
          OR (p_category_id = 'none' AND ni.category_id IS NULL)
          OR ni.category_id = p_category_id::uuid)
        AND (p_payment_method IS NULL OR p_payment_method = 'all'
          OR (p_payment_method = 'none' AND (ni.payment_method IS NULL OR ni.payment_method = ''))
          OR UPPER(ni.payment_method) = UPPER(p_payment_method)
          OR (p_payment_method = 'CASH' AND (ni.payment_method ILIKE '%cash%' OR ni.payment_method ILIKE '%készpénz%'))
          OR (p_payment_method = 'TRANSFER' AND (ni.payment_method ILIKE '%transfer%' OR ni.payment_method ILIKE '%átutalás%'))
          OR (p_payment_method = 'CARD' AND (ni.payment_method ILIKE '%card%' OR ni.payment_method ILIKE '%bankkártya%'))
          OR (p_payment_method ILIKE '%készpénz%' AND (ni.payment_method ILIKE '%készpénz%' OR ni.payment_method ILIKE '%keszpenz%' OR ni.payment_method ILIKE '%cash%'))
          OR (p_payment_method ILIKE '%átutalás%' AND (ni.payment_method ILIKE '%átutalás%' OR ni.payment_method ILIKE '%atutalas%' OR ni.payment_method ILIKE '%transfer%'))
          OR (p_payment_method ILIKE '%bankkártya%' AND (ni.payment_method ILIKE '%bankkártya%' OR ni.payment_method ILIKE '%card%')))
        AND (p_amount_min IS NULL OR COALESCE(ni.invoice_gross_amount, 0) >= p_amount_min)
        AND (p_amount_max IS NULL OR COALESCE(ni.invoice_gross_amount, 0) <= p_amount_max)
        AND (p_continuous IS NULL OR p_continuous = 'all'
          OR (p_continuous = 'yes' AND ni.is_continuous = true)
          OR (p_continuous = 'no' AND (ni.is_continuous IS NULL OR ni.is_continuous = false)))
        AND (
          p_vat_rate IS NULL OR p_vat_rate = 'all'
          OR EXISTS (
            SELECT 1 FROM nav_invoice_items nii
            WHERE nii.nav_invoice_id = ni.id
              AND (
                (p_vat_rate = '27%' AND (nii.vat_rate = '0.27' OR nii.vat_rate ILIKE '%27%'))
                OR (p_vat_rate = '18%' AND (nii.vat_rate = '0.18' OR nii.vat_rate ILIKE '%18%'))
                OR (p_vat_rate = '5%' AND (nii.vat_rate = '0.05' OR nii.vat_rate ILIKE '%5%'))
                OR (p_vat_rate = '0%' AND (nii.vat_rate = '0' OR nii.vat_rate = '0.00' OR nii.vat_rate = '0%' OR nii.vat_rate ILIKE '%0%'))
                OR (p_vat_rate = 'AAM' AND (nii.vat_rate ILIKE '%AAM%' OR nii.vat_code ILIKE '%AAM%'))
                OR (p_vat_rate = 'TAM' AND (nii.vat_rate ILIKE '%TAM%' OR nii.vat_code ILIKE '%TAM%'))
                OR (p_vat_rate = 'FAD' AND (nii.vat_rate ILIKE '%FAD%' OR nii.vat_code ILIKE '%FAD%'))
              )
          )
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(
              CASE 
                WHEN jsonb_typeof(ni.vat_summary->'vatSummaries') = 'array' THEN ni.vat_summary->'vatSummaries'
                WHEN jsonb_typeof(ni.vat_summary) = 'array' THEN ni.vat_summary
                ELSE '[]'::jsonb
              END
            ) elem
            WHERE (
              (p_vat_rate = '27%' AND (elem->>'vatRateLiteral' ILIKE '%27%' OR elem->>'vatPercentage' = '0.27' OR elem->>'vat_rate' ILIKE '%27%'))
              OR (p_vat_rate = '18%' AND (elem->>'vatRateLiteral' ILIKE '%18%' OR elem->>'vatPercentage' = '0.18' OR elem->>'vat_rate' ILIKE '%18%'))
              OR (p_vat_rate = '5%' AND (elem->>'vatRateLiteral' ILIKE '%5%' OR elem->>'vatPercentage' = '0.05' OR elem->>'vat_rate' ILIKE '%5%'))
              OR (p_vat_rate = '0%' AND (elem->>'vatRateLiteral' ILIKE '%0%' OR elem->>'vatPercentage' = '0' OR elem->>'vat_rate' ILIKE '%0%'))
              OR (p_vat_rate = 'AAM' AND (elem->>'vatRateLiteral' ILIKE '%AAM%' OR elem->>'category' ILIKE '%aam%' OR elem->>'vat_rate' ILIKE '%AAM%'))
              OR (p_vat_rate = 'TAM' AND (elem->>'vatRateLiteral' ILIKE '%TAM%' OR elem->>'category' ILIKE '%tam%' OR elem->>'vat_rate' ILIKE '%TAM%'))
              OR (p_vat_rate = 'FAD' AND (elem->>'vatRateLiteral' ILIKE '%FAD%' OR elem->>'category' ILIKE '%fad%' OR elem->>'vat_rate' ILIKE '%FAD%'))
            )
          )
        )
    ),
    all_tx_distinct AS (
      SELECT DISTINCT
        tx.id as transaction_id,
        tx.matched_invoice_id as invoice_id,
        tx.amount,
        tx.fee_amount,
        tx.match_type,
        tx.is_verified,
        tx.confidence_score
      FROM transactions tx
      WHERE tx.company_id = p_company_id AND tx.matched_invoice_id IS NOT NULL
      UNION
      SELECT DISTINCT
        t.id as transaction_id,
        tim.invoice_id,
        t.amount,
        t.fee_amount,
        COALESCE(tim.created_by, t.match_type) as match_type,
        t.is_verified,
        t.confidence_score
      FROM transaction_invoice_matches tim
      JOIN transactions t ON t.company_id = p_company_id AND t.id = tim.transaction_id
    ),
    all_tx_matches AS (
      SELECT 
        m.invoice_id,
        bool_or(m.match_type = 'manual' OR m.is_verified = true OR (m.confidence_score IS NOT NULL AND m.confidence_score >= 0.9)) AS is_matched,
        bool_or(m.match_type != 'manual' AND (m.is_verified IS NOT TRUE) AND (m.confidence_score < 0.9)) AS is_suggested,
        COALESCE(SUM(
          CASE 
            WHEN m.match_type = 'manual' OR m.is_verified = true OR (m.confidence_score IS NOT NULL AND m.confidence_score >= 0.9)
            THEN ABS(m.amount) + COALESCE(ABS(m.fee_amount), 0)
            ELSE 0
          END
        ), 0) AS total_paid_amount
      FROM all_tx_distinct m
      GROUP BY m.invoice_id
    ),
    sub_matches AS (
      SELECT 
        i.bizonylatsorszam,
        bool_or(
          atm.is_matched = true 
          OR i.transaction_id IS NOT NULL
          OR i.is_manual_payment = true
          OR LOWER(COALESCE(i.fizetesi_mod, '')) IN ('készpénz', 'keszpenz', 'cash')
          OR i.fizetesi_mod ILIKE '%készpénz%' 
          OR i.fizetesi_mod ILIKE '%keszpenz%' 
        ) AS is_sub_matched,
        bool_or(atm.is_suggested = true) AS is_sub_suggested,
        COALESCE(MAX(
          CASE 
            WHEN COALESCE(atm.total_paid_amount, 0) > 0
            THEN atm.total_paid_amount
            WHEN i.is_manual_payment = true 
              OR LOWER(COALESCE(i.fizetesi_mod, '')) IN ('készpénz', 'keszpenz', 'cash')
              OR i.fizetesi_mod ILIKE '%készpénz%' 
              OR i.fizetesi_mod ILIKE '%keszpenz%' 
              OR i.fizetve = true
              OR EXISTS (
                SELECT 1 FROM courier_reports cr 
                WHERE cr.company_id = p_company_id 
                  AND cr.reference_number = i.bizonylatsorszam 
                  AND cr.match_status = 'full'
              )
            THEN ABS(COALESCE(i.brutto_vegosszeg, 0))
            ELSE 0
          END
        ), 0) AS sub_paid_amount
      FROM invoices i
      LEFT JOIN all_tx_matches atm ON atm.invoice_id = i.id
      WHERE i.company_id = p_company_id
      GROUP BY i.bizonylatsorszam
    ),
    with_status AS (
      SELECT 
        bf.*,
        CASE
          WHEN (COALESCE(atm.total_paid_amount, 0) + COALESCE(sm.sub_paid_amount, 0)) > 0 
          THEN (COALESCE(atm.total_paid_amount, 0) + COALESCE(sm.sub_paid_amount, 0))
          WHEN bf.is_manual_payment = true 
            OR UPPER(COALESCE(bf.payment_method, '')) IN ('CASH', 'KÉSZPÉNZ', 'KESZPENZ') 
            OR bf.payment_method ILIKE '%készpénz%' 
            OR bf.payment_method ILIKE '%cash%' 
            OR bf.paid = true
            OR EXISTS (
              SELECT 1 FROM courier_reports cr 
              WHERE cr.company_id = p_company_id 
                AND cr.matched_nav_invoice_id = bf.id 
                AND cr.match_status = 'full'
            )
          THEN ABS(COALESCE(bf.invoice_gross_amount, 0))
          ELSE 0
        END AS computed_paid_raw,
        ABS(COALESCE(bf.invoice_gross_amount, 0)) AS gross_abs
      FROM base_filtered bf
      LEFT JOIN all_tx_matches atm ON atm.invoice_id = bf.id
      LEFT JOIN sub_matches sm ON sm.bizonylatsorszam = bf.invoice_number
    ),
    categorized AS (
      SELECT 
        ws.*,
        CASE 
          WHEN (
            ws.computed_paid_raw >= ws.gross_abs - 0.5 
            OR ws.paid = true 
            OR ws.transaction_id IS NOT NULL 
            OR ws.is_manual_payment = true 
            OR UPPER(COALESCE(ws.payment_method, '')) IN ('CASH', 'KÉSZPÉNZ', 'KESZPENZ')
            OR ws.payment_method ILIKE '%készpénz%'
            OR ws.payment_method ILIKE '%keszpenz%'
            OR ws.payment_method ILIKE '%cash%'
            OR EXISTS (
              SELECT 1 FROM courier_reports cr 
              WHERE cr.company_id = p_company_id 
                AND cr.matched_nav_invoice_id = ws.id 
                AND cr.match_status = 'full'
            )
          ) THEN 'matched'
          WHEN (COALESCE(ws.computed_paid_raw, 0) > 0 AND ws.computed_paid_raw < ws.gross_abs - 0.5) THEN 'matched'
          WHEN (tm_sub.is_sub_suggested = true OR atm_tx.is_suggested = true) THEN 'suggested'
          ELSE 'unmatched'
        END AS m_status
      FROM with_status ws
      LEFT JOIN sub_matches tm_sub ON tm_sub.bizonylatsorszam = ws.invoice_number
      LEFT JOIN all_tx_matches atm_tx ON atm_tx.invoice_id = ws.id
    )
    SELECT 
      COUNT(*)::integer,
      COUNT(CASE WHEN m_status = 'matched' THEN 1 END)::integer,
      COUNT(CASE WHEN m_status = 'suggested' THEN 1 END)::integer,
      COUNT(CASE WHEN m_status = 'unmatched' THEN 1 END)::integer
    INTO v_total, v_matched, v_suggested, v_unmatched
    FROM categorized;
  ELSE
    WITH base_filtered AS (
      SELECT i.id, i.bizonylatsorszam, i.is_manual_payment, i.fizetesi_mod, i.transaction_id, i.brutto_vegosszeg
      FROM invoices i
      WHERE i.company_id = p_company_id
        AND i.invoice_direction = p_direction
        AND (
          CASE 
            WHEN p_date_basis = 'teljesites' THEN
              (p_date_from IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date >= p_date_from)
              AND (p_date_to IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date <= p_date_to)
            ELSE
              (p_date_from IS NULL OR i.kibocsatas_datuma >= p_date_from)
              AND (p_date_to IS NULL OR i.kibocsatas_datuma <= p_date_to)
          END
        )
        AND (p_issue_date_from IS NULL OR i.kibocsatas_datuma >= p_issue_date_from)
        AND (p_issue_date_to IS NULL OR i.kibocsatas_datuma <= p_issue_date_to)
        AND (p_delivery_date_from IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma) >= p_delivery_date_from)
        AND (p_delivery_date_to IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma) <= p_delivery_date_to)
        AND (p_search IS NULL OR p_search = '' OR (
          i.elado_nev ILIKE '%' || p_search || '%'
          OR i.vevo_nev ILIKE '%' || p_search || '%'
          OR i.bizonylatsorszam ILIKE '%' || p_search || '%'
          OR i.brutto_vegosszeg::text ILIKE '%' || p_search || '%'
          OR i.adoalap_osszesen::text ILIKE '%' || p_search || '%'
        ))
        AND (p_currency IS NULL OR p_currency = 'all' OR i.penznem = p_currency)
        AND (p_category_id IS NULL OR p_category_id = 'all'
          OR (p_category_id = 'none' AND i.category_id IS NULL)
          OR i.category_id = p_category_id::uuid)
        AND (p_project_id IS NULL OR p_project_id = 'all'
          OR (p_project_id = 'none' AND i.project_id IS NULL)
          OR i.project_id = p_project_id::uuid)
        AND (p_payment_method IS NULL OR p_payment_method = 'all'
          OR (p_payment_method = 'none' AND (i.fizetesi_mod IS NULL OR i.fizetesi_mod = ''))
          OR UPPER(i.fizetesi_mod) = UPPER(p_payment_method)
          OR (p_payment_method = 'CASH' AND (i.fizetesi_mod ILIKE '%cash%' OR i.fizetesi_mod ILIKE '%készpénz%'))
          OR (p_payment_method = 'TRANSFER' AND (i.fizetesi_mod ILIKE '%transfer%' OR i.fizetesi_mod ILIKE '%átutalás%'))
          OR (p_payment_method = 'CARD' AND (i.fizetesi_mod ILIKE '%card%' OR i.fizetesi_mod ILIKE '%bankkártya%'))
          OR (p_payment_method ILIKE '%készpénz%' AND (i.fizetesi_mod ILIKE '%készpénz%' OR i.fizetesi_mod ILIKE '%keszpenz%' OR i.fizetesi_mod ILIKE '%cash%'))
          OR (p_payment_method ILIKE '%átutalás%' AND (i.fizetesi_mod ILIKE '%átutalás%' OR i.fizetesi_mod ILIKE '%atutalas%' OR i.fizetesi_mod ILIKE '%transfer%'))
          OR (p_payment_method ILIKE '%bankkártya%' AND (i.fizetesi_mod ILIKE '%bankkártya%' OR i.fizetesi_mod ILIKE '%card%')))
        AND (p_amount_min IS NULL OR COALESCE(i.brutto_vegosszeg, 0) >= p_amount_min)
        AND (p_amount_max IS NULL OR COALESCE(i.brutto_vegosszeg, 0) <= p_amount_max)
        AND (
          p_vat_rate IS NULL OR p_vat_rate = 'all'
          OR EXISTS (
            SELECT 1 FROM invoice_items ii
            WHERE ii.invoice_id = i.id
              AND (
                (p_vat_rate = '27%' AND (ii.vat_rate::text ILIKE '%27%' OR (ii.net_amount > 0 AND round((ii.vat_amount / ii.net_amount)::numeric, 2) = 0.27)))
                OR (p_vat_rate = '18%' AND (ii.vat_rate::text ILIKE '%18%' OR (ii.net_amount > 0 AND round((ii.vat_amount / ii.net_amount)::numeric, 2) = 0.18)))
                OR (p_vat_rate = '5%' AND (ii.vat_rate::text ILIKE '%5%' OR (ii.net_amount > 0 AND round((ii.vat_amount / ii.net_amount)::numeric, 2) = 0.05)))
                OR (p_vat_rate = '0%' AND (ii.vat_rate::text ILIKE '%0%' OR (ii.net_amount > 0 AND COALESCE(ii.vat_amount, 0) = 0)))
                OR (p_vat_rate = 'AAM' AND (ii.vat_rate::text ILIKE '%AAM%' OR ii.vat_code::text ILIKE '%AAM%'))
                OR (p_vat_rate = 'TAM' AND (ii.vat_rate::text ILIKE '%TAM%' OR ii.vat_code::text ILIKE '%TAM%'))
                OR (p_vat_rate = 'FAD' AND (ii.vat_rate::text ILIKE '%FAD%' OR ii.vat_code::text ILIKE '%FAD%'))
              )
          )
          OR (
            (p_vat_rate = '27%' AND i.adoalap_osszesen > 0 AND round((i.afa_osszeg_osszesen / i.adoalap_osszesen)::numeric, 2) = 0.27)
            OR (p_vat_rate = '18%' AND i.adoalap_osszesen > 0 AND round((i.afa_osszeg_osszesen / i.adoalap_osszesen)::numeric, 2) = 0.18)
            OR (p_vat_rate = '5%' AND i.adoalap_osszesen > 0 AND round((i.afa_osszeg_osszesen / i.adoalap_osszesen)::numeric, 2) = 0.05)
            OR (p_vat_rate = '0%' AND i.adoalap_osszesen > 0 AND COALESCE(i.afa_osszeg_osszesen, 0) = 0)
          )
        )
    ),
    all_tx_distinct AS (
      SELECT DISTINCT
        tx.id as transaction_id,
        tx.matched_invoice_id as invoice_id,
        tx.amount,
        tx.fee_amount,
        tx.match_type,
        tx.is_verified,
        tx.confidence_score
      FROM transactions tx
      WHERE tx.company_id = p_company_id AND tx.matched_invoice_id IS NOT NULL
      UNION
      SELECT DISTINCT
        t.id as transaction_id,
        tim.invoice_id,
        t.amount,
        t.fee_amount,
        COALESCE(tim.created_by, t.match_type) as match_type,
        t.is_verified,
        t.confidence_score
      FROM transaction_invoice_matches tim
      JOIN transactions t ON t.company_id = p_company_id AND t.id = tim.transaction_id
    ),
    all_tx_matches AS (
      SELECT 
        m.invoice_id,
        bool_or(m.match_type = 'manual' OR m.is_verified = true OR (m.confidence_score IS NOT NULL AND m.confidence_score >= 0.9)) AS is_matched,
        bool_or(m.match_type != 'manual' AND (m.is_verified IS NOT TRUE) AND (m.confidence_score < 0.9)) AS is_suggested
      FROM all_tx_distinct m
      GROUP BY m.invoice_id
    ),
    categorized AS (
      SELECT 
        CASE 
          WHEN b.is_manual_payment = true 
            OR LOWER(COALESCE(b.fizetesi_mod, '')) IN ('készpénz', 'keszpenz', 'cash')
            OR b.fizetesi_mod ILIKE '%készpénz%'
            OR b.fizetesi_mod ILIKE '%keszpenz%'
            OR EXISTS (
              SELECT 1 FROM courier_reports cr 
              WHERE cr.company_id = p_company_id 
                AND cr.reference_number = b.bizonylatsorszam 
                AND cr.match_status = 'full'
            )
          THEN 'matched'
          WHEN atm.is_matched = true OR b.transaction_id IS NOT NULL THEN 'matched'
          WHEN atm.is_suggested = true THEN 'suggested'
          ELSE 'unmatched'
        END AS m_status
      FROM base_filtered b
      LEFT JOIN all_tx_matches atm ON atm.invoice_id = b.id
    )
    SELECT 
      COUNT(*)::integer,
      COUNT(CASE WHEN m_status = 'matched' THEN 1 END)::integer,
      COUNT(CASE WHEN m_status = 'suggested' THEN 1 END)::integer,
      COUNT(CASE WHEN m_status = 'unmatched' THEN 1 END)::integer
    INTO v_total, v_matched, v_suggested, v_unmatched
    FROM categorized;
  END IF;

  RETURN json_build_object(
    'total', v_total,
    'matched', v_matched,
    'suggested', v_suggested,
    'unmatched', v_unmatched
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_invoice_kpis(uuid, date, date, text, text, text, text, text, text, text, numeric, numeric, date, date, text, text, date, date, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invoice_kpis(uuid, date, date, text, text, text, text, text, text, text, numeric, numeric, date, date, text, text, date, date, text, text) TO authenticated, service_role;
