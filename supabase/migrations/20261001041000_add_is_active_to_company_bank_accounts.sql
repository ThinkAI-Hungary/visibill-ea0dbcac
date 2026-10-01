-- Migration: Add is_active flag to company_bank_accounts for soft-deactivation / invalidation (EB-0182)
ALTER TABLE public.company_bank_accounts
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Index for filtering active bank accounts
CREATE INDEX IF NOT EXISTS idx_company_bank_accounts_company_active
ON public.company_bank_accounts (company_id, is_active);
