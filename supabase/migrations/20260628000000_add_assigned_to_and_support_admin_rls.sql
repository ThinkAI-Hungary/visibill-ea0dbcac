-- ==================================================
-- MERGED FROM: 20260628_add_assigned_to_and_support_admin_rls.sql
-- ==================================================
-- Migration to add assigned_to column and support admin policies
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(user_id);

-- Helper function to check if the current user is a support admin
CREATE OR REPLACE FUNCTION public.is_support_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND is_support_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_support_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_support_admin() TO authenticated, service_role;

-- RLS policies for feedback table to allow support admins full read/update access
DROP POLICY IF EXISTS "Support admins can select all feedback" ON public.feedback;
CREATE POLICY "Support admins can select all feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (public.is_support_admin());

DROP POLICY IF EXISTS "Support admins can update all feedback" ON public.feedback;
CREATE POLICY "Support admins can update all feedback" ON public.feedback
  FOR UPDATE TO authenticated
  WITH CHECK (public.is_support_admin());

-- Elevate test users to support admin status
UPDATE public.profiles SET is_support_admin = true WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89'; -- balazs@thinkai.hu
UPDATE public.profiles SET is_support_admin = true WHERE user_id = 'd83fd63d-c069-4cbf-81e8-b62a447bfeca'; -- management@thinkai.hu


-- ==================================================
-- MERGED FROM: 20260628_add_is_internal_comments_rls.sql
-- ==================================================
-- Migration to add is_internal to ticket_comments and restrict access
ALTER TABLE public.ticket_comments ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false;

-- Recreate SELECT policy on ticket_comments to restrict internal notes to support admins
DROP POLICY IF EXISTS "Users can view comments on their tickets" ON public.ticket_comments;

CREATE POLICY "Users can view comments on their tickets" ON public.ticket_comments
  FOR SELECT TO authenticated
  USING (
    public.is_support_admin()
    OR (
      (feedback_id IN (SELECT id FROM public.feedback WHERE user_id = auth.uid()))
      AND (is_internal = false)
    )
  );


-- ==================================================
-- MERGED FROM: 20260628_add_question_to_feedback_type_check.sql
-- ==================================================
-- Alter feedback_type_check constraint to allow 'question' as a valid ticket type
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_type_check;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_type_check CHECK (type = ANY (ARRAY['bug'::text, 'feedback'::text, 'question'::text]));


-- ==================================================
-- MERGED FROM: 20260628_fix_feedback_update_policy.sql
-- ==================================================
-- Fix the UPDATE policy for feedback table to include the USING clause, enabling support admins to edit tickets.
DROP POLICY IF EXISTS "Support admins can update all feedback" ON public.feedback;
CREATE POLICY "Support admins can update all feedback" ON public.feedback
  FOR UPDATE TO authenticated
  USING (public.is_support_admin())
  WITH CHECK (public.is_support_admin());


-- ==================================================
-- MERGED FROM: 20260628_update_ticket_status_event_trigger.sql
-- ==================================================
-- Update public.create_ticket_status_event trigger function
CREATE OR REPLACE FUNCTION public.create_ticket_status_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id uuid;
  v_actor_name text;
  v_actor_email text;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NOT NULL THEN
    SELECT name INTO v_actor_name FROM public.profiles WHERE user_id = v_actor_id;
    v_actor_email := auth.jwt() ->> 'email';
  END IF;

  -- 1. Status change logging
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ticket_events (feedback_id, event_type, actor_id, actor_email, actor_name, old_value, new_value)
    VALUES (NEW.id, 'status_changed', v_actor_id, v_actor_email, v_actor_name, OLD.status, NEW.status);
  END IF;

  -- 2. Assignee change logging
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    DECLARE
      v_old_assignee_name text := NULL;
      v_new_assignee_name text := NULL;
    BEGIN
      IF OLD.assigned_to IS NOT NULL THEN
        SELECT name INTO v_old_assignee_name FROM public.profiles WHERE user_id = OLD.assigned_to;
        IF v_old_assignee_name IS NULL THEN
          v_old_assignee_name := 'Ismeretlen';
        END IF;
      END IF;

      IF NEW.assigned_to IS NOT NULL THEN
        SELECT name INTO v_new_assignee_name FROM public.profiles WHERE user_id = NEW.assigned_to;
        IF v_new_assignee_name IS NULL THEN
          v_new_assignee_name := 'Ismeretlen';
        END IF;
      END IF;

      INSERT INTO ticket_events (feedback_id, event_type, actor_id, actor_email, actor_name, old_value, new_value)
      VALUES (NEW.id, 'assignee_changed', v_actor_id, v_actor_email, v_actor_name, v_old_assignee_name, v_new_assignee_name);
    END;
  END IF;

  RETURN NEW;
END;
$function$;
