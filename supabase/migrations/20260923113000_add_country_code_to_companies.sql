-- Migration: Add country_code to companies table
-- Date: 2026-09-23
-- Purpose: Support company jurisdiction (HU vs HR) for legal, compliance, and integration routing

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) NOT NULL DEFAULT 'HU';

ALTER TABLE public.companies 
DROP CONSTRAINT IF EXISTS companies_country_code_check;

ALTER TABLE public.companies 
ADD CONSTRAINT companies_country_code_check 
CHECK (country_code IN ('HU', 'HR'));

UPDATE public.companies 
SET country_code = 'HR' 
WHERE id = 'eb1d61df-3f85-45e2-b4d2-a93719ff4a4d' OR name ILIKE '%D-INVOICE%';

CREATE INDEX IF NOT EXISTS idx_companies_country_code ON public.companies(country_code);

COMMENT ON COLUMN public.companies.country_code IS 'ISO 3166-1 alpha-2 cég joghatóság (HU, HR)';
