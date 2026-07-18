-- 1. Insert accounty assignment for Balogh Róbert (74ffc3ee-9ed4-4f5e-9794-a1d084822979) for company 'Szbs BT' (38be1064-032d-4766-93f0-736ae4a80cd7)
INSERT INTO accounty_assignments (
  accountant_user_id,
  company_id,
  accounting_firm_id,
  role,
  is_primary,
  is_main_accountant,
  source
) VALUES (
  '74ffc3ee-9ed4-4f5e-9794-a1d084822979',
  '38be1064-032d-4766-93f0-736ae4a80cd7',
  '38be1064-032d-4766-93f0-736ae4a80cd7', -- company acts as its own firm in this setup
  'iroda_admin',
  true,
  true,
  'manual'
)
ON CONFLICT (accountant_user_id, company_id) DO UPDATE SET
  role = 'iroda_admin',
  is_primary = true,
  is_main_accountant = true,
  updated_at = now();

-- 2. Insert default tax profile for 'Szbs BT' (38be1064-032d-4766-93f0-736ae4a80cd7)
INSERT INTO accounty_tax_profiles (
  company_id,
  vat_frequency,
  contribution_frequency,
  is_kata,
  is_kiva,
  has_payroll,
  payroll_settings
) VALUES (
  '38be1064-032d-4766-93f0-736ae4a80cd7',
  'monthly',
  'monthly',
  false,
  false,
  false,
  '{}'::jsonb
)
ON CONFLICT (company_id) DO NOTHING;
