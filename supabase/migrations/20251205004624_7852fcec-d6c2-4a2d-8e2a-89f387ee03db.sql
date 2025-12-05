-- 1. COMPANIES tábla létrehozása
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tax_number text,
  address text,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS bekapcsolása
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Companies RLS policy-k
CREATE POLICY "Users can view their own companies"
  ON public.companies FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own companies"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own companies"
  ON public.companies FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own companies"
  ON public.companies FOR DELETE
  USING (auth.uid() = owner_id);

-- Updated_at trigger
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. company_id oszlop hozzáadása a meglévő táblákhoz (nullable először a migráció miatt)
ALTER TABLE public.invoices ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.nav_invoices ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.nav_sync_logs ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.projects ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.salary ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.salary_files ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.tax ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.email_aliases ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_uploads ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.bank_statements ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- 3. NAV credentials átköltöztetése company szintre
ALTER TABLE public.user_nav_credentials ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- 4. Alapértelmezett cég létrehozása minden meglévő felhasználónak és adatok migrálása
DO $$
DECLARE
  r RECORD;
  new_company_id uuid;
BEGIN
  -- Végigmegyünk minden profiles bejegyzésen (regisztrált felhasználók)
  FOR r IN SELECT user_id, name, company FROM public.profiles LOOP
    -- Új cég létrehozása
    INSERT INTO public.companies (name, owner_id)
    VALUES (COALESCE(r.company, r.name, 'Saját cég'), r.user_id)
    RETURNING id INTO new_company_id;
    
    -- Invoices frissítése
    UPDATE public.invoices SET company_id = new_company_id WHERE user_id = r.user_id;
    
    -- NAV invoices frissítése
    UPDATE public.nav_invoices SET company_id = new_company_id WHERE user_id = r.user_id;
    
    -- NAV sync logs frissítése
    UPDATE public.nav_sync_logs SET company_id = new_company_id WHERE user_id = r.user_id;
    
    -- Projects frissítése
    UPDATE public.projects SET company_id = new_company_id WHERE user_id = r.user_id;
    
    -- Categories frissítése
    UPDATE public.categories SET company_id = new_company_id WHERE user_id = r.user_id;
    
    -- Salary frissítése
    UPDATE public.salary SET company_id = new_company_id WHERE user_id = r.user_id;
    
    -- Salary files frissítése
    UPDATE public.salary_files SET company_id = new_company_id WHERE user_id = r.user_id;
    
    -- Tax frissítése
    UPDATE public.tax SET company_id = new_company_id WHERE user_id = r.user_id;
    
    -- Email aliases frissítése
    UPDATE public.email_aliases SET company_id = new_company_id WHERE user_id = r.user_id;
    
    -- Invoice uploads frissítése
    UPDATE public.invoice_uploads SET company_id = new_company_id WHERE user_id = r.user_id;
    
    -- Bank statements frissítése
    UPDATE public.bank_statements SET company_id = new_company_id WHERE user_id = r.user_id;
    
    -- NAV credentials frissítése
    UPDATE public.user_nav_credentials SET company_id = new_company_id WHERE user_id = r.user_id;
  END LOOP;
END $$;

-- 5. Indexek létrehozása a company_id oszlopokra
CREATE INDEX idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX idx_nav_invoices_company_id ON public.nav_invoices(company_id);
CREATE INDEX idx_nav_sync_logs_company_id ON public.nav_sync_logs(company_id);
CREATE INDEX idx_projects_company_id ON public.projects(company_id);
CREATE INDEX idx_categories_company_id ON public.categories(company_id);
CREATE INDEX idx_salary_company_id ON public.salary(company_id);
CREATE INDEX idx_salary_files_company_id ON public.salary_files(company_id);
CREATE INDEX idx_tax_company_id ON public.tax(company_id);

-- 6. Security definer funkció a company hozzáférés ellenőrzésére
CREATE OR REPLACE FUNCTION public.user_has_company_access(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies
    WHERE id = p_company_id
      AND owner_id = auth.uid()
  )
$$;