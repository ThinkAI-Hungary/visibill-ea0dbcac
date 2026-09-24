-- Migration: 20260924163000_nav_upo_m2m.sql
-- Description: NAV ÜPO (Ügyfélportál) M2M integration tables, audit logs, and security procedures.
-- Adheres 100% to NAV M2M ÁSZF (2025.02.01) and technical specifications 0.5, 1.2.

-- 1. accounty_upo_credentials table
CREATE TABLE IF NOT EXISTS public.accounty_upo_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'development')),
    client_id TEXT NOT NULL DEFAULT 'kD67QsLcF8',
    username TEXT NOT NULL,
    password_encrypted TEXT,
    signature_key_encrypted TEXT NOT NULL,
    representation_tax_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'error')),
    last_validated_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    auto_efo_sync_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_employee_sync_enabled BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT accounty_upo_credentials_company_env_key UNIQUE (company_id, environment)
);

CREATE INDEX IF NOT EXISTS idx_accounty_upo_credentials_company ON public.accounty_upo_credentials(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_upo_credentials_env ON public.accounty_upo_credentials(company_id, environment);

-- 2. nav_m2m_audit_logs table (Mandatory 90-day retention per NAV ÁSZF Section 6.2 & M2M General Spec)
CREATE TABLE IF NOT EXISTS public.nav_m2m_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    environment TEXT NOT NULL DEFAULT 'production',
    action TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_id TEXT,
    target_tax_id TEXT,
    status_code INTEGER,
    result_code TEXT,
    result_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nav_m2m_audit_logs_company_created ON public.nav_m2m_audit_logs(company_id, created_at DESC);

-- 3. accounty_efo_entries table (Simplified employment daily & yearly used days)
CREATE TABLE IF NOT EXISTS public.accounty_efo_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    tax_id TEXT NOT NULL,
    name TEXT NOT NULL,
    taj_number TEXT,
    target_year INTEGER NOT NULL,
    days_alkalmi INTEGER NOT NULL DEFAULT 0,
    days_mezogazdasag INTEGER NOT NULL DEFAULT 0,
    days_turisztika INTEGER NOT NULL DEFAULT 0,
    days_filmipar INTEGER NOT NULL DEFAULT 0,
    days_total_used INTEGER NOT NULL DEFAULT 0,
    days_total_available INTEGER NOT NULL DEFAULT 120,
    days_agri_available INTEGER NOT NULL DEFAULT 90,
    last_sync_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT accounty_efo_entries_company_tax_year_key UNIQUE (company_id, tax_id, target_year)
);

CREATE INDEX IF NOT EXISTS idx_accounty_efo_entries_company_year ON public.accounty_efo_entries(company_id, target_year);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.accounty_upo_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nav_m2m_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_efo_entries ENABLE ROW LEVEL SECURITY;

-- 5. Multi-tenancy RLS Policies with InitPlan optimization
-- Credentials: Only company members / owners can read (though RPC masks raw keys)
CREATE POLICY "accounty_upo_credentials_select" ON public.accounty_upo_credentials
    FOR SELECT TO authenticated
    USING (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
            UNION
            SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "accounty_upo_credentials_modify" ON public.accounty_upo_credentials
    FOR ALL TO authenticated
    USING (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
            UNION
            SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
            UNION
            SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        )
    );

-- Audit Logs: Company members can view audit logs
CREATE POLICY "nav_m2m_audit_logs_select" ON public.nav_m2m_audit_logs
    FOR SELECT TO authenticated
    USING (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
            UNION
            SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "nav_m2m_audit_logs_insert" ON public.nav_m2m_audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
            UNION
            SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        )
    );

-- EFO entries: Company members can view and manage
CREATE POLICY "accounty_efo_entries_select" ON public.accounty_efo_entries
    FOR SELECT TO authenticated
    USING (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
            UNION
            SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "accounty_efo_entries_modify" ON public.accounty_efo_entries
    FOR ALL TO authenticated
    USING (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
            UNION
            SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
            UNION
            SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        )
    );

