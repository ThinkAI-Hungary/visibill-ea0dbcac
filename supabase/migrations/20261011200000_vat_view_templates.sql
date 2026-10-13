-- Migration: 20261011200000_vat_view_templates.sql
-- Description: ÁFA analitika nézetválasztó és egyedi sablonkészítő adatmodell és RPC

-- 1. Create vat_view_templates table
CREATE TABLE IF NOT EXISTS public.vat_view_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  accounting_firm_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'custom' CHECK (template_type IN ('builtin', 'custom')),
  description TEXT,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_file_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add active_vat_view_template_id to company_settings if not exists
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS active_vat_view_template_id TEXT NOT NULL DEFAULT 'official_nav65_12col';

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_vat_view_templates_company_id ON public.vat_view_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_vat_view_templates_type ON public.vat_view_templates(template_type);

-- 4. Enable RLS
ALTER TABLE public.vat_view_templates ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- SELECT: Built-in templates are visible to everyone. Company templates to members/accountants.
DROP POLICY IF EXISTS "vat_view_templates_select" ON public.vat_view_templates;
CREATE POLICY "vat_view_templates_select" ON public.vat_view_templates
  FOR SELECT
  USING (
    template_type = 'builtin'
    OR company_id IS NULL
    OR company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    OR company_id IN (SELECT company_id FROM public.accounty_assignments WHERE accountant_user_id = auth.uid())
  );

-- INSERT: Company members (owner/admin/member) or assigned accountants
DROP POLICY IF EXISTS "vat_view_templates_insert" ON public.vat_view_templates;
CREATE POLICY "vat_view_templates_insert" ON public.vat_view_templates
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
    OR company_id IN (
      SELECT company_id FROM public.accounty_assignments 
      WHERE accountant_user_id = auth.uid()
    )
  );

-- UPDATE: Company members (owner/admin/member) or assigned accountants
DROP POLICY IF EXISTS "vat_view_templates_update" ON public.vat_view_templates;
CREATE POLICY "vat_view_templates_update" ON public.vat_view_templates
  FOR UPDATE
  USING (
    template_type = 'custom'
    AND (
      company_id IN (
        SELECT company_id FROM public.company_members 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
      )
      OR company_id IN (
        SELECT company_id FROM public.accounty_assignments 
        WHERE accountant_user_id = auth.uid()
      )
    )
  );

