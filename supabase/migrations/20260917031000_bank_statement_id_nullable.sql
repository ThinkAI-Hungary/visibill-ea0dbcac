-- Migration: Make bank_statement_id nullable in bank_transactions
-- Reason: Aggreg8 PSD2 Open Banking transactions are synced directly via API/webhook,
-- so there is no uploaded bank statement PDF record (bank_statement_id is NULL).

ALTER TABLE public.bank_transactions ALTER COLUMN bank_statement_id DROP NOT NULL;
