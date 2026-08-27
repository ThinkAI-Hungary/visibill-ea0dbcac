-- Add project_id and notes columns to line items tables
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.nav_invoice_items ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.nav_invoice_items ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create auto-linkage rules table
CREATE TABLE IF NOT EXISTS public.item_project_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  line_description TEXT NOT NULL,
  gl_number TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT item_project_rules_unique UNIQUE (company_id, line_description, gl_number)
);

-- Enable RLS
ALTER TABLE public.item_project_rules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid errors
DROP POLICY IF EXISTS "Allow read access for company members" ON public.item_project_rules;
DROP POLICY IF EXISTS "Allow insert access for company members" ON public.item_project_rules;
DROP POLICY IF EXISTS "Allow delete access for company members" ON public.item_project_rules;

-- Create RLS Policies
CREATE POLICY "Allow read access for company members" ON public.item_project_rules
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Allow insert access for company members" ON public.item_project_rules
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Allow delete access for company members" ON public.item_project_rules
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

-- Helper function to extract G/L number from classifications JSONB
CREATE OR REPLACE FUNCTION public.get_gl_number_from_classifications(classifications JSONB)
RETURNS TEXT AS $$
DECLARE
  preset_key TEXT;
  preset_val JSONB;
BEGIN
  IF classifications IS NULL THEN
    RETURN NULL;
  END IF;
  
  FOR preset_key, preset_val IN SELECT * FROM jsonb_each(classifications) LOOP
    IF preset_val ? 'gl_number' THEN
      RETURN preset_val->>'gl_number';
    END IF;
  END LOOP;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- Trigger function to automatically apply project rules on INSERT/UPDATE of line items
CREATE OR REPLACE FUNCTION public.apply_item_project_rules()
RETURNS TRIGGER AS $$
DECLARE
  rule_project_id UUID;
  item_gl_number TEXT;
  item_company_id UUID;
BEGIN
  -- If project_id is already set, do not override
  IF NEW.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Extract G/L number
  item_gl_number := public.get_gl_number_from_classifications(NEW.gl_classifications);
  IF item_gl_number IS NULL OR NEW.line_description IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch company_id
  IF TG_TABLE_NAME = 'invoice_items' THEN
    SELECT company_id INTO item_company_id FROM public.invoices WHERE id = NEW.invoice_id;
  ELSIF TG_TABLE_NAME = 'nav_invoice_items' THEN
    SELECT company_id INTO item_company_id FROM public.nav_invoices WHERE id = NEW.nav_invoice_id;
  END IF;

  IF item_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find matching rule (exact, case-insensitive match on description and exact match on gl_number)
  SELECT project_id INTO rule_project_id
  FROM public.item_project_rules
  WHERE company_id = item_company_id
    AND LOWER(TRIM(line_description)) = LOWER(TRIM(NEW.line_description))
    AND gl_number = item_gl_number
  LIMIT 1;

  IF rule_project_id IS NOT NULL THEN
    NEW.project_id := rule_project_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind triggers (drop first to prevent duplicate trigger errors)
DROP TRIGGER IF EXISTS trg_apply_project_rules_invoice_items ON public.invoice_items;
CREATE TRIGGER trg_apply_project_rules_invoice_items
  BEFORE INSERT OR UPDATE OF gl_classifications, line_description ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.apply_item_project_rules();

DROP TRIGGER IF EXISTS trg_apply_project_rules_nav_invoice_items ON public.nav_invoice_items;
CREATE TRIGGER trg_apply_project_rules_nav_invoice_items
  BEFORE INSERT OR UPDATE OF gl_classifications, line_description ON public.nav_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.apply_item_project_rules();

-- RPC function to save/update item project rule and retroactively apply it to existing matching items
CREATE OR REPLACE FUNCTION public.save_item_project_rule_and_retroactive(
  p_company_id UUID,
  p_line_description TEXT,
  p_gl_number TEXT,
  p_project_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- Insert or update rule
  INSERT INTO public.item_project_rules (company_id, line_description, gl_number, project_id, user_id)
  VALUES (p_company_id, p_line_description, p_gl_number, p_project_id, p_user_id)
  ON CONFLICT (company_id, line_description, gl_number)
  DO UPDATE SET project_id = EXCLUDED.project_id;

  -- Retroactive update of invoice_items
  UPDATE public.invoice_items
  SET project_id = p_project_id
  WHERE project_id IS NULL
    AND invoice_id IN (SELECT id FROM public.invoices WHERE company_id = p_company_id)
    AND LOWER(TRIM(line_description)) = LOWER(TRIM(p_line_description))
    AND public.get_gl_number_from_classifications(gl_classifications) = p_gl_number;

  -- Retroactive update of nav_invoice_items
  UPDATE public.nav_invoice_items
  SET project_id = p_project_id
  WHERE project_id IS NULL
    AND nav_invoice_id IN (SELECT id FROM public.nav_invoices WHERE company_id = p_company_id)
    AND LOWER(TRIM(line_description)) = LOWER(TRIM(p_line_description))
    AND public.get_gl_number_from_classifications(gl_classifications) = p_gl_number;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
