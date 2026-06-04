
-- ============ companies: drop anon read ============
DROP POLICY IF EXISTS "Users can view companies" ON public.companies;
CREATE POLICY "Users can view companies" ON public.companies
FOR SELECT TO authenticated
USING (
  auth.uid() = owner_id
  OR EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = companies.id AND cm.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.accounty_assignments aa WHERE aa.company_id = companies.id AND aa.accountant_user_id = auth.uid())
);

-- ============ annual_reports: scope to company members ============
DROP POLICY IF EXISTS annual_reports_select ON public.annual_reports;
DROP POLICY IF EXISTS annual_reports_insert ON public.annual_reports;
DROP POLICY IF EXISTS annual_reports_update ON public.annual_reports;
DROP POLICY IF EXISTS annual_reports_delete ON public.annual_reports;

CREATE POLICY annual_reports_select ON public.annual_reports
FOR SELECT TO authenticated
USING (public.is_company_member_or_above(company_id));

CREATE POLICY annual_reports_insert ON public.annual_reports
FOR INSERT TO authenticated
WITH CHECK (public.is_company_member_or_above(company_id));

CREATE POLICY annual_reports_update ON public.annual_reports
FOR UPDATE TO authenticated
USING (public.is_company_member_or_above(company_id))
WITH CHECK (public.is_company_member_or_above(company_id));

CREATE POLICY annual_reports_delete ON public.annual_reports
FOR DELETE TO authenticated
USING (public.is_company_admin(company_id));

-- ============ annual_report_notes_templates: remove public insert ============
DROP POLICY IF EXISTS notes_templates_insert ON public.annual_report_notes_templates;
-- Reads remain open (global reference templates). Inserts only via service role.

-- ============ employee_rates: drop anon select branch ============
DROP POLICY IF EXISTS "Users can view employee_rates" ON public.employee_rates;
CREATE POLICY "Users can view employee_rates" ON public.employee_rates
FOR SELECT TO authenticated
USING (public.is_company_member_or_above(company_id) OR user_id = auth.uid());

-- ============ llm_koltsegek: scope reads ============
DROP POLICY IF EXISTS "Authenticated users can view LLM costs" ON public.llm_koltsegek;
CREATE POLICY "Members can view LLM costs" ON public.llm_koltsegek
FOR SELECT TO authenticated
USING (
  company_id IS NULL
  OR public.is_company_member_or_above(company_id)
);

-- ============ accounty_audit_log: scope reads ============
DROP POLICY IF EXISTS accounty_audit_log_select ON public.accounty_audit_log;
CREATE POLICY accounty_audit_log_select ON public.accounty_audit_log
FOR SELECT TO authenticated
USING (
  (company_id IS NOT NULL AND public.is_company_member_or_above(company_id))
  OR (company_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.accounty_assignments aa
    WHERE aa.company_id = accounty_audit_log.company_id
      AND aa.accountant_user_id = auth.uid()
  ))
  OR user_id = auth.uid()
);

-- ============ accounty_job_codes: lock down writes ============
DROP POLICY IF EXISTS accounty_job_codes_modify ON public.accounty_job_codes;
-- Reads still open via existing accounty_job_codes_select. Writes only via service role (no authenticated policy).

-- ============ accounty_tax_parameters: lock down writes ============
DROP POLICY IF EXISTS accounty_tax_parameters_modify ON public.accounty_tax_parameters;
-- Reads remain open via accounty_tax_parameters_select. Writes only via service role.

-- ============ accounty_messages: scope to members / assigned accountants ============
DROP POLICY IF EXISTS accounty_messages_all ON public.accounty_messages;

CREATE POLICY accounty_messages_select ON public.accounty_messages
FOR SELECT TO authenticated
USING (
  public.is_company_member_or_above(company_id)
  OR EXISTS (
    SELECT 1 FROM public.accounty_assignments aa
    WHERE aa.company_id = accounty_messages.company_id
      AND aa.accountant_user_id = auth.uid()
  )
);

CREATE POLICY accounty_messages_insert ON public.accounty_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()
  AND (
    public.is_company_member_or_above(company_id)
    OR EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_messages.company_id
        AND aa.accountant_user_id = auth.uid()
    )
  )
);

CREATE POLICY accounty_messages_update ON public.accounty_messages
FOR UPDATE TO authenticated
USING (sender_user_id = auth.uid())
WITH CHECK (sender_user_id = auth.uid());

CREATE POLICY accounty_messages_delete ON public.accounty_messages
FOR DELETE TO authenticated
USING (sender_user_id = auth.uid());

-- ============ outgoing_emails: service-role-only inserts ============
DROP POLICY IF EXISTS "Service role can insert outgoing emails" ON public.outgoing_emails;
-- No authenticated/anon INSERT policy. Inserts only via service role (which bypasses RLS).

-- ============ VAT: extend access to all company members ============
DROP POLICY IF EXISTS vat_codes_company ON public.vat_codes;
CREATE POLICY vat_codes_company ON public.vat_codes
FOR ALL TO authenticated
USING (public.is_company_member_or_above(company_id))
WITH CHECK (public.is_company_member_or_above(company_id));

DROP POLICY IF EXISTS vat_returns_company ON public.vat_returns;
CREATE POLICY vat_returns_company ON public.vat_returns
FOR ALL TO authenticated
USING (public.is_company_member_or_above(company_id))
WITH CHECK (public.is_company_member_or_above(company_id));

DROP POLICY IF EXISTS vat_return_lines_via_return ON public.vat_return_lines;
CREATE POLICY vat_return_lines_via_return ON public.vat_return_lines
FOR ALL TO authenticated
USING (vat_return_id IN (SELECT id FROM public.vat_returns vr WHERE public.is_company_member_or_above(vr.company_id)))
WITH CHECK (vat_return_id IN (SELECT id FROM public.vat_returns vr WHERE public.is_company_member_or_above(vr.company_id)));

DROP POLICY IF EXISTS vat_return_m_lines_via_return ON public.vat_return_m_lines;
CREATE POLICY vat_return_m_lines_via_return ON public.vat_return_m_lines
FOR ALL TO authenticated
USING (vat_return_id IN (SELECT id FROM public.vat_returns vr WHERE public.is_company_member_or_above(vr.company_id)))
WITH CHECK (vat_return_id IN (SELECT id FROM public.vat_returns vr WHERE public.is_company_member_or_above(vr.company_id)));

-- ============ Storage buckets: per-user folder enforcement ============
-- asset-documents
DROP POLICY IF EXISTS "Allow authenticated uploads to asset-documents" ON storage.objects;
CREATE POLICY "Users can upload own asset documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'asset-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Allow authenticated deletes from asset-documents" ON storage.objects;
CREATE POLICY "Users can delete own asset documents" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'asset-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- report-uploads
DROP POLICY IF EXISTS "Users can read own reports" ON storage.objects;
CREATE POLICY "Users can read own reports" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'report-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can upload reports" ON storage.objects;
CREATE POLICY "Users can upload reports" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'report-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- szla_image
DROP POLICY IF EXISTS "Authenticated users can view own szla_image files" ON storage.objects;
CREATE POLICY "Authenticated users can view own szla_image files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'szla_image'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
