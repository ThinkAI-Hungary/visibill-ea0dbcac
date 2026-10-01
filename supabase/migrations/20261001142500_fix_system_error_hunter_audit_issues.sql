-- ==============================================================================
-- Migration: 20261001142500_fix_system_error_hunter_audit_issues.sql
-- Description: Fixes 6 systemic issues identified by /visibill-error-hunter:
--   1. Bug #1: Fix invalid column references (ii.vat_percentage -> ii.vat_rate, ii.vat_code)
--      in get_filtered_submitted_invoices and get_invoice_kpis.
--   2. Bug #2: Add 'DOMESTIC_142' to nav_invoices_rc_category_check constraint.
--   3. Bug #3: Add missing eu_tax_number and country_code to public.partners table.
--   4. Bug #4: Optimize get_fx_differences with t.company_id = p_company_id to eliminate full table scans.
--   5. Bug #5: Grant EXECUTE on user_is_company_member(uuid) to anon to eliminate 500 RLS crashes.
--   6. Bug #6: Fix NULL email_change in auth.users that crashes GoTrue SQL scan.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Bug #3: Add eu_tax_number and country_code to public.partners
-- ------------------------------------------------------------------------------
ALTER TABLE public.partners 
  ADD COLUMN IF NOT EXISTS eu_tax_number TEXT,
  ADD COLUMN IF NOT EXISTS country_code TEXT;

CREATE INDEX IF NOT EXISTS idx_partners_company_eu_tax 
  ON public.partners (company_id, eu_tax_number) 
  WHERE eu_tax_number IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. Bug #2: Update nav_invoices_rc_category_check CHECK constraint
-- ------------------------------------------------------------------------------
ALTER TABLE public.nav_invoices 
  DROP CONSTRAINT IF EXISTS nav_invoices_rc_category_check;

ALTER TABLE public.nav_invoices
  ADD CONSTRAINT nav_invoices_rc_category_check
  CHECK (reverse_charge_category IS NULL OR reverse_charge_category IN (
    'construction',
    'scrap_metal',
    'agriculture',
    'steel',
    'emission_quota',
    'natural_gas',
    'labor_hire',
    'eu_service_import',
    'third_country',
    'DOMESTIC_142'
  ));

-- ------------------------------------------------------------------------------
-- 3. Bug #5: Grant EXECUTE on user_is_company_member to anon
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.user_is_company_member(uuid) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. Bug #6: Prevent GoTrue scan errors on NULL email_change
-- ------------------------------------------------------------------------------
UPDATE auth.users 
SET email_change = '' 
WHERE email_change IS NULL;

