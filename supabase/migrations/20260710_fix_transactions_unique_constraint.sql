-- ============================================================================
-- Migration: Fix Transactions Unique Constraint Scoping (Multi-Tenant Fix)
-- ============================================================================

-- Drop the old constraint that was incorrectly scoped only to (transaction_date, description)
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS unique_transaction_entry;

-- Re-create the constraint scoped to (company_id, transaction_date, description)
ALTER TABLE public.transactions
  ADD CONSTRAINT unique_transaction_entry UNIQUE (company_id, transaction_date, description);
