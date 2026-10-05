-- Migration: 20261005180000_adopt_accountant_upo_credentials.sql
-- Description: RPCs for checking and adopting active accountant NAV ÜPO M2M credentials across multi-company portfolios.
-- Ensures accountants representing up to 200+ companies can share/inherit their active M2M credential in 1 click without re-registering.

-- 1. get_user_accountant_upo_status: checks if current authenticated user has an active M2M credential on any of their managed companies
CREATE OR REPLACE FUNCTION public.get_user_accountant_upo_status(
    p_env TEXT DEFAULT 'production'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_source RECORD;
    v_masked_uname TEXT;
    v_total_companies INTEGER := 0;
    v_already_connected INTEGER := 0;
    v_user_company_ids UUID[];
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL AND (SELECT auth.role()) <> 'service_role' THEN
        RAISE EXCEPTION 'A művelethez bejelentkezés szükséges.';
    END IF;

    -- Collect all company IDs accessible by user
    SELECT array_agg(DISTINCT c_id) INTO v_user_company_ids
    FROM (
        SELECT cm.company_id AS c_id FROM public.company_members cm WHERE cm.user_id = v_user_id
        UNION
        SELECT co.id AS c_id FROM public.companies co WHERE co.owner_id = v_user_id
    ) t;

    IF v_user_company_ids IS NULL OR array_length(v_user_company_ids, 1) = 0 THEN
        RETURN jsonb_build_object(
            'has_active_accountant_cred', false,
            'total_companies_count', 0,
            'already_connected_count', 0,
            'unconnected_count', 0
        );
    END IF;

    v_total_companies := array_length(v_user_company_ids, 1);

    -- Find an active source credential within user companies or user_id
    SELECT c.*, comp.name AS source_company_name
    INTO v_source
    FROM public.accounty_upo_credentials c
    JOIN public.companies comp ON comp.id = c.company_id
    WHERE c.environment = p_env
      AND c.status = 'active'
      AND (
        c.user_id = v_user_id
        OR c.company_id = ANY(v_user_company_ids)
      )
    ORDER BY c.last_validated_at DESC NULLS LAST, c.updated_at DESC
    LIMIT 1;

    -- Count how many companies already have active credentials
    SELECT COUNT(DISTINCT company_id) INTO v_already_connected
    FROM public.accounty_upo_credentials
    WHERE environment = p_env
      AND status = 'active'
      AND company_id = ANY(v_user_company_ids);

    IF NOT FOUND OR v_source.id IS NULL THEN
        RETURN jsonb_build_object(
            'has_active_accountant_cred', false,
            'total_companies_count', v_total_companies,
            'already_connected_count', v_already_connected,
            'unconnected_count', GREATEST(0, v_total_companies - v_already_connected)
        );
    END IF;

    -- Mask username (show first 3 and last 2 characters)
    IF length(v_source.username) > 5 THEN
        v_masked_uname := substring(v_source.username FROM 1 FOR 3) || '••••' || substring(v_source.username FROM length(v_source.username) - 1);
    ELSE
        v_masked_uname := '••••';
    END IF;

    RETURN jsonb_build_object(
        'has_active_accountant_cred', true,
        'source_company_id', v_source.company_id,
        'source_company_name', v_source.source_company_name,
        'username_masked', v_masked_uname,
        'environment', v_source.environment,
        'client_id', v_source.client_id,
        'last_validated_at', v_source.last_validated_at,
        'total_companies_count', v_total_companies,
        'already_connected_count', v_already_connected,
        'unconnected_count', GREATEST(0, v_total_companies - v_already_connected)
    );
END;
$$;

-- 2. adopt_upo_credentials: replicates an active accountant credential to a specific company or bulk to all managed companies
CREATE OR REPLACE FUNCTION public.adopt_upo_credentials(
    p_target_company_id UUID,
    p_env TEXT DEFAULT 'production',
    p_apply_to_all BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_source RECORD;
    v_target_comp RECORD;
    v_applied_count INTEGER := 0;
    v_user_company_ids UUID[];
    v_is_member BOOLEAN;
    r_comp_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL AND (SELECT auth.role()) <> 'service_role' THEN
        RAISE EXCEPTION 'A művelethez bejelentkezés szükséges.';
    END IF;

    -- Collect all company IDs accessible by user
    SELECT array_agg(DISTINCT c_id) INTO v_user_company_ids
    FROM (
        SELECT cm.company_id AS c_id FROM public.company_members cm WHERE cm.user_id = v_user_id
        UNION
        SELECT co.id AS c_id FROM public.companies co WHERE co.owner_id = v_user_id
    ) t;

    -- If target company specified, verify membership
    IF p_target_company_id IS NOT NULL THEN
        IF NOT (p_target_company_id = ANY(v_user_company_ids)) AND (SELECT auth.role()) <> 'service_role' THEN
            RAISE EXCEPTION 'Nincs jogosultságod a megadott cég NAV kapcsolatának módosítására.';
        END IF;
    END IF;

    -- Find the active source credential to adopt
    SELECT c.*, comp.name AS source_company_name
    INTO v_source
    FROM public.accounty_upo_credentials c
    JOIN public.companies comp ON comp.id = c.company_id
    WHERE c.environment = p_env
      AND c.status = 'active'
      AND (
        c.user_id = v_user_id
        OR c.company_id = ANY(v_user_company_ids)
      )
    ORDER BY c.last_validated_at DESC NULLS LAST, c.updated_at DESC
    LIMIT 1;

    IF NOT FOUND OR v_source.id IS NULL THEN
        RAISE EXCEPTION 'Nem található aktív könyvelői NAV ÜPO kapcsolat a fiókodhoz tartozó cégeknél.';
    END IF;

    IF p_apply_to_all THEN
        -- Apply to all managed companies
        FOREACH r_comp_id IN ARRAY v_user_company_ids
        LOOP
            INSERT INTO public.accounty_upo_credentials (
                company_id,
                user_id,
                environment,
                client_id,
                username,
                password_encrypted,
                signature_key_encrypted,
                representation_tax_id,
                status,
                auto_efo_sync_enabled,
                auto_employee_sync_enabled,
                last_validated_at,
                error_message,
                updated_at
            ) VALUES (
                r_comp_id,
                v_user_id,
                p_env,
                v_source.client_id,
                v_source.username,
                v_source.password_encrypted,
                v_source.signature_key_encrypted,
                v_source.representation_tax_id,
                'active',
                true,
                true,
                now(),
                null,
                now()
            )
            ON CONFLICT (company_id, environment)
            DO UPDATE SET
                user_id = EXCLUDED.user_id,
                client_id = EXCLUDED.client_id,
                username = EXCLUDED.username,
                password_encrypted = EXCLUDED.password_encrypted,
                signature_key_encrypted = EXCLUDED.signature_key_encrypted,
                representation_tax_id = EXCLUDED.representation_tax_id,
                status = 'active',
                last_validated_at = now(),
                error_message = null,
                updated_at = now();

            -- Audit log
            INSERT INTO public.nav_m2m_audit_logs (
                company_id,
                user_id,
                environment,
                action,
                endpoint,
                status_code,
                result_code,
                result_message,
                duration_ms
            ) VALUES (
                r_comp_id,
                v_user_id,
                p_env,
                'adopt_accountant_credential',
                '/adoptAccountantCredentials',
                200,
                'SIKERES',
                format('Könyvelői NAV M2M kapcsolat átvéve forrás cégből: %s (%s)', v_source.source_company_name, v_source.username),
                0
            );

            v_applied_count := v_applied_count + 1;
        END LOOP;

        RETURN jsonb_build_object(
            'success', true,
            'applied_count', v_applied_count,
            'message', format('A(z) %s könyvelői NAV kapcsolat sikeresen kiterjesztve %s cégre!', v_source.username, v_applied_count)
        );
    ELSE
        -- Single target company adoption
        IF p_target_company_id IS NULL THEN
            RAISE EXCEPTION 'A cél cég azonosítója kötelező!';
        END IF;

        INSERT INTO public.accounty_upo_credentials (
            company_id,
            user_id,
            environment,
            client_id,
            username,
            password_encrypted,
            signature_key_encrypted,
            representation_tax_id,
            status,
            auto_efo_sync_enabled,
            auto_employee_sync_enabled,
            last_validated_at,
            error_message,
            updated_at
        ) VALUES (
            p_target_company_id,
            v_user_id,
            p_env,
            v_source.client_id,
            v_source.username,
            v_source.password_encrypted,
            v_source.signature_key_encrypted,
            v_source.representation_tax_id,
            'active',
            true,
            true,
            now(),
            null,
            now()
        )
        ON CONFLICT (company_id, environment)
        DO UPDATE SET
            user_id = EXCLUDED.user_id,
            client_id = EXCLUDED.client_id,
            username = EXCLUDED.username,
            password_encrypted = EXCLUDED.password_encrypted,
            signature_key_encrypted = EXCLUDED.signature_key_encrypted,
            representation_tax_id = EXCLUDED.representation_tax_id,
            status = 'active',
            last_validated_at = now(),
            error_message = null,
            updated_at = now();

        -- Audit log
        INSERT INTO public.nav_m2m_audit_logs (
            company_id,
            user_id,
            environment,
            action,
            endpoint,
            status_code,
            result_code,
            result_message,
            duration_ms
        ) VALUES (
            p_target_company_id,
            v_user_id,
            p_env,
            'adopt_accountant_credential',
            '/adoptAccountantCredentials',
            200,
            'SIKERES',
            format('Könyvelői NAV M2M kapcsolat átvéve forrás cégből: %s (%s)', v_source.source_company_name, v_source.username),
            0
        );

        RETURN jsonb_build_object(
            'success', true,
            'applied_count', 1,
            'message', format('A(z) %s könyvelői NAV kapcsolat sikeresen hozzárendelve ehhez a céghez!', v_source.username)
        );
    END IF;
END;
$$;

-- 3. Security grants
REVOKE ALL ON FUNCTION public.get_user_accountant_upo_status(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_user_accountant_upo_status(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.adopt_upo_credentials(UUID, TEXT, BOOLEAN) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.adopt_upo_credentials(UUID, TEXT, BOOLEAN) TO authenticated, service_role;
