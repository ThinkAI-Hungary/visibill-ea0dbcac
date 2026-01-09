-- Function to aggregate NAV invoices data
CREATE OR REPLACE FUNCTION get_nav_invoice_aggregates(
  p_company_id UUID,
  p_date_from DATE,
  p_date_to DATE
)
RETURNS TABLE (
  invoice_direction TEXT,
  currency TEXT,
  total_net NUMERIC,
  total_gross NUMERIC,
  total_vat NUMERIC,
  paid_net NUMERIC,
  paid_gross NUMERIC,
  unpaid_net NUMERIC,
  unpaid_gross NUMERIC,
  invoice_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ni.invoice_direction::TEXT,
    COALESCE(ni.currency, 'HUF')::TEXT as currency,
    COALESCE(SUM(ni.invoice_net_amount), 0)::NUMERIC as total_net,
    COALESCE(SUM(COALESCE(ni.invoice_gross_amount, COALESCE(ni.invoice_net_amount, 0) + COALESCE(ni.invoice_vat_amount, 0))), 0)::NUMERIC as total_gross,
    COALESCE(SUM(ni.invoice_vat_amount), 0)::NUMERIC as total_vat,
    COALESCE(SUM(CASE WHEN ni.paid = true THEN ni.invoice_net_amount ELSE 0 END), 0)::NUMERIC as paid_net,
    COALESCE(SUM(CASE WHEN ni.paid = true THEN COALESCE(ni.invoice_gross_amount, COALESCE(ni.invoice_net_amount, 0) + COALESCE(ni.invoice_vat_amount, 0)) ELSE 0 END), 0)::NUMERIC as paid_gross,
    COALESCE(SUM(CASE WHEN ni.paid IS NOT TRUE THEN ni.invoice_net_amount ELSE 0 END), 0)::NUMERIC as unpaid_net,
    COALESCE(SUM(CASE WHEN ni.paid IS NOT TRUE THEN COALESCE(ni.invoice_gross_amount, COALESCE(ni.invoice_net_amount, 0) + COALESCE(ni.invoice_vat_amount, 0)) ELSE 0 END), 0)::NUMERIC as unpaid_gross,
    COUNT(*)::BIGINT as invoice_count
  FROM nav_invoices ni
  WHERE ni.company_id = p_company_id
    AND ni.invoice_issue_date >= p_date_from
    AND ni.invoice_issue_date <= p_date_to
  GROUP BY ni.invoice_direction, COALESCE(ni.currency, 'HUF');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to aggregate uploaded invoices data
CREATE OR REPLACE FUNCTION get_invoice_aggregates(
  p_company_id UUID,
  p_date_from DATE,
  p_date_to DATE
)
RETURNS TABLE (
  currency TEXT,
  total_gross NUMERIC,
  processing_count BIGINT,
  completed_count BIGINT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(i.penznem, 'HUF')::TEXT as currency,
    COALESCE(SUM(i.brutto_vegosszeg), 0)::NUMERIC as total_gross,
    COUNT(*) FILTER (WHERE i.statusz = 'feldolgozas_alatt')::BIGINT as processing_count,
    COUNT(*) FILTER (WHERE i.statusz = 'feldolgozva')::BIGINT as completed_count,
    COUNT(*)::BIGINT as total_count
  FROM invoices i
  WHERE i.company_id = p_company_id
    AND i.kibocsatas_datuma >= p_date_from
    AND i.kibocsatas_datuma <= p_date_to
  GROUP BY COALESCE(i.penznem, 'HUF');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;