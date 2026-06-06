-- =============================================
-- transaction_invoice_matches: join table for multiple invoice matching
-- =============================================
-- This table allows a single transaction to be matched to multiple invoices.
-- The existing transactions.matched_invoice_id field is UNTOUCHED (AI primary match).
-- This table stores additional manual matches only.

CREATE TABLE public.transaction_invoice_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,                              -- invoices.id OR nav_invoices.id
  invoice_source text NOT NULL DEFAULT 'submitted'       -- 'submitted' | 'nav'
    CHECK (invoice_source IN ('submitted', 'nav')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT 'manual'              -- 'manual' | 'ai' (future)
    CHECK (created_by IN ('manual', 'ai')),
  UNIQUE(transaction_id, invoice_id)
);

-- Index for fast lookups by transaction
CREATE INDEX idx_tim_transaction_id ON public.transaction_invoice_matches(transaction_id);
-- Index for reverse lookups (find which transactions match a given invoice)
CREATE INDEX idx_tim_invoice_id ON public.transaction_invoice_matches(invoice_id);

-- =============================================
-- RLS: Members can manage matches for their company's transactions
-- =============================================
ALTER TABLE public.transaction_invoice_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view transaction_invoice_matches"
  ON public.transaction_invoice_matches FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.transactions t
    JOIN public.company_members cm ON cm.company_id = t.company_id
    WHERE t.id = transaction_invoice_matches.transaction_id
      AND cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can create transaction_invoice_matches"
  ON public.transaction_invoice_matches FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.transactions t
    JOIN public.company_members cm ON cm.company_id = t.company_id
    WHERE t.id = transaction_invoice_matches.transaction_id
      AND cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can delete transaction_invoice_matches"
  ON public.transaction_invoice_matches FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.transactions t
    JOIN public.company_members cm ON cm.company_id = t.company_id
    WHERE t.id = transaction_invoice_matches.transaction_id
      AND cm.user_id = auth.uid()
  ));
