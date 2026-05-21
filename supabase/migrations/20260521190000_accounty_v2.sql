-- Accounty module v2: kanban_status + accountant access policies
-- IDEMPOTENT: safe to re-run

-- 1. Kanban status column on assignments
ALTER TABLE public.accounty_assignments 
  ADD COLUMN IF NOT EXISTS kanban_status TEXT DEFAULT 'aktiv'
  CHECK (kanban_status IN ('aktiv', 'feldolgozando', 'kritikus'));

COMMENT ON COLUMN public.accounty_assignments.kanban_status IS 'Kanban board status – aktiv=Rendben, feldolgozando=Feldolgozandó, kritikus=Kritikus';

-- 2. Allow authenticated users to read all profiles (needed for accountant list)
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- 3. Accountants can view invoices of their assigned companies
DROP POLICY IF EXISTS "Accountants can view assigned company invoices" ON public.invoices;
CREATE POLICY "Accountants can view assigned company invoices"
  ON public.invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.accounty_assignments
    WHERE accounty_assignments.company_id = invoices.company_id
      AND accounty_assignments.accountant_user_id = auth.uid()
  ));

-- 4. Accountants can view the companies they are assigned to
DROP POLICY IF EXISTS "Accountants can view assigned companies" ON public.companies;
CREATE POLICY "Accountants can view assigned companies"
  ON public.companies FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.accounty_assignments
    WHERE accounty_assignments.company_id = companies.id
      AND accounty_assignments.accountant_user_id = auth.uid()
  ));

-- 5. Accountants can view NAV invoices of their assigned companies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nav_invoices' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Accountants can view assigned NAV invoices" ON public.nav_invoices';
    EXECUTE 'CREATE POLICY "Accountants can view assigned NAV invoices"
      ON public.nav_invoices FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.accounty_assignments
        WHERE accounty_assignments.company_id = nav_invoices.company_id
          AND accounty_assignments.accountant_user_id = auth.uid()
      ))';
  END IF;
END $$;
