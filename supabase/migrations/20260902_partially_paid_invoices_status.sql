-- ============================================================================
-- Migration: 20260902_partially_paid_invoices_status.sql
-- Purpose: Add 'partially_paid' status support, paid_amount and remaining_amount
--          columns to get_filtered_nav_invoices and get_filtered_submitted_invoices,
--          update get_invoice_kpis and matching triggers with accurate amount checks.
-- ============================================================================

-- 1. Update mark_nav_invoice_paid_on_transaction_match trigger function
CREATE OR REPLACE FUNCTION public.mark_nav_invoice_paid_on_transaction_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bizonylatsorszam TEXT;
  v_company_id UUID;
  v_gross NUMERIC;
  v_total_paid NUMERIC;
  v_is_full_paid BOOLEAN;
BEGIN
  IF NEW.matched_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.matched_invoice_id IS NOT DISTINCT FROM NEW.matched_invoice_id THEN
    RETURN NEW;
  END IF;

  -- Try invoices table first (submitted invoices)
  SELECT bizonylatsorszam, company_id, ABS(COALESCE(brutto_vegosszeg, 0)) 
  INTO v_bizonylatsorszam, v_company_id, v_gross
  FROM invoices WHERE id = NEW.matched_invoice_id;

  IF v_bizonylatsorszam IS NOT NULL AND v_company_id IS NOT NULL THEN
    -- Calculate total verified/manual paid amount
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total_paid
    FROM transactions
    WHERE company_id = v_company_id
      AND (matched_invoice_id = NEW.matched_invoice_id OR id = NEW.id)
      AND (match_type = 'manual' OR is_verified = true OR (confidence_score IS NOT NULL AND confidence_score >= 0.9));

    v_is_full_paid := (v_gross = 0 OR v_total_paid >= v_gross - 0.5);

    UPDATE invoices SET transaction_id = NEW.id
    WHERE id = NEW.matched_invoice_id AND transaction_id IS DISTINCT FROM NEW.id;

    UPDATE nav_invoices
    SET paid = v_is_full_paid, submitted = true, transaction_id = NEW.id
    WHERE invoice_number = v_bizonylatsorszam
      AND company_id = v_company_id;

    RETURN NEW;
  END IF;

  -- Try nav_invoices table
  SELECT ABS(COALESCE(invoice_gross_amount, 0)), company_id
  INTO v_gross, v_company_id
  FROM nav_invoices WHERE id = NEW.matched_invoice_id;

  IF v_gross IS NOT NULL AND v_company_id IS NOT NULL THEN
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total_paid
    FROM transactions
    WHERE company_id = v_company_id
      AND (matched_invoice_id = NEW.matched_invoice_id OR id = NEW.id)
      AND (match_type = 'manual' OR is_verified = true OR (confidence_score IS NOT NULL AND confidence_score >= 0.9));

    v_is_full_paid := (v_gross = 0 OR v_total_paid >= v_gross - 0.5);

    UPDATE nav_invoices
    SET paid = v_is_full_paid, transaction_id = NEW.id
    WHERE id = NEW.matched_invoice_id;

    RETURN NEW;
  END IF;

  -- Try salary table
  UPDATE salary SET transaction_id = NEW.id
  WHERE id = NEW.matched_invoice_id AND transaction_id IS DISTINCT FROM NEW.id;

  RETURN NEW;
END;
$$;

-- 2. Update mark_invoice_paid_on_multi_match trigger function
CREATE OR REPLACE FUNCTION public.mark_invoice_paid_on_multi_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bizonylatsorszam TEXT;
  v_company_id UUID;
  v_transaction_id UUID;
  v_gross NUMERIC;
  v_total_paid NUMERIC;
  v_is_full_paid BOOLEAN;
