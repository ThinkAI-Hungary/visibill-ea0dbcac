-- Create sequence for ticket numbers starting with the next logical number
CREATE SEQUENCE IF NOT EXISTS public.feedback_ticket_number_seq;

-- Initialize/adjust sequence to start after the current maximum ticket number
DO $$
DECLARE
  v_max_id integer;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(ticket_number, '[^0-9]', '', 'g'), '')::integer), 0)
  INTO v_max_id
  FROM public.feedback;
  
  EXECUTE 'ALTER SEQUENCE public.feedback_ticket_number_seq RESTART WITH ' || (v_max_id + 1);
END;
$$;

-- Redefine generate_ticket_number function to use the sequence
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'EB-' || lpad(nextval('public.feedback_ticket_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure the trigger is properly registered on the feedback table
DROP TRIGGER IF EXISTS trg_generate_ticket_number ON public.feedback;
DROP TRIGGER IF EXISTS feedback_before_insert ON public.feedback;

CREATE TRIGGER trg_generate_ticket_number
  BEFORE INSERT ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_ticket_number();
