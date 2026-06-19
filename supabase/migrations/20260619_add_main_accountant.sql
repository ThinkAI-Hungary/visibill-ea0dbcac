-- ============================================================================
-- Add is_main_accountant flag to accounty_assignments
-- ============================================================================
-- Tracks which accountant is the primary/lead accountant for a company.
-- Each company can have at most ONE main accountant (enforced by unique index).
-- The iroda_admin stays assigned to all companies regardless.
-- ============================================================================

ALTER TABLE public.accounty_assignments
ADD COLUMN IF NOT EXISTS is_main_accountant BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.accounty_assignments.is_main_accountant IS
  'True if this accountant is the main/lead accountant for this company. Only one per company.';

-- Ensure only one main accountant per company (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_main_accountant_per_company
  ON public.accounty_assignments (company_id)
  WHERE is_main_accountant = true;
