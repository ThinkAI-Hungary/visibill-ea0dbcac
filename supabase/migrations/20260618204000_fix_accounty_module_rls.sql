-- Fix: RLS policies for accounty sub-tables so iroda_admin of the firm can view/modify them

CREATE OR REPLACE FUNCTION public.has_accounty_company_access(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounty_assignments aa
    WHERE aa.company_id = p_company_id
      AND (
        aa.accountant_user_id = auth.uid()
        OR is_iroda_admin_for_firm(aa.accounting_firm_id)
      )
  );
$$;

-- 1. accounty_tax_profiles
DROP POLICY IF EXISTS "accounty_tax_profiles_select" ON public.accounty_tax_profiles;
DROP POLICY IF EXISTS "accounty_tax_profiles_modify" ON public.accounty_tax_profiles;

CREATE POLICY "accounty_tax_profiles_select"
  ON public.accounty_tax_profiles
  FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));

CREATE POLICY "accounty_tax_profiles_modify"
  ON public.accounty_tax_profiles
  FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));


-- 2. accounty_deadlines
DROP POLICY IF EXISTS "accounty_deadlines_select" ON public.accounty_deadlines;
DROP POLICY IF EXISTS "accounty_deadlines_modify" ON public.accounty_deadlines;

CREATE POLICY "accounty_deadlines_select"
  ON public.accounty_deadlines
  FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));

CREATE POLICY "accounty_deadlines_modify"
  ON public.accounty_deadlines
  FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));


-- 3. accounty_missing_items
DROP POLICY IF EXISTS "accounty_missing_items_select" ON public.accounty_missing_items;
DROP POLICY IF EXISTS "accounty_missing_items_modify" ON public.accounty_missing_items;

CREATE POLICY "accounty_missing_items_select"
  ON public.accounty_missing_items
  FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));

CREATE POLICY "accounty_missing_items_modify"
  ON public.accounty_missing_items
  FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));


-- 4. accounty_communication_preferences
DROP POLICY IF EXISTS "accounty_communication_preferences_select" ON public.accounty_communication_preferences;
DROP POLICY IF EXISTS "accounty_communication_preferences_modify" ON public.accounty_communication_preferences;

CREATE POLICY "accounty_communication_preferences_select"
  ON public.accounty_communication_preferences
  FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));

CREATE POLICY "accounty_communication_preferences_modify"
  ON public.accounty_communication_preferences
  FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));


-- 5. accounty_portal_tokens
DROP POLICY IF EXISTS "accounty_portal_tokens_select" ON public.accounty_portal_tokens;
DROP POLICY IF EXISTS "accounty_portal_tokens_insert" ON public.accounty_portal_tokens;

CREATE POLICY "accounty_portal_tokens_select"
  ON public.accounty_portal_tokens
  FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));

CREATE POLICY "accounty_portal_tokens_insert"
  ON public.accounty_portal_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND has_accounty_company_access(company_id)
  );
