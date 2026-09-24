-- ==============================================================================
-- Migration: Ticket Resolution Race Guard & Colleague Unread Privacy
-- Description:
--   1. Adds concurrency guard to respond_to_ticket_resolution to prevent race
--      conditions if another colleague already confirmed/resolved the ticket.
--   2. Updates get_unread_ticket_count so non-admin colleagues do not see
--      each other's tickets as unread (only the reporter sees unread notifications).
-- ==============================================================================

-- 1. Update respond_to_ticket_resolution RPC with concurrency guard (Vakfolt 1 - Opció A)
CREATE OR REPLACE FUNCTION public.respond_to_ticket_resolution(
  p_feedback_id uuid,
  p_confirmed boolean,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_name text;
  v_actor_email text;
  v_ticket_user_id uuid;
  v_ticket_company_id uuid;
  v_ticket_status text;
  v_waiting_for_confirmation boolean;
  v_is_support_admin boolean := false;
  v_role text := null;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch ticket info
  SELECT user_id, company_id, status, waiting_for_user_confirmation
  INTO v_ticket_user_id, v_ticket_company_id, v_ticket_status, v_waiting_for_confirmation
  FROM public.feedback
  WHERE id = p_feedback_id;

  IF v_ticket_user_id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  -- Concurrency & State Guard (Vakfolt 1):
  -- Prevent race conditions if another colleague or support agent has already resolved the ticket
  -- or cancelled the resolution request.
  IF v_waiting_for_confirmation IS NOT TRUE OR v_ticket_status = 'resolved' THEN
    RAISE EXCEPTION 'A hibajegy állapota időközben megváltozott vagy már lezárásra került.';
  END IF;

  -- Fetch actor details
  SELECT is_support_admin, role, name INTO v_is_support_admin, v_role, v_actor_name
  FROM public.profiles
  WHERE user_id = v_actor_id;

  v_actor_email := auth.jwt() ->> 'email';
  IF v_actor_name IS NULL THEN
    v_actor_name := COALESCE(v_actor_email, 'Felhasználó');
  END IF;

  -- Authorization check: Can access ticket OR Support admin
  IF NOT (COALESCE(v_is_support_admin, false) OR v_role IN ('thinkai', 'management'))
     AND NOT public.can_access_ticket(v_ticket_company_id, v_ticket_user_id) THEN
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
        'confirmed_by_reporter', (v_ticket_user_id = v_actor_id),
        'confirmed_by_colleague', (v_ticket_user_id != v_actor_id)
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
        'rejected_by_reporter', (v_ticket_user_id = v_actor_id),
        'rejected_by_colleague', (v_ticket_user_id != v_actor_id)
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
$$;

-- 2. Update get_unread_ticket_count to count unread tickets only for the reporter (Vakfolt 3 - Opció A)
CREATE OR REPLACE FUNCTION public.get_unread_ticket_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Filter tickets visible to user based on role or ownership:
    -- Support admin / Management sees all assigned/unassigned tickets
    -- Client / Accountant sees unread ONLY on tickets they reported/created (so colleagues don't see each other's tickets as unread)
    AND (
      v_role = 'management' OR v_role = 'thinkai'
      OR (COALESCE(v_is_support_admin, false) AND (f.assigned_to IS NULL OR f.assigned_to = p_user_id))
      OR (
        NOT COALESCE(v_is_support_admin, false) 
        AND (f.user_id = p_user_id OR f.created_by = p_user_id)
      )
    );

  RETURN COALESCE(v_count, 0);
END;
$$;
