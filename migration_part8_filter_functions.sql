-- ============================================================
-- VISIBILL MIGRATION - PART 8: Large filter/aggregate RPC functions
-- Run this in the SQL Editor after Part 7
-- ============================================================

-- get_filtered_nav_invoices
CREATE OR REPLACE FUNCTION public.get_filtered_nav_invoices(p_company_id uuid, p_date_from date, p_date_to date, p_direction text, p_search text DEFAULT NULL, p_currency text DEFAULT NULL, p_paid text DEFAULT NULL, p_submitted text DEFAULT NULL, p_project_id text DEFAULT NULL, p_category_id text DEFAULT NULL, p_payment_method text DEFAULT NULL, p_amount_min numeric DEFAULT NULL, p_amount_max numeric DEFAULT NULL, p_sort_field text DEFAULT 'invoice_issue_date', p_sort_dir text DEFAULT 'desc', p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
 RETURNS TABLE(id uuid, invoice_number text, invoice_direction text, invoice_issue_date date, invoice_delivery_date date, supplier_tax_number text, supplier_name text, supplier_address text, customer_tax_number text, customer_name text, customer_address text, invoice_net_amount numeric, invoice_gross_amount numeric, invoice_vat_amount numeric, currency text, payment_method text, invoice_operation text, payment_date date, paid boolean, submitted boolean, details_fetched boolean, company_id uuid, user_id uuid, created_at timestamptz, fetched_at timestamptz, project_id uuid, category_id uuid, transaction_id uuid, total_count bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT ni.id, ni.invoice_number, ni.invoice_direction, ni.invoice_issue_date, ni.invoice_delivery_date,
    ni.supplier_tax_number, ni.supplier_name, ni.supplier_address, ni.customer_tax_number, ni.customer_name, ni.customer_address,
    ni.invoice_net_amount, ni.invoice_gross_amount, ni.invoice_vat_amount, ni.currency, ni.payment_method, ni.invoice_operation,
    ni.payment_date, ni.paid, ni.submitted, ni.details_fetched, ni.company_id, ni.user_id, ni.created_at, ni.fetched_at,
    ni.project_id, ni.category_id, ni.transaction_id, count(*) OVER()::bigint AS total_count
  FROM nav_invoices ni
  WHERE ni.company_id = p_company_id AND ni.invoice_direction = p_direction
    AND ni.invoice_issue_date >= p_date_from AND ni.invoice_issue_date <= p_date_to
    AND (p_search IS NULL OR p_search = '' OR (ni.invoice_number ILIKE '%' || p_search || '%' OR ni.supplier_name ILIKE '%' || p_search || '%' OR ni.customer_name ILIKE '%' || p_search || '%' OR ni.supplier_tax_number ILIKE '%' || p_search || '%' OR ni.customer_tax_number ILIKE '%' || p_search || '%'))
    AND (p_currency IS NULL OR p_currency = 'all' OR ni.currency = p_currency)
    AND (p_paid IS NULL OR p_paid = 'all' OR (p_paid = 'yes' AND ni.transaction_id IS NOT NULL) OR (p_paid = 'no' AND ni.transaction_id IS NULL))
    AND (p_submitted IS NULL OR p_submitted = 'all' OR (p_submitted = 'yes' AND ni.submitted = true) OR (p_submitted = 'no' AND (ni.submitted IS NULL OR ni.submitted = false)))
    AND (p_project_id IS NULL OR p_project_id = 'all' OR (p_project_id = 'none' AND ni.project_id IS NULL) OR ni.project_id = p_project_id::uuid)
    AND (p_category_id IS NULL OR p_category_id = 'all' OR (p_category_id = 'none' AND ni.category_id IS NULL) OR ni.category_id = p_category_id::uuid)
    AND (p_payment_method IS NULL OR p_payment_method = 'all' OR (p_payment_method = 'none' AND ni.payment_method IS NULL) OR ni.payment_method = p_payment_method)
    AND (p_amount_min IS NULL OR COALESCE(ni.invoice_gross_amount, 0) >= p_amount_min)
    AND (p_amount_max IS NULL OR COALESCE(ni.invoice_gross_amount, 0) <= p_amount_max)
  ORDER BY
    CASE WHEN p_sort_dir = 'asc' THEN
      CASE p_sort_field
        WHEN 'invoice_issue_date' THEN ni.invoice_issue_date::text
        WHEN 'invoice_delivery_date' THEN ni.invoice_delivery_date::text
        WHEN 'invoice_number' THEN ni.invoice_number
        WHEN 'invoice_net_amount' THEN lpad(COALESCE(ni.invoice_net_amount, 0)::text, 20, '0')
        WHEN 'invoice_gross_amount' THEN lpad(COALESCE(ni.invoice_gross_amount, 0)::text, 20, '0')
        WHEN 'invoice_vat_amount' THEN lpad(COALESCE(ni.invoice_vat_amount, 0)::text, 20, '0')
        WHEN 'partner_name' THEN COALESCE(CASE WHEN p_direction = 'INBOUND' THEN ni.supplier_name ELSE ni.customer_name END, '')
        ELSE ni.invoice_issue_date::text END
    END ASC NULLS LAST,
    CASE WHEN p_sort_dir = 'desc' OR p_sort_dir IS NULL THEN
      CASE p_sort_field
        WHEN 'invoice_issue_date' THEN ni.invoice_issue_date::text
        WHEN 'invoice_delivery_date' THEN ni.invoice_delivery_date::text
        WHEN 'invoice_number' THEN ni.invoice_number
        WHEN 'invoice_net_amount' THEN lpad(COALESCE(ni.invoice_net_amount, 0)::text, 20, '0')
        WHEN 'invoice_gross_amount' THEN lpad(COALESCE(ni.invoice_gross_amount, 0)::text, 20, '0')
        WHEN 'invoice_vat_amount' THEN lpad(COALESCE(ni.invoice_vat_amount, 0)::text, 20, '0')
        WHEN 'partner_name' THEN COALESCE(CASE WHEN p_direction = 'INBOUND' THEN ni.supplier_name ELSE ni.customer_name END, '')
        ELSE ni.invoice_issue_date::text END
    END DESC NULLS LAST
  LIMIT p_page_size OFFSET (p_page - 1) * p_page_size;
END;
$$;

-- get_filtered_submitted_invoices (version WITHOUT payment_method)
CREATE OR REPLACE FUNCTION public.get_filtered_submitted_invoices(p_company_id uuid, p_date_from date, p_date_to date, p_direction text, p_search text DEFAULT NULL, p_currency text DEFAULT NULL, p_category_id text DEFAULT NULL, p_project_id text DEFAULT NULL, p_amount_min numeric DEFAULT NULL, p_amount_max numeric DEFAULT NULL, p_sort_field text DEFAULT 'kibocsatas_datuma', p_sort_dir text DEFAULT 'desc', p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
 RETURNS TABLE(id uuid, bizonylatsorszam text, kibocsatas_datuma date, teljesites_datuma date, elado_nev text, vevo_nev text, adoalap_osszesen numeric, brutto_vegosszeg numeric, afa_osszeg_osszesen numeric, penznem text, category_id uuid, project_id uuid, image_url text, melleklet_url text, invoice_direction text, reference_number text, total_count bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.bizonylatsorszam, i.kibocsatas_datuma, i.teljesites_datuma,
    i.elado_nev, i.vevo_nev, i.adoalap_osszesen, i.brutto_vegosszeg,
    i.afa_osszeg_osszesen, i.penznem, i.category_id, i.project_id,
    i.image_url, i.melleklet_url, i.invoice_direction, i.reference_number,
    count(*) OVER()::bigint AS total_count
  FROM invoices i
  WHERE i.company_id = p_company_id AND i.invoice_direction = p_direction
    AND i.kibocsatas_datuma >= p_date_from AND i.kibocsatas_datuma <= p_date_to
    AND (p_search IS NULL OR p_search = '' OR (i.elado_nev ILIKE '%' || p_search || '%' OR i.vevo_nev ILIKE '%' || p_search || '%' OR i.bizonylatsorszam ILIKE '%' || p_search || '%'))
    AND (p_currency IS NULL OR p_currency = 'all' OR i.penznem = p_currency)
    AND (p_category_id IS NULL OR p_category_id = 'all' OR (p_category_id = 'none' AND i.category_id IS NULL) OR i.category_id = p_category_id::uuid)
    AND (p_project_id IS NULL OR p_project_id = 'all' OR (p_project_id = 'none' AND i.project_id IS NULL) OR i.project_id = p_project_id::uuid)
    AND (p_amount_min IS NULL OR COALESCE(i.brutto_vegosszeg, 0) >= p_amount_min)
    AND (p_amount_max IS NULL OR COALESCE(i.brutto_vegosszeg, 0) <= p_amount_max)
  ORDER BY
    CASE WHEN p_sort_dir = 'asc' THEN CASE p_sort_field
        WHEN 'kibocsatas_datuma' THEN i.kibocsatas_datuma::text WHEN 'invoice_issue_date' THEN i.kibocsatas_datuma::text
        WHEN 'teljesites_datuma' THEN i.teljesites_datuma::text WHEN 'invoice_delivery_date' THEN i.teljesites_datuma::text
        WHEN 'bizonylatsorszam' THEN i.bizonylatsorszam WHEN 'invoice_number' THEN i.bizonylatsorszam
        WHEN 'elado_nev' THEN i.elado_nev WHEN 'partner_name' THEN i.elado_nev WHEN 'vevo_nev' THEN i.vevo_nev
        WHEN 'adoalap_osszesen' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0') WHEN 'invoice_net_amount' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0')
        WHEN 'brutto_vegosszeg' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0') WHEN 'invoice_gross_amount' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0')
        ELSE i.kibocsatas_datuma::text END
    END ASC NULLS LAST,
    CASE WHEN p_sort_dir = 'desc' OR p_sort_dir IS NULL THEN CASE p_sort_field
        WHEN 'kibocsatas_datuma' THEN i.kibocsatas_datuma::text WHEN 'invoice_issue_date' THEN i.kibocsatas_datuma::text
        WHEN 'teljesites_datuma' THEN i.teljesites_datuma::text WHEN 'invoice_delivery_date' THEN i.teljesites_datuma::text
        WHEN 'bizonylatsorszam' THEN i.bizonylatsorszam WHEN 'invoice_number' THEN i.bizonylatsorszam
        WHEN 'elado_nev' THEN i.elado_nev WHEN 'partner_name' THEN i.elado_nev WHEN 'vevo_nev' THEN i.vevo_nev
        WHEN 'adoalap_osszesen' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0') WHEN 'invoice_net_amount' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0')
        WHEN 'brutto_vegosszeg' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0') WHEN 'invoice_gross_amount' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0')
        ELSE i.kibocsatas_datuma::text END
    END DESC NULLS LAST
  LIMIT p_page_size OFFSET (p_page - 1) * p_page_size;
