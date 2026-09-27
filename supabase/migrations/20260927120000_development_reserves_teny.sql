-- Migration: 20260927120000_development_reserves_teny.sql
-- Description: Fejlesztési Tartalék (Development Reserve) és Tárgyi Eszköz (TENY) összekapcsolása

-- 1. development_reserves tábla létrehozása
CREATE TABLE IF NOT EXISTS public.development_reserves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  creation_year INTEGER NOT NULL CHECK (creation_year BETWEEN 2000 AND 2100),
  reserve_amount NUMERIC(15, 2) NOT NULL CHECK (reserve_amount > 0),
  expiration_date DATE NOT NULL,
  description TEXT,
  gl_account_id UUID REFERENCES public.gl_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexek
CREATE INDEX IF NOT EXISTS idx_development_reserves_company ON public.development_reserves(company_id);
CREATE INDEX IF NOT EXISTS idx_development_reserves_year ON public.development_reserves(creation_year);

-- RLS
ALTER TABLE public.development_reserves ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'development_reserves' AND policyname = 'development_reserves_select'
  ) THEN
    CREATE POLICY development_reserves_select ON public.development_reserves
      FOR SELECT USING (
        company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'development_reserves' AND policyname = 'development_reserves_insert'
  ) THEN
    CREATE POLICY development_reserves_insert ON public.development_reserves
      FOR INSERT WITH CHECK (
        company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'development_reserves' AND policyname = 'development_reserves_update'
  ) THEN
    CREATE POLICY development_reserves_update ON public.development_reserves
      FOR UPDATE USING (
        company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'development_reserves' AND policyname = 'development_reserves_delete'
  ) THEN
    CREATE POLICY development_reserves_delete ON public.development_reserves
      FOR DELETE USING (
        company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- 2. fixed_assets tábla kiegészítése
ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS development_reserve_id UUID REFERENCES public.development_reserves(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS development_reserve_amount NUMERIC(15, 2) DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS idx_fixed_assets_dev_reserve ON public.fixed_assets(development_reserve_id);
