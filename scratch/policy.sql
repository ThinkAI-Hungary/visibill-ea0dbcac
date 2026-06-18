DROP POLICY IF EXISTS "Firm members can view firm companies" ON public.companies;
CREATE POLICY "Firm members can view firm companies" ON public.companies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = companies.id
        AND is_member_of_firm(aa.accounting_firm_id)
    )
  );
