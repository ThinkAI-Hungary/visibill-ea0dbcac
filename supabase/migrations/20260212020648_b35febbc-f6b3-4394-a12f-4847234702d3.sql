
-- =============================================
-- STEP 1a: Create company_members junction table
-- =============================================
CREATE TABLE public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 1b: Add share_token to companies
-- =============================================
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

-- =============================================
-- STEP 1c: Migrate existing data
-- =============================================
INSERT INTO public.company_members (user_id, company_id)
SELECT owner_id, id FROM public.companies
ON CONFLICT (user_id, company_id) DO NOTHING;

-- =============================================
-- STEP 1d: Trigger for auto-membership on company creation
-- =============================================
CREATE OR REPLACE FUNCTION public.on_company_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.company_members (user_id, company_id)
  VALUES (NEW.owner_id, NEW.id)
  ON CONFLICT (user_id, company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.on_company_created();

-- =============================================
-- STEP 1e: RLS on company_members
-- =============================================
CREATE POLICY "Users can view their memberships"
  ON public.company_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can leave companies"
  ON public.company_members FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- STEP 1f: Update user_has_company_access function
-- =============================================
CREATE OR REPLACE FUNCTION public.user_has_company_access(p_company_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id AND user_id = auth.uid()
  )
$$;

-- =============================================
-- STEP 1g: Update companies RLS policies
-- =============================================
DROP POLICY IF EXISTS "Users can view their own companies" ON public.companies;
DROP POLICY IF EXISTS "Users can update their own companies" ON public.companies;

CREATE POLICY "Members can view companies"
  ON public.companies FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = companies.id
      AND company_members.user_id = auth.uid()
  ));

CREATE POLICY "Members can update companies"
  ON public.companies FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = companies.id
      AND company_members.user_id = auth.uid()
  ));

-- =============================================
-- STEP 1h: Update RLS on shared-resource tables
-- =============================================

-- ---- INVOICES ----
DROP POLICY IF EXISTS "A felhasználók megtekinthetik saját számláikat" ON public.invoices;
DROP POLICY IF EXISTS "A felhasználók létrehozhatják saját számláikat" ON public.invoices;
DROP POLICY IF EXISTS "A felhasználók frissíthetik saját számláikat" ON public.invoices;
DROP POLICY IF EXISTS "A felhasználók törölhetik saját számláikat" ON public.invoices;

CREATE POLICY "Members can view invoices" ON public.invoices FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = invoices.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can create invoices" ON public.invoices FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = invoices.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can update invoices" ON public.invoices FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = invoices.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can delete invoices" ON public.invoices FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = invoices.company_id AND company_members.user_id = auth.uid()));

-- ---- NAV_INVOICES ----
DROP POLICY IF EXISTS "Users can manage own NAV invoices" ON public.nav_invoices;

CREATE POLICY "Members can manage NAV invoices" ON public.nav_invoices FOR ALL
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = nav_invoices.company_id AND company_members.user_id = auth.uid()));

-- ---- PARTNERS ----
DROP POLICY IF EXISTS "Users can view their own partners" ON public.partners;
DROP POLICY IF EXISTS "Users can create their own partners" ON public.partners;
DROP POLICY IF EXISTS "Users can update their own partners" ON public.partners;
DROP POLICY IF EXISTS "Users can delete their own partners" ON public.partners;

CREATE POLICY "Members can view partners" ON public.partners FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = partners.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can create partners" ON public.partners FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = partners.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can update partners" ON public.partners FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = partners.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can delete partners" ON public.partners FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = partners.company_id AND company_members.user_id = auth.uid()));

-- ---- SALARY ----
DROP POLICY IF EXISTS "Users can view their own salary entries" ON public.salary;
DROP POLICY IF EXISTS "Users can create their own salary entries" ON public.salary;
DROP POLICY IF EXISTS "Users can update their own salary entries" ON public.salary;
DROP POLICY IF EXISTS "Users can delete their own salary entries" ON public.salary;

