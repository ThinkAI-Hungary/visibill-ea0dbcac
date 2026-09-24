-- ==============================================================================
-- Migration: Hybrid Ticket Access RLS & RPC Permissions
-- Description:
--   Enables collaborative ticket visibility for accounting office staff
--   (e.g., all accountants in the same accounting_firm_id) and company members.
-- ==============================================================================

-- 1. Helper composite index for faster accountant-firm pair lookup
CREATE INDEX IF NOT EXISTS idx_accounty_assignments_user_firm 
  ON public.accounty_assignments(accountant_user_id, accounting_firm_id);

-- 2. Core Access Function: can_access_ticket
CREATE OR REPLACE FUNCTION public.can_access_ticket(p_company_id uuid, p_creator_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- 0. Unauthenticated
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Fast-path: Support admin / management / thinkai
  IF is_support_admin() THEN
    RETURN true;
  END IF;

  -- 2. Fast-path: Creator sees own ticket
  IF p_creator_id IS NOT NULL AND p_creator_id = v_uid THEN
    RETURN true;
  END IF;

  -- 3. Company member / owner / assigned accountant check (if ticket has company_id)
  IF p_company_id IS NOT NULL THEN
    -- Direct company owner
    IF EXISTS (
      SELECT 1 FROM public.companies
      WHERE id = p_company_id AND owner_id = v_uid
    ) THEN
      RETURN true;
    END IF;

    -- Member of the company (company_members)
    IF EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = p_company_id AND user_id = v_uid
    ) THEN
      RETURN true;
    END IF;

    -- Direct accountant assigned to this company
    IF EXISTS (
      SELECT 1 FROM public.accounty_assignments
      WHERE company_id = p_company_id AND accountant_user_id = v_uid
    ) THEN
      RETURN true;
    END IF;

    -- Accountant whose office manages this company
    IF EXISTS (
      SELECT 1
      FROM public.accounty_assignments my_firm
      JOIN public.accounty_assignments comp_firm
        ON my_firm.accounting_firm_id = comp_firm.accounting_firm_id
       AND my_firm.accounting_firm_id IS NOT NULL
      WHERE my_firm.accountant_user_id = v_uid
        AND comp_firm.company_id = p_company_id
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- 4. Same accounting office as the creator
  IF p_creator_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.accounty_assignments my_firm
      JOIN public.accounty_assignments creator_firm
        ON my_firm.accounting_firm_id = creator_firm.accounting_firm_id
       AND my_firm.accounting_firm_id IS NOT NULL
      WHERE my_firm.accountant_user_id = v_uid
        AND creator_firm.accountant_user_id = p_creator_id
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- 3. Update public.feedback RLS
DROP POLICY IF EXISTS "Users can read feedback" ON public.feedback;

CREATE POLICY "Users can read feedback" ON public.feedback
FOR SELECT TO authenticated
USING (
  public.can_access_ticket(company_id, user_id)
);

-- 4. Update public.ticket_comments RLS
DROP POLICY IF EXISTS "Users can view comments on their tickets" ON public.ticket_comments;

CREATE POLICY "Users can view comments on their tickets" ON public.ticket_comments
FOR SELECT TO authenticated
USING (
  is_support_admin() OR (
    EXISTS (
      SELECT 1 FROM public.feedback f
      WHERE f.id = ticket_comments.feedback_id
        AND public.can_access_ticket(f.company_id, f.user_id)
    ) AND is_internal = false
  )
);

DROP POLICY IF EXISTS "Users can insert comments" ON public.ticket_comments;

CREATE POLICY "Users can insert comments" ON public.ticket_comments
FOR INSERT TO authenticated
WITH CHECK (
  ((SELECT auth.uid()) = user_id) AND (
    is_support_admin() OR EXISTS (
      SELECT 1 FROM public.feedback f
      WHERE f.id = ticket_comments.feedback_id
        AND public.can_access_ticket(f.company_id, f.user_id)
    )
  )
);

-- 5. Update public.ticket_events RLS
DROP POLICY IF EXISTS "ticket_events_authenticated_select" ON public.ticket_events;

CREATE POLICY "ticket_events_authenticated_select" ON public.ticket_events
FOR SELECT TO authenticated
USING (
  is_support_admin() OR (
    EXISTS (
      SELECT 1 FROM public.feedback f
      WHERE f.id = ticket_events.feedback_id
        AND public.can_access_ticket(f.company_id, f.user_id)
    ) AND COALESCE((metadata->>'is_internal')::boolean, false) = false
  )
);

-- 6. Update respond_to_ticket_resolution RPC to allow authorized colleagues to respond
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
  v_is_support_admin boolean := false;
  v_role text := null;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch ticket info
  SELECT user_id, company_id, status 
  INTO v_ticket_user_id, v_ticket_company_id, v_ticket_status
  FROM public.feedback
  WHERE id = p_feedback_id;

  IF v_ticket_user_id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
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

-- 7. Update get_unread_ticket_count to count unread tickets for collaborative colleagues
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
    -- Filter tickets visible to user based on role or collaborative access:
    AND (
      v_role = 'management' OR v_role = 'thinkai'
      OR (v_is_support_admin AND (f.assigned_to IS NULL OR f.assigned_to = p_user_id))
      OR public.can_access_ticket(f.company_id, f.user_id)
    );

  RETURN COALESCE(v_count, 0);
END;
$$;
