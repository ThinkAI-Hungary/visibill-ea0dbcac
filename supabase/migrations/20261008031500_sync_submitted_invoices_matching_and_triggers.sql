-- Migration: 20261008031500_sync_submitted_invoices_matching_and_triggers.sql
-- Description: Synchronize matching status and triggers between NAV invoices and submitted invoices.
-- 1. Add nav_matches CTE to get_filtered_submitted_invoices so submitted invoices inherit matching/payment status from NAV invoices.
-- 2. Update mark_invoice_paid_on_multi_match and mark_nav_invoice_paid_on_transaction_match to sync invoices.fizetve and invoices.transaction_id when a NAV invoice is matched.
-- 3. Update reset_paid_on_multi_match_delete to reset matching on invoices when a NAV invoice match is removed.
-- 4. Backfill existing invoices where the matching NAV invoice is paid.

-- ------------------------------------------------------------------------------
-- 1. Update get_filtered_submitted_invoices with nav_matches CTE
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
STABLE
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
      COALESCE(i.exclude_from_accounting, false) AS exclude_from_accounting,
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
  nav_matches AS (
    SELECT 
      UPPER(TRIM(ni.invoice_number)) AS norm_invoice_number,
      bool_or(
        atm.is_matched = true 
        OR ni.transaction_id IS NOT NULL
        OR ni.paid = true
        OR ni.is_manual_payment = true
        OR LOWER(COALESCE(ni.payment_method, '')) IN ('készpénz', 'keszpenz', 'cash')
        OR ni.payment_method ILIKE '%készpénz%' 
        OR ni.payment_method ILIKE '%keszpenz%' 
      ) AS is_nav_matched,
      bool_or(atm.is_suggested = true) AS is_nav_suggested,
      COALESCE(MAX(
        CASE 
          WHEN COALESCE(atm.total_paid_amount, 0) > 0
          THEN atm.total_paid_amount
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
-- 2. Update mark_invoice_paid_on_multi_match to sync submitted invoices
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_invoice_paid_on_multi_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_bizonylatsorszam TEXT;
  v_nav_invoice_number TEXT;
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

    UPDATE invoices 
    SET transaction_id = v_transaction_id,
        fizetve = v_is_full_paid
    WHERE id = NEW.invoice_id;

    UPDATE nav_invoices
    SET paid = v_is_full_paid, submitted = true, transaction_id = v_transaction_id
    WHERE (invoice_number = v_bizonylatsorszam OR UPPER(TRIM(invoice_number)) = UPPER(TRIM(v_bizonylatsorszam)))
      AND company_id = v_company_id;

    RETURN NEW;
  END IF;

  -- Try nav_invoices table
  SELECT invoice_number, company_id, ABS(COALESCE(invoice_gross_amount, 0))
  INTO v_nav_invoice_number, v_company_id, v_gross
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

    -- ALSO UPDATE matching submitted invoices!
    IF v_nav_invoice_number IS NOT NULL THEN
      UPDATE invoices
      SET fizetve = v_is_full_paid,
          transaction_id = COALESCE(transaction_id, v_transaction_id)
      WHERE (bizonylatsorszam = v_nav_invoice_number OR UPPER(TRIM(bizonylatsorszam)) = UPPER(TRIM(v_nav_invoice_number)))
        AND company_id = v_company_id;
    END IF;

    RETURN NEW;
  END IF;

  -- Try salary table
  UPDATE salary SET transaction_id = v_transaction_id
  WHERE id = NEW.invoice_id AND transaction_id IS DISTINCT FROM v_transaction_id;

  RETURN NEW;
END;
$function$;


-- ------------------------------------------------------------------------------
-- 3. Update mark_nav_invoice_paid_on_transaction_match to sync submitted invoices
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_nav_invoice_paid_on_transaction_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_bizonylatsorszam TEXT;
  v_nav_invoice_number TEXT;
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

  -- Közvetlen submitted számla frissítése
  SELECT bizonylatsorszam, company_id, ABS(COALESCE(brutto_vegosszeg, 0)) 
  INTO v_bizonylatsorszam, v_company_id, v_gross
  FROM public.invoices WHERE id = NEW.matched_invoice_id;

  IF v_bizonylatsorszam IS NOT NULL AND v_company_id IS NOT NULL THEN
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total_paid
    FROM public.transactions
    WHERE company_id = v_company_id
      AND (matched_invoice_id = NEW.matched_invoice_id OR id = NEW.id)
      AND (match_type = 'manual' OR is_verified = true OR (confidence_score IS NOT NULL AND confidence_score >= 0.9));

    v_is_full_paid := (v_gross = 0 OR v_total_paid >= v_gross - 0.5);

    UPDATE public.invoices SET transaction_id = NEW.id, fizetve = v_is_full_paid
    WHERE id = NEW.matched_invoice_id;

    UPDATE public.nav_invoices
    SET paid = v_is_full_paid, submitted = true, transaction_id = NEW.id
    WHERE (invoice_number = v_bizonylatsorszam OR UPPER(TRIM(invoice_number)) = UPPER(TRIM(v_bizonylatsorszam)))
      AND company_id = v_company_id;

    -- Beszúrjuk a transaction_invoice_matches-be
    INSERT INTO public.transaction_invoice_matches (transaction_id, invoice_id, invoice_source, created_by)
    VALUES (NEW.id, NEW.matched_invoice_id, 'submitted', CASE WHEN NEW.match_type = 'manual' THEN 'manual' ELSE 'ai' END)
    ON CONFLICT (transaction_id, invoice_id) DO NOTHING;

    -- Láncolt továbbörökítés meghívása
    PERFORM public.propagate_transaction_to_invoice_chain(NEW.id);

    RETURN NEW;
  END IF;

  -- Közvetlen nav_invoices számla frissítése
  SELECT invoice_number, company_id, ABS(COALESCE(invoice_gross_amount, 0))
  INTO v_nav_invoice_number, v_company_id, v_gross
  FROM public.nav_invoices WHERE id = NEW.matched_invoice_id;

  IF v_gross IS NOT NULL AND v_company_id IS NOT NULL THEN
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total_paid
    FROM public.transactions
    WHERE company_id = v_company_id
      AND (matched_invoice_id = NEW.matched_invoice_id OR id = NEW.id)
      AND (match_type = 'manual' OR is_verified = true OR (confidence_score IS NOT NULL AND confidence_score >= 0.9));

    v_is_full_paid := (v_gross = 0 OR v_total_paid >= v_gross - 0.5);

    UPDATE public.nav_invoices
    SET paid = v_is_full_paid, transaction_id = NEW.id
    WHERE id = NEW.matched_invoice_id;

    -- ALSO UPDATE matching submitted invoices!
    IF v_nav_invoice_number IS NOT NULL THEN
      UPDATE public.invoices
      SET fizetve = v_is_full_paid,
          transaction_id = COALESCE(transaction_id, NEW.id)
      WHERE (bizonylatsorszam = v_nav_invoice_number OR UPPER(TRIM(bizonylatsorszam)) = UPPER(TRIM(v_nav_invoice_number)))
        AND company_id = v_company_id;
    END IF;

    -- Beszúrjuk a transaction_invoice_matches-be
    INSERT INTO public.transaction_invoice_matches (transaction_id, invoice_id, invoice_source, created_by)
    VALUES (NEW.id, NEW.matched_invoice_id, 'nav', CASE WHEN NEW.match_type = 'manual' THEN 'manual' ELSE 'ai' END)
    ON CONFLICT (transaction_id, invoice_id) DO NOTHING;

    -- Láncolt továbbörökítés meghívása
    PERFORM public.propagate_transaction_to_invoice_chain(NEW.id);

    RETURN NEW;
  END IF;

  -- Salary tábla kezelése
  UPDATE public.salary SET transaction_id = NEW.id
  WHERE id = NEW.matched_invoice_id AND transaction_id IS DISTINCT FROM NEW.id;

  RETURN NEW;
END;
$function$;


-- ------------------------------------------------------------------------------
-- 4. Update reset_paid_on_multi_match_delete to reset submitted invoices
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_paid_on_multi_match_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_bizonylatsorszam TEXT;
  v_company_id UUID;
BEGIN
  -- Check invoices table (submitted invoices)
  SELECT bizonylatsorszam, company_id INTO v_bizonylatsorszam, v_company_id
  FROM invoices WHERE id = OLD.invoice_id;

  IF v_bizonylatsorszam IS NOT NULL AND v_company_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM transactions WHERE matched_invoice_id = OLD.invoice_id
    ) AND NOT EXISTS (
      SELECT 1 FROM transaction_invoice_matches WHERE invoice_id = OLD.invoice_id AND id <> OLD.id
    ) THEN
      UPDATE invoices SET transaction_id = NULL, fizetve = false
      WHERE id = OLD.invoice_id AND (transaction_id = OLD.transaction_id OR transaction_id IS NULL);

      UPDATE nav_invoices
      SET paid = false, submitted = false, transaction_id = NULL
      WHERE (invoice_number = v_bizonylatsorszam OR UPPER(TRIM(invoice_number)) = UPPER(TRIM(v_bizonylatsorszam)))
        AND company_id = v_company_id
        AND (transaction_id = OLD.transaction_id OR transaction_id IS NULL);
    END IF;

    RETURN OLD;
  END IF;

  -- Check nav_invoices table
  IF EXISTS (SELECT 1 FROM nav_invoices WHERE id = OLD.invoice_id) THEN
    SELECT invoice_number, company_id INTO v_bizonylatsorszam, v_company_id
    FROM nav_invoices WHERE id = OLD.invoice_id;

    IF NOT EXISTS (
      SELECT 1 FROM transactions WHERE matched_invoice_id = OLD.invoice_id
    ) AND NOT EXISTS (
      SELECT 1 FROM transaction_invoice_matches WHERE invoice_id = OLD.invoice_id AND id <> OLD.id
    ) THEN
      UPDATE nav_invoices
      SET paid = false, transaction_id = NULL
      WHERE id = OLD.invoice_id
        AND (transaction_id = OLD.transaction_id OR transaction_id IS NULL);

      IF v_bizonylatsorszam IS NOT NULL AND v_company_id IS NOT NULL THEN
        UPDATE invoices
        SET fizetve = false, transaction_id = NULL
        WHERE (bizonylatsorszam = v_bizonylatsorszam OR UPPER(TRIM(bizonylatsorszam)) = UPPER(TRIM(v_bizonylatsorszam)))
          AND company_id = v_company_id
          AND (transaction_id = OLD.transaction_id OR transaction_id IS NULL);
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  -- Check salary table
  IF NOT EXISTS (
    SELECT 1 FROM transactions WHERE matched_invoice_id = OLD.invoice_id
  ) AND NOT EXISTS (
    SELECT 1 FROM transaction_invoice_matches WHERE invoice_id = OLD.invoice_id AND id <> OLD.id
  ) THEN
    UPDATE salary SET transaction_id = NULL
    WHERE id = OLD.invoice_id AND (transaction_id = OLD.transaction_id OR transaction_id IS NULL);
  END IF;

  RETURN OLD;
END;
$function$;


-- ------------------------------------------------------------------------------
-- 5. Backfill existing submitted invoices where NAV invoice is paid
-- ------------------------------------------------------------------------------
UPDATE public.invoices i
SET fizetve = true,
    transaction_id = COALESCE(i.transaction_id, ni.transaction_id)
FROM public.nav_invoices ni
WHERE (ni.invoice_number = i.bizonylatsorszam OR UPPER(TRIM(ni.invoice_number)) = UPPER(TRIM(i.bizonylatsorszam)))
  AND ni.company_id = i.company_id
  AND ni.paid = true
  AND (i.fizetve IS NOT TRUE OR i.transaction_id IS NULL);
