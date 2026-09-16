-- ============================================================================
-- Migration: Customer API & Multi-Company API Keys Support
-- Date: 2026-09-16
-- Description: 
--   1. Expands api_keys table with user_id and enhanced RLS for multi-company access.
--   2. Creates api_request_logs table for comprehensive M2M API audit trails.
--   3. Updates generate_api_key RPC to support user_id and read_write scopes.
--   4. Creates authenticate_customer_api_key RPC for high-performance Edge Function auth.
-- ============================================================================

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Expand api_keys table
ALTER TABLE public.api_keys 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill user_id from created_by where user_id is null
UPDATE public.api_keys 
SET user_id = created_by 
WHERE user_id IS NULL AND created_by IS NOT NULL;

-- Indexes on api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active_lookup ON public.api_keys(key_hash) WHERE is_active = true;

-- 3. Create api_request_logs table for API audit & debugging
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  ip_address text,
  user_agent text,
  request_params jsonb DEFAULT '{}'::jsonb,
  request_body jsonb,
  response_summary jsonb,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.api_request_logs IS 'Audit napló a külső gép-gép (M2M) API hívásokról és cégadat-módosításokról.';

-- Indexes on api_request_logs
CREATE INDEX IF NOT EXISTS idx_api_request_logs_api_key ON public.api_request_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_company ON public.api_request_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_user ON public.api_request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_created_at ON public.api_request_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any
DROP POLICY IF EXISTS "api_request_logs_select" ON public.api_request_logs;

-- RLS Policy: company owners/admins and the respective user or management can view their logs
CREATE POLICY "api_request_logs_select" ON public.api_request_logs
  FOR SELECT USING (
    (company_id IS NOT NULL AND company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid()) AND cm.role IN ('owner', 'admin')
    ))
    OR
    (user_id = (SELECT auth.uid()))
    OR
    (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND p.role IN ('thinkai', 'management')
    ))
  );

REVOKE ALL ON public.api_request_logs FROM anon;
GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;

-- 4. Update RLS policies on api_keys
DROP POLICY IF EXISTS "api_keys_company_admin" ON public.api_keys;

CREATE POLICY "api_keys_company_admin" ON public.api_keys
  FOR ALL USING (
    -- Direct owner of the key
    (user_id = (SELECT auth.uid()))
    OR
    (created_by = (SELECT auth.uid()))
    OR
    -- Company-scoped key: owner/admin of that company
    (company_id IS NOT NULL AND company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
      AND cm.role IN ('owner', 'admin')
    ))
    OR
    -- Project-wide keys (thinkai/management)
    (company_id IS NULL AND user_id IS NULL AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
      AND p.role IN ('thinkai', 'management')
    ))
  );

-- 5. Updated RPC: generate_api_key
DROP FUNCTION IF EXISTS public.generate_api_key(uuid, text);

