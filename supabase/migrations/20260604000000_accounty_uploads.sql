-- ==================================================
-- MERGED FROM: 20260604_accounty_uploads.sql
-- ==================================================
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


-- ==================================================
-- MERGED FROM: 20260604_portal_anon_rls.sql
-- ==================================================
-- Portal anonymous access policies
-- Allow anonymous (magic link) users to interact with missing items and upload files

-- Anonymous SELECT on portal tokens (to resolve token → company_id)
CREATE POLICY portal_tokens_anon_select ON public.accounty_portal_tokens
  FOR SELECT TO anon
  USING (is_active = true AND expires_at > now());

-- Anonymous SELECT on missing items (for companies with active portal tokens)
CREATE POLICY missing_items_portal_select ON public.accounty_missing_items
  FOR SELECT TO anon
  USING (
    company_id IN (
      SELECT company_id FROM public.accounty_portal_tokens
      WHERE is_active = true AND expires_at > now()
    )
  );

-- Anonymous UPDATE on missing items (status, uploaded_files after portal upload)
CREATE POLICY missing_items_portal_update ON public.accounty_missing_items
  FOR UPDATE TO anon
  USING (
    company_id IN (
      SELECT company_id FROM public.accounty_portal_tokens
      WHERE is_active = true AND expires_at > now()
    )
  );

-- Anonymous file upload to storage (only in accounty-portal folder)
CREATE POLICY portal_upload_anon ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = 'accounty-portal');


-- ==================================================
-- MERGED FROM: 20260604_portal_requested_items.sql
-- ==================================================
-- Add requested_item_ids to portal tokens so we know exactly which documents were requested via this magic link
ALTER TABLE public.accounty_portal_tokens
  ADD COLUMN IF NOT EXISTS requested_item_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN public.accounty_portal_tokens.requested_item_ids
  IS 'Array of accounty_missing_items IDs that were specifically requested via this portal link';


-- ==================================================
-- MERGED FROM: 20260604_terheles_datuma.sql
-- ==================================================
-- Add terheles_datuma column to transactions table
-- For bank card charges, this stores the actual purchase date (extracted from description)
-- rather than the bank processing date (transaction_date).
-- This allows more accurate invoice matching.
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS terheles_datuma DATE;

COMMENT ON COLUMN public.transactions.terheles_datuma IS 
  'Bankkártyás terhelés tényleges dátuma (a leírásból kinyerve, YYYYMMDD formátum). Ha kitöltve, a matchelés ezt használja a transaction_date helyett.';
