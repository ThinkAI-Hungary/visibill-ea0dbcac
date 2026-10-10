-- Migration: 20261010030000_fix_get_filtered_submitted_invoices_aliases.sql
-- Description: Fix column aliases in get_filtered_submitted_invoices final SELECT
--              (computed_match_status AS match_status, calculated_paid AS paid_amount, calculated_remaining AS remaining_amount)

CREATE OR REPLACE FUNCTION public.get_filtered_submitted_invoices(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text,
  p_search text DEFAULT NULL::text,
  p_currency text DEFAULT NULL::text,
  p_category_id text DEFAULT NULL::text,
  p_project_id text DEFAULT NULL::text,
  p_payment_method text DEFAULT NULL::text,
  p_amount_min numeric DEFAULT NULL::numeric,
  p_amount_max numeric DEFAULT NULL::numeric,
  p_sort_field text DEFAULT 'kibocsatas_datuma'::text,
  p_sort_dir text DEFAULT 'desc'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_issue_date_from date DEFAULT NULL::date,
  p_issue_date_to date DEFAULT NULL::date,
  p_kpi_filter text DEFAULT 'all'::text,
  p_nav_status text DEFAULT 'all'::text,
  p_delivery_date_from date DEFAULT NULL::date,
  p_delivery_date_to date DEFAULT NULL::date,
  p_date_basis text DEFAULT 'kibocsatas'::text,
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
  invoice_direction text,
  reference_number text,
  exclude_from_accounting boolean,
  accounting_exclusion_type text,
  deferred_vat_reason text,
  deferred_vat_since date,
  deferred_vat_target_period text,
  is_accountant_reviewed boolean,
  fizetesi_mod text,
  match_status text,
  paid_amount numeric,
  remaining_amount numeric,
  statusz text,
  nav_status text,
  approval_note text,
  approved_at timestamp with time zone,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_offset integer;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

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
      i.invoice_direction,
      i.reference_number,
      COALESCE(i.exclude_from_accounting, false) AS exclude_from_accounting,
      i.accounting_exclusion_type,
      i.deferred_vat_reason,
      i.deferred_vat_since,
      i.deferred_vat_target_period,
      COALESCE(i.is_accountant_reviewed, false) AS is_accountant_reviewed,
      i.fizetesi_mod,
      i.is_manual_payment,
      i.transaction_id,
      i.fizetve,
      i.statusz,
      i.nav_status,
      i.approval_note,
      i.approved_at
    FROM invoices i
    WHERE i.company_id = p_company_id
      AND i.invoice_direction = p_direction
      AND (
        (p_date_basis = 'teljesites' AND i.teljesites_datuma >= p_date_from AND i.teljesites_datuma <= p_date_to)
        OR (p_date_basis <> 'teljesites' AND i.kibocsatas_datuma >= p_date_from AND i.kibocsatas_datuma <= p_date_to)
      )
      AND (p_delivery_date_from IS NULL OR i.teljesites_datuma >= p_delivery_date_from)
      AND (p_delivery_date_to IS NULL OR i.teljesites_datuma <= p_delivery_date_to)
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
  with_status AS (
    SELECT 
      bf.*,
      CASE
        WHEN COALESCE(atm.total_paid_amount, 0) > 0 THEN COALESCE(atm.total_paid_amount, 0)
        WHEN bf.is_manual_payment = true 
          OR LOWER(COALESCE(bf.fizetesi_mod, '')) IN ('készpénz', 'keszpenz', 'cash')
          OR bf.fizetesi_mod ILIKE '%készpénz%'
          OR bf.fizetesi_mod ILIKE '%keszpenz%'
          OR bf.fizetve = true
          OR EXISTS (
            SELECT 1 FROM courier_reports cr 
            WHERE cr.company_id = p_company_id 
              AND cr.reference_number = bf.bizonylatsorszam 
              AND cr.match_status = 'full'
          )
        THEN ABS(COALESCE(bf.brutto_vegosszeg, 0))
        ELSE 0
      END AS computed_paid_raw,
      ABS(COALESCE(bf.brutto_vegosszeg, 0)) AS gross_abs
    FROM base_filtered bf
    LEFT JOIN all_tx_matches atm ON atm.invoice_id = bf.id
  ),
  with_calc AS (
    SELECT
      ws.*,
      LEAST(ws.computed_paid_raw, ws.gross_abs) AS calculated_paid,
      GREATEST(0::numeric, ws.gross_abs - ws.computed_paid_raw) AS calculated_remaining,
      CASE
        WHEN ws.gross_abs > 0 AND ws.computed_paid_raw >= ws.gross_abs - 0.5 THEN 'matched'
        WHEN ws.gross_abs = 0 AND ws.computed_paid_raw >= 0 AND (
          ws.fizetve = true 
          OR ws.transaction_id IS NOT NULL 
          OR ws.is_manual_payment = true 
          OR LOWER(COALESCE(ws.fizetesi_mod, '')) IN ('készpénz', 'keszpenz', 'cash')
          OR ws.fizetesi_mod ILIKE '%készpénz%'
          OR ws.fizetesi_mod ILIKE '%keszpenz%'
          OR EXISTS (
            SELECT 1 FROM courier_reports cr 
            WHERE cr.company_id = p_company_id 
              AND cr.reference_number = ws.bizonylatsorszam 
              AND cr.match_status = 'full'
          )
        ) THEN 'matched'
        WHEN (COALESCE(ws.computed_paid_raw, 0) > 0 AND ws.computed_paid_raw < ws.gross_abs - 0.5) THEN 'partially_paid'
        WHEN atm_tx.is_suggested = true THEN 'suggested'
        ELSE 'unmatched'
      END AS computed_match_status
    FROM with_status ws
    LEFT JOIN all_tx_matches atm_tx ON atm_tx.invoice_id = ws.id
  ),
  kpi_filtered AS (
    SELECT *
    FROM with_calc wc
    WHERE p_kpi_filter IS NULL 
      OR p_kpi_filter = 'all'
      OR (p_kpi_filter = 'matched' AND wc.computed_match_status IN ('matched', 'partially_paid'))
      OR (p_kpi_filter = 'suggested' AND wc.computed_match_status = 'suggested')
      OR (p_kpi_filter = 'unmatched' AND wc.computed_match_status = 'unmatched')
  ),
  counted AS (
    SELECT COUNT(*)::bigint AS cnt FROM kpi_filtered
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
    kf.invoice_direction,
    kf.reference_number,
    kf.exclude_from_accounting,
    kf.accounting_exclusion_type,
    kf.deferred_vat_reason,
    kf.deferred_vat_since,
    kf.deferred_vat_target_period,
    kf.is_accountant_reviewed,
    kf.fizetesi_mod,
    kf.computed_match_status AS match_status,
    kf.calculated_paid AS paid_amount,
    kf.calculated_remaining AS remaining_amount,
    kf.statusz,
    kf.nav_status,
    kf.approval_note,
    kf.approved_at,
    counted.cnt AS total_count
  FROM kpi_filtered kf
  CROSS JOIN counted
  ORDER BY
    CASE WHEN p_sort_field = 'kibocsatas_datuma' AND p_sort_dir = 'asc' THEN kf.kibocsatas_datuma END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'kibocsatas_datuma' AND p_sort_dir = 'desc' THEN kf.kibocsatas_datuma END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'teljesites_datuma' AND p_sort_dir = 'asc' THEN kf.teljesites_datuma END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'teljesites_datuma' AND p_sort_dir = 'desc' THEN kf.teljesites_datuma END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'brutto_vegosszeg' AND p_sort_dir = 'asc' THEN kf.brutto_vegosszeg END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'brutto_vegosszeg' AND p_sort_dir = 'desc' THEN kf.brutto_vegosszeg END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'elado_nev' AND p_sort_dir = 'asc' THEN kf.elado_nev END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'elado_nev' AND p_sort_dir = 'desc' THEN kf.elado_nev END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'bizonylatsorszam' AND p_sort_dir = 'asc' THEN kf.bizonylatsorszam END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'bizonylatsorszam' AND p_sort_dir = 'desc' THEN kf.bizonylatsorszam END DESC NULLS LAST,
    kf.kibocsatas_datuma DESC NULLS LAST,
    kf.id ASC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_filtered_submitted_invoices FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_filtered_submitted_invoices TO authenticated, service_role;
