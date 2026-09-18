-- Migration: Add targyi_mentes to companies.vat_regime check constraint
-- Description: Supports activity-based VAT exemption (Áfa tv. 85-86. § - TAM) for sports clubs, educational and cultural organizations.

ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_vat_regime_check;

ALTER TABLE public.companies ADD CONSTRAINT companies_vat_regime_check 
  CHECK (vat_regime IN ('normal', 'penzforgalmi', 'alanyi_mentes', 'targyi_mentes'));

COMMENT ON CONSTRAINT companies_vat_regime_check ON public.companies IS
  'Engedélyezett ÁFA rezsimek: normal (általános), penzforgalmi, alanyi_mentes (AAM), targyi_mentes (TAM)';
