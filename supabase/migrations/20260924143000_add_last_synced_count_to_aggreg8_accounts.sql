-- Migration: Add last_synced_count to aggreg8_accounts
-- Description: Stores the number of transactions synchronized in the most recent sync run.

ALTER TABLE public.aggreg8_accounts 
ADD COLUMN IF NOT EXISTS last_synced_count integer DEFAULT 0;

COMMENT ON COLUMN public.aggreg8_accounts.last_synced_count IS 'Number of transactions imported in the most recent synchronization.';
