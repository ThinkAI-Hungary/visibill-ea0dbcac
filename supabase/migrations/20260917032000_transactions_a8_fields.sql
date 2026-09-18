-- Migration: 20260917032000_transactions_a8_fields.sql
-- Description: Add a8_transaction_id to transactions table and company_id to bank_transactions table

-- 1. Add a8_transaction_id to transactions table for API idempotency
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS a8_transaction_id TEXT;

-- Create unique partial index so same Aggreg8 transaction is never inserted twice into public.transactions
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_a8_tx_id
  ON public.transactions(a8_transaction_id)
  WHERE a8_transaction_id IS NOT NULL;

-- 2. Add company_id to bank_transactions table for direct tenant querying & RLS
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_company_id
  ON public.bank_transactions(company_id);

-- Backfill company_id for any existing bank_transactions from aggreg8_accounts
UPDATE public.bank_transactions bt
SET company_id = aa.company_id
FROM public.aggreg8_accounts aa
WHERE bt.a8_account_id = aa.a8_account_id
  AND bt.company_id IS NULL;

-- 3. Company member RLS for bank_transactions when company_id is present
DROP POLICY IF EXISTS "Company members can view company bank_transactions" ON public.bank_transactions;
CREATE POLICY "Company members can view company bank_transactions"
  ON public.bank_transactions
  FOR SELECT
  USING (
    company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = bank_transactions.company_id
        AND company_members.user_id = auth.uid()
    )
  );

