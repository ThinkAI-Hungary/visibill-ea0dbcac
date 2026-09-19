-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  ACCOUNTY PAYROLL SETTINGS TABLE CREATION                             ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_payroll_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
    data_request_preset JSONB DEFAULT '{"attendance": true, "overtime": true, "bonus": false, "sickLeave": true, "newHires": false, "terminations": false, "cafeteria": false, "phone": false, "serviceCharge": false, "advances": false}'::jsonb,
    email_template TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_payroll_settings IS 'Cégenkénti bérszámfejtési beállítások: egyedi adatbekérési profil (preset) és testreszabott bekérő e-mail sablon.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounty_payroll_settings_company_id ON public.accounty_payroll_settings(company_id);

-- RLS
ALTER TABLE public.accounty_payroll_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounty_payroll_settings_select" ON public.accounty_payroll_settings;
CREATE POLICY "accounty_payroll_settings_select" ON public.accounty_payroll_settings
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
        OR
        company_id IN (
            SELECT company_id FROM public.accounty_assignments WHERE accountant_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "accounty_payroll_settings_insert" ON public.accounty_payroll_settings;
CREATE POLICY "accounty_payroll_settings_insert" ON public.accounty_payroll_settings
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
        OR
        company_id IN (
            SELECT company_id FROM public.accounty_assignments WHERE accountant_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "accounty_payroll_settings_update" ON public.accounty_payroll_settings;
CREATE POLICY "accounty_payroll_settings_update" ON public.accounty_payroll_settings
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
        OR
        company_id IN (
            SELECT company_id FROM public.accounty_assignments WHERE accountant_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "accounty_payroll_settings_delete" ON public.accounty_payroll_settings;
CREATE POLICY "accounty_payroll_settings_delete" ON public.accounty_payroll_settings
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
        OR
        company_id IN (
            SELECT company_id FROM public.accounty_assignments WHERE accountant_user_id = auth.uid()
        )
    );

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
