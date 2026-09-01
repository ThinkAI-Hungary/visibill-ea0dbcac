-- ==============================================================================
-- Migration: Multi-profile Company Email Accounts (IMAP & SMTP)
-- Date: 2026-08-27
-- Description:
--   1. Creates `public.company_email_accounts` table supporting multiple email profiles per company.
--   2. Secures table with Row Level Security (RLS) policies.
--   3. Creates indexes for performance.
--   4. Adds SECURITY DEFINER RPC functions with Supabase Vault password encryption/decryption:
--      - save_company_email_account
--      - delete_company_email_account
--      - set_default_company_email_account
--      - get_company_email_accounts
--      - get_single_email_account
--      - get_default_company_smtp
--      - get_active_imap_accounts
--      - get_company_email_settings (backward compatibility wrapper)
-- ==============================================================================

-- ─── 1. Table Creation ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Levelező fiók',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default_smtp BOOLEAN NOT NULL DEFAULT false,
  is_default_imap BOOLEAN NOT NULL DEFAULT false,
  
  -- IMAP Settings
  is_imap_enabled BOOLEAN NOT NULL DEFAULT true,
  imap_host TEXT,
  imap_port INTEGER DEFAULT 993,
  imap_username TEXT,
  imap_password_secret_id UUID REFERENCES vault.secrets(id) ON DELETE SET NULL,
  imap_encryption TEXT DEFAULT 'SSL/TLS',
  imap_status TEXT NOT NULL DEFAULT 'pending' CHECK (imap_status IN ('pending', 'valid', 'invalid', 'error')),
  imap_last_synced_at TIMESTAMPTZ,
  imap_last_validated_at TIMESTAMPTZ,
  imap_validation_error TEXT,

  -- SMTP Settings
  is_smtp_enabled BOOLEAN NOT NULL DEFAULT true,
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 465,
  smtp_username TEXT,
  smtp_password_secret_id UUID REFERENCES vault.secrets(id) ON DELETE SET NULL,
  smtp_encryption TEXT DEFAULT 'SSL/TLS',
  smtp_status TEXT NOT NULL DEFAULT 'pending' CHECK (smtp_status IN ('pending', 'valid', 'invalid', 'error')),
  smtp_last_validated_at TIMESTAMPTZ,
  smtp_validation_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_company_email_accounts_company_id 
  ON public.company_email_accounts(company_id);

CREATE INDEX IF NOT EXISTS idx_company_email_accounts_active_imap 
  ON public.company_email_accounts(is_active, is_imap_enabled) 
  WHERE is_active = true AND is_imap_enabled = true;

CREATE INDEX IF NOT EXISTS idx_company_email_accounts_default_smtp 
  ON public.company_email_accounts(company_id, is_default_smtp) 
  WHERE is_default_smtp = true;

-- ─── 3. Row Level Security (RLS) ───────────────────────────────
ALTER TABLE public.company_email_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view company email accounts" ON public.company_email_accounts;
CREATE POLICY "Company members can view company email accounts"
  ON public.company_email_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = company_email_accounts.company_id
        AND company_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company owners and admins can manage company email accounts" ON public.company_email_accounts;
CREATE POLICY "Company owners and admins can manage company email accounts"
  ON public.company_email_accounts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.companies
      WHERE companies.id = company_email_accounts.company_id
        AND companies.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = company_email_accounts.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies
      WHERE companies.id = company_email_accounts.company_id
        AND companies.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = company_email_accounts.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.role IN ('owner', 'admin')
    )
  );


