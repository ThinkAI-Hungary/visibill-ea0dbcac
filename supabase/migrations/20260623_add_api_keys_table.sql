-- ============================================================================
-- Migration: API Keys table for external integrations (OpenClaw)
-- Date: 2026-06-23
-- Description: Adds api_keys table with SHA-256 hashed keys for secure
--              external API access. Supports company-scoped and project-wide keys.
-- ============================================================================

-- Ensure pgcrypto is available (for digest function)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- API Keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,  -- NULL = project-wide access
  created_by uuid,                                -- auth.uid() who created it
  key_hash text NOT NULL,                         -- SHA-256 hash (raw key NEVER stored)
  key_prefix text NOT NULL,                       -- first 11 chars (vb_xxxxxxxx) for display
  name text NOT NULL DEFAULT 'API Key',
  scope text NOT NULL DEFAULT 'read',             -- 'read' | 'read_write' (future)
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,                         -- NULL = no expiry
  rate_limit_per_minute integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Comment
COMMENT ON TABLE public.api_keys IS 'API kulcsok külső integrációkhoz (OpenClaw). A nyers kulcs soha nem tárolódik, csak SHA-256 hash.';

-- RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: owner/admin can manage their company keys
CREATE POLICY "api_keys_company_admin" ON public.api_keys
  FOR ALL USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
      AND cm.role IN ('owner', 'admin')
    )
    OR
    -- Project-wide keys (company_id IS NULL): only thinkai/management can manage
    (company_id IS NULL AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
      AND p.role IN ('thinkai', 'management')
    ))
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_company_id ON public.api_keys(company_id);

-- Grants
REVOKE ALL ON public.api_keys FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

-- ============================================================================
-- RPC: generate_api_key — generates a new API key and returns the raw key ONCE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_api_key(
  p_company_id uuid DEFAULT NULL,
  p_name text DEFAULT 'OpenClaw API Key'
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
BEGIN
  -- Permission check: owner/admin for company keys, thinkai for project-wide
  IF p_company_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    ) THEN
      RAISE EXCEPTION 'Nincs jogosultság API kulcs generáláshoz ehhez a céghez';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('thinkai', 'management')
    ) THEN
      RAISE EXCEPTION 'Projekt-szintű API kulcs generálásához thinkai jogosultság szükséges';
    END IF;
  END IF;

  -- Generate key: vb_ prefix + 40 hex characters (20 random bytes)
  v_raw_key := 'vb_' || encode(gen_random_bytes(20), 'hex');
  v_key_hash := encode(digest(v_raw_key, 'sha256'), 'hex');
  v_key_prefix := left(v_raw_key, 11);

  -- Insert
  INSERT INTO api_keys (company_id, created_by, key_hash, key_prefix, name)
  VALUES (p_company_id, auth.uid(), v_key_hash, v_key_prefix, p_name)
  RETURNING id INTO v_key_id;

  -- Return the raw key ONCE — it cannot be retrieved again
  RETURN jsonb_build_object(
    'id', v_key_id,
    'api_key', v_raw_key,
    'prefix', v_key_prefix,
    'name', p_name,
    'company_id', p_company_id,
    'warning', 'Ez a kulcs CSAK MOST jelenik meg! Mentsd el biztonságos helyre.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_api_key FROM anon, public;
GRANT EXECUTE ON FUNCTION public.generate_api_key TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_api_key TO service_role;

-- ============================================================================
-- RPC: revoke_api_key — deactivates an API key
-- ============================================================================
CREATE OR REPLACE FUNCTION public.revoke_api_key(p_key_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE api_keys
  SET is_active = false, updated_at = now()
  WHERE id = p_key_id
  AND (
    -- Company key: owner/admin
    (company_id IS NOT NULL AND company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin')
    ))
    OR
    -- Project-wide key: thinkai
    (company_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('thinkai', 'management')
    ))
  );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'API kulcs nem található vagy nincs jogosultság';
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'API kulcs visszavonva');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_api_key FROM anon, public;
GRANT EXECUTE ON FUNCTION public.revoke_api_key TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_api_key TO service_role;
