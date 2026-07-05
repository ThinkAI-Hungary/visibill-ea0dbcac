-- Migration: Add FX GL account mapping columns to company_fx_settings
-- This allows accountants to configure which GL numbers receive FX gains and losses.

ALTER TABLE public.company_fx_settings
  ADD COLUMN IF NOT EXISTS fx_gain_gl_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fx_loss_gl_number text DEFAULT NULL;

COMMENT ON COLUMN public.company_fx_settings.fx_gain_gl_number
  IS 'GL account number for FX gains (e.g. 976). Editable by accountant.';
COMMENT ON COLUMN public.company_fx_settings.fx_loss_gl_number
  IS 'GL account number for FX losses (e.g. 876). Editable by accountant.';
