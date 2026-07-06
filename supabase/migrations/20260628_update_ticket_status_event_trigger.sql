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