-- ─── 4. RPC: save_company_email_account ────────────────────────
CREATE OR REPLACE FUNCTION public.save_company_email_account(
  p_company_id UUID,
  p_name TEXT,
  p_is_active BOOLEAN,
  p_is_default_smtp BOOLEAN,
  p_is_default_imap BOOLEAN,
  p_is_imap_enabled BOOLEAN,
  p_imap_host TEXT,
  p_imap_port INTEGER,
  p_imap_username TEXT,
  p_imap_password TEXT,
  p_imap_encryption TEXT,
  p_is_smtp_enabled BOOLEAN,
  p_smtp_host TEXT,
  p_smtp_port INTEGER,
  p_smtp_username TEXT,
  p_smtp_password TEXT,
  p_smtp_encryption TEXT,
  p_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_imap_secret_id UUID;
  v_smtp_secret_id UUID;
  v_existing public.company_email_accounts%ROWTYPE;
  v_has_access BOOLEAN;
  v_is_first_account BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_id = v_user_id
    UNION
    SELECT 1 FROM public.company_members WHERE company_id = p_company_id AND user_id = v_user_id AND role IN ('owner', 'admin')
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Csak a cég tulajdonosa vagy adminisztrátora kezelheti a levelező fiókokat';
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.company_email_accounts 
    WHERE company_id = p_company_id AND (p_id IS NULL OR id != p_id)
  ) INTO v_is_first_account;

  IF p_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.company_email_accounts WHERE id = p_id AND company_id = p_company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A megadott e-mail fiók nem található';
    END IF;
    v_account_id := p_id;
    v_imap_secret_id := v_existing.imap_password_secret_id;
    v_smtp_secret_id := v_existing.smtp_password_secret_id;
  ELSE
    v_account_id := gen_random_uuid();
  END IF;

  IF p_imap_password IS NOT NULL AND p_imap_password != '' AND p_imap_password != '***masked***' THEN
    IF v_imap_secret_id IS NOT NULL THEN
      DELETE FROM vault.secrets WHERE id = v_imap_secret_id;
    END IF;
    v_imap_secret_id := vault.create_secret(
      p_imap_password,
      'imap_password_account_' || v_account_id::text,
      'IMAP jelszó az account ' || v_account_id::text || ' fiókhoz'
    );
  END IF;

  IF p_smtp_password IS NOT NULL AND p_smtp_password != '' AND p_smtp_password != '***masked***' THEN
    IF v_smtp_secret_id IS NOT NULL THEN
      DELETE FROM vault.secrets WHERE id = v_smtp_secret_id;
    END IF;
    v_smtp_secret_id := vault.create_secret(
      p_smtp_password,
      'smtp_password_account_' || v_account_id::text,
      'SMTP jelszó az account ' || v_account_id::text || ' fiókhoz'
    );
  END IF;

  IF p_is_default_smtp THEN
    UPDATE public.company_email_accounts
    SET is_default_smtp = false
    WHERE company_id = p_company_id AND id != v_account_id;
  END IF;

  IF p_is_default_imap THEN
    UPDATE public.company_email_accounts
    SET is_default_imap = false
    WHERE company_id = p_company_id AND id != v_account_id;
  END IF;

  INSERT INTO public.company_email_accounts (
    id,
    company_id,
    user_id,
    name,
    is_active,
    is_default_smtp,
    is_default_imap,
    is_imap_enabled,
    imap_host,
    imap_port,
    imap_username,
    imap_password_secret_id,
    imap_encryption,
    imap_status,
    is_smtp_enabled,
    smtp_host,
    smtp_port,
    smtp_username,
    smtp_password_secret_id,
    smtp_encryption,
    smtp_status
  ) VALUES (
    v_account_id,
    p_company_id,
    v_user_id,
    COALESCE(NULLIF(p_name, ''), 'Levelező fiók'),
    COALESCE(p_is_active, true),
    COALESCE(p_is_default_smtp, false),
    COALESCE(p_is_default_imap, false),
    COALESCE(p_is_imap_enabled, true),
    p_imap_host,
    p_imap_port,
    p_imap_username,
    v_imap_secret_id,
    COALESCE(p_imap_encryption, 'SSL/TLS'),
    'pending',
    COALESCE(p_is_smtp_enabled, true),
    p_smtp_host,
    p_smtp_port,
    p_smtp_username,
    v_smtp_secret_id,
    COALESCE(p_smtp_encryption, 'SSL/TLS'),
    'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    is_default_smtp = EXCLUDED.is_default_smtp,
    is_default_imap = EXCLUDED.is_default_imap,
    is_imap_enabled = EXCLUDED.is_imap_enabled,
    imap_host = EXCLUDED.imap_host,
    imap_port = EXCLUDED.imap_port,
    imap_username = EXCLUDED.imap_username,
    imap_password_secret_id = COALESCE(v_imap_secret_id, company_email_accounts.imap_password_secret_id),
    imap_encryption = EXCLUDED.imap_encryption,
    is_smtp_enabled = EXCLUDED.is_smtp_enabled,
    smtp_host = EXCLUDED.smtp_host,
    smtp_port = EXCLUDED.smtp_port,
    smtp_username = EXCLUDED.smtp_username,
    smtp_password_secret_id = COALESCE(v_smtp_secret_id, company_email_accounts.smtp_password_secret_id),
    smtp_encryption = EXCLUDED.smtp_encryption,
    updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'account_id', v_account_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.save_company_email_account FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_company_email_account TO authenticated;


-- ─── 5. RPC: delete_company_email_account ──────────────────────
CREATE OR REPLACE FUNCTION public.delete_company_email_account(
  p_account_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_account public.company_email_accounts%ROWTYPE;
  v_has_access BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_account
  FROM public.company_email_accounts
  WHERE id = p_account_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'Account not found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.companies WHERE id = v_account.company_id AND owner_id = v_user_id
    UNION
    SELECT 1 FROM public.company_members WHERE company_id = v_account.company_id AND user_id = v_user_id AND role IN ('owner', 'admin')
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Csak a cég tulajdonosa vagy adminisztrátora törölheti a fiókot';
  END IF;

  IF v_account.imap_password_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_account.imap_password_secret_id;
  END IF;

  IF v_account.smtp_password_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_account.smtp_password_secret_id;
  END IF;

  DELETE FROM public.company_email_accounts WHERE id = p_account_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_company_email_account FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_company_email_account TO authenticated;


-- ─── 6. RPC: set_default_company_email_account ─────────────────
CREATE OR REPLACE FUNCTION public.set_default_company_email_account(
  p_account_id UUID,
  p_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_account public.company_email_accounts%ROWTYPE;
  v_has_access BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_account
  FROM public.company_email_accounts
  WHERE id = p_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fiók nem található';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.companies WHERE id = v_account.company_id AND owner_id = v_user_id
    UNION
    SELECT 1 FROM public.company_members WHERE company_id = v_account.company_id AND user_id = v_user_id AND role IN ('owner', 'admin')
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Csak a cég tulajdonosa vagy adminisztrátora módosíthatja az alapértelmezett fiókot';
  END IF;

  IF p_type IN ('smtp', 'both') THEN
    UPDATE public.company_email_accounts
    SET is_default_smtp = (id = p_account_id)
    WHERE company_id = v_account.company_id;
  END IF;

  IF p_type IN ('imap', 'both') THEN
    UPDATE public.company_email_accounts
    SET is_default_imap = (id = p_account_id)
    WHERE company_id = v_account.company_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_default_company_email_account FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_default_company_email_account TO authenticated;


-- ─── 7. RPC: get_company_email_accounts (Decrypted) ────────────
CREATE OR REPLACE FUNCTION public.get_company_email_accounts(
  p_company_id UUID
)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  user_id UUID,
  name TEXT,
  is_active BOOLEAN,
  is_default_smtp BOOLEAN,
  is_default_imap BOOLEAN,
  is_imap_enabled BOOLEAN,
  imap_host TEXT,
  imap_port INTEGER,
  imap_username TEXT,
  imap_password TEXT,
  imap_encryption TEXT,
  imap_status TEXT,
  imap_last_synced_at TIMESTAMPTZ,
  imap_last_validated_at TIMESTAMPTZ,
  imap_validation_error TEXT,
  is_smtp_enabled BOOLEAN,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password TEXT,
  smtp_encryption TEXT,
  smtp_status TEXT,
  smtp_last_validated_at TIMESTAMPTZ,
  smtp_validation_error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_is_member BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.company_id = p_company_id AND m.user_id = v_user_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
      RAISE EXCEPTION 'Nincs jogosultságod a cég levelező fiókjainak megtekintéséhez';
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    a.id,
    a.company_id,
    a.user_id,
    a.name,
    a.is_active,
    a.is_default_smtp,
    a.is_default_imap,
    a.is_imap_enabled,
    a.imap_host,
    a.imap_port,
    a.imap_username,
    (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.id = a.imap_password_secret_id),
    a.imap_encryption,
    a.imap_status,
    a.imap_last_synced_at,
    a.imap_last_validated_at,
    a.imap_validation_error,
    a.is_smtp_enabled,
    a.smtp_host,
    a.smtp_port,
    a.smtp_username,
    (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.id = a.smtp_password_secret_id),
    a.smtp_encryption,
    a.smtp_status,
    a.smtp_last_validated_at,
    a.smtp_validation_error,
    a.created_at,
    a.updated_at
  FROM public.company_email_accounts a
  WHERE a.company_id = p_company_id
  ORDER BY a.is_default_smtp DESC, a.created_at ASC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_company_email_accounts(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_company_email_accounts(UUID) TO authenticated, service_role;


-- ─── 8. RPC: get_single_email_account (Decrypted) ──────────────
CREATE OR REPLACE FUNCTION public.get_single_email_account(
  p_account_id UUID
)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  user_id UUID,
  name TEXT,
  is_active BOOLEAN,
  is_default_smtp BOOLEAN,
  is_default_imap BOOLEAN,
  is_imap_enabled BOOLEAN,
  imap_host TEXT,
  imap_port INTEGER,
  imap_username TEXT,
  imap_password TEXT,
  imap_encryption TEXT,
  imap_status TEXT,
  imap_last_synced_at TIMESTAMPTZ,
  imap_last_validated_at TIMESTAMPTZ,
  imap_validation_error TEXT,
  is_smtp_enabled BOOLEAN,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password TEXT,
  smtp_encryption TEXT,
  smtp_status TEXT,
  smtp_last_validated_at TIMESTAMPTZ,
  smtp_validation_error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_comp_id UUID;
  v_is_member BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  SELECT a.company_id INTO v_comp_id
  FROM public.company_email_accounts a
  WHERE a.id = p_account_id;

  IF v_comp_id IS NULL THEN
    RETURN;
  END IF;

  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.company_id = v_comp_id AND m.user_id = v_user_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
      RAISE EXCEPTION 'Nincs jogosultságod ezen fiók megtekintéséhez';
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    a.id,
    a.company_id,
    a.user_id,
    a.name,
    a.is_active,
    a.is_default_smtp,
    a.is_default_imap,
    a.is_imap_enabled,
    a.imap_host,
    a.imap_port,
    a.imap_username,
    (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.id = a.imap_password_secret_id),
    a.imap_encryption,
    a.imap_status,
    a.imap_last_synced_at,
    a.imap_last_validated_at,
    a.imap_validation_error,
    a.is_smtp_enabled,
    a.smtp_host,
    a.smtp_port,
    a.smtp_username,
    (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.id = a.smtp_password_secret_id),
    a.smtp_encryption,
    a.smtp_status,
    a.smtp_last_validated_at,
    a.smtp_validation_error,
    a.created_at,
    a.updated_at
  FROM public.company_email_accounts a
  WHERE a.id = p_account_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_single_email_account(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_single_email_account(UUID) TO authenticated, service_role;


-- ─── 9. RPC: get_default_company_smtp (Decrypted) ──────────────
CREATE OR REPLACE FUNCTION public.get_default_company_smtp(
  p_company_id UUID
)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  name TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password TEXT,
  smtp_encryption TEXT,
  smtp_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.company_id,
    a.name,
    a.smtp_host,
    a.smtp_port,
    a.smtp_username,
    (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.id = a.smtp_password_secret_id),
    a.smtp_encryption,
    a.smtp_status
  FROM public.company_email_accounts a
  WHERE a.company_id = p_company_id
    AND a.is_active = true
    AND a.is_smtp_enabled = true
    AND a.smtp_host IS NOT NULL
  ORDER BY a.is_default_smtp DESC, a.created_at ASC
  LIMIT 1;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_default_company_smtp(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_default_company_smtp(UUID) TO authenticated, service_role;


-- ─── 10. RPC: get_active_imap_accounts (Decrypted for Worker) ──
CREATE OR REPLACE FUNCTION public.get_active_imap_accounts()
RETURNS TABLE (
  account_id UUID,
  company_id UUID,
  user_id UUID,
  name TEXT,
  imap_host TEXT,
  imap_port INTEGER,
  imap_username TEXT,
  imap_password TEXT,
  imap_encryption TEXT,
  imap_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    a.id AS account_id,
    a.company_id,
    a.user_id,
    a.name,
    a.imap_host,
    a.imap_port,
    a.imap_username,
    (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.id = a.imap_password_secret_id),
    a.imap_encryption,
    a.imap_status
  FROM public.company_email_accounts a
  WHERE a.is_active = true
    AND a.is_imap_enabled = true
    AND a.imap_host IS NOT NULL
    AND a.imap_username IS NOT NULL
  ORDER BY a.company_id, a.is_default_imap DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_active_imap_accounts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_active_imap_accounts() TO service_role;


-- ─── 11. Backward Compatibility Wrapper for get_company_email_settings
CREATE OR REPLACE FUNCTION public.get_company_email_settings(
  p_company_id UUID
)
RETURNS TABLE (
  company_id UUID,
  imap_host TEXT,
  imap_port INTEGER,
  imap_username TEXT,
  imap_password TEXT,
  imap_encryption TEXT,
  imap_status TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password TEXT,
  smtp_encryption TEXT,
  smtp_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    a.company_id,
    a.imap_host,
    a.imap_port,
    a.imap_username,
    (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.id = a.imap_password_secret_id),
    a.imap_encryption,
    a.imap_status,
    a.smtp_host,
    a.smtp_port,
    a.smtp_username,
    (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.id = a.smtp_password_secret_id),
    a.smtp_encryption,
    a.smtp_status
  FROM public.company_email_accounts a
  WHERE a.company_id = p_company_id
    AND a.is_active = true
  ORDER BY a.is_default_smtp DESC, a.is_default_imap DESC, a.created_at ASC
  LIMIT 1;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_company_email_settings(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_company_email_settings(UUID) TO authenticated, service_role;
