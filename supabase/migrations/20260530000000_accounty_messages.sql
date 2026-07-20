-- ==================================================
-- MERGED FROM: 20260530_accounty_messages.sql
-- ==================================================
-- ============================================================================
-- ACCOUNTY MESSAGES — Ügyfélportál kommunikáció
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accounty_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_from_client BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_messages IS 'Ügyfélportál kommunikáció: könyvelő ↔ ügyfél üzenetek cégenkénti csevegés.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounty_messages_company ON public.accounty_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_messages_created ON public.accounty_messages(created_at DESC);

-- RLS
ALTER TABLE public.accounty_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounty_messages_all" ON public.accounty_messages
  FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );


-- ==================================================
-- MERGED FROM: 20260530_add_taxology_to_assignments.sql
-- ==================================================
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