BEGIN
  v_transaction_id := NEW.transaction_id;

  -- Try invoices table first (submitted invoices)
  SELECT bizonylatsorszam, company_id, ABS(COALESCE(brutto_vegosszeg, 0)) 
  INTO v_bizonylatsorszam, v_company_id, v_gross
  FROM invoices WHERE id = NEW.invoice_id;

  IF v_bizonylatsorszam IS NOT NULL AND v_company_id IS NOT NULL THEN
    SELECT COALESCE(SUM(ABS(t.amount)), 0) INTO v_total_paid
    FROM transaction_invoice_matches tim
    JOIN transactions t ON t.id = tim.transaction_id
    WHERE tim.invoice_id = NEW.invoice_id;

    v_is_full_paid := (v_gross = 0 OR v_total_paid >= v_gross - 0.5);

    UPDATE invoices SET transaction_id = v_transaction_id
    WHERE id = NEW.invoice_id AND transaction_id IS DISTINCT FROM v_transaction_id;

    UPDATE nav_invoices
    SET paid = v_is_full_paid, submitted = true, transaction_id = v_transaction_id
    WHERE invoice_number = v_bizonylatsorszam
      AND company_id = v_company_id;

    RETURN NEW;
  END IF;

  -- Try nav_invoices table
  SELECT ABS(COALESCE(invoice_gross_amount, 0)), company_id
  INTO v_gross, v_company_id
  FROM nav_invoices WHERE id = NEW.invoice_id;

  IF v_gross IS NOT NULL AND v_company_id IS NOT NULL THEN
    SELECT COALESCE(SUM(ABS(t.amount)), 0) INTO v_total_paid
    FROM transaction_invoice_matches tim
    JOIN transactions t ON t.id = tim.transaction_id
    WHERE tim.invoice_id = NEW.invoice_id;

    v_is_full_paid := (v_gross = 0 OR v_total_paid >= v_gross - 0.5);

    UPDATE nav_invoices
    SET paid = v_is_full_paid, transaction_id = v_transaction_id
    WHERE id = NEW.invoice_id;

    RETURN NEW;
  END IF;

  -- Try salary table
  UPDATE salary SET transaction_id = v_transaction_id
  WHERE id = NEW.invoice_id AND transaction_id IS DISTINCT FROM v_transaction_id;

  RETURN NEW;
END;
$$;


