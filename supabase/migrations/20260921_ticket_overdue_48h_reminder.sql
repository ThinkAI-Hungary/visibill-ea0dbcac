-- Migration: 20260921_ticket_overdue_48h_reminder.sql
-- Description: Track customer message timestamps, staff response status, and overdue SLA state on feedback tickets

-- 1. Add SLA & response tracking columns to feedback table
ALTER TABLE public.feedback
ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS needs_staff_response boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz DEFAULT NULL;

-- 2. Indexes for fast query and notification dispatching
CREATE INDEX IF NOT EXISTS idx_feedback_needs_staff_response
ON public.feedback(needs_staff_response, last_customer_message_at)
WHERE status != 'resolved' AND waiting_for_user_confirmation IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_feedback_assigned_to
ON public.feedback(assigned_to);

-- 3. Trigger Function: Sync staff response needs on ticket comments
CREATE OR REPLACE FUNCTION public.handle_ticket_comment_staff_response_sync()
RETURNS trigger AS $$
BEGIN
  -- Internal comments are invisible to customers, they do not satisfy the customer-facing response SLA
  IF NEW.is_internal IS TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.is_admin IS TRUE THEN
    -- Staff replied publicly: ticket no longer awaits staff response
    UPDATE public.feedback
    SET needs_staff_response = false,
        updated_at = now()
    WHERE id = NEW.feedback_id;
  ELSE
    -- Customer replied: ticket now awaits staff response
    UPDATE public.feedback
    SET needs_staff_response = true,
        last_customer_message_at = COALESCE(NEW.created_at, now()),
        updated_at = now()
    WHERE id = NEW.feedback_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_ticket_comment_staff_response_sync() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.handle_ticket_comment_staff_response_sync() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_ticket_comment_staff_response_sync ON public.ticket_comments;
CREATE TRIGGER trg_ticket_comment_staff_response_sync
AFTER INSERT ON public.ticket_comments
FOR EACH ROW
EXECUTE FUNCTION public.handle_ticket_comment_staff_response_sync();


-- 4. Trigger Function: Sync needs_staff_response on feedback creation/status updates
CREATE OR REPLACE FUNCTION public.handle_feedback_staff_response_sync()
RETURNS trigger AS $$
DECLARE
  v_is_staff boolean := false;
BEGIN
  -- Check if created_by is staff (support admin or management)
  IF NEW.created_by IS NOT NULL THEN
    SELECT (COALESCE(is_support_admin, false) OR role IN ('thinkai', 'management'))
    INTO v_is_staff
    FROM public.profiles
    WHERE user_id = NEW.created_by;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_is_staff THEN
      -- Staff-created ticket on behalf of user: wait for customer reply
      NEW.needs_staff_response := false;
      NEW.last_customer_message_at := NULL;
    ELSE
      -- Customer-created ticket: awaits staff response from the start
      NEW.needs_staff_response := true;
      NEW.last_customer_message_at := COALESCE(NEW.created_at, now());
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If resolved or waiting for confirmation, clear needs_staff_response
    IF NEW.status = 'resolved' OR NEW.waiting_for_user_confirmation IS TRUE THEN
      NEW.needs_staff_response := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_feedback_staff_response_sync() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.handle_feedback_staff_response_sync() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_feedback_staff_response_sync ON public.feedback;
CREATE TRIGGER trg_feedback_staff_response_sync
BEFORE INSERT OR UPDATE OF status, waiting_for_user_confirmation ON public.feedback
FOR EACH ROW
EXECUTE FUNCTION public.handle_feedback_staff_response_sync();


-- 5. Backfill existing feedback records
DO $$
DECLARE
  rec RECORD;
  v_last_cust timestamptz;
  v_last_staff timestamptz;
BEGIN
  FOR rec IN SELECT id, created_at, status, waiting_for_user_confirmation FROM public.feedback LOOP
    -- If resolved or waiting for confirmation
    IF rec.status = 'resolved' OR rec.waiting_for_user_confirmation IS TRUE THEN
      UPDATE public.feedback
      SET needs_staff_response = false
      WHERE id = rec.id;
      CONTINUE;
    END IF;

    -- Find latest public customer comment
    SELECT MAX(created_at) INTO v_last_cust
    FROM public.ticket_comments
    WHERE feedback_id = rec.id AND is_admin IS FALSE AND is_internal IS NOT TRUE;

    -- If no customer comment, fallback to ticket created_at
    IF v_last_cust IS NULL THEN
      v_last_cust := rec.created_at;
    END IF;

    -- Find latest public staff comment
    SELECT MAX(created_at) INTO v_last_staff
    FROM public.ticket_comments
    WHERE feedback_id = rec.id AND is_admin IS TRUE AND is_internal IS NOT TRUE;

    IF v_last_staff IS NOT NULL AND v_last_staff > v_last_cust THEN
      -- Staff answered last
      UPDATE public.feedback
      SET last_customer_message_at = v_last_cust,
          needs_staff_response = false
      WHERE id = rec.id;
    ELSE
      -- Customer message pending answer
      UPDATE public.feedback
      SET last_customer_message_at = v_last_cust,
          needs_staff_response = true
      WHERE id = rec.id;
    END IF;
  END LOOP;
END;
$$;

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

