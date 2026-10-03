-- Migration: Add EaisyWorks ticket fields to feedback and create link RPC
-- Date: 2026-10-03
-- Author: ThinkAI Visibill Development

-- 1. Add columns to feedback table
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS eaisyworks_ticket_id text,
  ADD COLUMN IF NOT EXISTS eaisyworks_ticket_key text,
  ADD COLUMN IF NOT EXISTS eaisyworks_synced_at timestamptz;

-- 2. Index for searching/filtering
CREATE INDEX IF NOT EXISTS idx_feedback_eaisyworks_ticket_key
  ON public.feedback (eaisyworks_ticket_key)
  WHERE eaisyworks_ticket_key IS NOT NULL;

COMMENT ON COLUMN public.feedback.eaisyworks_ticket_id IS 'Associated EaisyWorks task internal UUID';
COMMENT ON COLUMN public.feedback.eaisyworks_ticket_key IS 'Associated EaisyWorks task user-facing key (e.g. PROJ-108)';
COMMENT ON COLUMN public.feedback.eaisyworks_synced_at IS 'Timestamp of successful synchronization to EaisyWorks';

-- 3. Atomic RPC to link EaisyWorks ticket and log audit event
CREATE OR REPLACE FUNCTION public.link_eaisyworks_ticket(
  p_ticket_id uuid,
  p_works_id text,
  p_works_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_user_email text;
  v_is_authorized boolean := false;
BEGIN
  -- Permission check: caller must be support admin or management/thinkai
  SELECT 
    (is_support_admin = true OR role = ANY(ARRAY['management', 'thinkai'])),
    name,
    email
  INTO 
    v_is_authorized,
    v_user_name,
    v_user_email
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Nincs jogosultsága EaisyWorks feladat hozzárendeléséhez (Unauthorized)';
  END IF;

  -- Update feedback record
  UPDATE public.feedback
  SET
    eaisyworks_ticket_id = p_works_id,
    eaisyworks_ticket_key = p_works_key,
    eaisyworks_synced_at = NOW()
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A megadott hibajegy nem található (Ticket not found: %)', p_ticket_id;
  END IF;

  -- Create audit event in ticket_events
  INSERT INTO public.ticket_events (
    feedback_id,
    event_type,
    actor_id,
    actor_name,
    actor_email,
    new_value,
    metadata
  ) VALUES (
    p_ticket_id,
    'eaisyworks_synced',
    v_user_id,
    COALESCE(v_user_name, 'Management'),
    v_user_email,
    p_works_key,
    jsonb_build_object(
      'eaisyworks_ticket_id', p_works_id,
      'eaisyworks_ticket_key', p_works_key,
      'synced_at', NOW()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'eaisyworks_ticket_id', p_works_id,
    'eaisyworks_ticket_key', p_works_key,
    'synced_at', NOW()
  );
END;
$$;

-- Grant execution to authenticated users (internal checks enforce role)
GRANT EXECUTE ON FUNCTION public.link_eaisyworks_ticket(uuid, text, text) TO authenticated;
