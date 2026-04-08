CREATE OR REPLACE FUNCTION public.get_nav_invoice_aggregates(p_company_id uuid, p_date_from date, p_date_to date)
 RETURNS TABLE(invoice_direction text, currency text, total_net numeric, total_gross numeric, total_vat numeric, paid_net numeric, paid_gross numeric, unpaid_net numeric, unpaid_gross numeric, invoice_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH combined_invoices AS (
    SELECT 
      ni.invoice_direction::TEXT,
      COALESCE(ni.currency, 'HUF')::TEXT as currency,
      ni.invoice_net_amount as net,
      COALESCE(ni.invoice_gross_amount, COALESCE(ni.invoice_net_amount, 0) + COALESCE(ni.invoice_vat_amount, 0)) as gross,
      ni.invoice_vat_amount as vat,
      CASE WHEN ni.transaction_id IS NOT NULL THEN ni.invoice_net_amount ELSE 0 END as paid_net,
      CASE WHEN ni.transaction_id IS NOT NULL THEN COALESCE(ni.invoice_gross_amount, COALESCE(ni.invoice_net_amount, 0) + COALESCE(ni.invoice_vat_amount, 0)) ELSE 0 END as paid_gross,
      CASE WHEN ni.transaction_id IS NULL THEN ni.invoice_net_amount ELSE 0 END as unpaid_net,
      CASE WHEN ni.transaction_id IS NULL THEN COALESCE(ni.invoice_gross_amount, COALESCE(ni.invoice_net_amount, 0) + COALESCE(ni.invoice_vat_amount, 0)) ELSE 0 END as unpaid_gross
    FROM nav_invoices ni
    WHERE ni.company_id = p_company_id
      AND ni.invoice_issue_date >= p_date_from
      AND ni.invoice_issue_date <= p_date_to

    UNION ALL

    SELECT 
      i.invoice_direction::TEXT,
      COALESCE(i.penznem, 'HUF')::TEXT as currency,
      COALESCE(i.adoalap_osszesen, 0) as net,
      COALESCE(i.brutto_vegosszeg, 0) as gross,
      COALESCE(i.afa_osszeg_osszesen, 0) as vat,
      CASE WHEN (i.transaction_id IS NOT NULL OR i.fizetve = true) THEN COALESCE(i.adoalap_osszesen, 0) ELSE 0 END as paid_net,
      CASE WHEN (i.transaction_id IS NOT NULL OR i.fizetve = true) THEN COALESCE(i.brutto_vegosszeg, 0) ELSE 0 END as paid_gross,
      CASE WHEN (i.transaction_id IS NULL AND (i.fizetve IS NULL OR i.fizetve = false)) THEN COALESCE(i.adoalap_osszesen, 0) ELSE 0 END as unpaid_net,
      CASE WHEN (i.transaction_id IS NULL AND (i.fizetve IS NULL OR i.fizetve = false)) THEN COALESCE(i.brutto_vegosszeg, 0) ELSE 0 END as unpaid_gross
    FROM invoices i
    WHERE i.company_id = p_company_id
      AND i.kibocsatas_datuma::date >= p_date_from
      AND i.kibocsatas_datuma::date <= p_date_to
      AND i.invoice_direction = 'INBOUND'
      AND NOT EXISTS (
        SELECT 1 FROM nav_invoices ni 
        WHERE ni.company_id = i.company_id 
          AND REPLACE(ni.invoice_number, ' ', '') = REPLACE(i.bizonylatsorszam, ' ', '')
      )
  )
  SELECT 
    c.invoice_direction,
    c.currency,
    COALESCE(SUM(c.net), 0)::NUMERIC as total_net,
    COALESCE(SUM(c.gross), 0)::NUMERIC as total_gross,
    COALESCE(SUM(c.vat), 0)::NUMERIC as total_vat,
    COALESCE(SUM(c.paid_net), 0)::NUMERIC as paid_net,
    COALESCE(SUM(c.paid_gross), 0)::NUMERIC as paid_gross,
    COALESCE(SUM(c.unpaid_net), 0)::NUMERIC as unpaid_net,
    COALESCE(SUM(c.unpaid_gross), 0)::NUMERIC as unpaid_gross,
    COUNT(*)::BIGINT as invoice_count
  FROM combined_invoices c
  GROUP BY c.invoice_direction, c.currency;
END;
$$;
