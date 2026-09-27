-- ==============================================================================
-- Migration: 20260927131000_related_partners_schema.sql
-- Description: Expand public.partners with related party details:
--              relation_type, ownership_percent, valid_from, valid_to,
--              parent_partner_id, custom_gl_account_id, related_party_notes
-- ==============================================================================

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS relation_type TEXT CHECK (relation_type IN ('parent', 'subsidiary', 'sister', 'owner_interest', 'other')),
  ADD COLUMN IF NOT EXISTS ownership_percent NUMERIC(5, 2) CHECK (ownership_percent >= 0 AND ownership_percent <= 100),
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE,
  ADD COLUMN IF NOT EXISTS parent_partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_gl_account_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_party_notes TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_partners_related_party ON public.partners(company_id, related_party) WHERE related_party = true;
CREATE INDEX IF NOT EXISTS idx_partners_parent_partner_id ON public.partners(parent_partner_id) WHERE parent_partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_custom_gl_account ON public.partners(custom_gl_account_id) WHERE custom_gl_account_id IS NOT NULL;
