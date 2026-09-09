-- Migration: 20260909120000_fakov_accounting_vat_enhancements.sql
-- Description: Add accountant review checkbox columns and seed missing GL sub-accounts (4668, 4542, 4543, 3112, 3113)

-- 1. Add is_accountant_reviewed column to nav_invoices and invoices tables
ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS is_accountant_reviewed BOOLEAN DEFAULT false;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_accountant_reviewed BOOLEAN DEFAULT false;

-- Create indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_nav_invoices_accountant_reviewed 
  ON public.nav_invoices(company_id, is_accountant_reviewed);

CREATE INDEX IF NOT EXISTS idx_invoices_accountant_reviewed 
  ON public.invoices(company_id, is_accountant_reviewed);

-- 2. Function to seed missing Fakov GL accounts for all existing presets
CREATE OR REPLACE FUNCTION seed_fakov_gl_accounts()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  r_preset RECORD;
BEGIN
  FOR r_preset IN SELECT DISTINCT id FROM public.gl_presets LOOP
    -- 4668: Arányosítandó / nem levonható ÁFA
    IF NOT EXISTS (SELECT 1 FROM public.gl_accounts WHERE preset_id = r_preset.id AND gl_number = '4668') THEN
      INSERT INTO public.gl_accounts (preset_id, gl_number, short_name, account_type)
      VALUES (r_preset.id, '4668', 'Arányosítandó / nem levonható ÁFA', 'BALANCE_SHEET');
    END IF;

    -- 4542: Külföldi szállítók
    IF NOT EXISTS (SELECT 1 FROM public.gl_accounts WHERE preset_id = r_preset.id AND gl_number = '4542') THEN
      INSERT INTO public.gl_accounts (preset_id, gl_number, short_name, account_type)
      VALUES (r_preset.id, '4542', 'Külföldi szállítók', 'BALANCE_SHEET');
    END IF;

    -- 4543: Fordított ÁFA (FAD) szállítók
    IF NOT EXISTS (SELECT 1 FROM public.gl_accounts WHERE preset_id = r_preset.id AND gl_number = '4543') THEN
      INSERT INTO public.gl_accounts (preset_id, gl_number, short_name, account_type)
      VALUES (r_preset.id, '4543', 'Fordított ÁFA szállítók (FAD)', 'BALANCE_SHEET');
    END IF;

    -- 3112: Külföldi vevők
    IF NOT EXISTS (SELECT 1 FROM public.gl_accounts WHERE preset_id = r_preset.id AND gl_number = '3112') THEN
      INSERT INTO public.gl_accounts (preset_id, gl_number, short_name, account_type)
      VALUES (r_preset.id, '3112', 'Külföldi vevők', 'BALANCE_SHEET');
    END IF;

    -- 3113: Fordított ÁFA (FAD) vevők
    IF NOT EXISTS (SELECT 1 FROM public.gl_accounts WHERE preset_id = r_preset.id AND gl_number = '3113') THEN
      INSERT INTO public.gl_accounts (preset_id, gl_number, short_name, account_type)
      VALUES (r_preset.id, '3113', 'Fordított ÁFA vevők (FAD)', 'BALANCE_SHEET');
    END IF;
  END LOOP;
END;
$$;

-- Execute the seeding function
SELECT seed_fakov_gl_accounts();
