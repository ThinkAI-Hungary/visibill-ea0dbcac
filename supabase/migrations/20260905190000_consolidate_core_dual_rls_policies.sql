-- ===========================================================================
-- Batch POL-1: Consolidate Core Dual RLS Policies (Member + Accountant)
-- Eliminates multiple_permissive_policies on:
--   companies, invoices, partners, transactions, nav_invoices
-- ===========================================================================

-- 1. companies
DROP POLICY IF EXISTS "Accountants can view assigned companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view companies" ON public.companies;

CREATE POLICY "Users can view companies" ON public.companies
FOR SELECT TO authenticated
USING (
  ((SELECT auth.uid()) = owner_id)
  OR (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = companies.id AND cm.user_id = (SELECT auth.uid())
  ))
  OR has_company_access_via_cache(id, 'accounty'::text)
);

-- 2. invoices
DROP POLICY IF EXISTS "Accountants can view assigned company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Members can view invoices" ON public.invoices;

CREATE POLICY "Users can view invoices" ON public.invoices
FOR SELECT TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = invoices.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> 'employee'::text
  ))
  OR has_company_access_via_cache(company_id, 'accounty'::text)
);

-- 3. partners
DROP POLICY IF EXISTS "Accountants can view assigned company partners" ON public.partners;
DROP POLICY IF EXISTS "Members can view partners" ON public.partners;

CREATE POLICY "Users can view partners" ON public.partners
FOR SELECT TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = partners.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> 'employee'::text
  ))
  OR has_company_access_via_cache(company_id, 'accounty'::text)
);

-- 4. transactions
DROP POLICY IF EXISTS "Accountants can view assigned company transactions" ON public.transactions;
DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;

CREATE POLICY "Users can view transactions" ON public.transactions
FOR SELECT TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = transactions.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> 'employee'::text
  ))
  OR has_company_access_via_cache(company_id, 'accounty'::text)
);

-- 5. nav_invoices
DROP POLICY IF EXISTS "Accountants can view assigned NAV invoices" ON public.nav_invoices;
DROP POLICY IF EXISTS "Members can manage NAV invoices" ON public.nav_invoices;
DROP POLICY IF EXISTS "Members can view NAV invoices" ON public.nav_invoices;
DROP POLICY IF EXISTS "Members can insert NAV invoices" ON public.nav_invoices;
DROP POLICY IF EXISTS "Members can update NAV invoices" ON public.nav_invoices;
DROP POLICY IF EXISTS "Members can delete NAV invoices" ON public.nav_invoices;

CREATE POLICY "Members can view NAV invoices" ON public.nav_invoices
FOR SELECT TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = nav_invoices.company_id
      AND company_members.user_id = (SELECT auth.uid())
  ))
  OR has_company_access_via_cache(company_id, 'accounty'::text)
);

CREATE POLICY "Members can insert NAV invoices" ON public.nav_invoices
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = nav_invoices.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
  )
);

CREATE POLICY "Members can update NAV invoices" ON public.nav_invoices
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = nav_invoices.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = nav_invoices.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
  )
);

CREATE POLICY "Members can delete NAV invoices" ON public.nav_invoices
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = nav_invoices.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
  )
);
