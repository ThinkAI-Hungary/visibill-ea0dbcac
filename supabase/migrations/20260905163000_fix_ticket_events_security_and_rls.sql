-- ============================================================================
-- Migration: Fix ticket_events security, RLS policies and comment trigger (CRIT-2)
-- Date: 2026-09-05
-- Reference: visibill-db-audit CRIT-2 / ADR A-003, A-017, A-020, P-035
-- ============================================================================

-- 1. Régi és új policy-k törlése az idempotens futtathatóság érdekében
DROP POLICY IF EXISTS "Users can view ticket events" ON public.ticket_events;
DROP POLICY IF EXISTS "ticket_events_service_role_all" ON public.ticket_events;
DROP POLICY IF EXISTS "ticket_events_authenticated_select" ON public.ticket_events;
DROP POLICY IF EXISTS "ticket_events_support_admin_insert" ON public.ticket_events;
DROP POLICY IF EXISTS "ticket_events_management_delete" ON public.ticket_events;

-- 2. Service role teljes jogú hozzáférése (Kifejezetten csak service_role szerepkörnek!)
CREATE POLICY "ticket_events_service_role_all"
  ON public.ticket_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Hitelesített felhasználók olvasási joga (SELECT)
-- Support adminok látnak minden eseményt; normál felhasználók kizárólag a saját ticketjeik
-- publikus eseményeit láthatják (InitPlan (SELECT auth.uid()) és belső megjegyzés szűréssel)
CREATE POLICY "ticket_events_authenticated_select"
  ON public.ticket_events
  FOR SELECT
  TO authenticated
  USING (
    public.is_support_admin()
    OR (
      feedback_id IN (
        SELECT f.id FROM public.feedback f
        WHERE f.user_id = (SELECT auth.uid())
      )
      AND COALESCE((metadata->>'is_internal')::boolean, false) = false
    )
  );

-- 4. Hitelesített felhasználók beszúrási joga (INSERT)
-- Kizárólag support adminisztrátorok részére (a triggerek SECURITY DEFINER-ként futnak)
CREATE POLICY "ticket_events_support_admin_insert"
  ON public.ticket_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_support_admin());

-- 5. Hitelesített felhasználók törlési joga (DELETE)
-- Kizárólag management és thinkai jogosultságú support adminok részére
CREATE POLICY "ticket_events_management_delete"
  ON public.ticket_events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = (SELECT auth.uid())
        AND is_support_admin = true
        AND role IN ('management', 'thinkai')
    )
  );

-- 6. Trigger frissítés: Belső megjegyzés (is_internal) jelölésének rögzítése metadata-ban
CREATE OR REPLACE FUNCTION public.create_comment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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

-- 7. Trigger és tábla jogosultságok szigorítása (Hardening)
REVOKE EXECUTE ON FUNCTION public.create_comment_event() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_comment_event() TO authenticated, service_role;

REVOKE ALL ON public.ticket_events FROM anon;
GRANT SELECT, INSERT, DELETE ON public.ticket_events TO authenticated;
GRANT ALL ON public.ticket_events TO service_role;
