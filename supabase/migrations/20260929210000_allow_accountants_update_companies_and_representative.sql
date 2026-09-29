-- ===========================================================================
-- Migration: Add representative_name & phone to companies + allow accountants to update companies
-- ===========================================================================

-- 1. Ensure representative contact columns exist on companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS representative_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.companies.representative_name IS 'Hivatalos ügyintéző neve az ÁNYK ÁFA és egyéb adóbevallásokhoz';
COMMENT ON COLUMN public.companies.phone IS 'Hivatalos ügyintéző telefonszáma az ÁNYK formátumhoz';

-- 2. Consolidate companies UPDATE policy to permit assigned accountants via cache
DROP POLICY IF EXISTS "Members can update companies" ON public.companies;
DROP POLICY IF EXISTS "Members and accountants can update companies" ON public.companies;

CREATE POLICY "Members and accountants can update companies" ON public.companies
FOR UPDATE TO authenticated
USING (
  ((SELECT auth.uid()) = owner_id)
  OR (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = companies.id AND cm.user_id = (SELECT auth.uid())
  ))
  OR has_company_access_via_cache(id, 'accounty'::text)
)
WITH CHECK (
  ((SELECT auth.uid()) = owner_id)
  OR (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = companies.id AND cm.user_id = (SELECT auth.uid())
  ))
  OR has_company_access_via_cache(id, 'accounty'::text)
);
