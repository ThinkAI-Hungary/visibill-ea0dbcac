-- ============================================================================
-- Migration: 20260927160000_fix_vat_returns_accounty_and_support_admin_rls.sql
-- Description: Expand is_company_member_or_above and vat_returns RLS policies
--              to grant access to eaisyBooks assigned accountants and support_admin.
-- ============================================================================

-- 1. Upgrade is_company_member_or_above to include accounty access & support_admin
CREATE OR REPLACE FUNCTION public.is_company_member_or_above(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = p_company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role IN ('owner', 'admin', 'member', 'assistant', 'viewer', 'support_admin')
  )
  OR public.has_company_access_via_cache(p_company_id, 'accounty'::text)
  OR public.is_support_admin();
$function$;

-- 2. Consolidate RLS policies on vat_returns
DROP POLICY IF EXISTS "vat_returns_company" ON public.vat_returns;
DROP POLICY IF EXISTS "vat_returns_access" ON public.vat_returns;

CREATE POLICY "vat_returns_access" ON public.vat_returns
FOR ALL TO authenticated
USING (
  public.is_company_member_or_above(company_id)
  OR public.has_company_access_via_cache(company_id, 'accounty'::text)
  OR public.is_support_admin()
)
WITH CHECK (
  public.is_company_member_or_above(company_id)
  OR public.has_company_access_via_cache(company_id, 'accounty'::text)
  OR public.is_support_admin()
);

-- 3. Consolidate RLS policies on vat_return_lines
DROP POLICY IF EXISTS "vat_return_lines_via_return" ON public.vat_return_lines;
DROP POLICY IF EXISTS "vat_return_lines_access" ON public.vat_return_lines;

CREATE POLICY "vat_return_lines_access" ON public.vat_return_lines
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vat_returns vr
    WHERE vr.id = vat_return_lines.vat_return_id
      AND (
        public.is_company_member_or_above(vr.company_id)
        OR public.has_company_access_via_cache(vr.company_id, 'accounty'::text)
        OR public.is_support_admin()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vat_returns vr
    WHERE vr.id = vat_return_lines.vat_return_id
      AND (
        public.is_company_member_or_above(vr.company_id)
        OR public.has_company_access_via_cache(vr.company_id, 'accounty'::text)
        OR public.is_support_admin()
      )
  )
);

-- 4. Consolidate RLS policies on vat_return_m_lines
DROP POLICY IF EXISTS "vat_return_m_lines_via_return" ON public.vat_return_m_lines;
DROP POLICY IF EXISTS "vat_return_m_lines_access" ON public.vat_return_m_lines;

CREATE POLICY "vat_return_m_lines_access" ON public.vat_return_m_lines
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vat_returns vr
    WHERE vr.id = vat_return_m_lines.vat_return_id
      AND (
        public.is_company_member_or_above(vr.company_id)
        OR public.has_company_access_via_cache(vr.company_id, 'accounty'::text)
        OR public.is_support_admin()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vat_returns vr
    WHERE vr.id = vat_return_m_lines.vat_return_id
      AND (
        public.is_company_member_or_above(vr.company_id)
        OR public.has_company_access_via_cache(vr.company_id, 'accounty'::text)
        OR public.is_support_admin()
      )
  )
);
