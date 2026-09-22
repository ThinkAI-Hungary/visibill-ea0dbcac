-- Migration: Fix BS and P&L mapping UUID empty string parsing and enrich Customer API key user attribution
-- Description:
--   1. Replaces save_bs_mappings and save_pnl_mappings to parse gl_account_id and structure_id as text first,
--      preventing "invalid input syntax for type uuid: """ when unmapped rows are submitted.
--   2. Adds tenant authorization check (company_members / management) to save_bs_mappings and save_pnl_mappings.
--   3. Adds ON CONFLICT (company_id, preset_id, gl_account_id) DO UPDATE to prevent duplicate key constraint crashes.
--   4. Updates authenticate_customer_api_key to COALESCE(user_id, created_by) so that any API key
--      is attributed to the account whose user created/owns the key.

-- 1. Updated RPC: save_bs_mappings
CREATE OR REPLACE FUNCTION public.save_bs_mappings(
  p_company_id uuid,
  p_preset_id uuid,
  p_mappings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  mapping record;
  v_gl_id uuid;
  v_bs_id uuid;
BEGIN
  -- Tenant jogosultság ellenőrzése: Csak a cég tagja vagy thinkai/management admin módosíthat
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.company_members 
    WHERE company_id = p_company_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('thinkai', 'management')
  ) THEN
    RAISE EXCEPTION 'Hozzáférés megtagadva a megadott céghez (nincs tagság vagy admin jogosultság)';
  END IF;

  DELETE FROM public.bs_mapping
  WHERE company_id = p_company_id AND preset_id = p_preset_id;

  IF p_mappings IS NULL OR jsonb_typeof(p_mappings) <> 'array' THEN
    RETURN;
  END IF;

  FOR mapping IN SELECT * FROM jsonb_to_recordset(p_mappings) AS x(gl_account_id text, bs_structure_id text)
  LOOP
    -- Safely parse gl_account_id and bs_structure_id: only insert when both are valid UUIDs
    IF mapping.gl_account_id IS NOT NULL 
       AND mapping.gl_account_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND mapping.bs_structure_id IS NOT NULL 
       AND mapping.bs_structure_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN
      v_gl_id := mapping.gl_account_id::uuid;
      v_bs_id := mapping.bs_structure_id::uuid;

      INSERT INTO public.bs_mapping (company_id, preset_id, gl_account_id, bs_structure_id, user_id)
      VALUES (p_company_id, p_preset_id, v_gl_id, v_bs_id, auth.uid())
      ON CONFLICT (company_id, preset_id, gl_account_id)
      DO UPDATE SET bs_structure_id = EXCLUDED.bs_structure_id,
                    user_id = EXCLUDED.user_id,
                    updated_at = now();
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_bs_mappings(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_bs_mappings(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_bs_mappings(uuid, uuid, jsonb) TO service_role;

-- 2. Updated RPC: save_pnl_mappings
CREATE OR REPLACE FUNCTION public.save_pnl_mappings(
  p_company_id uuid,
  p_preset_id uuid,
  p_mappings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  mapping record;
  v_gl_id uuid;
  v_pnl_id uuid;
BEGIN
  -- Tenant jogosultság ellenőrzése: Csak a cég tagja vagy thinkai/management admin módosíthat
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.company_members 
    WHERE company_id = p_company_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role IN ('thinkai', 'management')
  ) THEN
    RAISE EXCEPTION 'Hozzáférés megtagadva a megadott céghez (nincs tagság vagy admin jogosultság)';
  END IF;

  DELETE FROM public.pnl_mapping 
  WHERE company_id = p_company_id AND preset_id = p_preset_id;

  IF p_mappings IS NULL OR jsonb_typeof(p_mappings) <> 'array' THEN
    RETURN;
  END IF;

  FOR mapping IN SELECT * FROM jsonb_to_recordset(p_mappings) AS x(gl_account_id text, pnl_structure_id text)
  LOOP
    -- Safely parse gl_account_id and pnl_structure_id: only insert when both are valid UUIDs
    IF mapping.gl_account_id IS NOT NULL 
       AND mapping.gl_account_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND mapping.pnl_structure_id IS NOT NULL 
       AND mapping.pnl_structure_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN
      v_gl_id := mapping.gl_account_id::uuid;
      v_pnl_id := mapping.pnl_structure_id::uuid;

      INSERT INTO public.pnl_mapping (company_id, preset_id, gl_account_id, pnl_structure_id, user_id)
      VALUES (p_company_id, p_preset_id, v_gl_id, v_pnl_id, auth.uid())
      ON CONFLICT (company_id, preset_id, gl_account_id)
      DO UPDATE SET pnl_structure_id = EXCLUDED.pnl_structure_id,
                    user_id = EXCLUDED.user_id,
                    updated_at = now();
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_pnl_mappings(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_pnl_mappings(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_pnl_mappings(uuid, uuid, jsonb) TO service_role;

-- 3. Updated RPC: authenticate_customer_api_key
-- Resolves user_id via COALESCE(user_id, created_by) so that any API request
-- carries the account of the user who owns or created the key.
CREATE OR REPLACE FUNCTION public.authenticate_customer_api_key(p_key_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_key record;
  v_company_ids uuid[];
  v_user_id uuid;
BEGIN
  -- 1. Find key
  SELECT id, company_id, user_id, created_by, scope, is_active, expires_at, rate_limit_per_minute, name
  INTO v_key
  FROM public.api_keys
  WHERE key_hash = p_key_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('authenticated', false, 'error', 'INVALID_API_KEY');
  END IF;

  IF NOT v_key.is_active THEN
    RETURN jsonb_build_object('authenticated', false, 'error', 'KEY_REVOKED');
  END IF;

  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < now() THEN
    RETURN jsonb_build_object('authenticated', false, 'error', 'KEY_EXPIRED');
  END IF;

  -- Update last_used_at timestamp
  UPDATE public.api_keys 
  SET last_used_at = now() 
  WHERE id = v_key.id;

  v_user_id := COALESCE(v_key.user_id, v_key.created_by);

  -- 2. Resolve accessible companies
  IF v_key.company_id IS NOT NULL THEN
    -- Single company scope
    v_company_ids := ARRAY[v_key.company_id];
  ELSIF v_user_id IS NOT NULL THEN
    -- User-level scope: all companies where user is owner or admin
    SELECT COALESCE(array_agg(company_id), '{}'::uuid[])
    INTO v_company_ids
    FROM public.company_members
    WHERE user_id = v_user_id
    AND role IN ('owner', 'admin');
  ELSE
    -- Project-wide key (OpenClaw / ThinkAI)
    SELECT COALESCE(array_agg(id), '{}'::uuid[])
    INTO v_company_ids
    FROM public.companies;
  END IF;

  RETURN jsonb_build_object(
    'authenticated', true,
    'key_id', v_key.id,
    'name', v_key.name,
    'user_id', v_user_id,
    'company_id', v_key.company_id,
    'scope', v_key.scope,
    'rate_limit_per_minute', v_key.rate_limit_per_minute,
    'accessible_company_ids', v_company_ids
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.authenticate_customer_api_key FROM anon, public;
GRANT EXECUTE ON FUNCTION public.authenticate_customer_api_key TO service_role;