CREATE POLICY "Members can view salary" ON public.salary FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = salary.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can create salary" ON public.salary FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = salary.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can update salary" ON public.salary FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = salary.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can delete salary" ON public.salary FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = salary.company_id AND company_members.user_id = auth.uid()));

-- ---- SALARY_FILES ----
DROP POLICY IF EXISTS "Users can view their own salaries" ON public.salary_files;
DROP POLICY IF EXISTS "Users can create their own salaries" ON public.salary_files;
DROP POLICY IF EXISTS "Users can update their own salaries" ON public.salary_files;
DROP POLICY IF EXISTS "Users can delete their own salaries" ON public.salary_files;

CREATE POLICY "Members can view salary_files" ON public.salary_files FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = salary_files.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can create salary_files" ON public.salary_files FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = salary_files.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can update salary_files" ON public.salary_files FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = salary_files.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can delete salary_files" ON public.salary_files FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = salary_files.company_id AND company_members.user_id = auth.uid()));

-- ---- TAX ----
DROP POLICY IF EXISTS "Users can view their own tax entries" ON public.tax;
DROP POLICY IF EXISTS "Users can create their own tax entries" ON public.tax;
DROP POLICY IF EXISTS "Users can update their own tax entries" ON public.tax;
DROP POLICY IF EXISTS "Users can delete their own tax entries" ON public.tax;

CREATE POLICY "Members can view tax" ON public.tax FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = tax.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can create tax" ON public.tax FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = tax.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can update tax" ON public.tax FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = tax.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can delete tax" ON public.tax FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = tax.company_id AND company_members.user_id = auth.uid()));

-- ---- EMAIL_ALIASES ----
DROP POLICY IF EXISTS "Users can view their own email aliases" ON public.email_aliases;
DROP POLICY IF EXISTS "Users can create their own email aliases" ON public.email_aliases;
DROP POLICY IF EXISTS "Users can update their own email aliases" ON public.email_aliases;
DROP POLICY IF EXISTS "Users can delete their own email aliases" ON public.email_aliases;

CREATE POLICY "Members can view email_aliases" ON public.email_aliases FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = email_aliases.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can create email_aliases" ON public.email_aliases FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = email_aliases.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can update email_aliases" ON public.email_aliases FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = email_aliases.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can delete email_aliases" ON public.email_aliases FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = email_aliases.company_id AND company_members.user_id = auth.uid()));

-- ---- INVOICE_UPLOADS ----
DROP POLICY IF EXISTS "Users can view their own invoice uploads" ON public.invoice_uploads;
DROP POLICY IF EXISTS "Users can create their own invoice uploads" ON public.invoice_uploads;
DROP POLICY IF EXISTS "Users can update their own invoice uploads" ON public.invoice_uploads;
DROP POLICY IF EXISTS "Users can delete their own invoice uploads" ON public.invoice_uploads;

CREATE POLICY "Members can view invoice_uploads" ON public.invoice_uploads FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = invoice_uploads.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can create invoice_uploads" ON public.invoice_uploads FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = invoice_uploads.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can update invoice_uploads" ON public.invoice_uploads FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = invoice_uploads.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can delete invoice_uploads" ON public.invoice_uploads FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = invoice_uploads.company_id AND company_members.user_id = auth.uid()));

-- ---- BANK_STATEMENTS ----
DROP POLICY IF EXISTS "Users can view their own bank statements" ON public.bank_statements;
DROP POLICY IF EXISTS "Users can create their own bank statements" ON public.bank_statements;
DROP POLICY IF EXISTS "Users can update their own bank statements" ON public.bank_statements;
DROP POLICY IF EXISTS "Users can delete their own bank statements" ON public.bank_statements;

CREATE POLICY "Members can view bank_statements" ON public.bank_statements FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = bank_statements.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can create bank_statements" ON public.bank_statements FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = bank_statements.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can update bank_statements" ON public.bank_statements FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = bank_statements.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can delete bank_statements" ON public.bank_statements FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = bank_statements.company_id AND company_members.user_id = auth.uid()));

