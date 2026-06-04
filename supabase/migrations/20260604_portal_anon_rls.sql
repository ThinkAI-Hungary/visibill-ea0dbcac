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
