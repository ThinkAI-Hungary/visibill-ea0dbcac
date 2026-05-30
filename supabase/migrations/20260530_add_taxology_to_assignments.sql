-- ============================================================================
-- Add Taxology Kft. to accounty_assignments for Viktor Jámbor
-- So that the owner can see their own company in the Accounty sidebar
-- ============================================================================

-- Viktor Jámbor user ID: 5abff3e7-0b0e-47eb-9198-4db551668caf
-- Taxology Kft. company ID: 377d28cb-edc9-48a7-b261-bcd9c91d81a1

INSERT INTO public.accounty_assignments (
  accountant_user_id,
  company_id,
  accounting_firm_id,
  role,
  is_primary
) VALUES (
  '5abff3e7-0b0e-47eb-9198-4db551668caf',  -- Viktor Jámbor
  '377d28cb-edc9-48a7-b261-bcd9c91d81a1',  -- Taxology Kft.
  '377d28cb-edc9-48a7-b261-bcd9c91d81a1',  -- accounting_firm_id = same (own company)
  'senior',                                  -- owner = senior role
  true                                       -- primary accountant
) ON CONFLICT (accountant_user_id, company_id) DO NOTHING;