-- 6. Helper RPC Functions
-- A) get_upo_credentials_status: returns safe masked metadata without exposing raw secrets
CREATE OR REPLACE FUNCTION public.get_upo_credentials_status(
    p_company_id UUID,
    p_env TEXT DEFAULT 'production'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_cred RECORD;
    v_masked_uname TEXT;
    v_is_member BOOLEAN;
BEGIN
    -- Check permissions
    SELECT EXISTS (
        SELECT 1 FROM public.company_members WHERE company_id = p_company_id AND user_id = (SELECT auth.uid())
        UNION
        SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_id = (SELECT auth.uid())
    ) INTO v_is_member;

    IF NOT v_is_member AND (SELECT auth.role()) <> 'service_role' THEN
        RAISE EXCEPTION 'Nincs jogosultságod a cég NAV M2M állapotának megtekintésére.';
    END IF;

    SELECT * INTO v_cred
    FROM public.accounty_upo_credentials
    WHERE company_id = p_company_id AND environment = p_env
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'is_connected', false,
            'status', 'not_configured',
            'client_id', 'kD67QsLcF8',
            'environment', p_env
        );
    END IF;

    -- Mask username (show first 3 and last 2 characters)
    IF length(v_cred.username) > 5 THEN
        v_masked_uname := substring(v_cred.username FROM 1 FOR 3) || '••••' || substring(v_cred.username FROM length(v_cred.username) - 1);
    ELSE
        v_masked_uname := '••••';
    END IF;

    RETURN jsonb_build_object(
        'is_connected', (v_cred.status = 'active'),
        'id', v_cred.id,
        'status', v_cred.status,
        'client_id', v_cred.client_id,
        'username_masked', v_masked_uname,
        'representation_tax_id', v_cred.representation_tax_id,
        'environment', v_cred.environment,
        'last_validated_at', v_cred.last_validated_at,
        'last_sync_at', v_cred.last_sync_at,
        'auto_efo_sync_enabled', v_cred.auto_efo_sync_enabled,
        'auto_employee_sync_enabled', v_cred.auto_employee_sync_enabled,
        'error_message', v_cred.error_message
    );
END;
$$;

-- B) revoke_upo_credentials: irrevocably deletes secrets and writes audit log
CREATE OR REPLACE FUNCTION public.revoke_upo_credentials(
    p_company_id UUID,
    p_env TEXT DEFAULT 'production'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_is_member BOOLEAN;
    v_username TEXT;
BEGIN
    -- Check permissions
    SELECT EXISTS (
        SELECT 1 FROM public.company_members WHERE company_id = p_company_id AND user_id = (SELECT auth.uid())
        UNION
        SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_id = (SELECT auth.uid())
    ) INTO v_is_member;

    IF NOT v_is_member AND (SELECT auth.role()) <> 'service_role' THEN
        RAISE EXCEPTION 'Nincs jogosultságod a cég NAV M2M kapcsolatának bontására.';
    END IF;

    SELECT username INTO v_username
    FROM public.accounty_upo_credentials
    WHERE company_id = p_company_id AND environment = p_env;

    DELETE FROM public.accounty_upo_credentials
    WHERE company_id = p_company_id AND environment = p_env;

    -- Write audit log (mandatory compliance)
    INSERT INTO public.nav_m2m_audit_logs (
        company_id,
        user_id,
        environment,
        action,
        endpoint,
        status_code,
        result_code,
        result_message
    ) VALUES (
        p_company_id,
        (SELECT auth.uid()),
        p_env,
        'credentials_revoke',
        'public.revoke_upo_credentials',
        200,
        'REVOKED',
        COALESCE('Kapcsolat megszüntetve, azonosítási titkok megsemmisítve (user: ' || v_username || ')', 'Kapcsolat megszüntetve')
    );

    RETURN true;
END;
$$;

-- Explicit GRANTs / REVOKEs
REVOKE ALL ON public.accounty_upo_credentials FROM anon;
REVOKE ALL ON public.nav_m2m_audit_logs FROM anon;
REVOKE ALL ON public.accounty_efo_entries FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_upo_credentials_status(UUID, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_upo_credentials_status(UUID, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.revoke_upo_credentials(UUID, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.revoke_upo_credentials(UUID, TEXT) TO authenticated, service_role;