-- ------------------------------------------------------------------------------
-- 5. Bug #1: Fix get_filtered_submitted_invoices (ii.vat_rate, ii.vat_code)
-- ------------------------------------------------------------------------------
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
      COALESCE(i.is_accountant_reviewed, false) AS is_accountant_reviewed,
      i.fizetesi_mod,
      i.is_manual_payment,
      i.transaction_id,
      i.statusz,
      COALESCE(i.nav_status, 'missing_nav') AS nav_status,
      i.approval_note,
      i.approved_at
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
        OR (p_nav_status = 'linked' AND COALESCE(i.nav_status, 'missing_nav') = 'linked')
        OR (p_nav_status = 'unlinked' AND COALESCE(i.nav_status, 'missing_nav') IN ('missing_nav', 'failed', 'not_found'))
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
  with_match_status AS (
    SELECT 
      b.*,
      CASE 
        WHEN COALESCE(atm.total_paid_amount, 0) > 0 THEN
          CASE 
            WHEN ABS(COALESCE(b.brutto_vegosszeg, 0)) > 0 
              AND COALESCE(atm.total_paid_amount, 0) < ABS(COALESCE(b.brutto_vegosszeg, 0)) - 0.5
            THEN 'partially_paid'
            ELSE 'matched'
          END
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
      END AS match_status,
      CASE 
        WHEN COALESCE(atm.total_paid_amount, 0) > 0
        THEN COALESCE(atm.total_paid_amount, 0)
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
        ELSE 0
      END AS paid_amount
    FROM base_filtered b
    LEFT JOIN all_tx_matches atm ON atm.invoice_id = b.id
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

REVOKE EXECUTE ON FUNCTION public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, text, text, date, date, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, text, text, date, date, text, text) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. Bug #1: Fix get_invoice_kpis (ii.vat_rate, ii.vat_code)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invoice_kpis(
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
  p_issue_date_from date DEFAULT NULL::date,
  p_issue_date_to date DEFAULT NULL::date,
  p_nav_status text DEFAULT 'all'::text,
  p_tab text DEFAULT 'nav'::text,
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
  IF p_tab = 'nav' THEN
    WITH base_filtered AS (
      SELECT
        ni.id,
        ni.invoice_number,
        ni.paid,
        ni.payment_method,
        ni.transaction_id,
        ni.is_manual_payment,
        COALESCE(ni.invoice_gross_amount, 0) AS gross_amount
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
        AND (p_category_id IS NULL OR p_category_id = 'all'
          OR (p_category_id = 'none' AND ni.category_id IS NULL)
          OR ni.category_id = p_category_id::uuid)
        AND (p_project_id IS NULL OR p_project_id = 'all'
          OR (p_project_id = 'none' AND ni.project_id IS NULL)
          OR ni.project_id = p_project_id::uuid)
        AND (p_payment_method IS NULL OR p_payment_method = 'all'
          OR (p_payment_method = 'none' AND (ni.payment_method IS NULL OR ni.payment_method = ''))
          OR LOWER(ni.payment_method) = LOWER(p_payment_method)
          OR (p_payment_method ILIKE '%készpénz%' AND (ni.payment_method ILIKE '%készpénz%' OR ni.payment_method ILIKE '%keszpenz%' OR ni.payment_method ILIKE '%cash%'))
          OR (p_payment_method ILIKE '%átutalás%' AND (ni.payment_method ILIKE '%átutalás%' OR ni.payment_method ILIKE '%atutalas%' OR ni.payment_method ILIKE '%transfer%'))
          OR (p_payment_method ILIKE '%bankkártya%' AND (ni.payment_method ILIKE '%bankkártya%' OR ni.payment_method ILIKE '%card%')))
        AND (p_amount_min IS NULL OR COALESCE(ni.invoice_gross_amount, 0) >= p_amount_min)
        AND (p_amount_max IS NULL OR COALESCE(ni.invoice_gross_amount, 0) <= p_amount_max)
        AND (
          p_nav_status IS NULL OR p_nav_status = 'all'
          OR (p_nav_status = 'linked' AND EXISTS (SELECT 1 FROM invoices i2 WHERE i2.company_id = p_company_id AND i2.nav_invoice_id = ni.id))
          OR (p_nav_status = 'unlinked' AND NOT EXISTS (SELECT 1 FROM invoices i2 WHERE i2.company_id = p_company_id AND i2.nav_invoice_id = ni.id))
        )
        AND (
          p_vat_rate IS NULL OR p_vat_rate = 'all'
          OR EXISTS (
            SELECT 1 FROM nav_invoice_items nii
            WHERE nii.invoice_id = ni.id
              AND (
                (p_vat_rate = '27%' AND (nii.vat_percentage = 27 OR nii.vat_rate_net_amount = 0.27))
                OR (p_vat_rate = '18%' AND (nii.vat_percentage = 18 OR nii.vat_rate_net_amount = 0.18))
                OR (p_vat_rate = '5%' AND (nii.vat_percentage = 5 OR nii.vat_rate_net_amount = 0.05))
                OR (p_vat_rate = '0%' AND (nii.vat_percentage = 0 OR nii.vat_rate_net_amount = 0))
                OR (p_vat_rate = 'AAM' AND nii.vat_percentage IS NULL AND (nii.line_description ILIKE '%AAM%' OR nii.line_nature_indicator ILIKE '%AAM%'))
                OR (p_vat_rate = 'TAM' AND nii.vat_percentage IS NULL AND (nii.line_description ILIKE '%TAM%' OR nii.line_nature_indicator ILIKE '%TAM%'))
                OR (p_vat_rate = 'FAD' AND nii.vat_percentage IS NULL AND (nii.line_description ILIKE '%FAD%' OR nii.line_nature_indicator ILIKE '%FAD%'))
              )
          )
          OR (
            (p_vat_rate = '27%' AND ni.invoice_net_amount > 0 AND round((ni.invoice_vat_amount / ni.invoice_net_amount)::numeric, 2) = 0.27)
            OR (p_vat_rate = '18%' AND ni.invoice_net_amount > 0 AND round((ni.invoice_vat_amount / ni.invoice_net_amount)::numeric, 2) = 0.18)
            OR (p_vat_rate = '5%' AND ni.invoice_net_amount > 0 AND round((ni.invoice_vat_amount / ni.invoice_net_amount)::numeric, 2) = 0.05)
            OR (p_vat_rate = '0%' AND ni.invoice_net_amount > 0 AND COALESCE(ni.invoice_vat_amount, 0) = 0)
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
        bool_or(i.match_status = 'matched') AS is_sub_matched,
        bool_or(i.match_status = 'suggested') AS is_sub_suggested
      FROM invoices i
      WHERE i.company_id = p_company_id AND i.bizonylatsorszam IS NOT NULL
      GROUP BY i.bizonylatsorszam
    ),
    with_status AS (
      SELECT 
        b.id,
        b.invoice_number,
        b.paid,
        b.transaction_id,
        b.is_manual_payment,
        b.payment_method,
        ABS(b.gross_amount) AS gross_abs,
        atm.total_paid_amount AS computed_paid_raw,
        atm.is_matched AS atm_matched
      FROM base_filtered b
      LEFT JOIN all_tx_matches atm ON atm.invoice_id = b.id
    ),
    categorized AS (
      SELECT 
        CASE 
          WHEN (
            (ws.computed_paid_raw IS NOT NULL AND ws.gross_abs > 0 AND ws.computed_paid_raw >= ws.gross_abs - 0.5)
            OR ws.atm_matched = true
            OR tm_sub.is_sub_matched = true 
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

-- ------------------------------------------------------------------------------
-- 7. Bug #4: Optimize get_fx_differences with t.company_id = p_company_id
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_fx_differences(
  p_company_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date
)
RETURNS TABLE(
  invoice_id uuid,
  invoice_source text,
  invoice_number text,
  partner_name text,
  invoice_direction text,
  currency text,
  foreign_amount numeric,
  delivery_date date,
  delivery_rate numeric,
  delivery_huf numeric,
  settlement_date date,
  settlement_rate numeric,
  settlement_huf numeric,
  fx_difference numeric,
  settlement_month text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rate_source text;
BEGIN
  -- Get company rate source preference (default MNB)
  SELECT COALESCE(fs.rate_source, 'MNB') INTO v_rate_source
  FROM company_fx_settings fs
  WHERE fs.company_id = p_company_id;

  IF v_rate_source IS NULL THEN
    v_rate_source := 'MNB';
  END IF;

  RETURN QUERY

  -- ── NAV invoices matched directly to transactions ──
  WITH nav_matched_direct AS (
    SELECT
      ni.id AS inv_id,
      'nav_invoices'::text AS inv_source,
      ni.invoice_number AS inv_number,
      CASE
        WHEN ni.invoice_direction = 'OUTBOUND' THEN ni.customer_name
        ELSE ni.supplier_name
      END AS inv_partner,
      ni.invoice_direction AS inv_direction,
      ni.currency AS inv_currency,
      ni.invoice_gross_amount AS inv_amount,
      COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date)::date AS inv_delivery_date,
      t.transaction_date::date AS inv_settlement_date,
      t.amount AS tx_amount,
      t.currency AS tx_currency
    FROM nav_invoices ni
    JOIN transactions t ON t.matched_invoice_id = ni.id AND t.company_id = p_company_id
    WHERE ni.company_id = p_company_id
      AND ni.currency IS NOT NULL
      AND ni.currency != 'HUF'
      AND ni.invoice_gross_amount IS NOT NULL
      AND ni.invoice_gross_amount != 0
      AND (ni.exclude_from_accounting IS NULL OR ni.exclude_from_accounting = false)
  ),

  -- ── NAV invoices matched via transaction_invoice_matches ──
  nav_matched_via_link AS (
    SELECT
      ni.id AS inv_id,
      'nav_invoices'::text AS inv_source,
      ni.invoice_number AS inv_number,
      CASE
        WHEN ni.invoice_direction = 'OUTBOUND' THEN ni.customer_name
        ELSE ni.supplier_name
      END AS inv_partner,
      ni.invoice_direction AS inv_direction,
      ni.currency AS inv_currency,
      ni.invoice_gross_amount AS inv_amount,
      COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date)::date AS inv_delivery_date,
      t.transaction_date::date AS inv_settlement_date,
      t.amount AS tx_amount,
      t.currency AS tx_currency
    FROM nav_invoices ni
    JOIN transaction_invoice_matches tim ON tim.invoice_id = ni.id AND tim.invoice_source = 'nav_invoices'
    JOIN transactions t ON t.id = tim.transaction_id AND t.company_id = p_company_id
    WHERE ni.company_id = p_company_id
      AND ni.currency IS NOT NULL
      AND ni.currency != 'HUF'
      AND ni.invoice_gross_amount IS NOT NULL
      AND ni.invoice_gross_amount != 0
      AND (ni.exclude_from_accounting IS NULL OR ni.exclude_from_accounting = false)
  ),

  -- ── Combine NAV matched sources ──
  nav_matched AS (
    SELECT * FROM nav_matched_direct
    UNION
    SELECT * FROM nav_matched_via_link
  ),

  -- ── Submitted invoices matched directly to transactions ──
  submitted_matched_direct AS (
    SELECT
      i.id AS inv_id,
      'invoices'::text AS inv_source,
      COALESCE(i.bizonylatsorszam, 'N/A') AS inv_number,
      CASE
        WHEN i.invoice_direction = 'OUTBOUND' THEN i.vevo_nev
        ELSE i.elado_nev
      END AS inv_partner,
      i.invoice_direction AS inv_direction,
      i.penznem AS inv_currency,
      i.brutto_vegosszeg AS inv_amount,
      COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date AS inv_delivery_date,
      t.transaction_date::date AS inv_settlement_date,
      t.amount AS tx_amount,
      t.currency AS tx_currency
    FROM invoices i
    JOIN transactions t ON t.matched_invoice_id = i.id AND t.company_id = p_company_id
    WHERE i.company_id = p_company_id
      AND i.penznem IS NOT NULL
      AND i.penznem != 'HUF'
      AND i.brutto_vegosszeg IS NOT NULL
      AND i.brutto_vegosszeg != 0
      AND (i.exclude_from_accounting IS NULL OR i.exclude_from_accounting = false)
  ),

  -- ── Submitted invoices matched via transaction_invoice_matches ──
  submitted_matched_via_link AS (
    SELECT
      i.id AS inv_id,
      'invoices'::text AS inv_source,
      COALESCE(i.bizonylatsorszam, 'N/A') AS inv_number,
      CASE
        WHEN i.invoice_direction = 'OUTBOUND' THEN i.vevo_nev
        ELSE i.elado_nev
      END AS inv_partner,
      i.invoice_direction AS inv_direction,
      i.penznem AS inv_currency,
      i.brutto_vegosszeg AS inv_amount,
      COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date AS inv_delivery_date,
      t.transaction_date::date AS inv_settlement_date,
      t.amount AS tx_amount,
      t.currency AS tx_currency
    FROM invoices i
    JOIN transaction_invoice_matches tim ON tim.invoice_id = i.id AND tim.invoice_source = 'invoices'
    JOIN transactions t ON t.id = tim.transaction_id AND t.company_id = p_company_id
    WHERE i.company_id = p_company_id
      AND i.penznem IS NOT NULL
      AND i.penznem != 'HUF'
      AND i.brutto_vegosszeg IS NOT NULL
      AND i.brutto_vegosszeg != 0
      AND (i.exclude_from_accounting IS NULL OR i.exclude_from_accounting = false)
  ),

  -- ── Combine submitted matched sources ──
  submitted_matched AS (
    SELECT * FROM submitted_matched_direct
    UNION
    SELECT * FROM submitted_matched_via_link
  ),

  -- ── Combine both NAV and submitted matches ──
  all_matched AS (
    SELECT * FROM nav_matched
    UNION ALL
    SELECT * FROM submitted_matched
  ),

  -- ── Join with daily rates ──
  with_rates AS (
    SELECT
      am.*,
      dr_del.rate AS del_rate,
      CASE
        WHEN am.tx_currency = 'HUF' AND am.inv_amount != 0
          THEN ABS(am.tx_amount) / ABS(am.inv_amount)
        ELSE dr_set.rate
      END AS set_rate
    FROM all_matched am
    LEFT JOIN LATERAL (
      SELECT der.rate
      FROM daily_exchange_rates der
      WHERE der.currency = am.inv_currency
        AND der.source = v_rate_source
        AND der.rate_date <= am.inv_delivery_date
      ORDER BY der.rate_date DESC
      LIMIT 1
    ) dr_del ON true
    LEFT JOIN LATERAL (
      SELECT der.rate
      FROM daily_exchange_rates der
      WHERE der.currency = am.inv_currency
        AND der.source = v_rate_source
        AND der.rate_date <= am.inv_settlement_date
      ORDER BY der.rate_date DESC
      LIMIT 1
    ) dr_set ON am.tx_currency IS DISTINCT FROM 'HUF'
  )

  SELECT
    wr.inv_id,
    wr.inv_source,
    wr.inv_number,
    wr.inv_partner,
    wr.inv_direction,
    wr.inv_currency,
    wr.inv_amount,
    wr.inv_delivery_date,
    COALESCE(wr.del_rate, 0),
    COALESCE(wr.del_rate, 0) * ABS(wr.inv_amount),
    wr.inv_settlement_date,
    COALESCE(wr.set_rate, 0),
    COALESCE(wr.set_rate, 0) * ABS(wr.inv_amount),
    CASE 
      WHEN wr.inv_direction = 'OUTBOUND' THEN (COALESCE(wr.set_rate, 0) - COALESCE(wr.del_rate, 0)) * ABS(wr.inv_amount)
      ELSE (COALESCE(wr.del_rate, 0) - COALESCE(wr.set_rate, 0)) * ABS(wr.inv_amount)
    END,
    TO_CHAR(wr.inv_settlement_date, 'YYYY-MM')
  FROM with_rates wr
  WHERE (p_date_from IS NULL OR wr.inv_settlement_date >= p_date_from)
    AND (p_date_to IS NULL OR wr.inv_settlement_date <= p_date_to)
    AND wr.del_rate IS NOT NULL
  ORDER BY wr.inv_settlement_date DESC, wr.inv_number;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_fx_differences(uuid, date, date) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fx_differences(uuid, date, date) TO authenticated, service_role;
