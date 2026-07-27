-- Database Query Optimizations Migration
-- Creates get_unread_ticket_count and get_vat_breakdown RPC functions

CREATE OR REPLACE FUNCTION get_unread_ticket_count(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  v_count integer;
  v_is_support_admin boolean;
  v_role text;
BEGIN
  -- Get user profile info
  SELECT is_support_admin, role INTO v_is_support_admin, v_role
  FROM profiles
  WHERE user_id = p_user_id;

  SELECT COUNT(DISTINCT c.feedback_id) INTO v_count
  FROM ticket_comments c
  JOIN feedback f ON c.feedback_id = f.id
  LEFT JOIN ticket_reads r ON r.feedback_id = f.id AND r.user_id = p_user_id
  WHERE c.user_id != p_user_id
    AND (r.last_read_at IS NULL OR c.created_at > r.last_read_at)
    -- Filter tickets visible to user based on role:
    AND (
      v_role = 'management' OR v_role = 'thinkai' -- sees all
      OR (v_is_support_admin AND (f.assigned_to IS NULL OR f.assigned_to = p_user_id)) -- support admin
      OR (f.user_id = p_user_id) -- regular user
    );

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_vat_breakdown(p_company_id uuid, p_date_from text, p_date_to text)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