-- DELETE: Company members (owner/admin) or assigned accountants
DROP POLICY IF EXISTS "vat_view_templates_delete" ON public.vat_view_templates;
CREATE POLICY "vat_view_templates_delete" ON public.vat_view_templates
  FOR DELETE
  USING (
    template_type = 'custom'
    AND (
      company_id IN (
        SELECT company_id FROM public.company_members 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
      OR company_id IN (
        SELECT company_id FROM public.accounty_assignments 
        WHERE accountant_user_id = auth.uid()
      )
    )
  );

-- 6. Seed Built-in System Templates (Idempotent)
INSERT INTO public.vat_view_templates (id, company_id, name, template_type, description, columns)
VALUES
(
  'official_nav65_12col',
  NULL,
  'Hivatalos NAV 65-ös Részletező (12 oszlop)',
  'builtin',
  'Hivatalos magyar adóhatósági 65-ös analitika teljes bizonylatszintű, partner és adókulcs adatokkal.',
  '[
    {"id": "entryNumber", "key": "entryNumber", "label": "Sorszám", "width": "95px", "align": "center", "field": "entryNumber", "required": true},
    {"id": "journalType", "key": "journalType", "label": "Napló", "width": "85px", "align": "center", "field": "journalType"},
    {"id": "vatDueDate", "key": "vatDueDate", "label": "ÁFA esedékesség", "width": "115px", "align": "center", "field": "vatDueDate", "format": "date", "required": true},
    {"id": "invoiceNumber", "key": "invoiceNumber", "label": "Bizonylatszám", "width": "140px", "align": "left", "field": "invoiceNumber", "required": true},
    {"id": "partnerCode", "key": "partnerCode", "label": "Adószám", "width": "100px", "align": "center", "field": "partnerCode"},
    {"id": "partnerName", "key": "partnerName", "label": "Partner neve", "width": "1.2fr", "align": "left", "field": "partnerName", "required": true},
    {"id": "description", "key": "description", "label": "Megjegyzés", "width": "180px", "align": "left", "field": "description"},
    {"id": "vatRateLabel", "key": "vatRateLabel", "label": "ÁFA kulcs", "width": "90px", "align": "center", "field": "vatRateLabel"},
    {"id": "netAmount", "key": "netAmount", "label": "Nettó összeg", "width": "130px", "align": "right", "field": "netAmount", "format": "currency", "required": true},
    {"id": "vatAmount", "key": "vatAmount", "label": "ÁFA összeg", "width": "130px", "align": "right", "field": "vatAmount", "format": "currency", "required": true},
    {"id": "grossAmount", "key": "grossAmount", "label": "Bruttó összeg", "width": "140px", "align": "right", "field": "grossAmount", "format": "currency", "required": true},
    {"id": "returnRowCode", "key": "returnRowCode", "label": "Bev. sor", "width": "85px", "align": "center", "field": "returnRowCode"}
  ]'::jsonb
),
(
  'simplified_financial_7col',
  NULL,
  'Egyszerűsített Pénzügyi (7 oszlop)',
  'builtin',
  'Letisztult gyorsellenőrző nézet a legfontosabb bizonylat-, partner- és ÁFA összegadatokkal.',
  '[
    {"id": "invoiceNumber", "key": "invoiceNumber", "label": "Bizonylatszám", "width": "160px", "align": "left", "field": "invoiceNumber", "required": true},
    {"id": "partnerName", "key": "partnerName", "label": "Partner neve", "width": "1.4fr", "align": "left", "field": "partnerName", "required": true},
    {"id": "vatDueDate", "key": "vatDueDate", "label": "Teljesítés dátuma", "width": "120px", "align": "center", "field": "vatDueDate", "format": "date", "required": true},
    {"id": "netAmount", "key": "netAmount", "label": "Nettó összeg", "width": "160px", "align": "right", "field": "netAmount", "format": "currency", "required": true},
    {"id": "vatAmount", "key": "vatAmount", "label": "ÁFA összeg", "width": "160px", "align": "right", "field": "vatAmount", "format": "currency", "required": true},
    {"id": "grossAmount", "key": "grossAmount", "label": "Bruttó összeg", "width": "170px", "align": "right", "field": "grossAmount", "format": "currency", "required": true},
    {"id": "returnRowCode", "key": "returnRowCode", "label": "Bev. sor", "width": "95px", "align": "center", "field": "returnRowCode"}
  ]'::jsonb
),
(
  'two_sided_payable_deductible_8col',
  NULL,
  'Fizetendő & Levonható Kétoldalas (8 oszlop)',
  'builtin',
  'Kétoldalú ÁFA pozíció vizsgálat: külön fizetendő és levonható adóalap és ÁFA bontásban.',
  '[
    {"id": "invoiceNumber", "key": "invoiceNumber", "label": "Bizonylatszám", "width": "140px", "align": "left", "field": "invoiceNumber", "required": true},
    {"id": "partnerName", "key": "partnerName", "label": "Partner neve", "width": "1.2fr", "align": "left", "field": "partnerName", "required": true},
    {"id": "vatDueDate", "key": "vatDueDate", "label": "Dátum", "width": "105px", "align": "center", "field": "vatDueDate", "format": "date"},
    {"id": "payableNetAmount", "key": "payableNetAmount", "label": "Fizetendő nettó", "width": "140px", "align": "right", "field": "payableNetAmount", "format": "currency"},
    {"id": "payableVatAmount", "key": "payableVatAmount", "label": "Fizetendő ÁFA", "width": "140px", "align": "right", "field": "payableVatAmount", "format": "currency"},
    {"id": "deductibleNetAmount", "key": "deductibleNetAmount", "label": "Levonható nettó", "width": "140px", "align": "right", "field": "deductibleNetAmount", "format": "currency"},
    {"id": "deductibleVatAmount", "key": "deductibleVatAmount", "label": "Levonható ÁFA", "width": "140px", "align": "right", "field": "deductibleVatAmount", "format": "currency"},
    {"id": "netVatPosition", "key": "netVatPosition", "label": "Nettó pozíció", "width": "150px", "align": "right", "field": "netVatPosition", "format": "currency"}
  ]'::jsonb
),
(
  'gl_accounting_fad_10col',
  NULL,
  'Számviteli Kontírozás & FAD (10 oszlop)',
  'builtin',
  'Főkönyvi ellenszámlákkal (911/529, 466/467, 311/454) és Fordított ÁFA (FAD) adatokkal kiegészített analitika.',
  '[
    {"id": "entryNumber", "key": "entryNumber", "label": "Sorszám", "width": "95px", "align": "center", "field": "entryNumber"},
    {"id": "invoiceNumber", "key": "invoiceNumber", "label": "Bizonylatszám", "width": "140px", "align": "left", "field": "invoiceNumber", "required": true},
    {"id": "partnerName", "key": "partnerName", "label": "Partner neve", "width": "1.2fr", "align": "left", "field": "partnerName", "required": true},
    {"id": "description", "key": "description", "label": "FAD / Ügylet jelleg", "width": "160px", "align": "left", "field": "description"},
    {"id": "netAmount", "key": "netAmount", "label": "Nettó", "width": "130px", "align": "right", "field": "netAmount", "format": "currency"},
    {"id": "netGlAccount", "key": "netGlAccount", "label": "Nettó fsz.", "width": "90px", "align": "center", "field": "netGlAccount"},
    {"id": "vatAmount", "key": "vatAmount", "label": "ÁFA", "width": "130px", "align": "right", "field": "vatAmount", "format": "currency"},
    {"id": "vatGlAccount", "key": "vatGlAccount", "label": "ÁFA fsz.", "width": "110px", "align": "center", "field": "vatGlAccount"},
    {"id": "grossGlAccount", "key": "grossGlAccount", "label": "Bruttó fsz.", "width": "100px", "align": "center", "field": "grossGlAccount"},
    {"id": "returnRowCode", "key": "returnRowCode", "label": "Bev. sor", "width": "90px", "align": "center", "field": "returnRowCode"}
  ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  columns = EXCLUDED.columns,
  updated_at = now();

-- 7. RPC: set_active_vat_view_template
CREATE OR REPLACE FUNCTION public.set_active_vat_view_template(
  p_company_id UUID,
  p_template_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_authorized BOOLEAN := FALSE;
  v_template_exists BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nem azonosított felhasználó' USING ERRCODE = '42501';
  END IF;

  -- 1. Check authorization: user is company member OR assigned accountant
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id AND user_id = v_user_id
    UNION
    SELECT 1 FROM public.accounty_assignments
    WHERE company_id = p_company_id AND accountant_user_id = v_user_id
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég ÁFA analitika nézetének módosítására' USING ERRCODE = '42501';
  END IF;

  -- 2. Validate template exists (builtin or belongs to this company)
  SELECT EXISTS (
    SELECT 1 FROM public.vat_view_templates
    WHERE id = p_template_id
      AND (template_type = 'builtin' OR company_id = p_company_id)
  ) INTO v_template_exists;

  IF NOT v_template_exists THEN
    RAISE EXCEPTION 'A megadott ÁFA sablon nem található vagy nem ehhez a céghez tartozik' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Upsert active_vat_view_template_id in company_settings
  INSERT INTO public.company_settings (company_id, active_vat_view_template_id, updated_at)
  VALUES (p_company_id, p_template_id, now())
  ON CONFLICT (company_id)
  DO UPDATE SET
    active_vat_view_template_id = EXCLUDED.active_vat_view_template_id,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'active_vat_view_template_id', p_template_id
  );
END;
$$;

-- 8. Security Grants for RPC
REVOKE EXECUTE ON FUNCTION public.set_active_vat_view_template(UUID, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION public.set_active_vat_view_template(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_active_vat_view_template(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_vat_view_template(UUID, TEXT) TO service_role;