-- ============================================================================
-- 3. get_invoice_kpis — Updated with Accurate Partial Payment Handling
-- ============================================================================

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
  p_submitted text DEFAULT NULL
)
RETURNS TABLE(
  total bigint,
  matched bigint,
  suggested bigint,
  unmatched bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_source = 'submitted' THEN
    RETURN QUERY
    WITH company_sub AS (
      SELECT 
        i.id,
        i.bizonylatsorszam,
        i.transaction_id,
        i.kibocsatas_datuma,
        i.brutto_vegosszeg,
        i.adoalap_osszesen,
        i.elado_nev,
        i.vevo_nev,
        i.fizetesi_mod
      FROM invoices i
      WHERE i.company_id = p_company_id
        AND i.invoice_direction = p_direction
        AND i.kibocsatas_datuma >= p_date_from
        AND i.kibocsatas_datuma <= p_date_to
        AND (p_issue_date_from IS NULL OR i.kibocsatas_datuma >= p_issue_date_from)
        AND (p_issue_date_to IS NULL OR i.kibocsatas_datuma <= p_issue_date_to)
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
          OR (p_payment_method = 'none' AND i.fizetesi_mod IS NULL)
          OR i.fizetesi_mod = p_payment_method)
        AND (p_amount_min IS NULL OR COALESCE(i.brutto_vegosszeg, 0) >= p_amount_min)
        AND (p_amount_max IS NULL OR COALESCE(i.brutto_vegosszeg, 0) <= p_amount_max)
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
      JOIN transactions t ON t.id = tim.transaction_id
      WHERE t.company_id = p_company_id
      GROUP BY tim.invoice_id
    ),
    nav_matches AS (
      SELECT 
        ni.invoice_number,
        bool_or(
          ni.paid = true 
          OR ni.transaction_id IS NOT NULL 
          OR ni.is_manual_payment = true
          OR tm.is_matched = true
          OR tim.invoice_id IS NOT NULL
        ) AS is_nav_matched,
        bool_or(tm.is_suggested = true) AS is_nav_suggested,
        COALESCE(MAX(
          CASE 
            WHEN ni.is_manual_payment = true OR ni.payment_method = 'CASH' THEN ABS(COALESCE(ni.invoice_gross_amount, 0))
            ELSE COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0)
          END
        ), 0) AS nav_paid_amount
      FROM nav_invoices ni
      LEFT JOIN tx_matches tm ON tm.matched_invoice_id = ni.id
      LEFT JOIN tim_matches tim ON tim.invoice_id = ni.id
      WHERE ni.company_id = p_company_id
      GROUP BY ni.invoice_number
    ),
    sub_with_status AS (
      SELECT 
        cs.*,
        CASE
          WHEN cs.transaction_id IS NOT NULL 
            OR tm.is_matched = true
            OR tim.invoice_id IS NOT NULL
            OR nm.is_nav_matched = true
            OR cs.fizetesi_mod = 'Készpénz'
          THEN 'matched'
          WHEN (
            tm.is_suggested = true
            OR nm.is_nav_suggested = true
          )
          THEN 'suggested'
          ELSE 'unmatched'
        END AS computed_match_status
      FROM company_sub cs
      LEFT JOIN tx_matches tm ON tm.matched_invoice_id = cs.id
      LEFT JOIN tim_matches tim ON tim.invoice_id = cs.id
      LEFT JOIN nav_matches nm ON nm.invoice_number = cs.bizonylatsorszam
    )
    SELECT 
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (
        WHERE sws.computed_match_status = 'matched'
      )::bigint AS matched,
      COUNT(*) FILTER (
        WHERE sws.computed_match_status = 'suggested'
      )::bigint AS suggested,
      COUNT(*) FILTER (
        WHERE sws.computed_match_status = 'unmatched'
      )::bigint AS unmatched
    FROM sub_with_status sws;

  ELSE
    RETURN QUERY
    WITH company_nav AS (
      SELECT 
        ni.id,
        ni.invoice_number,
        ni.transaction_id,
        ni.paid,
        ni.is_manual_payment,
        ni.payment_method,
        ni.invoice_issue_date,
        ni.invoice_gross_amount,
        ni.invoice_net_amount,
        ni.supplier_name,
        ni.customer_name,
        ni.supplier_tax_number,
        ni.customer_tax_number
      FROM nav_invoices ni
      WHERE ni.company_id = p_company_id
        AND ni.invoice_direction = p_direction
        AND ni.invoice_issue_date >= p_date_from
        AND ni.invoice_issue_date <= p_date_to
        AND (p_issue_date_from IS NULL OR ni.invoice_issue_date >= p_issue_date_from)
        AND (p_issue_date_to IS NULL OR ni.invoice_issue_date <= p_issue_date_to)
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
        AND (p_category_id IS NULL OR p_category_id = 'all'
          OR (p_category_id = 'none' AND ni.category_id IS NULL)
          OR ni.category_id = p_category_id::uuid)
        AND (p_project_id IS NULL OR p_project_id = 'all'
          OR (p_project_id = 'none' AND ni.project_id IS NULL)
          OR ni.project_id = p_project_id::uuid)
        AND (p_payment_method IS NULL OR p_payment_method = 'all'
          OR (p_payment_method = 'none' AND ni.payment_method IS NULL)
          OR ni.payment_method = p_payment_method)
        AND (p_amount_min IS NULL OR COALESCE(ni.invoice_gross_amount, 0) >= p_amount_min)
        AND (p_amount_max IS NULL OR COALESCE(ni.invoice_gross_amount, 0) <= p_amount_max)
        AND (p_continuous IS NULL OR p_continuous = 'all'
          OR (p_continuous = 'yes' AND ni.is_continuous = true)
          OR (p_continuous = 'no' AND (ni.is_continuous IS NULL OR ni.is_continuous = false)))
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
      JOIN transactions t ON t.id = tim.transaction_id
      WHERE t.company_id = p_company_id
      GROUP BY tim.invoice_id
    ),
    sub_matches AS (
      SELECT 
        i.bizonylatsorszam,
        bool_or(tm.is_matched = true OR tim.invoice_id IS NOT NULL) AS is_sub_matched,
        bool_or(tm.is_suggested = true) AS is_sub_suggested,
        COALESCE(MAX(COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0)), 0) AS sub_paid_amount
      FROM invoices i
      LEFT JOIN tx_matches tm ON tm.matched_invoice_id = i.id
      LEFT JOIN tim_matches tim ON tim.invoice_id = i.id
      WHERE i.company_id = p_company_id
      GROUP BY i.bizonylatsorszam
    ),
    nav_with_status AS (
      SELECT 
        cn.*,
        CASE
          WHEN cn.paid = true 
            OR cn.transaction_id IS NOT NULL 
            OR cn.is_manual_payment = true
            OR cn.payment_method = 'CASH'
            OR tm.is_matched = true
            OR tim.invoice_id IS NOT NULL
            OR sm.is_sub_matched = true
          THEN 'matched'
          WHEN (
            tm.is_suggested = true
            OR sm.is_sub_suggested = true
          )
          THEN 'suggested'
          ELSE 'unmatched'
        END AS computed_match_status
      FROM company_nav cn
      LEFT JOIN tx_matches tm ON tm.matched_invoice_id = cn.id
      LEFT JOIN tim_matches tim ON tim.invoice_id = cn.id
      LEFT JOIN sub_matches sm ON sm.bizonylatsorszam = cn.invoice_number
    )
    SELECT 
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (
        WHERE nws.computed_match_status = 'matched'
      )::bigint AS matched,
      COUNT(*) FILTER (
        WHERE nws.computed_match_status = 'suggested'
      )::bigint AS suggested,
      COUNT(*) FILTER (
        WHERE nws.computed_match_status = 'unmatched'
      )::bigint AS unmatched
    FROM nav_with_status nws;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invoice_kpis(
  uuid, date, date, text, text, text, text, text, text, text, numeric, numeric, date, date, text, text
) TO authenticated, service_role;