-- ---- BANK_STATEMENT_UPLOADS ----
DROP POLICY IF EXISTS "Users can view their own bank statement uploads" ON public.bank_statement_uploads;
DROP POLICY IF EXISTS "Users can create their own bank statement uploads" ON public.bank_statement_uploads;
DROP POLICY IF EXISTS "Users can update their own bank statement uploads" ON public.bank_statement_uploads;
DROP POLICY IF EXISTS "Users can delete their own bank statement uploads" ON public.bank_statement_uploads;

CREATE POLICY "Members can view bank_statement_uploads" ON public.bank_statement_uploads FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = bank_statement_uploads.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can create bank_statement_uploads" ON public.bank_statement_uploads FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = bank_statement_uploads.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can update bank_statement_uploads" ON public.bank_statement_uploads FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = bank_statement_uploads.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can delete bank_statement_uploads" ON public.bank_statement_uploads FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = bank_statement_uploads.company_id AND company_members.user_id = auth.uid()));

-- ---- NAV_SYNC_LOGS ----
DROP POLICY IF EXISTS "Users can view own NAV sync logs" ON public.nav_sync_logs;

CREATE POLICY "Members can view nav_sync_logs" ON public.nav_sync_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = nav_sync_logs.company_id AND company_members.user_id = auth.uid()));

-- ---- USER_NAV_CREDENTIALS ----
DROP POLICY IF EXISTS "Users can manage own NAV credentials" ON public.user_nav_credentials;

CREATE POLICY "Members can manage NAV credentials" ON public.user_nav_credentials FOR ALL
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = user_nav_credentials.company_id AND company_members.user_id = auth.uid()));

-- ---- CATEGORIES ----
DROP POLICY IF EXISTS "Users can view their own projects" ON public.categories;
DROP POLICY IF EXISTS "Users can create their own projects" ON public.categories;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.categories;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.categories;

CREATE POLICY "Members can view categories" ON public.categories FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = categories.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can create categories" ON public.categories FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = categories.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can update categories" ON public.categories FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = categories.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can delete categories" ON public.categories FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = categories.company_id AND company_members.user_id = auth.uid()));

-- ---- PROJECTS ----
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

CREATE POLICY "Members can view projects" ON public.projects FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = projects.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can create projects" ON public.projects FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = projects.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can update projects" ON public.projects FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = projects.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can delete projects" ON public.projects FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = projects.company_id AND company_members.user_id = auth.uid()));

-- ---- TRANSACTIONS ----
DROP POLICY IF EXISTS "Company members can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Company members can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Company members can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Company members can delete transactions" ON public.transactions;

CREATE POLICY "Members can view transactions" ON public.transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = transactions.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can create transactions" ON public.transactions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = transactions.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can update transactions" ON public.transactions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = transactions.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can delete transactions" ON public.transactions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = transactions.company_id AND company_members.user_id = auth.uid()));

-- ---- TRANSACTION_UPLOADS ----
DROP POLICY IF EXISTS "Users can view their own transaction uploads" ON public.transaction_uploads;
DROP POLICY IF EXISTS "Users can create their own transaction uploads" ON public.transaction_uploads;
DROP POLICY IF EXISTS "Users can update their own transaction uploads" ON public.transaction_uploads;
DROP POLICY IF EXISTS "Users can delete their own transaction uploads" ON public.transaction_uploads;

CREATE POLICY "Members can view transaction_uploads" ON public.transaction_uploads FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = transaction_uploads.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can create transaction_uploads" ON public.transaction_uploads FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = transaction_uploads.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can update transaction_uploads" ON public.transaction_uploads FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = transaction_uploads.company_id AND company_members.user_id = auth.uid()));
CREATE POLICY "Members can delete transaction_uploads" ON public.transaction_uploads FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = transaction_uploads.company_id AND company_members.user_id = auth.uid()));
