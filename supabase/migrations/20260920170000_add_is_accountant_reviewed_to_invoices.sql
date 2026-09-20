-- Migration: 20260920170000_add_is_accountant_reviewed_to_invoices.sql
-- Description: Add is_accountant_reviewed column to nav_invoices and invoices tables, with indexes and schema cache reload

-- 1. Add is_accountant_reviewed column to nav_invoices and invoices tables
ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS is_accountant_reviewed BOOLEAN DEFAULT false;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_accountant_reviewed BOOLEAN DEFAULT false;

-- 2. Create indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_nav_invoices_accountant_reviewed 
  ON public.nav_invoices(company_id, is_accountant_reviewed);

CREATE INDEX IF NOT EXISTS idx_invoices_accountant_reviewed 
  ON public.invoices(company_id, is_accountant_reviewed);

-- 3. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
