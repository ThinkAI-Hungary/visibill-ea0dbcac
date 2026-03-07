CREATE OR REPLACE FUNCTION public.get_invoice_aggregates(p_company_id uuid, p_date_from date, p_date_to date)
 RETURNS TABLE(currency text, total_gross numeric, processing_count bigint, completed_count bigint, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND i.reference_number IS NULL
  GROUP BY COALESCE(i.penznem, 'HUF');
END;
$function$;