-- ============================================
-- 1. PROJEKT TÍPUS OSZLOP
-- ============================================
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'one_time';

-- ============================================
-- 2. SZÁMLA-PROJEKT HOZZÁRENDELÉS VÉDELEM (1 számla → 1 projekt)
-- ============================================
CREATE OR REPLACE FUNCTION enforce_invoice_single_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_project_name TEXT;
BEGIN
  -- Ha a project_id nem változik, engedélyezzük
  IF OLD.project_id IS NOT DISTINCT FROM NEW.project_id THEN
    RETURN NEW;
  END IF;
  
  -- Ha a régi project_id NULL volt, engedélyezzük az új beállítást
  IF OLD.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Ha a project_id-t NULL-ra állítják (eltávolítás), engedélyezzük
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Ha már van project_id és mást akarnak beállítani: HIBA
  SELECT name INTO v_existing_project_name
  FROM projects
  WHERE id = OLD.project_id;
  
  RAISE EXCEPTION 'INVOICE_ALREADY_ASSIGNED::%', 
    COALESCE(v_existing_project_name, 'Ismeretlen projekt');
END;
$$;

-- Trigger a nav_invoices táblára
DROP TRIGGER IF EXISTS trg_enforce_invoice_single_project ON nav_invoices;
CREATE TRIGGER trg_enforce_invoice_single_project
  BEFORE UPDATE OF project_id ON nav_invoices
  FOR EACH ROW
  EXECUTE FUNCTION enforce_invoice_single_project();