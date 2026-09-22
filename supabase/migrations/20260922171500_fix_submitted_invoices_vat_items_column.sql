-- Fix get_filtered_submitted_invoices
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
SECURITY DEFINER
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
      i.exclude_from_accounting,
      i.is_accountant_reviewed,
      i.fizetesi_mod,
      i.statusz,
      i.nav_status,
      i.approval_note,
      i.approved_at,
      i.is_manual_payment,
      i.manual_payment_type,
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
        OR LOWER(i.fizetesi_mod) = LOWER(p_payment_method)
        OR (p_payment_method ILIKE '%készpénz%' AND (i.fizetesi_mod ILIKE '%készpénz%' OR i.fizetesi_mod ILIKE '%keszpenz%' OR i.fizetesi_mod ILIKE '%cash%'))
        OR (p_payment_method ILIKE '%átutalás%' AND (i.fizetesi_mod ILIKE '%átutalás%' OR i.fizetesi_mod ILIKE '%atutalas%' OR i.fizetesi_mod ILIKE '%transfer%'))
        OR (p_payment_method ILIKE '%bankkártya%' AND (i.fizetesi_mod ILIKE '%bankkártya%' OR i.fizetesi_mod ILIKE '%card%')))
      AND (p_amount_min IS NULL OR COALESCE(i.brutto_vegosszeg, 0) >= p_amount_min)
      AND (p_amount_max IS NULL OR COALESCE(i.brutto_vegosszeg, 0) <= p_amount_max)
      AND (
        p_nav_status IS NULL OR p_nav_status = 'all'
        OR (p_nav_status = 'verified' AND i.nav_status = 'verified')
        OR (p_nav_status = 'missing_nav' AND (i.nav_status = 'missing_nav' OR i.statusz = 'jovahagyasra_var'))
        OR (p_nav_status = 'not_applicable' AND i.nav_status = 'not_applicable')
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
  tx_matches AS (
    SELECT 
      tx.matched_invoice_id,
      bool_or(tx.match_type = 'manual' OR tx.is_verified = true OR (tx.confidence_score IS NOT NULL AND tx.confidence_score >= 0.9)) AS is_matched,
      bool_or(tx.match_type != 'manual' AND (tx.is_verified IS NOT TRUE) AND (tx.confidence_score < 0.9)) AS is_suggested,
      COALESCE(SUM(
        CASE 
          WHEN tx.match_type = 'manual' OR tx.is_verified = true OR (tx.confidence_score IS NOT NULL AND tx.confidence_score >= 0.9)
          THEN ABS(tx.amount)
          ELSE 0
        END
      ), 0) AS total_paid_amount
    FROM transactions tx
    WHERE tx.company_id = p_company_id AND tx.matched_invoice_id IS NOT NULL
    GROUP BY tx.matched_invoice_id
  ),
  tim_matches AS (
    SELECT 
      tim.invoice_id,
      COALESCE(SUM(ABS(t.amount)), 0) AS total_tim_amount
    FROM transaction_invoice_matches tim
    JOIN transactions t ON t.company_id = p_company_id AND t.id = tim.transaction_id
    GROUP BY tim.invoice_id
  ),
  with_match_status AS (
    SELECT 
      b.*,
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
        WHEN tx.is_matched = true OR tim.invoice_id IS NOT NULL OR b.transaction_id IS NOT NULL THEN
          CASE 
            WHEN ABS(COALESCE(b.brutto_vegosszeg, 0)) > 0 
              AND (COALESCE(tx.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0)) < ABS(COALESCE(b.brutto_vegosszeg, 0)) - 0.01
            THEN 'partially_paid'
            ELSE 'matched'
          END
        WHEN tx.is_suggested = true THEN 'suggested'
        ELSE 'unmatched'
      END AS match_status,
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
        THEN ABS(COALESCE(b.brutto_vegosszeg, 0))
        ELSE COALESCE(tx.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0)
      END AS paid_amount
    FROM base_filtered b
    LEFT JOIN tx_matches tx ON tx.matched_invoice_id = b.id
    LEFT JOIN tim_matches tim ON tim.invoice_id = b.id
  ),
  with_remaining AS (
    SELECT 
      wms.*,
      GREATEST(0, ABS(COALESCE(wms.brutto_vegosszeg, 0)) - wms.paid_amount) AS remaining_amount
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
    kf.invoice_direction,
    kf.reference_number,
    kf.exclude_from_accounting,
    kf.is_accountant_reviewed,
    kf.fizetesi_mod,
    kf.match_status,
    kf.paid_amount,
    kf.remaining_amount,
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

-- Fix get_invoice_kpis
CREATE OR REPLACE FUNCTION public.get_invoice_kpis(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text,
  p_source text DEFAULT 'nav',
  p_search text DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_project_id text DEFAULT NULL,
  p_category_id text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_amount_min numeric DEFAULT NULL,
  p_amount_max numeric DEFAULT NULL,
  p_issue_date_from date DEFAULT NULL,
  p_issue_date_to date DEFAULT NULL,
  p_continuous text DEFAULT NULL,
  p_submitted text DEFAULT NULL,
  p_delivery_date_from date DEFAULT NULL,
  p_delivery_date_to date DEFAULT NULL,
  p_date_basis text DEFAULT 'kibocsatas',
  p_vat_rate text DEFAULT 'all'
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
          ni.supplier_name ILIKE '%' || p_search || '%'
          OR ni.customer_name ILIKE '%' || p_search || '%'
          OR ni.invoice_number ILIKE '%' || p_search || '%'
          OR ni.invoice_gross_amount::text ILIKE '%' || p_search || '%'
          OR ni.invoice_net_amount::text ILIKE '%' || p_search || '%'
        ))
        AND (p_currency IS NULL OR p_currency = 'all' OR ni.currency = p_currency)
        AND (p_project_id IS NULL OR p_project_id = 'all'
          OR (p_project_id = 'none' AND ni.project_id IS NULL)
          OR ni.project_id = p_project_id::uuid)
        AND (p_category_id IS NULL OR p_category_id = 'all'
          OR (p_category_id = 'none' AND ni.category_id IS NULL)
          OR ni.category_id = p_category_id::uuid)
        AND (p_payment_method IS NULL OR p_payment_method = 'all'
          OR (p_payment_method = 'none' AND (ni.payment_method IS NULL OR ni.payment_method = ''))
          OR UPPER(ni.payment_method) = UPPER(p_payment_method)
          OR (p_payment_method = 'TRANSFER' AND UPPER(ni.payment_method) IN ('TRANSFER', 'ÁTUTALÁS', 'ATUTALAS'))
          OR (p_payment_method = 'CASH' AND UPPER(ni.payment_method) IN ('CASH', 'KÉSZPÉNZ', 'KESZPENZ'))
          OR (p_payment_method = 'CARD' AND UPPER(ni.payment_method) IN ('CARD', 'BANKKÁRTYA', 'BANKKARTYA'))
          OR (p_payment_method = 'VOUCHER' AND UPPER(ni.payment_method) IN ('VOUCHER', 'UTALVÁNY', 'UTALVANY'))
          OR (p_payment_method = 'OTHER' AND UPPER(ni.payment_method) NOT IN ('TRANSFER', 'ÁTUTALÁS', 'ATUTALAS', 'CASH', 'KÉSZPÉNZ', 'KESZPENZ', 'CARD', 'BANKKÁRTYA', 'BANKKARTYA', 'VOUCHER', 'UTALVÁNY', 'UTALVANY')))
        AND (p_amount_min IS NULL OR COALESCE(ni.invoice_gross_amount, 0) >= p_amount_min)
        AND (p_amount_max IS NULL OR COALESCE(ni.invoice_gross_amount, 0) <= p_amount_max)
        AND (p_continuous IS NULL OR p_continuous = 'all'
          OR (p_continuous = 'yes' AND ni.is_continuous = true)
          OR (p_continuous = 'no' AND (ni.is_continuous = false OR ni.is_continuous IS NULL)))
        AND (p_submitted IS NULL OR p_submitted = 'all'
          OR (p_submitted = 'yes' AND ni.submitted = true)
          OR (p_submitted = 'no' AND (ni.submitted = false OR ni.submitted IS NULL)))
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
    tx_matches AS (
      SELECT 
        tx.matched_invoice_id,
        bool_or(tx.match_type = 'manual' OR tx.is_verified = true OR (tx.confidence_score IS NOT NULL AND tx.confidence_score >= 0.9)) AS is_matched,
        bool_or(tx.match_type != 'manual' AND (tx.is_verified IS NOT TRUE) AND (tx.confidence_score < 0.9)) AS is_suggested,
        COALESCE(SUM(
          CASE 
            WHEN tx.match_type = 'manual' OR tx.is_verified = true OR (tx.confidence_score IS NOT NULL AND tx.confidence_score >= 0.9)
            THEN ABS(tx.amount)
            ELSE 0
          END
        ), 0) AS total_paid_amount
      FROM transactions tx
      WHERE tx.company_id = p_company_id AND tx.matched_invoice_id IS NOT NULL
      GROUP BY tx.matched_invoice_id
    ),
    tim_matches AS (
      SELECT 
        tim.invoice_id,
        COALESCE(SUM(ABS(t.amount)), 0) AS total_tim_amount
      FROM transaction_invoice_matches tim
      JOIN transactions t ON t.company_id = p_company_id AND t.id = tim.transaction_id
      GROUP BY tim.invoice_id
    ),
    sub_matches AS (
      SELECT 
        i.bizonylatsorszam,
        bool_or(
          tm.is_matched = true 
          OR tim.invoice_id IS NOT NULL
          OR i.transaction_id IS NOT NULL
          OR i.is_manual_payment = true
          OR LOWER(COALESCE(i.fizetesi_mod, '')) IN ('készpénz', 'keszpenz', 'cash')
          OR i.fizetesi_mod ILIKE '%készpénz%'
          OR i.fizetesi_mod ILIKE '%keszpenz%'
        ) AS is_sub_matched,
        bool_or(tm.is_suggested = true) AS is_sub_suggested,
        COALESCE(MAX(
          CASE 
            WHEN i.is_manual_payment = true 
              OR LOWER(COALESCE(i.fizetesi_mod, '')) IN ('készpénz', 'keszpenz', 'cash')
              OR i.fizetesi_mod ILIKE '%készpénz%'
              OR i.fizetesi_mod ILIKE '%keszpenz%'
              OR EXISTS (
                SELECT 1 FROM courier_reports cr 
                WHERE cr.company_id = p_company_id 
                  AND cr.reference_number = i.bizonylatsorszam 
                  AND cr.match_status = 'full'
              )
            THEN ABS(COALESCE(i.brutto_vegosszeg, 0))
            ELSE COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0)
          END
        ), 0) AS sub_paid_amount
      FROM invoices i
      LEFT JOIN tx_matches tm ON tm.matched_invoice_id = i.id
      LEFT JOIN tim_matches tim ON tim.invoice_id = i.id
      WHERE i.company_id = p_company_id
        AND i.bizonylatsorszam IS NOT NULL
      GROUP BY i.bizonylatsorszam
    ),
    with_status AS (
      SELECT 
        bf.id,
        bf.invoice_number,
        bf.invoice_gross_amount,
        bf.paid,
        bf.is_manual_payment,
        bf.payment_method,
        bf.transaction_id,
        tm.is_matched,
        tm.is_suggested,
        CASE 
          WHEN bf.is_manual_payment = true 
            OR UPPER(COALESCE(bf.payment_method, '')) IN ('CASH', 'KÉSZPÉNZ', 'KESZPENZ')
            OR bf.payment_method ILIKE '%készpénz%'
            OR bf.payment_method ILIKE '%keszpenz%'
            OR bf.payment_method ILIKE '%cash%'
            OR EXISTS (
              SELECT 1 FROM courier_reports cr 
              WHERE cr.company_id = p_company_id 
                AND cr.matched_nav_invoice_id = bf.id 
                AND cr.match_status = 'full'
            )
          THEN ABS(COALESCE(bf.invoice_gross_amount, 0))
          WHEN (COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0) + COALESCE(sm.sub_paid_amount, 0)) > 0 
          THEN (COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0) + COALESCE(sm.sub_paid_amount, 0))
          ELSE 0
        END AS computed_paid_raw,
        ABS(COALESCE(bf.invoice_gross_amount, 0)) AS gross_abs
      FROM base_filtered bf
      LEFT JOIN tx_matches tm ON tm.matched_invoice_id = bf.id
      LEFT JOIN tim_matches tim ON tim.invoice_id = bf.id
      LEFT JOIN sub_matches sm ON sm.bizonylatsorszam = bf.invoice_number
    ),
    categorized AS (
      SELECT 
        CASE 
          WHEN ws.gross_abs > 0 AND ws.computed_paid_raw >= ws.gross_abs - 0.5 THEN 'matched'
          WHEN ws.gross_abs = 0 AND ws.computed_paid_raw >= 0 AND (
            ws.paid = true 
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
          WHEN (tm_sub.is_sub_suggested = true OR tm_tx.is_suggested = true) THEN 'suggested'
          ELSE 'unmatched'
        END AS m_status
      FROM with_status ws
      LEFT JOIN sub_matches tm_sub ON tm_sub.bizonylatsorszam = ws.invoice_number
      LEFT JOIN tx_matches tm_tx ON tm_tx.matched_invoice_id = ws.id
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
          OR LOWER(i.fizetesi_mod) = LOWER(p_payment_method)
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
    tx_matches AS (
      SELECT 
        tx.matched_invoice_id,
        bool_or(tx.match_type = 'manual' OR tx.is_verified = true OR (tx.confidence_score IS NOT NULL AND tx.confidence_score >= 0.9)) AS is_matched,
        bool_or(tx.match_type != 'manual' AND (tx.is_verified IS NOT TRUE) AND (tx.confidence_score < 0.9)) AS is_suggested
      FROM transactions tx
      WHERE tx.company_id = p_company_id AND tx.matched_invoice_id IS NOT NULL
      GROUP BY tx.matched_invoice_id
    ),
    tim_matches AS (
      SELECT DISTINCT tim.invoice_id
      FROM transaction_invoice_matches tim
      JOIN transactions t ON t.company_id = p_company_id AND t.id = tim.transaction_id
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
          WHEN tx.is_matched = true OR tim.invoice_id IS NOT NULL OR b.transaction_id IS NOT NULL THEN 'matched'
          WHEN tx.is_suggested = true THEN 'suggested'
          ELSE 'unmatched'
        END AS m_status
      FROM base_filtered b
      LEFT JOIN tx_matches tx ON tx.matched_invoice_id = b.id
      LEFT JOIN tim_matches tim ON tim.invoice_id = b.id
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
