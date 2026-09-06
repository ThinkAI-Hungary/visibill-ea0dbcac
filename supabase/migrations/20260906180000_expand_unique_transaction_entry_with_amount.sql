-- ============================================================================
-- Migration: Expand unique_transaction_entry to include amount
--
-- Context:
-- Previously, unique_transaction_entry was UNIQUE (company_id, transaction_date, description).
-- In real bank statements, multiple distinct transactions often share the same
-- calendar date and description (e.g. repeated bank service fees, multiple fuel/store
-- purchases at the same merchant, multiple employee payouts). Without 'amount'
-- in the constraint, the 2nd transaction of that day is erroneously dropped as a duplicate.
--
-- Resolution:
-- Drop the 3-column constraint and recreate it as 4-column:
-- (company_id, transaction_date, description, amount).
-- ============================================================================

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS unique_transaction_entry;

ALTER TABLE public.transactions
  ADD CONSTRAINT unique_transaction_entry 
  UNIQUE (company_id, transaction_date, description, amount);
