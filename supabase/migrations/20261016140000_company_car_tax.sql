-- Migration: 20261016140000_company_car_tax.sql
-- Cél: Cégautóadó nyilvántartás (company_cars), gépjárműadó levonások (company_car_tax_payments) és TENY kivezetési szinkron trigger

-- 1. Cégautók tábla
CREATE TABLE IF NOT EXISTS public.company_cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  license_plate VARCHAR(20) NOT NULL,
  ownership_type VARCHAR(20) NOT NULL CHECK (ownership_type IN ('OWNED', 'RENTED', 'LEASED', 'PRIVATE_OPERATED')),
  fixed_asset_id UUID REFERENCES public.fixed_assets(id) ON DELETE SET NULL,
  make_and_model VARCHAR(100),
  engine_power_kw INTEGER NOT NULL,
  environmental_category VARCHAR(30) NOT NULL CHECK (environmental_category IN ('EURO_5_6', 'EURO_3_4', 'EURO_0_2', 'GREEN_ELECTRIC')),
  tax_liability_from DATE NOT NULL,
  tax_liability_to DATE,
  monthly_tax_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_tax_exempt BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexek
CREATE INDEX IF NOT EXISTS idx_company_cars_company_id ON public.company_cars(company_id);
CREATE INDEX IF NOT EXISTS idx_company_cars_fixed_asset_id ON public.company_cars(fixed_asset_id);
CREATE INDEX IF NOT EXISTS idx_company_cars_license_plate ON public.company_cars(company_id, license_plate);

-- 2. Gépjárműadó befizetések tábla (negyedéves levonáshoz)
CREATE TABLE IF NOT EXISTS public.company_car_tax_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  car_id UUID NOT NULL REFERENCES public.company_cars(id) ON DELETE CASCADE,
  tax_year SMALLINT NOT NULL,
  quarter SMALLINT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL,
  due_date DATE NOT NULL,
  is_deductible BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_car_tax_payments_car_id ON public.company_car_tax_payments(car_id);
CREATE INDEX IF NOT EXISTS idx_company_car_tax_payments_quarter ON public.company_car_tax_payments(company_id, tax_year, quarter);

-- 3. Row Level Security engedélyezése
ALTER TABLE public.company_cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_car_tax_payments ENABLE ROW LEVEL SECURITY;

-- company_cars RLS
CREATE POLICY "company_cars_select"
  ON public.company_cars
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid() AS uid)
    )
  );

CREATE POLICY "company_cars_insert"
  ON public.company_cars
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid() AS uid)
    )
  );

CREATE POLICY "company_cars_update"
  ON public.company_cars
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid() AS uid)
    )
  );

CREATE POLICY "company_cars_delete"
  ON public.company_cars
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid() AS uid)
    )
  );

-- company_car_tax_payments RLS
CREATE POLICY "company_car_tax_payments_select"
  ON public.company_car_tax_payments
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid() AS uid)
    )
  );

CREATE POLICY "company_car_tax_payments_insert"
  ON public.company_car_tax_payments
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid() AS uid)
    )
  );

CREATE POLICY "company_car_tax_payments_update"
  ON public.company_car_tax_payments
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid() AS uid)
    )
  );

CREATE POLICY "company_car_tax_payments_delete"
  ON public.company_car_tax_payments
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid() AS uid)
    )
  );

-- 4. TENY automatikus kivezetés trigger:
-- Ha a fixed_assets karton kivezetésre kerül (disposal_date), a tax_liability_to mező
-- automatikusan frissül a kivezetés hónapjának utolsó napjára.
CREATE OR REPLACE FUNCTION public.sync_company_car_disposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.disposal_date IS NOT NULL AND (OLD.disposal_date IS NULL OR OLD.disposal_date <> NEW.disposal_date) THEN
    UPDATE public.company_cars
       SET tax_liability_to = (date_trunc('month', NEW.disposal_date) + interval '1 month - 1 day')::date,
           updated_at = now()
     WHERE fixed_asset_id = NEW.id
       AND (tax_liability_to IS NULL OR tax_liability_to > NEW.disposal_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_company_car_disposal ON public.fixed_assets;

CREATE TRIGGER trg_sync_company_car_disposal
  AFTER UPDATE OF disposal_date ON public.fixed_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_company_car_disposal();

GRANT ALL ON public.company_cars TO authenticated, service_role;
GRANT ALL ON public.company_car_tax_payments TO authenticated, service_role;
