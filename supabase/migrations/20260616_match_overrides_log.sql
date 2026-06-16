-- ══════════════════════════════════════════════════════════════
-- Match Overrides Log — Few-shot learning for transaction matching
-- ══════════════════════════════════════════════════════════════
-- Stores manual corrections to AI/heuristic matching decisions.
-- The worker loads these at matching time and injects them into the
-- AI prompt as "company-specific knowledge" (few-shot examples).

CREATE TABLE IF NOT EXISTS public.match_overrides_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,

    -- What the AI/heuristic originally decided
    original_invoice_id uuid,            -- NULL if there was no match
    original_match_type text,            -- 'ai_match', 'heuristic', etc.

    -- What the user corrected it to
    corrected_invoice_id uuid,           -- NULL if "no invoice needed"
    corrected_match_type text NOT NULL,  -- 'manual', 'no_invoice', 'invoice_missing'

    -- Context for learning (denormalized for fast loading)
    transaction_description text NOT NULL,   -- The transaction description
    transaction_amount numeric NOT NULL,     -- Transaction amount
    original_partner_name text,              -- Partner name from original match
    corrected_partner_name text,             -- Partner name from corrected match

    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- Index for company-scoped queries
CREATE INDEX IF NOT EXISTS idx_match_overrides_company
    ON public.match_overrides_log(company_id, created_at DESC);

-- RLS
ALTER TABLE public.match_overrides_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company match overrides"
    ON public.match_overrides_log FOR SELECT
    USING (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm
            WHERE cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert match overrides for own company"
    ON public.match_overrides_log FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm
            WHERE cm.user_id = auth.uid()
        )
    );

-- Grant to authenticated users
GRANT SELECT, INSERT ON public.match_overrides_log TO authenticated;
