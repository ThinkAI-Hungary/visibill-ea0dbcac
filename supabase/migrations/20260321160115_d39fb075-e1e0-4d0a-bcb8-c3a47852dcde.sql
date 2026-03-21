
-- Trigger: when a salary row is inserted with a salary_file_id,
-- automatically set the parent salary_files.status to 'completed'
CREATE OR REPLACE FUNCTION public.mark_salary_file_completed_on_salary_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.salary_file_id IS NOT NULL THEN
    UPDATE salary_files
    SET status = 'completed', updated_at = now()
    WHERE id = NEW.salary_file_id
      AND status IN ('pending', 'processing', 'webhook_sent');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mark_salary_file_completed
AFTER INSERT ON public.salary
FOR EACH ROW
EXECUTE FUNCTION public.mark_salary_file_completed_on_salary_insert();
