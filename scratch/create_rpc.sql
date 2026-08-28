CREATE OR REPLACE FUNCTION get_courier_reports_counts_by_upload(p_upload_ids uuid[])
RETURNS TABLE(upload_id uuid, total_count bigint, matched_count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.upload_id, 
    COUNT(*)::bigint as total_count,
    COUNT(*) FILTER (WHERE cr.match_status IN ('full', 'partial_nav', 'partial_trx'))::bigint as matched_count
  FROM courier_reports cr
  WHERE cr.upload_id = ANY(p_upload_ids)
  GROUP BY cr.upload_id;
END;
$$ LANGUAGE plpgsql;