END;
$$;

-- get_filtered_submitted_invoices (version WITH payment_method)
CREATE OR REPLACE FUNCTION public.get_filtered_submitted_invoices(p_company_id uuid, p_date_from date, p_date_to date, p_direction text, p_search text DEFAULT NULL, p_currency text DEFAULT NULL, p_category_id text DEFAULT NULL, p_project_id text DEFAULT NULL, p_payment_method text DEFAULT NULL, p_amount_min numeric DEFAULT NULL, p_amount_max numeric DEFAULT NULL, p_sort_field text DEFAULT 'kibocsatas_datuma', p_sort_dir text DEFAULT 'desc', p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
 RETURNS TABLE(id uuid, bizonylatsorszam text, kibocsatas_datuma date, teljesites_datuma date, elado_nev text, vevo_nev text, adoalap_osszesen numeric, brutto_vegosszeg numeric, afa_osszeg_osszesen numeric, penznem text, category_id uuid, project_id uuid, image_url text, melleklet_url text, invoice_direction text, reference_number text, fizetesi_mod text, total_count bigint)
 LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.bizonylatsorszam, i.kibocsatas_datuma, i.teljesites_datuma,
    i.elado_nev, i.vevo_nev, i.adoalap_osszesen, i.brutto_vegosszeg,
    i.afa_osszeg_osszesen, i.penznem, i.category_id, i.project_id,
    i.image_url, i.melleklet_url, i.invoice_direction, i.reference_number,
    i.fizetesi_mod, count(*) OVER()::bigint AS total_count
  FROM invoices i
  WHERE i.company_id = p_company_id AND i.invoice_direction = p_direction
    AND i.kibocsatas_datuma >= p_date_from AND i.kibocsatas_datuma <= p_date_to
    AND (p_search IS NULL OR p_search = '' OR (i.elado_nev ILIKE '%' || p_search || '%' OR i.vevo_nev ILIKE '%' || p_search || '%' OR i.bizonylatsorszam ILIKE '%' || p_search || '%'))
    AND (p_currency IS NULL OR p_currency = 'all' OR i.penznem = p_currency)
    AND (p_category_id IS NULL OR p_category_id = 'all' OR (p_category_id = 'none' AND i.category_id IS NULL) OR i.category_id = p_category_id::uuid)
    AND (p_project_id IS NULL OR p_project_id = 'all' OR (p_project_id = 'none' AND i.project_id IS NULL) OR i.project_id = p_project_id::uuid)
    AND (p_payment_method IS NULL OR p_payment_method = 'all' OR (p_payment_method = 'none' AND (i.fizetesi_mod IS NULL OR i.fizetesi_mod = '')) OR i.fizetesi_mod ILIKE p_payment_method)
    AND (p_amount_min IS NULL OR COALESCE(i.brutto_vegosszeg, 0) >= p_amount_min)
    AND (p_amount_max IS NULL OR COALESCE(i.brutto_vegosszeg, 0) <= p_amount_max)
  ORDER BY
    CASE WHEN p_sort_dir = 'asc' THEN CASE p_sort_field
        WHEN 'kibocsatas_datuma' THEN i.kibocsatas_datuma::text WHEN 'invoice_issue_date' THEN i.kibocsatas_datuma::text
        WHEN 'teljesites_datuma' THEN i.teljesites_datuma::text WHEN 'invoice_delivery_date' THEN i.teljesites_datuma::text
        WHEN 'bizonylatsorszam' THEN i.bizonylatsorszam WHEN 'invoice_number' THEN i.bizonylatsorszam
        WHEN 'elado_nev' THEN i.elado_nev WHEN 'partner_name' THEN i.elado_nev WHEN 'vevo_nev' THEN i.vevo_nev
        WHEN 'adoalap_osszesen' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0') WHEN 'invoice_net_amount' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0')
        WHEN 'brutto_vegosszeg' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0') WHEN 'invoice_gross_amount' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0')
        ELSE i.kibocsatas_datuma::text END
    END ASC NULLS LAST,
    CASE WHEN p_sort_dir = 'desc' OR p_sort_dir IS NULL THEN CASE p_sort_field
        WHEN 'kibocsatas_datuma' THEN i.kibocsatas_datuma::text WHEN 'invoice_issue_date' THEN i.kibocsatas_datuma::text
        WHEN 'teljesites_datuma' THEN i.teljesites_datuma::text WHEN 'invoice_delivery_date' THEN i.teljesites_datuma::text
        WHEN 'bizonylatsorszam' THEN i.bizonylatsorszam WHEN 'invoice_number' THEN i.bizonylatsorszam
        WHEN 'elado_nev' THEN i.elado_nev WHEN 'partner_name' THEN i.elado_nev WHEN 'vevo_nev' THEN i.vevo_nev
        WHEN 'adoalap_osszesen' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0') WHEN 'invoice_net_amount' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0')
        WHEN 'brutto_vegosszeg' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0') WHEN 'invoice_gross_amount' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0')
        ELSE i.kibocsatas_datuma::text END
    END DESC NULLS LAST
  LIMIT p_page_size OFFSET (p_page - 1) * p_page_size;
