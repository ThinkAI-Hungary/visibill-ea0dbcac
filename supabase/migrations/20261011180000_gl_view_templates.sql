-- Migration: 20261011180000_gl_view_templates.sql
-- Description: Főkönyvi nézetválasztó és egyedi sablonkészítő adatmodell

-- 1. Create gl_view_templates table
CREATE TABLE IF NOT EXISTS public.gl_view_templates (
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

-- 2. Add active_gl_view_template_id to company_settings if not exists
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS active_gl_view_template_id TEXT NOT NULL DEFAULT 'standard_3col';

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_gl_view_templates_company_id ON public.gl_view_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_gl_view_templates_type ON public.gl_view_templates(template_type);

-- 4. Enable RLS
ALTER TABLE public.gl_view_templates ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- SELECT: Built-in templates are visible to everyone. Company templates to members/accountants.
DROP POLICY IF EXISTS "gl_view_templates_select" ON public.gl_view_templates;
CREATE POLICY "gl_view_templates_select" ON public.gl_view_templates
  FOR SELECT
  USING (
    template_type = 'builtin'
    OR company_id IS NULL
    OR company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    OR company_id IN (SELECT company_id FROM public.accounty_assignments WHERE accountant_user_id = auth.uid())
  );

-- INSERT: Company members (owner/admin/member) or assigned accountants
DROP POLICY IF EXISTS "gl_view_templates_insert" ON public.gl_view_templates;
CREATE POLICY "gl_view_templates_insert" ON public.gl_view_templates
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
DROP POLICY IF EXISTS "gl_view_templates_update" ON public.gl_view_templates;
CREATE POLICY "gl_view_templates_update" ON public.gl_view_templates
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
DROP POLICY IF EXISTS "gl_view_templates_delete" ON public.gl_view_templates;
CREATE POLICY "gl_view_templates_delete" ON public.gl_view_templates
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
INSERT INTO public.gl_view_templates (id, company_id, name, template_type, description, columns)
VALUES
(
  'standard_3col',
  NULL,
  'Standard Összesített (3 oszlop)',
  'builtin',
  'Egyszerűsített, áttekinthető összesített főkönyvi egyenleglista.',
  '[
    {"id": "gl_number", "key": "gl_number", "label": "Fők. szám", "width": "120px", "align": "center", "field": "id", "required": true},
    {"id": "name", "key": "name", "label": "Megnevezés", "width": "1fr", "align": "left", "field": "name", "required": true},
    {"id": "balance", "key": "balance", "label": "Összesített Egyenleg", "width": "220px", "align": "right", "field": "balance", "format": "currency", "required": true}
  ]'::jsonb
),
(
  'classic_6col',
  NULL,
  'Klasszikus Forgalmi és Egyenleg (6 oszlop)',
  'builtin',
  'Hagyományos magyar számviteli kétoldalas forgalmi és egyenleg kimutatás (Tartozik / Követel bontásban).',
  '[
    {"id": "gl_number", "key": "gl_number", "label": "Fők. szám", "width": "90px", "align": "center", "field": "id", "required": true},
    {"id": "name", "key": "name", "label": "Megnevezés", "width": "1fr", "align": "left", "field": "name", "required": true},
    {"id": "turnover_debit", "key": "turnover_debit", "label": "Forgalom T", "width": "165px", "align": "right", "field": "debitTurnover", "format": "currency"},
    {"id": "turnover_credit", "key": "turnover_credit", "label": "Forgalom K", "width": "165px", "align": "right", "field": "creditTurnover", "format": "currency"},
    {"id": "balance_debit", "key": "balance_debit", "label": "Egyenleg T", "width": "165px", "align": "right", "field": "balanceDebit", "format": "currency"},
    {"id": "balance_credit", "key": "balance_credit", "label": "Egyenleg K", "width": "190px", "align": "right", "field": "balanceCredit", "format": "currency"}
  ]'::jsonb
),
(
  'balance_4col',
  NULL,
  'Kétoldalas Egyenleg Fókuszú (4 oszlop)',
  'builtin',
  'Forgalmak nélküli, kizárólag a záró egyenlegek Tartozik / Követel oszlopos kimutatása.',
  '[
    {"id": "gl_number", "key": "gl_number", "label": "Fők. szám", "width": "110px", "align": "center", "field": "id", "required": true},
    {"id": "name", "key": "name", "label": "Megnevezés", "width": "1fr", "align": "left", "field": "name", "required": true},
    {"id": "balance_debit", "key": "balance_debit", "label": "Tartozik Egyenleg", "width": "200px", "align": "right", "field": "balanceDebit", "format": "currency"},
    {"id": "balance_credit", "key": "balance_credit", "label": "Követel Egyenleg", "width": "200px", "align": "right", "field": "balanceCredit", "format": "currency"}
  ]'::jsonb
),
(
  'analytic_8col',
  NULL,
  'Részletező Analitikus (8 oszlop)',
  'builtin',
  'Mély analitikus nézet tételes partner, bizonylatszám és dátum adatokkal a forgalom és egyenleg mellett.',
  '[
    {"id": "gl_number", "key": "gl_number", "label": "Fők. szám", "width": "90px", "align": "center", "field": "id", "required": true},
    {"id": "name", "key": "name", "label": "Megnevezés", "width": "1.2fr", "align": "left", "field": "name", "required": true},
    {"id": "partner", "key": "partner", "label": "Partner", "width": "180px", "align": "left", "field": "partner"},
    {"id": "invoice_number", "key": "invoice_number", "label": "Bizonylat", "width": "150px", "align": "left", "field": "invoiceNumber"},
    {"id": "date", "key": "date", "label": "Dátum", "width": "110px", "align": "center", "field": "date", "format": "date"},
    {"id": "turnover_debit", "key": "turnover_debit", "label": "Forgalom T", "width": "150px", "align": "right", "field": "debitTurnover", "format": "currency"},
    {"id": "turnover_credit", "key": "turnover_credit", "label": "Forgalom K", "width": "150px", "align": "right", "field": "creditTurnover", "format": "currency"},
    {"id": "balance", "key": "balance", "label": "Egyenleg", "width": "170px", "align": "right", "field": "balance", "format": "currency"}
  ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  columns = EXCLUDED.columns,
  updated_at = now();
