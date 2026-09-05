-- Migration: 20260905201000_fix_remaining_security_warnings.sql
-- Description: Resolve the remaining 5 security and hygiene warnings:
-- 1. Extension in Public: Move pg_trgm extension to extensions schema.
-- 2. RLS Policy Always True (accounty_dependents): Restrict dependent data to employee's company members and assigned accountants.
-- 3. RLS Policy Always True (app_error_logs): Tighten INSERT policy to require non-null message and error_type.
-- 4. Public Bucket Allows Listing (accounty_uploads): Restrict storage.objects SELECT to company members and accountants.
-- 5. Public Bucket Allows Listing (ticket-attachments): Restrict storage.objects SELECT to ticket owner and admins.

-- ============================================================================
-- 1. Move pg_trgm extension to extensions schema
-- ============================================================================
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- ============================================================================
-- 2. Secure accounty_dependents RLS (GDPR & Multi-Tenancy Protection)
-- ============================================================================
DROP POLICY IF EXISTS "accounty_dependents_all_policy" ON public.accounty_dependents;

CREATE POLICY "accounty_dependents_tenant_policy"
ON public.accounty_dependents
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.accounty_employees e
    WHERE e.id = accounty_dependents.employee_id
      AND (
        EXISTS (
          SELECT 1 FROM public.accounty_assignments aa
          WHERE aa.company_id = e.company_id
            AND aa.accountant_user_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.company_members cm
          WHERE cm.company_id = e.company_id
            AND cm.user_id = (SELECT auth.uid())
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.accounty_employees e
    WHERE e.id = accounty_dependents.employee_id
      AND (
        EXISTS (
          SELECT 1 FROM public.accounty_assignments aa
          WHERE aa.company_id = e.company_id
            AND aa.accountant_user_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.company_members cm
          WHERE cm.company_id = e.company_id
            AND cm.user_id = (SELECT auth.uid())
        )
      )
  )
);

CREATE POLICY "accounty_dependents_service_role_all"
ON public.accounty_dependents
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 3. Tighten app_error_logs RLS INSERT policy
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.app_error_logs;

CREATE POLICY "Anyone can insert error logs"
ON public.app_error_logs
FOR INSERT
TO public
WITH CHECK (message IS NOT NULL AND error_type IS NOT NULL);

-- ============================================================================
-- 4. Secure storage.objects listing for accounty_uploads and ticket-attachments
-- ============================================================================
DROP POLICY IF EXISTS "portal_read_anon" ON storage.objects;
DROP POLICY IF EXISTS "portal_read_auth" ON storage.objects;

CREATE POLICY "accounty_uploads_read_auth"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'accounty_uploads'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT aa.company_id::text FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
    OR
    (storage.foldername(name))[1] IN (
      SELECT cm.company_id::text FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Anyone can view ticket attachments" ON storage.objects;

CREATE POLICY "ticket_attachments_read_auth"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    (storage.foldername(name))[2] = (SELECT auth.uid())::text
    OR
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.role IN ('ADMIN', 'OWNER', 'DEVELOPER')
    )
  )
);
