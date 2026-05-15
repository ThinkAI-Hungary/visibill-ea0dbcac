-- =============================================
-- BALANCE SHEET MODULE - Tables & RLS
-- =============================================

-- 1. BS Structure Table (Sztv. "A" változat mérlegsorok)
CREATE TABLE IF NOT EXISTS public.bs_structure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_code varchar NOT NULL,
  name text NOT NULL,
  section varchar NOT NULL CHECK (section IN ('assets', 'liabilities')),
  type varchar NOT NULL CHECK (type IN ('letter', 'roman', 'arabic', 'total')),
  parent_id uuid REFERENCES public.bs_structure(id),
  order_num integer NOT NULL,
  is_pnl_bridge boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 2. BS Mapping Table (GL account → BS row)
CREATE TABLE IF NOT EXISTS public.bs_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  preset_id uuid NOT NULL REFERENCES public.chart_of_accounts_presets(id),
  gl_account_id uuid NOT NULL REFERENCES public.gl_accounts(id),
  bs_structure_id uuid NOT NULL REFERENCES public.bs_structure(id),
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, preset_id, gl_account_id)
);

-- 3. BS Prior Year Data (manual input for prior year columns)
CREATE TABLE IF NOT EXISTS public.bs_prior_year (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  bs_structure_id uuid NOT NULL REFERENCES public.bs_structure(id),
  fiscal_year integer NOT NULL,
  prior_year_balance numeric NOT NULL DEFAULT 0,
  prior_year_adjustment numeric NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, bs_structure_id, fiscal_year)
);

-- 4. RLS
ALTER TABLE public.bs_structure ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bs_structure_read_all" ON public.bs_structure FOR SELECT USING (true);

ALTER TABLE public.bs_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bs_mapping_read" ON public.bs_mapping FOR SELECT USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "bs_mapping_insert" ON public.bs_mapping FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "bs_mapping_update" ON public.bs_mapping FOR UPDATE USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "bs_mapping_delete" ON public.bs_mapping FOR DELETE USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

ALTER TABLE public.bs_prior_year ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bs_prior_year_read" ON public.bs_prior_year FOR SELECT USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "bs_prior_year_insert" ON public.bs_prior_year FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "bs_prior_year_update" ON public.bs_prior_year FOR UPDATE USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "bs_prior_year_delete" ON public.bs_prior_year FOR DELETE USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- 5. Save BS Mappings RPC
CREATE OR REPLACE FUNCTION public.save_bs_mappings(
  p_company_id uuid,
  p_preset_id uuid,
  p_mappings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  mapping record;
BEGIN
  DELETE FROM public.bs_mapping
  WHERE company_id = p_company_id AND preset_id = p_preset_id;

  FOR mapping IN SELECT * FROM jsonb_to_recordset(p_mappings) AS x(gl_account_id uuid, bs_structure_id uuid)
  LOOP
    IF mapping.bs_structure_id IS NOT NULL THEN
      INSERT INTO public.bs_mapping (company_id, preset_id, gl_account_id, bs_structure_id, user_id)
      VALUES (p_company_id, p_preset_id, mapping.gl_account_id, mapping.bs_structure_id, auth.uid());
    END IF;
  END LOOP;
END;
$$;

-- 6. Save BS Prior Year RPC
CREATE OR REPLACE FUNCTION public.save_bs_prior_year(
  p_company_id uuid,
  p_fiscal_year integer,
  p_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  row_data record;
BEGIN
  FOR row_data IN SELECT * FROM jsonb_to_recordset(p_data) AS x(bs_structure_id uuid, prior_year_balance numeric, prior_year_adjustment numeric)
  LOOP
    INSERT INTO public.bs_prior_year (company_id, bs_structure_id, fiscal_year, prior_year_balance, prior_year_adjustment, user_id)
    VALUES (p_company_id, row_data.bs_structure_id, p_fiscal_year, COALESCE(row_data.prior_year_balance, 0), COALESCE(row_data.prior_year_adjustment, 0), auth.uid())
    ON CONFLICT (company_id, bs_structure_id, fiscal_year)
    DO UPDATE SET prior_year_balance = EXCLUDED.prior_year_balance, prior_year_adjustment = EXCLUDED.prior_year_adjustment, user_id = EXCLUDED.user_id, updated_at = now();
  END LOOP;
END;
$$;
