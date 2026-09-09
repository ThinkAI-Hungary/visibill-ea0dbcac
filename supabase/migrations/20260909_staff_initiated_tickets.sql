-- Migration: 20260909_staff_initiated_tickets.sql
-- Description: Add created_by column to feedback and update get_unread_ticket_count RPC

-- 1. Add created_by column referencing profiles(user_id)
ALTER TABLE public.feedback
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- 2. Add index on created_by (FK index requirement per visibill-db-checklist)
CREATE INDEX IF NOT EXISTS idx_feedback_created_by ON public.feedback(created_by);

-- 3. Update get_unread_ticket_count RPC to handle staff-initiated tickets with 0 comments
CREATE OR REPLACE FUNCTION public.get_unread_ticket_count(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  v_count integer;
  v_is_support_admin boolean;
  v_role text;
BEGIN
  -- Get user profile info
  SELECT is_support_admin, role INTO v_is_support_admin, v_role
  FROM public.profiles
  WHERE user_id = p_user_id;

  SELECT COUNT(DISTINCT f.id) INTO v_count
  FROM public.feedback f
  LEFT JOIN public.ticket_reads r ON r.feedback_id = f.id AND r.user_id = p_user_id
  LEFT JOIN public.ticket_comments c ON c.feedback_id = f.id AND c.user_id != p_user_id
  WHERE (
      -- Condition A: Unread comment from another party
      (c.id IS NOT NULL AND (r.last_read_at IS NULL OR c.created_at > r.last_read_at))
      OR
      -- Condition B: Staff-initiated ticket with unread initial message
      (f.created_by IS NOT NULL AND f.created_by != p_user_id AND (r.last_read_at IS NULL OR f.created_at > r.last_read_at))
    )
    -- Filter tickets visible to user based on role:
    AND (
      v_role = 'management' OR v_role = 'thinkai'
      OR (v_is_support_admin AND (f.assigned_to IS NULL OR f.assigned_to = p_user_id))
      OR (f.user_id = p_user_id)
    );

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_unread_ticket_count(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_ticket_count(uuid) TO authenticated, service_role;
