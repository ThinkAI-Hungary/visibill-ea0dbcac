-- Fix: Enable RLS + allow SELECT on notes templates
ALTER TABLE public.annual_report_notes_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_templates_select" ON public.annual_report_notes_templates
  FOR SELECT USING (true);

CREATE POLICY "notes_templates_insert" ON public.annual_report_notes_templates
  FOR INSERT WITH CHECK (true);
