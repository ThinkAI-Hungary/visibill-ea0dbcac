-- Migration: 20260911_ticket_resolution_confirmation.sql
-- Description: Solution confirmation workflow for tickets (support request + customer confirmation / auto-resolve)

-- 1. Add resolution confirmation columns to feedback table
ALTER TABLE public.feedback
ADD COLUMN IF NOT EXISTS waiting_for_user_confirmation boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS resolution_requested_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS resolution_requested_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS resolution_confirmed_at timestamptz DEFAULT NULL;

-- 2. Add partial index for fast lookup of tickets waiting for user confirmation
CREATE INDEX IF NOT EXISTS idx_feedback_waiting_confirmation 
ON public.feedback(waiting_for_user_confirmation) 
WHERE waiting_for_user_confirmation = true;

-- 3. Add FK index for resolution_requested_by per visibill-db-checklist
CREATE INDEX IF NOT EXISTS idx_feedback_resolution_requested_by 
ON public.feedback(resolution_requested_by);

-- 4. RPC: Support agent requests ticket resolution confirmation
CREATE OR REPLACE FUNCTION public.request_ticket_resolution(
  p_feedback_id uuid,
  p_comment text DEFAULT NULL,
  p_attachments text[] DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_actor_id uuid;
  v_actor_name text;
  v_actor_email text;
  v_is_support_admin boolean := false;
  v_role text := null;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller is support admin or management
  SELECT is_support_admin, role, name INTO v_is_support_admin, v_role, v_actor_name
  FROM public.profiles
  WHERE user_id = v_actor_id;

  IF NOT (COALESCE(v_is_support_admin, false) OR v_role IN ('thinkai', 'management')) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only support staff can request ticket resolution';
  END IF;

  v_actor_email := auth.jwt() ->> 'email';
  IF v_actor_name IS NULL THEN
    v_actor_name := COALESCE(v_actor_email, 'Support Munkatárs');
  END IF;

  -- 1. Insert comment if message provided
  IF p_comment IS NOT NULL AND trim(p_comment) != '' THEN
    INSERT INTO public.ticket_comments (
      feedback_id,
      user_id,
      user_name,
      user_email,
      is_admin,
      message,
      attachments,
      is_internal
    ) VALUES (
      p_feedback_id,
      v_actor_id,
      v_actor_name,
      v_actor_email,
      true,
      p_comment,
      p_attachments,
      false
    );
  END IF;

  -- 2. Update ticket to waiting_for_user_confirmation
  UPDATE public.feedback
  SET waiting_for_user_confirmation = true,
      resolution_requested_at = now(),
      resolution_requested_by = v_actor_id,
      status = 'in_progress',
      updated_at = now()
  WHERE id = p_feedback_id;

  -- 3. Log event into ticket_events
  INSERT INTO public.ticket_events (
    feedback_id,
    event_type,
    actor_id,
    actor_email,
    actor_name,
    metadata
  ) VALUES (
    p_feedback_id,
    'resolution_requested',
    v_actor_id,
    v_actor_email,
    v_actor_name,
    jsonb_build_object(
      'comment_provided', (p_comment IS NOT NULL AND trim(p_comment) != ''),
      'is_admin', true
    )
  );

  RETURN jsonb_build_object('success', true, 'status', 'in_progress', 'waiting_for_user_confirmation', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.request_ticket_resolution(uuid, text, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_ticket_resolution(uuid, text, text[]) TO authenticated, service_role;


-- 5. RPC: Customer (or admin) responds to resolution confirmation
CREATE OR REPLACE FUNCTION public.respond_to_ticket_resolution(
  p_feedback_id uuid,
  p_confirmed boolean,
  p_comment text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_actor_id uuid;
  v_actor_name text;
  v_actor_email text;
  v_ticket_user_id uuid;
  v_ticket_status text;
  v_is_support_admin boolean := false;
  v_role text := null;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch ticket info
  SELECT user_id, status INTO v_ticket_user_id, v_ticket_status
  FROM public.feedback
  WHERE id = p_feedback_id;

  IF v_ticket_user_id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  -- Fetch actor details & check permissions
  SELECT is_support_admin, role, name INTO v_is_support_admin, v_role, v_actor_name
  FROM public.profiles
  WHERE user_id = v_actor_id;

  v_actor_email := auth.jwt() ->> 'email';
  IF v_actor_name IS NULL THEN
    v_actor_name := COALESCE(v_actor_email, 'Felhasználó');
  END IF;

  -- Authorization check: Ticket reporter OR Support admin
  IF v_ticket_user_id != v_actor_id AND NOT (COALESCE(v_is_support_admin, false) OR v_role IN ('thinkai', 'management')) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: You cannot respond to this ticket resolution';
  END IF;

  IF p_confirmed IS TRUE THEN
    -- Case A: Confirmed - Auto-resolve the ticket
    UPDATE public.feedback
    SET status = 'resolved',
        waiting_for_user_confirmation = false,
        resolution_confirmed_at = now(),
        updated_at = now()
    WHERE id = p_feedback_id;

    -- Audit event
    INSERT INTO public.ticket_events (
      feedback_id,
      event_type,
      actor_id,
      actor_email,
      actor_name,
      old_value,
      new_value,
      metadata
    ) VALUES (
      p_feedback_id,
      'resolution_confirmed',
      v_actor_id,
      v_actor_email,
      v_actor_name,
      v_ticket_status,
      'resolved',
      jsonb_build_object(
        'automatic_resolution', true,
        'confirmed_by_reporter', (v_ticket_user_id = v_actor_id)
      )
    );

    -- Post resolution confirmation comment
    INSERT INTO public.ticket_comments (
      feedback_id,
      user_id,
      user_name,
      user_email,
      is_admin,
      message,
      is_internal
    ) VALUES (
      p_feedback_id,
      v_actor_id,
      v_actor_name,
      v_actor_email,
      COALESCE(v_is_support_admin, false),
      '<p><em>Az ügyfél megerősítette: a probléma megoldódott. A hibajegy automatikusan lezárásra került.</em></p>',
      false
    );

    RETURN jsonb_build_object('success', true, 'status', 'resolved');

  ELSE
    -- Case B: Rejected - Still an issue, keep in progress
    UPDATE public.feedback
    SET waiting_for_user_confirmation = false,
        status = 'in_progress',
        updated_at = now()
    WHERE id = p_feedback_id;

    -- Audit event
    INSERT INTO public.ticket_events (
      feedback_id,
      event_type,
      actor_id,
      actor_email,
      actor_name,
      metadata
    ) VALUES (
      p_feedback_id,
      'resolution_rejected',
      v_actor_id,
      v_actor_email,
      v_actor_name,
      jsonb_build_object(
        'has_comment', (p_comment IS NOT NULL AND trim(p_comment) != ''),
        'rejected_by_reporter', (v_ticket_user_id = v_actor_id)
      )
    );

    -- If explanation comment provided, insert it
    IF p_comment IS NOT NULL AND trim(p_comment) != '' THEN
      INSERT INTO public.ticket_comments (
        feedback_id,
        user_id,
        user_name,
        user_email,
        is_admin,
        message,
        is_internal
      ) VALUES (
        p_feedback_id,
        v_actor_id,
        v_actor_name,
        v_actor_email,
        COALESCE(v_is_support_admin, false),
        p_comment,
        false
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'status', 'in_progress');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.respond_to_ticket_resolution(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_ticket_resolution(uuid, boolean, text) TO authenticated, service_role;


-- 6. Trigger: Automatically reset waiting_for_user_confirmation if reporter sends a normal comment
CREATE OR REPLACE FUNCTION public.handle_ticket_comment_resolution_reset()
RETURNS trigger AS $$
BEGIN
  IF (NEW.is_internal IS NOT TRUE) THEN
    UPDATE public.feedback
    SET waiting_for_user_confirmation = false,
        updated_at = now()
    WHERE id = NEW.feedback_id
      AND waiting_for_user_confirmation = true
      AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ticket_comment_resolution_reset ON public.ticket_comments;
CREATE TRIGGER trg_ticket_comment_resolution_reset
AFTER INSERT ON public.ticket_comments
FOR EACH ROW
EXECUTE FUNCTION public.handle_ticket_comment_resolution_reset();


-- 7. Update create_comment_event: Suppress comment_added event when automated resolution confirmation comment is posted
CREATE OR REPLACE FUNCTION public.create_comment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Do not create comment_added event if this is an automated resolution confirmation comment
  IF NEW.message LIKE '%Az ügyfél megerősítette: a probléma megoldódott%' 
     OR NEW.message LIKE '%A javasolt megoldás megerősítve%' THEN
    RETURN NEW;
  END IF;

  INSERT INTO ticket_events (feedback_id, event_type, actor_id, actor_email, actor_name, metadata)
  VALUES (
    NEW.feedback_id, 
    'comment_added', 
    NEW.user_id, 
    NEW.user_email, 
    NEW.user_name, 
    jsonb_build_object(
      'is_admin', COALESCE(NEW.is_admin, false),
      'is_internal', COALESCE(NEW.is_internal, false)
    )
  );
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_comment_event() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_comment_event() TO authenticated, service_role;


-- 8. Update get_unread_ticket_count: Count resolution confirmation requests as unread activity
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
      OR
      -- Condition C: Resolution confirmation requested by another party awaiting confirmation
      (f.waiting_for_user_confirmation IS TRUE
       AND f.resolution_requested_by IS NOT NULL
       AND f.resolution_requested_by != p_user_id
       AND (r.last_read_at IS NULL OR COALESCE(f.resolution_requested_at, f.updated_at) > r.last_read_at))
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


