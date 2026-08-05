-- Fix get_vat_breakdown parameters to be date instead of text to avoid operator mismatch errors.
-- Also enforce security best practices: SET search_path and grant/revoke execution rights.

-- First, drop the old function with text arguments
DROP FUNCTION IF EXISTS get_vat_breakdown(uuid, text, text);

-- Now, create the new function with date arguments
CREATE OR REPLACE FUNCTION get_vat_breakdown(p_company_id uuid, p_date_from date, p_date_to date)
RETURNS TABLE(
  vat_rate text,
  invoice_direction text,
  currency text,
  net_sum numeric,
  vat_sum numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    item.vat_rate::text,
    inv.invoice_direction::text,
    inv.currency::text,
    SUM(COALESCE(item.net_amount, 0))::numeric as net_sum,
    SUM(COALESCE(item.vat_amount, 0))::numeric as vat_sum
  FROM nav_invoice_items item
  JOIN nav_invoices inv ON item.nav_invoice_id = inv.id
  WHERE inv.company_id = p_company_id
    AND inv.invoice_issue_date >= p_date_from
    AND inv.invoice_issue_date <= p_date_to
  GROUP BY item.vat_rate, inv.invoice_direction, inv.currency;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke default public execution rights and grant only to authenticated and service_role
REVOKE EXECUTE ON FUNCTION get_vat_breakdown(uuid, date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION get_vat_breakdown(uuid, date, date) TO authenticated, service_role;
