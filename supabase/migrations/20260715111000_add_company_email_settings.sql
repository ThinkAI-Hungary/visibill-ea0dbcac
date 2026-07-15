-- ============================================================
-- Company Email Settings (IMAP/SMTP) — Tables + RPC
-- ============================================================

-- ─── 1. company_email_settings ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_email_settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id                 uuid NOT NULL REFERENCES auth.users(id),
  
  -- IMAP Settings
  imap_host               text,
  imap_port               integer,
  imap_username           text,
  imap_password_secret_id uuid, -- Reference to vault.secrets.id
  imap_encryption         text, -- 'SSL/TLS', 'STARTTLS', 'NONE'
  imap_status             text NOT NULL DEFAULT 'pending', -- 'pending', 'valid', 'invalid', 'error'
  imap_last_validated_at  timestamptz,
  imap_validation_error   text,
  
  -- SMTP Settings
  smtp_host               text,
  smtp_port               integer,
  smtp_username           text,
  smtp_password_secret_id uuid, -- Reference to vault.secrets.id
  smtp_encryption         text, -- 'SSL/TLS', 'STARTTLS', 'NONE'
  smtp_status             text NOT NULL DEFAULT 'pending', -- 'pending', 'valid', 'invalid', 'error'
  smtp_last_validated_at  timestamptz,
  smtp_validation_error   text,
  
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_company_email_settings UNIQUE (company_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_email_settings_company_id 
  ON public.company_email_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_company_email_settings_user_id 
  ON public.company_email_settings(user_id);

-- Enable RLS
ALTER TABLE public.company_email_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: All company members can read settings
CREATE POLICY "Members can view company_email_settings"
  ON public.company_email_settings FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

-- Write operations are allowed for service_role (and SECURITY DEFINER RPCs)
CREATE POLICY "Service role manages company_email_settings"
  ON public.company_email_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ─── 2. RPC: save_company_email_settings ───────────────────────
CREATE OR REPLACE FUNCTION public.save_company_email_settings(
  p_company_id UUID,
  p_imap_host TEXT,
  p_imap_port INTEGER,
  p_imap_username TEXT,
  p_imap_password TEXT,
  p_imap_encryption TEXT,
  p_smtp_host TEXT,
  p_smtp_port INTEGER,
  p_smtp_username TEXT,
  p_smtp_password TEXT,
  p_smtp_encryption TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_existing_cred public.company_email_settings%ROWTYPE;
  v_imap_secret_id UUID := NULL;
  v_smtp_secret_id UUID := NULL;
  v_imap_secret_name TEXT;
  v_smtp_secret_name TEXT;
  v_is_owner BOOLEAN;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user is the owner of the company
  SELECT EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = p_company_id AND owner_id = v_user_id
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Csak a cég tulajdonosa mentheti az email beállításokat';
  END IF;

  -- Get existing settings
  SELECT * INTO v_existing_cred
  FROM public.company_email_settings
  WHERE company_id = p_company_id;

  -- Prepare secret names scoped to company
  v_imap_secret_name := 'imap_password_company_' || p_company_id::text;
  v_smtp_secret_name := 'smtp_password_company_' || p_company_id::text;

  -- 1. Manage IMAP Secret
  IF p_imap_password IS NOT NULL AND p_imap_password <> '' AND p_imap_password <> '***masked***' THEN
    -- Delete old secret if exists
    DELETE FROM vault.secrets WHERE name = v_imap_secret_name;
    -- Create new secret
    v_imap_secret_id := vault.create_secret(
      p_imap_password,
      v_imap_secret_name,
      'IMAP password for company email sync'
    );
  ELSIF FOUND AND v_existing_cred.imap_password_secret_id IS NOT NULL THEN
    -- Keep existing secret
    v_imap_secret_id := v_existing_cred.imap_password_secret_id;
  END IF;

  -- 2. Manage SMTP Secret
  IF p_smtp_password IS NOT NULL AND p_smtp_password <> '' AND p_smtp_password <> '***masked***' THEN
    -- Delete old secret if exists
    DELETE FROM vault.secrets WHERE name = v_smtp_secret_name;
    -- Create new secret
    v_smtp_secret_id := vault.create_secret(
      p_smtp_password,
      v_smtp_secret_name,
      'SMTP password for company email sending'
    );
  ELSIF FOUND AND v_existing_cred.smtp_password_secret_id IS NOT NULL THEN
    -- Keep existing secret
    v_smtp_secret_id := v_existing_cred.smtp_password_secret_id;
  END IF;

  -- 3. Upsert settings
  INSERT INTO public.company_email_settings (
    company_id,
    user_id,
    imap_host,
    imap_port,
    imap_username,
    imap_password_secret_id,
    imap_encryption,
    imap_status,
    smtp_host,
    smtp_port,
    smtp_username,
    smtp_password_secret_id,
    smtp_encryption,
    smtp_status,
    updated_at
  ) VALUES (
    p_company_id,
    v_user_id,
    p_imap_host,
    p_imap_port,
    p_imap_username,
    v_imap_secret_id,
    p_imap_encryption,
    CASE WHEN p_imap_host IS NOT NULL AND p_imap_host <> '' THEN 'pending'::text ELSE 'pending'::text END,
    p_smtp_host,
    p_smtp_port,
    p_smtp_username,
    v_smtp_secret_id,
    p_smtp_encryption,
    CASE WHEN p_smtp_host IS NOT NULL AND p_smtp_host <> '' THEN 'pending'::text ELSE 'pending'::text END,
    now()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    imap_host = EXCLUDED.imap_host,
    imap_port = EXCLUDED.imap_port,
    imap_username = EXCLUDED.imap_username,
    imap_password_secret_id = COALESCE(v_imap_secret_id, company_email_settings.imap_password_secret_id),
    imap_encryption = EXCLUDED.imap_encryption,
    imap_status = CASE WHEN company_email_settings.imap_host <> EXCLUDED.imap_host OR company_email_settings.imap_username <> EXCLUDED.imap_username OR v_imap_secret_id IS NOT NULL THEN 'pending'::text ELSE company_email_settings.imap_status END,
    smtp_host = EXCLUDED.smtp_host,
    smtp_port = EXCLUDED.smtp_port,
    smtp_username = EXCLUDED.smtp_username,
    smtp_password_secret_id = COALESCE(v_smtp_secret_id, company_email_settings.smtp_password_secret_id),
    smtp_encryption = EXCLUDED.smtp_encryption,
    smtp_status = CASE WHEN company_email_settings.smtp_host <> EXCLUDED.smtp_host OR company_email_settings.smtp_username <> EXCLUDED.smtp_username OR v_smtp_secret_id IS NOT NULL THEN 'pending'::text ELSE company_email_settings.smtp_status END,
    updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Revoke and Grant EXECUTE for save function
REVOKE EXECUTE ON FUNCTION public.save_company_email_settings(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_company_email_settings(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated;


-- ─── 3. RPC: delete_company_email_settings ─────────────────────
CREATE OR REPLACE FUNCTION public.delete_company_email_settings(
  p_company_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_imap_secret_name TEXT;
  v_smtp_secret_name TEXT;
  v_is_owner BOOLEAN;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user is the owner of the company
  SELECT EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = p_company_id AND owner_id = v_user_id
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Csak a cég tulajdonosa törölheti az email beállításokat';
  END IF;

  -- Prepare secret names scoped to company
  v_imap_secret_name := 'imap_password_company_' || p_company_id::text;
  v_smtp_secret_name := 'smtp_password_company_' || p_company_id::text;

  -- Delete secrets from Vault
  DELETE FROM vault.secrets WHERE name IN (v_imap_secret_name, v_smtp_secret_name);

  -- Delete from email settings table
  DELETE FROM public.company_email_settings WHERE company_id = p_company_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Revoke and Grant EXECUTE for delete function
REVOKE EXECUTE ON FUNCTION public.delete_company_email_settings(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_company_email_settings(UUID) TO authenticated;