END;
$$;

-- get_nav_invoice_aggregates
CREATE OR REPLACE FUNCTION public.get_nav_invoice_aggregates(p_company_id uuid, p_date_from date, p_date_to date)
 RETURNS TABLE(invoice_direction text, currency text, total_net numeric, total_gross numeric, total_vat numeric, paid_net numeric, paid_gross numeric, unpaid_net numeric, unpaid_gross numeric, invoice_count bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH combined_invoices AS (
    SELECT ni.invoice_direction::TEXT, COALESCE(ni.currency, 'HUF')::TEXT as currency,
      ni.invoice_net_amount as net,
      COALESCE(ni.invoice_gross_amount, COALESCE(ni.invoice_net_amount, 0) + COALESCE(ni.invoice_vat_amount, 0)) as gross,
      ni.invoice_vat_amount as vat,
      CASE WHEN ni.transaction_id IS NOT NULL THEN ni.invoice_net_amount ELSE 0 END as paid_net,
      CASE WHEN ni.transaction_id IS NOT NULL THEN COALESCE(ni.invoice_gross_amount, COALESCE(ni.invoice_net_amount, 0) + COALESCE(ni.invoice_vat_amount, 0)) ELSE 0 END as paid_gross,
      CASE WHEN ni.transaction_id IS NULL THEN ni.invoice_net_amount ELSE 0 END as unpaid_net,
      CASE WHEN ni.transaction_id IS NULL THEN COALESCE(ni.invoice_gross_amount, COALESCE(ni.invoice_net_amount, 0) + COALESCE(ni.invoice_vat_amount, 0)) ELSE 0 END as unpaid_gross
    FROM nav_invoices ni
    WHERE ni.company_id = p_company_id AND ni.invoice_issue_date >= p_date_from AND ni.invoice_issue_date <= p_date_to
    UNION ALL
    SELECT i.invoice_direction::TEXT, COALESCE(i.penznem, 'HUF')::TEXT as currency,
      COALESCE(i.adoalap_osszesen, 0) as net, COALESCE(i.brutto_vegosszeg, 0) as gross, COALESCE(i.afa_osszeg_osszesen, 0) as vat,
      CASE WHEN (i.transaction_id IS NOT NULL OR i.fizetve = true) THEN COALESCE(i.adoalap_osszesen, 0) ELSE 0 END as paid_net,
      CASE WHEN (i.transaction_id IS NOT NULL OR i.fizetve = true) THEN COALESCE(i.brutto_vegosszeg, 0) ELSE 0 END as paid_gross,
      CASE WHEN (i.transaction_id IS NULL AND (i.fizetve IS NULL OR i.fizetve = false)) THEN COALESCE(i.adoalap_osszesen, 0) ELSE 0 END as unpaid_net,
      CASE WHEN (i.transaction_id IS NULL AND (i.fizetve IS NULL OR i.fizetve = false)) THEN COALESCE(i.brutto_vegosszeg, 0) ELSE 0 END as unpaid_gross
    FROM invoices i
    WHERE i.company_id = p_company_id AND i.kibocsatas_datuma::date >= p_date_from AND i.kibocsatas_datuma::date <= p_date_to
      AND i.invoice_direction = 'INBOUND'
      AND NOT EXISTS (SELECT 1 FROM nav_invoices ni WHERE ni.company_id = i.company_id AND REPLACE(ni.invoice_number, ' ', '') = REPLACE(i.bizonylatsorszam, ' ', ''))
  )
  SELECT c.invoice_direction, c.currency,
    COALESCE(SUM(c.net), 0)::NUMERIC, COALESCE(SUM(c.gross), 0)::NUMERIC, COALESCE(SUM(c.vat), 0)::NUMERIC,
    COALESCE(SUM(c.paid_net), 0)::NUMERIC, COALESCE(SUM(c.paid_gross), 0)::NUMERIC,
    COALESCE(SUM(c.unpaid_net), 0)::NUMERIC, COALESCE(SUM(c.unpaid_gross), 0)::NUMERIC,
    COUNT(*)::BIGINT
  FROM combined_invoices c GROUP BY c.invoice_direction, c.currency;
END;
$$;

-- get_petty_cash_balance
CREATE OR REPLACE FUNCTION public.get_petty_cash_balance(p_company_id uuid)
 RETURNS TABLE(balance numeric, has_settings boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_opening_balance numeric; v_start_date date; v_withdrawals numeric;
  v_cash_deposits numeric; v_cash_sales numeric; v_cash_expenses numeric; v_nav_cash_expenses numeric;
BEGIN
  SELECT hp.opening_balance, hp.start_date INTO v_opening_balance, v_start_date FROM hp_settings hp WHERE hp.company_id = p_company_id;
  IF NOT FOUND OR v_start_date IS NULL THEN RETURN QUERY SELECT 0::numeric, false; RETURN; END IF;
  v_opening_balance := COALESCE(v_opening_balance, 0);
  SELECT COALESCE(SUM(ABS(t.amount)), 0) INTO v_withdrawals FROM transactions t WHERE t.company_id = p_company_id AND t.type IN ('atm készpénzfelvét', 'pénztári kp felvét') AND t.transaction_date >= v_start_date;
  SELECT COALESCE(SUM(ABS(t.amount)), 0) INTO v_cash_deposits FROM transactions t WHERE t.company_id = p_company_id AND t.type IN ('pénztári kp befizetés', 'kp befizetés atm-en keresztül') AND t.transaction_date >= v_start_date;
  SELECT COALESCE(SUM(ABS(ni.invoice_gross_amount)), 0) INTO v_cash_sales FROM nav_invoices ni WHERE ni.company_id = p_company_id AND ni.invoice_direction = 'OUTBOUND' AND ni.payment_method IN ('CASH', 'KÉSZPÉNZ') AND ni.invoice_issue_date >= v_start_date;
  SELECT COALESCE(SUM(ABS(i.brutto_vegosszeg)), 0) INTO v_cash_expenses FROM invoices i WHERE i.company_id = p_company_id AND i.fizetesi_mod ILIKE '%készpénz%' AND i.reference_number IS NULL AND i.kibocsatas_datuma >= v_start_date;
  SELECT COALESCE(SUM(ABS(ni.invoice_gross_amount)), 0) INTO v_nav_cash_expenses FROM nav_invoices ni WHERE ni.company_id = p_company_id AND ni.invoice_direction = 'INBOUND' AND ni.payment_method IN ('CASH', 'KÉSZPÉNZ') AND ni.invoice_issue_date >= v_start_date
    AND NOT EXISTS (SELECT 1 FROM invoices i2 WHERE i2.company_id = p_company_id AND i2.bizonylatsorszam = ni.invoice_number AND i2.fizetesi_mod ILIKE '%készpénz%' AND i2.reference_number IS NULL);
  RETURN QUERY SELECT (v_opening_balance + v_withdrawals - v_cash_deposits + v_cash_sales - v_cash_expenses - v_nav_cash_expenses)::numeric, true;
END;
$$;