-- ============================================================================
-- 4. get_filtered_nav_invoices — Added partially_paid, paid_amount, remaining_amount
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date);
DROP FUNCTION IF EXISTS public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, uuid);
DROP FUNCTION IF EXISTS public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, uuid, text);
DROP FUNCTION IF EXISTS public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, uuid, text, text);

CREATE OR REPLACE FUNCTION public.get_filtered_nav_invoices(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text,
  p_search text DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_paid text DEFAULT NULL,
  p_submitted text DEFAULT NULL,
  p_project_id text DEFAULT NULL,
  p_category_id text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_amount_min numeric DEFAULT NULL,
  p_amount_max numeric DEFAULT NULL,
  p_sort_field text DEFAULT 'invoice_issue_date',
  p_sort_dir text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_issue_date_from date DEFAULT NULL,
  p_issue_date_to date DEFAULT NULL,
  p_preset_id uuid DEFAULT NULL,
  p_continuous text DEFAULT NULL,
  p_kpi_filter text DEFAULT 'all'
)
RETURNS TABLE(
  id uuid,
  invoice_number text,
  invoice_direction text,
  invoice_issue_date date,
  invoice_delivery_date date,
  supplier_tax_number text,
  supplier_name text,
  supplier_address text,
  customer_tax_number text,
  customer_name text,
  customer_address text,
  invoice_net_amount numeric,
  invoice_gross_amount numeric,
  invoice_vat_amount numeric,
  currency text,
  payment_method text,
  invoice_operation text,
  payment_date date,
  paid boolean,
  submitted boolean,
  details_fetched boolean,
  company_id uuid,
  user_id uuid,
  created_at timestamp with time zone,
  fetched_at timestamp with time zone,
  project_id uuid,
  category_id uuid,
  transaction_id uuid,
  exclude_from_accounting boolean,
  gl_numbers text,
  is_continuous boolean,
  service_period_start date,
  service_period_end date,
  calculated_ti date,
  ti_override date,
  ti_calculation_method text,
  is_manual_payment boolean,
  manual_payment_type text,
  match_status text,
  paid_amount numeric,
  remaining_amount numeric,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offset integer;
  v_preset_id uuid;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  -- Resolve preset: use p_preset_id, fallback to active custom preset, fallback to generic preset
  IF p_preset_id IS NULL THEN
    SELECT cap.id INTO v_preset_id
    FROM public.chart_of_accounts_presets cap
    WHERE cap.company_id = p_company_id AND cap.is_active = true
    LIMIT 1;

    IF v_preset_id IS NULL THEN
      SELECT cap.id INTO v_preset_id
      FROM public.chart_of_accounts_presets cap
      WHERE cap.company_id = p_company_id
      ORDER BY cap.created_at ASC
      LIMIT 1;
    END IF;
  ELSE
    v_preset_id := p_preset_id;
  END IF;

  RETURN QUERY
  WITH base_filtered AS (
    SELECT
      ni.id, ni.invoice_number, ni.invoice_direction,
      ni.invoice_issue_date, ni.invoice_delivery_date,
      ni.supplier_tax_number, ni.supplier_name, ni.supplier_address,
      ni.customer_tax_number, ni.customer_name, ni.customer_address,
      ni.invoice_net_amount, ni.invoice_gross_amount, ni.invoice_vat_amount,
      ni.currency, ni.payment_method, ni.invoice_operation,
      ni.payment_date, ni.paid, ni.submitted, ni.details_fetched,
      ni.company_id, ni.user_id, ni.created_at, ni.fetched_at,
      ni.project_id, ni.category_id, ni.transaction_id,
      ni.exclude_from_accounting,
      ni.is_continuous,
      ni.service_period_start,
      ni.service_period_end,
      ni.calculated_ti,
      ni.ti_override,
      ni.ti_calculation_method,
      ni.is_manual_payment,
      ni.manual_payment_type
    FROM nav_invoices ni
    WHERE ni.company_id = p_company_id
      AND ni.invoice_direction = p_direction
      AND ni.invoice_issue_date >= p_date_from
      AND ni.invoice_issue_date <= p_date_to
      AND (p_issue_date_from IS NULL OR ni.invoice_issue_date >= p_issue_date_from)
      AND (p_issue_date_to IS NULL OR ni.invoice_issue_date <= p_issue_date_to)
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
        OR (p_payment_method = 'none' AND ni.payment_method IS NULL)
        OR ni.payment_method = p_payment_method)
      AND (p_amount_min IS NULL OR COALESCE(ni.invoice_gross_amount, 0) >= p_amount_min)
      AND (p_amount_max IS NULL OR COALESCE(ni.invoice_gross_amount, 0) <= p_amount_max)
      AND (p_continuous IS NULL OR p_continuous = 'all'
        OR (p_continuous = 'yes' AND ni.is_continuous = true)
        OR (p_continuous = 'no' AND (ni.is_continuous IS NULL OR ni.is_continuous = false)))
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
    JOIN transactions t ON t.id = tim.transaction_id
    WHERE t.company_id = p_company_id
    GROUP BY tim.invoice_id
  ),
  sub_matches AS (
    SELECT 
      i.bizonylatsorszam,
      bool_or(tm.is_matched = true OR tim.invoice_id IS NOT NULL) AS is_sub_matched,
      bool_or(tm.is_suggested = true) AS is_sub_suggested,
      COALESCE(MAX(COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0)), 0) AS sub_paid_amount
    FROM invoices i
    LEFT JOIN tx_matches tm ON tm.matched_invoice_id = i.id
    LEFT JOIN tim_matches tim ON tim.invoice_id = i.id
    WHERE i.company_id = p_company_id
    GROUP BY i.bizonylatsorszam
  ),
  with_status AS (
    SELECT 
      bf.*,
      CASE
        -- Manual payment, CASH, or paid without linked tx -> full gross
        WHEN bf.is_manual_payment = true OR bf.payment_method = 'CASH' THEN ABS(COALESCE(bf.invoice_gross_amount, 0))
        -- Transactions linked
        WHEN (COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0) + COALESCE(sm.sub_paid_amount, 0)) > 0 
        THEN (COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0) + COALESCE(sm.sub_paid_amount, 0))
        -- Explicit paid flag
        WHEN bf.paid = true AND bf.transaction_id IS NULL THEN ABS(COALESCE(bf.invoice_gross_amount, 0))
        ELSE 0
      END AS computed_paid_raw,
      ABS(COALESCE(bf.invoice_gross_amount, 0)) AS gross_abs
    FROM base_filtered bf
    LEFT JOIN tx_matches tm ON tm.matched_invoice_id = bf.id
    LEFT JOIN tim_matches tim ON tim.invoice_id = bf.id
    LEFT JOIN sub_matches sm ON sm.bizonylatsorszam = bf.invoice_number
  ),
  with_calc AS (
    SELECT
      ws.*,
      ws.computed_paid_raw AS calculated_paid,
      GREATEST(0::numeric, ws.gross_abs - ws.computed_paid_raw) AS calculated_remaining,
      CASE
        WHEN ws.gross_abs > 0 AND ws.computed_paid_raw >= ws.gross_abs - 0.5 THEN 'matched'
        WHEN ws.gross_abs = 0 AND ws.computed_paid_raw >= 0 AND (ws.paid = true OR ws.transaction_id IS NOT NULL OR ws.is_manual_payment = true OR ws.payment_method = 'CASH') THEN 'matched'
        WHEN ws.computed_paid_raw > 0 AND ws.computed_paid_raw < ws.gross_abs - 0.5 THEN 'partially_paid'
        WHEN EXISTS (
          SELECT 1 FROM tx_matches tm2 WHERE tm2.matched_invoice_id = ws.id AND tm2.is_suggested = true
        ) OR EXISTS (
          SELECT 1 FROM sub_matches sm2 WHERE sm2.bizonylatsorszam = ws.invoice_number AND sm2.is_sub_suggested = true
        ) THEN 'suggested'
        ELSE 'unmatched'
      END AS computed_match_status
    FROM with_status ws
  ),
  kpi_filtered AS (
    SELECT *
    FROM with_calc wc
    WHERE (
      p_kpi_filter IS NULL 
      OR p_kpi_filter = 'all' 
      OR (p_kpi_filter = 'matched' AND wc.computed_match_status IN ('matched', 'partially_paid'))
      OR (p_kpi_filter = 'partially_paid' AND wc.computed_match_status = 'partially_paid')
      OR wc.computed_match_status = p_kpi_filter
    )
    AND (
      p_paid IS NULL
      OR p_paid = 'all'
      OR (p_paid IN ('yes', 'paid') AND wc.computed_match_status = 'matched')
      OR (p_paid IN ('partial', 'partially_paid') AND wc.computed_match_status = 'partially_paid')
      OR (p_paid IN ('no', 'unmatched') AND wc.computed_match_status IN ('unmatched', 'suggested'))
    )
  )
  SELECT
    kf.id, kf.invoice_number, kf.invoice_direction,
    kf.invoice_issue_date, kf.invoice_delivery_date,
    kf.supplier_tax_number, kf.supplier_name, kf.supplier_address,
    kf.customer_tax_number, kf.customer_name, kf.customer_address,
    kf.invoice_net_amount, kf.invoice_gross_amount, kf.invoice_vat_amount,
    kf.currency, kf.payment_method, kf.invoice_operation,
    kf.payment_date, kf.paid, kf.submitted, kf.details_fetched,
    kf.company_id, kf.user_id, kf.created_at, kf.fetched_at,
    kf.project_id, kf.category_id, kf.transaction_id,
    kf.exclude_from_accounting,
    (
      SELECT string_agg(DISTINCT g.gl_number, ', ')
      FROM public.nav_invoice_items nii
      JOIN public.gl_accounts g ON g.id = (
        CASE WHEN (nii.gl_classifications -> (v_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
        THEN (nii.gl_classifications -> (v_preset_id::text) ->> 'gl_account_id')::uuid 
        ELSE NULL END
      )
      WHERE nii.nav_invoice_id = kf.id
    ) AS gl_numbers,
    kf.is_continuous,
    kf.service_period_start,
    kf.service_period_end,
    kf.calculated_ti,
    kf.ti_override,
    kf.ti_calculation_method,
    kf.is_manual_payment,
    kf.manual_payment_type,
    kf.computed_match_status AS match_status,
    kf.calculated_paid AS paid_amount,
    kf.calculated_remaining AS remaining_amount,
    count(*) OVER()::bigint AS total_count
  FROM kpi_filtered kf
  ORDER BY
    CASE WHEN p_sort_field = 'partner_name' AND p_sort_dir = 'asc' THEN (CASE WHEN p_direction = 'INBOUND' THEN kf.supplier_name ELSE kf.customer_name END) END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'partner_name' AND p_sort_dir = 'desc' THEN (CASE WHEN p_direction = 'INBOUND' THEN kf.supplier_name ELSE kf.customer_name END) END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_issue_date' AND p_sort_dir = 'asc' THEN kf.invoice_issue_date END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_issue_date' AND p_sort_dir = 'desc' THEN kf.invoice_issue_date END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_delivery_date' AND p_sort_dir = 'asc' THEN kf.invoice_delivery_date END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_delivery_date' AND p_sort_dir = 'desc' THEN kf.invoice_delivery_date END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_number' AND p_sort_dir = 'asc' THEN kf.invoice_number END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_number' AND p_sort_dir = 'desc' THEN kf.invoice_number END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_net_amount' AND p_sort_dir = 'asc' THEN kf.invoice_net_amount END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_net_amount' AND p_sort_dir = 'desc' THEN kf.invoice_net_amount END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_gross_amount' AND p_sort_dir = 'asc' THEN kf.invoice_gross_amount END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_gross_amount' AND p_sort_dir = 'desc' THEN kf.invoice_gross_amount END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_vat_amount' AND p_sort_dir = 'asc' THEN kf.invoice_vat_amount END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_vat_amount' AND p_sort_dir = 'desc' THEN kf.invoice_vat_amount END DESC NULLS LAST,
    kf.invoice_issue_date DESC NULLS LAST,
    kf.id ASC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_filtered_nav_invoices(
  uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, uuid, text, text
) TO authenticated, service_role;


-- ============================================================================
-- 5. get_filtered_submitted_invoices — Added partially_paid, paid_amount, remaining_amount
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, numeric, numeric, text, text, integer, integer, text, date, date, text);
DROP FUNCTION IF EXISTS public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, text);

