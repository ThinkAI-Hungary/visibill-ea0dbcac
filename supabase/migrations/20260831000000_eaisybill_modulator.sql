-- Alter companies table to add description and primary_teaor columns
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS primary_teaor text;

-- Create company_prompt_rules table
CREATE TABLE IF NOT EXISTS public.company_prompt_rules (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    rule_name text NOT NULL,
    rule_prompt text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT company_prompt_rules_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.company_prompt_rules ENABLE ROW LEVEL SECURITY;

-- Create Policies
DROP POLICY IF EXISTS "Enable read access for company prompt rules" ON public.company_prompt_rules;
DROP POLICY IF EXISTS "Enable insert for company prompt rules" ON public.company_prompt_rules;
DROP POLICY IF EXISTS "Enable update for company prompt rules" ON public.company_prompt_rules;
DROP POLICY IF EXISTS "Enable delete for company prompt rules" ON public.company_prompt_rules;

-- Read Policy
CREATE POLICY "Enable read access for company prompt rules" ON public.company_prompt_rules
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm 
            WHERE cm.company_id = company_prompt_rules.company_id AND cm.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.accounty_assignments aa 
            WHERE aa.company_id = company_prompt_rules.company_id AND aa.accountant_user_id = auth.uid()
        )
    );

-- Insert Policy
CREATE POLICY "Enable insert for company prompt rules" ON public.company_prompt_rules
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_members cm 
            WHERE cm.company_id = company_prompt_rules.company_id AND cm.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.accounty_assignments aa 
            WHERE aa.company_id = company_prompt_rules.company_id AND aa.accountant_user_id = auth.uid()
        )
    );

-- Update Policy
CREATE POLICY "Enable update for company prompt rules" ON public.company_prompt_rules
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm 
            WHERE cm.company_id = company_prompt_rules.company_id AND cm.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.accounty_assignments aa 
            WHERE aa.company_id = company_prompt_rules.company_id AND aa.accountant_user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_members cm 
            WHERE cm.company_id = company_prompt_rules.company_id AND cm.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.accounty_assignments aa 
            WHERE aa.company_id = company_prompt_rules.company_id AND aa.accountant_user_id = auth.uid()
        )
    );

-- Delete Policy
CREATE POLICY "Enable delete for company prompt rules" ON public.company_prompt_rules
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm 
            WHERE cm.company_id = company_prompt_rules.company_id AND cm.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.accounty_assignments aa 
            WHERE aa.company_id = company_prompt_rules.company_id AND aa.accountant_user_id = auth.uid()
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_company_prompt_rules
    BEFORE UPDATE ON public.company_prompt_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
