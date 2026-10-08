-- Migration: 20261008140000_eb0258_accounting_settings_date_gl_fx.sql
-- Description: EB-0258 Company accounting settings: default fulfillment date basis, aggregated GL view, exchange rate bank and type configuration

-- 1. Alter gl_date_basis default to 'teljesites' (Hungarian accounting fulfillment date priority)
ALTER TABLE public.company_settings 
  ALTER COLUMN gl_date_basis SET DEFAULT 'teljesites';

-- 2. Add gl_default_view_mode ('osszevont' vs 'teteles', default 'osszevont')
ALTER TABLE public.company_settings 
  ADD COLUMN IF NOT EXISTS gl_default_view_mode VARCHAR(20) NOT NULL DEFAULT 'osszevont';

-- 3. Add fx_accounting_bank_code (Bank for daily accounting exchange rates, default 'MNB')
ALTER TABLE public.company_settings 
  ADD COLUMN IF NOT EXISTS fx_accounting_bank_code VARCHAR(32) NOT NULL DEFAULT 'MNB';

-- 4. Add fx_accounting_rate_type ('mid' = Közép, 'buy' = Vétel, 'sell' = Eladás, default 'mid')
ALTER TABLE public.company_settings 
  ADD COLUMN IF NOT EXISTS fx_accounting_rate_type VARCHAR(16) NOT NULL DEFAULT 'mid';

-- 5. Add fx_revaluation_bank_code (Bank for year-end revaluation, default 'MNB')
ALTER TABLE public.company_settings 
  ADD COLUMN IF NOT EXISTS fx_revaluation_bank_code VARCHAR(32) NOT NULL DEFAULT 'MNB';

-- 6. Add fx_revaluation_rate_type ('mid' = Közép, 'buy' = Vétel, 'sell' = Eladás, default 'mid')
ALTER TABLE public.company_settings 
  ADD COLUMN IF NOT EXISTS fx_revaluation_rate_type VARCHAR(16) NOT NULL DEFAULT 'mid';

-- 7. Add index for faster company settings retrieval if not already present
CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON public.company_settings(company_id);

COMMENT ON COLUMN public.company_settings.gl_date_basis IS 'Default date basis for GL and accounting: teljesites (Fulfillment date) or kibocsatas (Issue date)';
COMMENT ON COLUMN public.company_settings.gl_default_view_mode IS 'Default GL table view mode: osszevont (Aggregated / collapsed by account) or teteles (Detailed item lines)';
COMMENT ON COLUMN public.company_settings.fx_accounting_bank_code IS 'Primary bank identifier for daily transaction exchange rates (e.g. MNB, 117-OTP, 107-CIB)';
COMMENT ON COLUMN public.company_settings.fx_accounting_rate_type IS 'Rate type for daily accounting: mid (Közép), buy (Vétel), sell (Eladás)';
COMMENT ON COLUMN public.company_settings.fx_revaluation_bank_code IS 'Bank identifier for periodic/year-end FX revaluation (e.g. MNB, 146-MFB)';
COMMENT ON COLUMN public.company_settings.fx_revaluation_rate_type IS 'Rate type for FX revaluation: mid (Közép), buy (Vétel), sell (Eladás)';