CREATE OR REPLACE FUNCTION public.get_filtered_submitted_invoices(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text,
  p_search text DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_category_id text DEFAULT NULL,
  p_project_id text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_amount_min numeric DEFAULT NULL,
  p_amount_max numeric DEFAULT NULL,
  p_sort_field text DEFAULT 'kibocsatas_datuma',
  p_sort_dir text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_issue_date_from date DEFAULT NULL,
  p_issue_date_to date DEFAULT NULL,
  p_kpi_filter text DEFAULT 'all'
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
  fizetesi_mod text,
  match_status text,
  paid_amount numeric,
  remaining_amount numeric,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      i.fizetesi_mod,
      i.transaction_id
    FROM invoices i
    WHERE i.company_id = p_company_id
      AND i.invoice_direction = p_direction
      AND i.kibocsatas_datuma >= p_date_from
      AND i.kibocsatas_datuma <= p_date_to
      AND (p_issue_date_from IS NULL OR i.kibocsatas_datuma >= p_issue_date_from)
      AND (p_issue_date_to IS NULL OR i.kibocsatas_datuma <= p_issue_date_to)
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
        OR (p_payment_method = 'none' AND i.fizetesi_mod IS NULL)
        OR i.fizetesi_mod = p_payment_method)
      AND (p_amount_min IS NULL OR COALESCE(i.brutto_vegosszeg, 0) >= p_amount_min)
      AND (p_amount_max IS NULL OR COALESCE(i.brutto_vegosszeg, 0) <= p_amount_max)
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
    JOIN transactions t ON t.id = tim.transaction_id
    WHERE t.company_id = p_company_id
    GROUP BY tim.invoice_id
  ),
  nav_matches AS (
    SELECT 
      ni.invoice_number,
      bool_or(
        ni.paid = true 
        OR ni.transaction_id IS NOT NULL 
        OR ni.is_manual_payment = true
        OR tm.is_matched = true
        OR tim.invoice_id IS NOT NULL
      ) AS is_nav_matched,
      bool_or(tm.is_suggested = true) AS is_nav_suggested,
      COALESCE(MAX(
        CASE 
          WHEN ni.is_manual_payment = true OR ni.payment_method = 'CASH' THEN ABS(COALESCE(ni.invoice_gross_amount, 0))
          ELSE COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0)
        END
      ), 0) AS nav_paid_amount
    FROM nav_invoices ni
    LEFT JOIN tx_matches tm ON tm.matched_invoice_id = ni.id
    LEFT JOIN tim_matches tim ON tim.invoice_id = ni.id
    WHERE ni.company_id = p_company_id
    GROUP BY ni.invoice_number
  ),
  with_status AS (
    SELECT 
      bf.*,
      CASE
        WHEN bf.fizetesi_mod = 'Készpénz' THEN ABS(COALESCE(bf.brutto_vegosszeg, 0))
        WHEN (COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0) + COALESCE(nm.nav_paid_amount, 0)) > 0
        THEN (COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0) + COALESCE(nm.nav_paid_amount, 0))
        WHEN bf.transaction_id IS NOT NULL THEN ABS(COALESCE(bf.brutto_vegosszeg, 0))
        ELSE 0
      END AS computed_paid_raw,
      ABS(COALESCE(bf.brutto_vegosszeg, 0)) AS gross_abs
    FROM base_filtered bf
    LEFT JOIN tx_matches tm ON tm.matched_invoice_id = bf.id
    LEFT JOIN tim_matches tim ON tim.invoice_id = bf.id
    LEFT JOIN nav_matches nm ON nm.invoice_number = bf.bizonylatsorszam
  ),
  with_calc AS (
    SELECT
      ws.*,
      ws.computed_paid_raw AS calculated_paid,
      GREATEST(0::numeric, ws.gross_abs - ws.computed_paid_raw) AS calculated_remaining,
      CASE
        WHEN ws.gross_abs > 0 AND ws.computed_paid_raw >= ws.gross_abs - 0.5 THEN 'matched'
        WHEN ws.gross_abs = 0 AND ws.computed_paid_raw >= 0 AND (ws.transaction_id IS NOT NULL OR ws.fizetesi_mod = 'Készpénz') THEN 'matched'
        WHEN ws.computed_paid_raw > 0 AND ws.computed_paid_raw < ws.gross_abs - 0.5 THEN 'partially_paid'
        WHEN EXISTS (
          SELECT 1 FROM tx_matches tm2 WHERE tm2.matched_invoice_id = ws.id AND tm2.is_suggested = true
        ) OR EXISTS (
          SELECT 1 FROM nav_matches nm2 WHERE nm2.invoice_number = ws.bizonylatsorszam AND nm2.is_nav_suggested = true
        ) THEN 'suggested'
        ELSE 'unmatched'
      END AS computed_match_status
    FROM with_status ws
  ),
  kpi_filtered AS (
    SELECT *
    FROM with_calc wc
    WHERE p_kpi_filter IS NULL 
       OR p_kpi_filter = 'all' 
       OR (p_kpi_filter = 'matched' AND wc.computed_match_status IN ('matched', 'partially_paid'))
       OR (p_kpi_filter = 'partially_paid' AND wc.computed_match_status = 'partially_paid')
       OR wc.computed_match_status = p_kpi_filter
  )
  SELECT
    kf.id, kf.bizonylatsorszam, kf.kibocsatas_datuma, kf.teljesites_datuma,
    kf.elado_nev, kf.vevo_nev, kf.adoalap_osszesen, kf.brutto_vegosszeg,
    kf.afa_osszeg_osszesen, kf.penznem, kf.category_id, kf.project_id,
    kf.image_url, kf.melleklet_url, kf.invoice_direction, kf.reference_number,
    kf.exclude_from_accounting, kf.fizetesi_mod,
    kf.computed_match_status AS match_status,
    kf.calculated_paid AS paid_amount,
    kf.calculated_remaining AS remaining_amount,
    count(*) OVER()::bigint AS total_count
  FROM kpi_filtered kf
  ORDER BY
    CASE WHEN p_sort_field IN ('partner_name', 'elado_nev') AND p_sort_dir = 'asc' THEN (CASE WHEN p_direction = 'INBOUND' THEN kf.elado_nev ELSE kf.vevo_nev END) END ASC NULLS LAST,
    CASE WHEN p_sort_field IN ('partner_name', 'elado_nev') AND p_sort_dir = 'desc' THEN (CASE WHEN p_direction = 'INBOUND' THEN kf.elado_nev ELSE kf.vevo_nev END) END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'kibocsatas_datuma' AND p_sort_dir = 'asc' THEN kf.kibocsatas_datuma END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'kibocsatas_datuma' AND p_sort_dir = 'desc' THEN kf.kibocsatas_datuma END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'teljesites_datuma' AND p_sort_dir = 'asc' THEN kf.teljesites_datuma END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'teljesites_datuma' AND p_sort_dir = 'desc' THEN kf.teljesites_datuma END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'bizonylatsorszam' AND p_sort_dir = 'asc' THEN kf.bizonylatsorszam END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'bizonylatsorszam' AND p_sort_dir = 'desc' THEN kf.bizonylatsorszam END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'adoalap_osszesen' AND p_sort_dir = 'asc' THEN kf.adoalap_osszesen END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'adoalap_osszesen' AND p_sort_dir = 'desc' THEN kf.adoalap_osszesen END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'brutto_vegosszeg' AND p_sort_dir = 'asc' THEN kf.brutto_vegosszeg END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'brutto_vegosszeg' AND p_sort_dir = 'desc' THEN kf.brutto_vegosszeg END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'afa_osszeg_osszesen' AND p_sort_dir = 'asc' THEN kf.afa_osszeg_osszesen END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'afa_osszeg_osszesen' AND p_sort_dir = 'desc' THEN kf.afa_osszeg_osszesen END DESC NULLS LAST,
    kf.kibocsatas_datuma DESC NULLS LAST,
    kf.id ASC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_filtered_submitted_invoices(
  uuid, date, date, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, text
) TO authenticated, service_role;
