-- Accounty uploads audit log table
CREATE TABLE public.accounty_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  missing_item_id UUID REFERENCES public.accounty_missing_items(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  file_size_bytes BIGINT,
  storage_bucket TEXT DEFAULT 'uploads',
  upload_source TEXT DEFAULT 'portal' CHECK (upload_source IN ('portal', 'admin', 'api')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'success', 'error')),
  error_message TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  portal_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_accounty_uploads_company ON public.accounty_uploads(company_id);
CREATE INDEX idx_accounty_uploads_missing_item ON public.accounty_uploads(missing_item_id);
CREATE INDEX idx_accounty_uploads_status ON public.accounty_uploads(status);

ALTER TABLE public.accounty_uploads ENABLE ROW LEVEL SECURITY;

-- Authenticated users full access
CREATE POLICY uploads_select ON public.accounty_uploads FOR SELECT TO authenticated USING (true);
CREATE POLICY uploads_insert ON public.accounty_uploads FOR INSERT TO authenticated WITH CHECK (true);

-- Anonymous (portal) access scoped to companies with active tokens
CREATE POLICY uploads_anon_select ON public.accounty_uploads FOR SELECT TO anon
  USING (company_id IN (SELECT company_id FROM public.accounty_portal_tokens WHERE is_active = true AND expires_at > now()));
CREATE POLICY uploads_anon_insert ON public.accounty_uploads FOR INSERT TO anon
  WITH CHECK (company_id IN (SELECT company_id FROM public.accounty_portal_tokens WHERE is_active = true AND expires_at > now()));