CREATE OR REPLACE FUNCTION public.generate_api_key(
  p_company_id uuid DEFAULT NULL,
  p_name text DEFAULT 'Customer API Key',
  p_scope text DEFAULT 'read_write',
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_raw_key text;
  v_key_hash text;
  v_key_prefix text;
  v_key_id uuid;
  v_effective_user_id uuid;
  v_caller_is_admin boolean;
BEGIN
  -- Determine target user
  v_effective_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_effective_user_id IS NULL THEN
    RAISE EXCEPTION 'A kulcshoz felhasználói azonosító szükséges';
  END IF;

  -- Check if caller is management / thinkai
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role IN ('thinkai', 'management')
  ) INTO v_caller_is_admin;

  -- Permission check: Generating for another user requires thinkai/management role
  IF p_user_id IS NOT NULL AND p_user_id <> auth.uid() AND NOT v_caller_is_admin THEN
    RAISE EXCEPTION 'Más felhasználó részére történő kulcsgeneráláshoz thinkai adminisztrátori jogosultság szükséges';
  END IF;

  -- Check company permissions if company_id is provided
  IF p_company_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = p_company_id
      AND user_id = v_effective_user_id
      AND role IN ('owner', 'admin')
    ) AND NOT v_caller_is_admin THEN
      RAISE EXCEPTION 'Nincs adminisztrátori vagy tulajdonosi jogosultság a megadott céghez';
    END IF;
  ELSE
    -- User-level multi-company key: User must be owner/admin in at least one company or management
    IF NOT EXISTS (
      SELECT 1 FROM public.company_members
      WHERE user_id = v_effective_user_id
      AND role IN ('owner', 'admin')
    ) AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = v_effective_user_id
      AND role IN ('thinkai', 'management')
    ) THEN
      RAISE EXCEPTION 'A felhasználó nem rendelkezik egyetlen cégben sem tulajdonosi vagy adminisztrátori jogosultsággal';
    END IF;
  END IF;

  -- Validate scope
  IF p_scope NOT IN ('read', 'read_write') THEN
    RAISE EXCEPTION 'Érvénytelen scope: %, megengedett értékek: read, read_write', p_scope;
  END IF;

  -- Generate secure random raw key: vb_ prefix + 40 hex chars (20 random bytes)
  v_raw_key := 'vb_' || encode(gen_random_bytes(20), 'hex');
  v_key_hash := encode(digest(v_raw_key, 'sha256'), 'hex');
  v_key_prefix := left(v_raw_key, 11);

  -- Insert key record
  INSERT INTO public.api_keys (
    company_id,
    user_id,
    created_by,
    key_hash,
    key_prefix,
    name,
    scope,
    is_active
  )
  VALUES (
    p_company_id,
    v_effective_user_id,
    COALESCE(auth.uid(), v_effective_user_id),
    v_key_hash,
    v_key_prefix,
    p_name,
    p_scope,
    true
  )
  RETURNING id INTO v_key_id;

  -- Return raw key ONCE
  RETURN jsonb_build_object(
    'id', v_key_id,
    'api_key', v_raw_key,
    'prefix', v_key_prefix,
    'name', p_name,
    'scope', p_scope,
    'user_id', v_effective_user_id,
    'company_id', p_company_id,
    'warning', 'Ez a nyers API kulcs CSAK MOST látható! Mentsd el biztonságos helyre, mert a szerver kizárólag a titkosított lenyomatot tárolja.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_api_key FROM anon, public;
GRANT EXECUTE ON FUNCTION public.generate_api_key TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_api_key TO service_role;

-- 6. RPC: authenticate_customer_api_key
-- Fast single-query authentication & scope resolution for Edge Functions
CREATE OR REPLACE FUNCTION public.authenticate_customer_api_key(p_key_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_key record;
  v_company_ids uuid[];
BEGIN
  -- 1. Find key
  SELECT id, company_id, user_id, scope, is_active, expires_at, rate_limit_per_minute, name
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

  -- 2. Resolve accessible companies
  IF v_key.company_id IS NOT NULL THEN
    -- Single company scope
    v_company_ids := ARRAY[v_key.company_id];
  ELSIF v_key.user_id IS NOT NULL THEN
    -- User-level scope: all companies where user is owner or admin
    SELECT COALESCE(array_agg(company_id), '{}'::uuid[])
    INTO v_company_ids
    FROM public.company_members
    WHERE user_id = v_key.user_id
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
    'user_id', v_key.user_id,
    'company_id', v_key.company_id,
    'scope', v_key.scope,
    'rate_limit_per_minute', v_key.rate_limit_per_minute,
    'accessible_company_ids', v_company_ids
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.authenticate_customer_api_key FROM anon, public;
GRANT EXECUTE ON FUNCTION public.authenticate_customer_api_key TO service_role;

-- 7. Updated RPC: revoke_api_key
-- Allows key owner (user_id / created_by), company admin, or thinkai/management to revoke
CREATE OR REPLACE FUNCTION public.revoke_api_key(p_key_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.api_keys
  SET is_active = false, updated_at = now()
  WHERE id = p_key_id
  AND (
    (user_id = auth.uid())
    OR
    (created_by = auth.uid())
    OR
    (company_id IS NOT NULL AND company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin', 'support_admin')
    ))
    OR
    (company_id IS NULL AND EXISTS (
      SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('thinkai', 'management')
    ))
  );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'API kulcs nem talalhato vagy nincs jogosultsag';
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'API kulcs visszavonva');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_api_key FROM anon, public;
GRANT EXECUTE ON FUNCTION public.revoke_api_key TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_api_key TO service_role;
