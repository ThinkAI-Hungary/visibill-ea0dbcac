-- Migration: 20261008100000_create_company_auto_accounting_rules.sql
-- Description:
--   EB-0256: Create company_auto_accounting_rules table for centralized configuration
--   of automated booking mechanisms (VAT transfers, FX differences, rounding, linked journals).
--   Includes RLS multi-tenancy policies and foreign key performance indexes.

CREATE TABLE IF NOT EXISTS public.company_auto_accounting_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

    -- 1. ÁFA átvezetések (gl_accounts FK)
    vat_pf_payable_gl_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,     -- Pénzforgalmi fizetendő (pl. 47911)
    vat_pf_deductible_gl_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,  -- Pénzforgalmi levonható (pl. 36911)
    vat_advance_gross_gl_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,  -- Bruttó előleg ÁFA (pl. 36914)
    vat_intra_year_payable_gl_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,    -- Éven belüli fizetendő (pl. 47912)
    vat_intra_year_deductible_gl_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL, -- Éven belüli levonható (pl. 36912)
    vat_cross_year_payable_gl_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,    -- Évek közötti fizetendő (pl. 47913)
    vat_cross_year_deductible_gl_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL, -- Évek közötti levonható (pl. 36913)

    -- 2. Realizált árfolyam-különbözet
    fx_realized_journal_id UUID REFERENCES public.acc_journals(id) ON DELETE SET NULL,   -- Kapcsolt vegyes napló (pl. VE)
    fx_realized_gain_gl_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,    -- Nyereség (pl. 9779)
    fx_realized_loss_gl_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,    -- Veszteség (pl. 8755)

    -- 3. Nem realizált árfolyam-különbözet
    fx_unrealized_journal_id UUID REFERENCES public.acc_journals(id) ON DELETE SET NULL, -- Kapcsolt vegyes napló
    fx_unrealized_gain_gl_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,  -- Nyereség (pl. 9762)
    fx_unrealized_loss_gl_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,  -- Veszteség (pl. 8762)

    -- 4. Kerekítési különbözet
    rounding_gain_gl_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,       -- Nyereség / bevétel (pl. 9699)
    rounding_loss_gl_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,       -- Veszteség / ráfordítás (pl. 8699)
    rounding_max_limit_huf NUMERIC(10,2) NOT NULL DEFAULT 10.00,                         -- Max határ folyószámla párosításnál

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_company_auto_accounting_rules_company UNIQUE (company_id)
);

-- Comments for documentation & PostgREST OpenAPI spec
COMMENT ON TABLE public.company_auto_accounting_rules IS 'Cégszintű automatikus könyvelési szabályok és átvezetési főkönyvi számlák konfigurációja (EB-0256).';
COMMENT ON COLUMN public.company_auto_accounting_rules.vat_pf_payable_gl_id IS 'Pénzforgalmi ÁFA fizetendő átvezetési számla (pl. 47911)';
COMMENT ON COLUMN public.company_auto_accounting_rules.vat_pf_deductible_gl_id IS 'Pénzforgalmi ÁFA levonható átvezetési számla (pl. 36911)';
COMMENT ON COLUMN public.company_auto_accounting_rules.rounding_max_limit_huf IS 'Maximális kerekítési különbözet forintban (alapértelmezett 10 Ft)';

-- Enable RLS
ALTER TABLE public.company_auto_accounting_rules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view auto rules of accessible companies" ON public.company_auto_accounting_rules;
DROP POLICY IF EXISTS "Admins/Accountants can upsert auto rules" ON public.company_auto_accounting_rules;

-- RLS: Read policy with InitPlan optimization
CREATE POLICY "Users can view auto rules of accessible companies"
ON public.company_auto_accounting_rules FOR SELECT
USING (
    company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
    )
);

-- RLS: Write policy for owner, admin, accountant
CREATE POLICY "Admins/Accountants can upsert auto rules"
ON public.company_auto_accounting_rules FOR ALL
USING (
    company_id IN (
        SELECT cm.company_id FROM public.company_members cm 
        WHERE cm.user_id = (SELECT auth.uid()) AND cm.role IN ('owner', 'admin', 'accountant')
    )
)
WITH CHECK (
    company_id IN (
        SELECT cm.company_id FROM public.company_members cm 
        WHERE cm.user_id = (SELECT auth.uid()) AND cm.role IN ('owner', 'admin', 'accountant')
    )
);

-- Performance Indexes on FK columns
CREATE INDEX IF NOT EXISTS idx_company_auto_accounting_rules_company ON public.company_auto_accounting_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_company_auto_rules_fx_realized_journal ON public.company_auto_accounting_rules(fx_realized_journal_id);
CREATE INDEX IF NOT EXISTS idx_company_auto_rules_fx_unrealized_journal ON public.company_auto_accounting_rules(fx_unrealized_journal_id);

-- Explicit Permissions
REVOKE ALL ON TABLE public.company_auto_accounting_rules FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_auto_accounting_rules TO authenticated;
GRANT ALL ON TABLE public.company_auto_accounting_rules TO service_role;
