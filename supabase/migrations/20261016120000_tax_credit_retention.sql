-- Migration: 20261016120000_tax_credit_retention.sql
-- Cél: Beruházási adókedvezmény és 4 éves megtartási kötelezettség (kivezetési gát) nyilvántartása

ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS has_tax_credit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_credit_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS tax_credit_retention_until DATE;

-- Index a gyors szűréshez és ellenőrzéshez
CREATE INDEX IF NOT EXISTS idx_fixed_assets_tax_credit_retention 
  ON public.fixed_assets (company_id, tax_credit_retention_until) 
  WHERE has_tax_credit = true;

COMMENT ON COLUMN public.fixed_assets.has_tax_credit IS 'Igénybe vett-e beruházási adókedvezményt az eszközre (Tao. tv. 22/B. § vagy kisvállalkozói kedvezmény)';
COMMENT ON COLUMN public.fixed_assets.tax_credit_type IS 'Beruházási adókedvezmény jogcíme / típusa (pl. small_business, development_tax_incentive, energy_efficiency)';
COMMENT ON COLUMN public.fixed_assets.tax_credit_retention_until IS 'Megtartási / elidegenítési tilalom záródátuma (alapesetben aktiválás + 4 év)';
