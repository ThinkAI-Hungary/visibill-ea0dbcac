-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  ACCOUNTY PAYROLL COMPREHENSIVE ENHANCEMENTS                      ║
-- ║  1. Garnishments: case_number column + interest calculation fields ║
-- ║  2. Payroll Settings: data request presets & custom email template ║
-- ║  3. Dividends: accounty_dividends table with RLS & indexes          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- 1. accounty_garnishments: add case_number and interest fields
DO $$
BEGIN
    -- Add case_number column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'accounty_garnishments' 
        AND column_name = 'case_number'
    ) THEN
        ALTER TABLE public.accounty_garnishments ADD COLUMN case_number TEXT;
        UPDATE public.accounty_garnishments SET case_number = decree_number WHERE decree_number IS NOT NULL;
    END IF;

    -- Add creditor_bank_account column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'accounty_garnishments' 
        AND column_name = 'creditor_bank_account'
    ) THEN
        ALTER TABLE public.accounty_garnishments ADD COLUMN creditor_bank_account TEXT;
        UPDATE public.accounty_garnishments SET creditor_bank_account = creditor_account WHERE creditor_account IS NOT NULL;
    END IF;

    -- Add total_amount column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'accounty_garnishments' 
        AND column_name = 'total_amount'
    ) THEN
        ALTER TABLE public.accounty_garnishments ADD COLUMN total_amount NUMERIC;
        UPDATE public.accounty_garnishments SET total_amount = original_amount WHERE original_amount IS NOT NULL;
    END IF;

    -- Add interest and execution cost calculation columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'accounty_garnishments' 
        AND column_name = 'interest_rate_pct'
    ) THEN
        ALTER TABLE public.accounty_garnishments ADD COLUMN interest_rate_pct NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'accounty_garnishments' 
        AND column_name = 'interest_start_date'
    ) THEN
        ALTER TABLE public.accounty_garnishments ADD COLUMN interest_start_date DATE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'accounty_garnishments' 
        AND column_name = 'calculated_interest'
    ) THEN
        ALTER TABLE public.accounty_garnishments ADD COLUMN calculated_interest NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'accounty_garnishments' 
        AND column_name = 'execution_costs'
    ) THEN
        ALTER TABLE public.accounty_garnishments ADD COLUMN execution_costs NUMERIC DEFAULT 0;
    END IF;
END $$;

-- 2. accounty_payroll_settings: add data_request_preset and email_template
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'accounty_payroll_settings'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'accounty_payroll_settings' 
            AND column_name = 'data_request_preset'
        ) THEN
            ALTER TABLE public.accounty_payroll_settings ADD COLUMN data_request_preset JSONB DEFAULT '{"attendance": true, "overtime": true, "bonus": true, "sickLeave": true, "cafeteria": false, "phone": false, "advances": false}'::jsonb;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'accounty_payroll_settings' 
            AND column_name = 'email_template'
        ) THEN
            ALTER TABLE public.accounty_payroll_settings ADD COLUMN email_template TEXT;
        END IF;
    END IF;
END $$;

-- 3. accounty_dividends table
CREATE TABLE IF NOT EXISTS public.accounty_dividends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    member_name TEXT NOT NULL,
    member_tax_id TEXT NOT NULL,
    declaration_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payout_date DATE,
    gross_amount NUMERIC NOT NULL DEFAULT 0,
    has_reached_szocho_cap BOOLEAN DEFAULT FALSE,
    szja_rate NUMERIC NOT NULL DEFAULT 0.15,
    szja_amount NUMERIC NOT NULL DEFAULT 0,
    szocho_rate NUMERIC NOT NULL DEFAULT 0.13,
    szocho_amount NUMERIC NOT NULL DEFAULT 0,
    net_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid', 'posted', 'cancelled')),
    journal_entry_id UUID,
    resolution_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Comments
COMMENT ON TABLE public.accounty_dividends IS 'Osztalék számfejtések: 15% SZJA és 13% SZOCHO kalkuláció (24x minimálbér felső plafon figyeléssel), kifizetés és főkönyvi feladás.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounty_dividends_company_id ON public.accounty_dividends(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_dividends_payout_date ON public.accounty_dividends(payout_date);
CREATE INDEX IF NOT EXISTS idx_accounty_dividends_status ON public.accounty_dividends(status);

-- RLS
ALTER TABLE public.accounty_dividends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounty_dividends_tenant_select" ON public.accounty_dividends;
CREATE POLICY "accounty_dividends_tenant_select" ON public.accounty_dividends
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.accounty_assignments
            WHERE accountant_user_id = auth.uid() AND company_id = accounty_dividends.company_id
        )
    );

DROP POLICY IF EXISTS "accounty_dividends_tenant_modify" ON public.accounty_dividends;
CREATE POLICY "accounty_dividends_tenant_modify" ON public.accounty_dividends
    FOR ALL
    USING (
        company_id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.accounty_assignments
            WHERE accountant_user_id = auth.uid() AND company_id = accounty_dividends.company_id
        )
    );

DROP POLICY IF EXISTS "accounty_dividends_service_role" ON public.accounty_dividends;
CREATE POLICY "accounty_dividends_service_role" ON public.accounty_dividends
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
