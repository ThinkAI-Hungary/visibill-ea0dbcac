-- ============================================
-- 1. PARTNERS TÁBLA BŐVÍTÉSE
-- ============================================
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS default_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_partners_default_project 
ON partners(default_project_id) WHERE default_project_id IS NOT NULL;

-- ============================================
-- 2. NAV_INVOICES TÁBLA BŐVÍTÉSE
-- ============================================
ALTER TABLE nav_invoices 
ADD COLUMN IF NOT EXISTS supplier_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nav_invoices_supplier_partner 
ON nav_invoices(supplier_partner_id) WHERE supplier_partner_id IS NOT NULL;

-- ============================================
-- 3. ALAPÉRTELMEZETT PROJEKT HOZZÁRENDELŐ FÜGGVÉNY
-- ============================================
CREATE OR REPLACE FUNCTION assign_supplier_default_projects(p_company_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE nav_invoices ni
  SET project_id = p.default_project_id
  FROM partners p
  WHERE ni.company_id = p_company_id
    AND ni.project_id IS NULL
    AND ni.invoice_direction = 'INBOUND'
    AND ni.supplier_partner_id = p.id
    AND p.default_project_id IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- ============================================
-- 4. JAVÍTOTT SZÁMLA-PROJEKT VÉDELEM TRIGGER
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
  IF OLD.project_id IS NOT DISTINCT FROM NEW.project_id THEN
    RETURN NEW;
  END IF;
  
  IF OLD.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT name INTO v_existing_project_name
  FROM projects
  WHERE id = OLD.project_id;
  
  -- ID és név is benne van az üzenetben
  RAISE EXCEPTION 'INVOICE_ALREADY_ASSIGNED::%::%', 
    OLD.project_id,
    COALESCE(v_existing_project_name, 'Ismeretlen projekt');
END;
$$;

-- Trigger újra-létrehozása (ha változott a függvény)
DROP TRIGGER IF EXISTS trg_enforce_invoice_single_project ON nav_invoices;
CREATE TRIGGER trg_enforce_invoice_single_project
  BEFORE UPDATE OF project_id ON nav_invoices
  FOR EACH ROW
  EXECUTE FUNCTION enforce_invoice_single_project();