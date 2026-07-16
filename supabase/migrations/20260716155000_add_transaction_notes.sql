-- Migration: Add transaction_id and transaction_ids columns to notes table
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS transaction_ids uuid[] DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_notes_transaction_id ON public.notes(transaction_id);
