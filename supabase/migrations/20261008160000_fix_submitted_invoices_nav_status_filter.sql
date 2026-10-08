-- Migration: Fix submitted invoices nav_status filter options (verified, missing_nav, not_applicable)
-- Enables exact matching for frontend filter options in get_filtered_submitted_invoices

CREATE OR REPLACE FUNCTION public.get_filtered_submitted_invoices(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text DEFAULT 'INBOUND'::text,
  p_search text DEFAULT NULL::text,
  p_currency text DEFAULT 'all'::text,
  p_category_id text DEFAULT 'all'::text,
  p_project_id text DEFAULT 'all'::text,
  p_payment_method text DEFAULT 'all'::text,
  p_amount_min numeric DEFAULT NULL::numeric,
  p_amount_max numeric DEFAULT NULL::numeric,
  p_sort_field text DEFAULT 'kibocsatas_datuma'::text,
  p_sort_dir text DEFAULT 'desc'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_issue_date_from date DEFAULT NULL::date,
  p_issue_date_to date DEFAULT NULL::date,
  p_delivery_date_from date DEFAULT NULL::date,
  p_delivery_date_to date DEFAULT NULL::date,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_kpi_filter text DEFAULT 'all'::text,
  p_nav_status text DEFAULT 'all'::text,
  p_vat_rate text DEFAULT 'all'::text
)
RETURNS TABLE(
  id uuid,
  bizonylatsorszam text,
  kibocsatas_datuma date,
  teljesites_datuma date,
  elado_nev text,
  vevo_nev text,
  adoalap_osszesen numeric,
  brutto_vegosszeg numeric,
  afa_osszeg_osszesen numeric,
  penznem text,
  category_id uuid,
  project_id uuid,
  image_url text,
  melleklet_url text,
  elado_adoszam text,
  vevo_adoszam text,
  fizetesi_mod text,
  statusz text,
  nav_status text,
  nav_invoice_id uuid,
  paid boolean,
  match_status text,
  paid_amount numeric,
  remaining_amount numeric,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_offset integer;
BEGIN
  v_offset := GREATEST(0, (COALESCE(p_page, 1) - 1) * COALESCE(p_page_size, 50));

  RETURN QUERY
  WITH base_filtered AS (
    SELECT 
      i.id,
      i.bizonylatsorszam,
      i.kibocsatas_datuma,
      i.teljesites_datuma,
      i.elado_nev,
      i.vevo_nev,
      i.adoalap_osszesen,
      i.brutto_vegosszeg,
      i.afa_osszeg_osszesen,
      i.penznem,
      i.category_id,
      i.project_id,
      i.image_url,
      i.melleklet_url,
      i.elado_vat_id AS elado_adoszam,
      i.vevo_vat_id AS vevo_adoszam,
      i.fizetesi_mod,
      i.statusz,
      i.nav_status,
      i.nav_invoice_id,
      i.fizetve,
      i.is_manual_payment,
      i.transaction_id
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
      AND (p_delivery_date_from IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma) >= p_delivery_date_from)
      AND (p_delivery_date_to IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma) <= p_delivery_date_to)
      AND (p_issue_date_from IS NULL OR i.kibocsatas_datuma >= p_issue_date_from)
      AND (p_issue_date_to IS NULL OR i.kibocsatas_datuma <= p_issue_date_to)
      AND (
        p_search IS NULL OR p_search = ''
        OR i.bizonylatsorszam ILIKE '%' || p_search || '%'
        OR i.elado_nev ILIKE '%' || p_search || '%'
        OR i.vevo_nev ILIKE '%' || p_search || '%'
        OR i.reference_number ILIKE '%' || p_search || '%'
      )
      AND (p_currency IS NULL OR p_currency = 'all' OR i.penznem = p_currency)
      AND (p_category_id IS NULL OR p_category_id = 'all' OR i.category_id = p_category_id::uuid)
      AND (p_project_id IS NULL OR p_project_id = 'all' OR i.project_id = p_project_id::uuid)
      AND (p_payment_method IS NULL OR p_payment_method = 'all' OR i.fizetesi_mod = p_payment_method)
      AND (p_amount_min IS NULL OR ABS(COALESCE(i.brutto_vegosszeg, 0)) >= p_amount_min)
      AND (p_amount_max IS NULL OR ABS(COALESCE(i.brutto_vegosszeg, 0)) <= p_amount_max)
      AND (
        p_nav_status IS NULL OR p_nav_status = 'all'
        OR (p_nav_status = 'verified' AND (i.nav_status = 'verified' OR i.nav_status = 'linked'))
        OR (p_nav_status = 'missing_nav' AND COALESCE(i.nav_status, 'missing_nav') = 'missing_nav')
        OR (p_nav_status = 'not_applicable' AND i.nav_status = 'not_applicable')
        OR (p_nav_status = 'linked' AND (i.nav_status = 'linked' OR i.nav_status = 'verified'))
        OR (p_nav_status = 'unlinked' AND COALESCE(i.nav_status, 'missing_nav') IN ('missing_nav', 'failed', 'not_found', 'not_applicable'))
      )
      AND (
        p_vat_rate IS NULL OR p_vat_rate = 'all'
        OR EXISTS (
          SELECT 1 FROM invoice_items ii
          WHERE ii.invoice_id = i.id
            AND (
              (p_vat_rate = '27%' AND (ii.vat_rate ILIKE '%27%' OR ii.vat_rate = '0.27' OR ii.vat_code ILIKE '%27%'))
              OR (p_vat_rate = '18%' AND (ii.vat_rate ILIKE '%18%' OR ii.vat_rate = '0.18' OR ii.vat_code ILIKE '%18%'))
              OR (p_vat_rate = '5%' AND (ii.vat_rate ILIKE '%5%' OR ii.vat_rate = '0.05' OR ii.vat_code ILIKE '%5%'))
              OR (p_vat_rate = '0%' AND (ii.vat_rate ILIKE '%0%' OR ii.vat_rate = '0' OR ii.vat_rate = '0.00' OR ii.vat_code ILIKE '%0%'))
              OR (p_vat_rate = 'AAM' AND (ii.vat_rate ILIKE '%AAM%' OR ii.vat_code ILIKE '%AAM%'))
              OR (p_vat_rate = 'TAM' AND (ii.vat_rate ILIKE '%TAM%' OR ii.vat_code ILIKE '%TAM%'))
              OR (p_vat_rate = 'FAD' AND (ii.vat_rate ILIKE '%FAD%' OR ii.vat_code ILIKE '%FAD%'))
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
  nav_matches AS (
    SELECT 
      UPPER(TRIM(ni.invoice_number)) AS norm_invoice_number,
      bool_or(
        ni.paid = true 
        OR ni.is_manual_payment = true 
        OR atm.is_matched = true 
        OR LOWER(COALESCE(ni.payment_method, '')) IN ('készpénz', 'keszpenz', 'cash')
        OR ni.payment_method ILIKE '%készpénz%' 
        OR ni.payment_method ILIKE '%keszpenz%'
        OR EXISTS (
          SELECT 1 FROM courier_reports cr 
          WHERE cr.company_id = p_company_id 
            AND cr.reference_number = ni.invoice_number 
            AND cr.match_status = 'full'
        )
      ) AS is_nav_matched,
      bool_or(atm.is_suggested = true) AS is_nav_suggested,
      COALESCE(MAX(
        CASE 
          WHEN atm.total_paid_amount > 0 THEN atm.total_paid_amount
          WHEN ni.paid = true 
            OR ni.is_manual_payment = true 
            OR LOWER(COALESCE(ni.payment_method, '')) IN ('készpénz', 'keszpenz', 'cash')
            OR ni.payment_method ILIKE '%készpénz%' 
            OR ni.payment_method ILIKE '%keszpenz%' 
            OR EXISTS (
              SELECT 1 FROM courier_reports cr 
              WHERE cr.company_id = p_company_id 
                AND cr.reference_number = ni.invoice_number 
                AND cr.match_status = 'full'
            )
          THEN ABS(COALESCE(ni.invoice_gross_amount, 0))
          ELSE 0
        END
      ), 0) AS nav_paid_amount
    FROM nav_invoices ni
    LEFT JOIN all_tx_matches atm ON atm.invoice_id = ni.id
    WHERE ni.company_id = p_company_id
      AND ni.invoice_number IS NOT NULL
    GROUP BY UPPER(TRIM(ni.invoice_number))
  ),
  with_match_status AS (
    SELECT 
      b.*,
      CASE 
        WHEN COALESCE(atm.total_paid_amount, 0) > 0 OR COALESCE(nm.nav_paid_amount, 0) > 0 THEN
          CASE 
            WHEN ABS(COALESCE(b.brutto_vegosszeg, 0)) > 0 
              AND GREATEST(COALESCE(atm.total_paid_amount, 0), COALESCE(nm.nav_paid_amount, 0)) < ABS(COALESCE(b.brutto_vegosszeg, 0)) - 0.5
            THEN 'partially_paid'
            ELSE 'matched'
          END
        WHEN b.fizetve = true
          OR nm.is_nav_matched = true
          OR b.is_manual_payment = true 
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
        WHEN atm.is_suggested = true OR nm.is_nav_suggested = true THEN 'suggested'
        ELSE 'unmatched'
      END AS match_status,
      CASE 
        WHEN COALESCE(atm.total_paid_amount, 0) > 0 OR COALESCE(nm.nav_paid_amount, 0) > 0
        THEN GREATEST(COALESCE(atm.total_paid_amount, 0), COALESCE(nm.nav_paid_amount, 0))
        WHEN b.fizetve = true
          OR nm.is_nav_matched = true
          OR b.is_manual_payment = true 
          OR LOWER(COALESCE(b.fizetesi_mod, '')) IN ('készpénz', 'keszpenz', 'cash')
          OR b.fizetesi_mod ILIKE '%készpénz%'
          OR b.fizetesi_mod ILIKE '%keszpenz%'
          OR EXISTS (
            SELECT 1 FROM courier_reports cr 
            WHERE cr.company_id = p_company_id 
              AND cr.reference_number = b.bizonylatsorszam 
              AND cr.match_status = 'full'
          )
        THEN ABS(COALESCE(b.brutto_vegosszeg, 0))
        ELSE 0
      END AS paid_amount
    FROM base_filtered b
    LEFT JOIN all_tx_matches atm ON atm.invoice_id = b.id
    LEFT JOIN nav_matches nm ON nm.norm_invoice_number = UPPER(TRIM(b.bizonylatsorszam))
  ),
  with_remaining AS (
    SELECT 
      wms.*,
      GREATEST(0::numeric, ABS(COALESCE(wms.brutto_vegosszeg, 0)) - wms.paid_amount) AS remaining_amount
    FROM with_match_status wms
  ),
  kpi_filtered AS (
    SELECT * FROM with_remaining wms
    WHERE p_kpi_filter IS NULL 
      OR p_kpi_filter = 'all'
      OR (p_kpi_filter = 'matched' AND wms.match_status IN ('matched', 'partially_paid'))
      OR (p_kpi_filter = 'suggested' AND wms.match_status = 'suggested')
      OR (p_kpi_filter = 'unmatched' AND wms.match_status = 'unmatched')
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM kpi_filtered
  )
  SELECT 
    kf.id,
    kf.bizonylatsorszam,
    kf.kibocsatas_datuma,
    kf.teljesites_datuma,
    kf.elado_nev,
    kf.vevo_nev,
    kf.adoalap_osszesen,
    kf.brutto_vegosszeg,
    kf.afa_osszeg_osszesen,
    kf.penznem,
    kf.category_id,
    kf.project_id,
    kf.image_url,
    kf.melleklet_url,
    kf.elado_adoszam,
    kf.vevo_adoszam,
    kf.fizetesi_mod,
    kf.statusz,
    kf.nav_status,
    kf.nav_invoice_id,
    kf.paid,
    kf.match_status,
    kf.paid_amount,
    kf.remaining_amount,
    c.cnt AS total_count
  FROM kpi_filtered kf
  CROSS JOIN counted c
  ORDER BY
    CASE WHEN p_sort_dir = 'asc' AND p_sort_field = 'kibocsatas_datuma' THEN kf.kibocsatas_datuma END ASC,
    CASE WHEN p_sort_dir = 'desc' AND p_sort_field = 'kibocsatas_datuma' THEN kf.kibocsatas_datuma END DESC,
    CASE WHEN p_sort_dir = 'asc' AND p_sort_field = 'teljesites_datuma' THEN kf.teljesites_datuma END ASC,
    CASE WHEN p_sort_dir = 'desc' AND p_sort_field = 'teljesites_datuma' THEN kf.teljesites_datuma END DESC,
    CASE WHEN p_sort_dir = 'asc' AND p_sort_field = 'bizonylatsorszam' THEN kf.bizonylatsorszam END ASC,
    CASE WHEN p_sort_dir = 'desc' AND p_sort_field = 'bizonylatsorszam' THEN kf.bizonylatsorszam END DESC,
    CASE WHEN p_sort_dir = 'asc' AND p_sort_field = 'brutto_vegosszeg' THEN ABS(COALESCE(kf.brutto_vegosszeg, 0)) END ASC,
    CASE WHEN p_sort_dir = 'desc' AND p_sort_field = 'brutto_vegosszeg' THEN ABS(COALESCE(kf.brutto_vegosszeg, 0)) END DESC,
    kf.kibocsatas_datuma DESC,
    kf.id DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_filtered_submitted_invoices FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_filtered_submitted_invoices TO authenticated, service_role;
