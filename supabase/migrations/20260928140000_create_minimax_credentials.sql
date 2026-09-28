-- ==============================================================================
-- Migration: 20260928140000_create_minimax_credentials.sql
-- Description:
--   1. Create company_minimax_credentials table for Croatian company Minimax API sync
--   2. Create minimax_sync_logs table for audit & telemetry
--   3. Create RPC functions: save_minimax_credentials, get_minimax_credentials, disconnect_minimax_credentials
--   4. Strict RLS multi-tenancy policies (company_members)
-- ==============================================================================

-- 1. Create company_minimax_credentials table
CREATE TABLE IF NOT EXISTS public.company_minimax_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  minimax_username text NOT NULL,
  minimax_password text NOT NULL,
  organisation_id text,
  organisation_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  is_test_environment boolean DEFAULT false,
  auto_sync_enabled boolean DEFAULT true,
  sync_frequency text DEFAULT 'daily',
  validation_status text DEFAULT 'pending',
  validation_error text,
  last_validated_at timestamptz,
  last_synced_at timestamptz,
  last_sync_result jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_company_minimax_credentials_company UNIQUE (company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_minimax_credentials_company_id 
  ON public.company_minimax_credentials(company_id);

-- 2. Create minimax_sync_logs table
CREATE TABLE IF NOT EXISTS public.minimax_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  direction text NOT NULL,
  status text NOT NULL,
  invoices_fetched integer DEFAULT 0,
  invoices_saved integer DEFAULT 0,
  date_from date,
  date_to date,
  error_message text,
  sync_duration_ms integer,
  sync_type text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_minimax_sync_logs_company_id 
  ON public.minimax_sync_logs(company_id, created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.company_minimax_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minimax_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view company Minimax credentials" ON public.company_minimax_credentials;
CREATE POLICY "Members can view company Minimax credentials"
  ON public.company_minimax_credentials FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_minimax_credentials.company_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can manage company Minimax credentials" ON public.company_minimax_credentials;
CREATE POLICY "Members can manage company Minimax credentials"
  ON public.company_minimax_credentials FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_minimax_credentials.company_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can view minimax sync logs" ON public.minimax_sync_logs;
CREATE POLICY "Members can view minimax sync logs"
  ON public.minimax_sync_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = minimax_sync_logs.company_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages minimax sync logs" ON public.minimax_sync_logs;
CREATE POLICY "Service role manages minimax sync logs"
  ON public.minimax_sync_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. RPC save_minimax_credentials
CREATE OR REPLACE FUNCTION public.save_minimax_credentials(
  p_company_id uuid,
  p_username text,
  p_password text,
  p_organisation_id text DEFAULT NULL,
  p_organisation_name text DEFAULT NULL,
  p_is_test boolean DEFAULT false,
  p_auto_sync boolean DEFAULT true,
  p_sync_frequency text DEFAULT 'daily'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_has_access boolean;
  v_res_id uuid;
BEGIN
  -- Verify user has permission to manage company
  SELECT EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = p_company_id
      AND cm.user_id = v_user_id
  ) INTO v_has_access;

  -- Allow service role (when v_user_id is null) or company members
  IF v_user_id IS NOT NULL AND NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied for company %', p_company_id;
  END IF;

  INSERT INTO public.company_minimax_credentials (
    company_id,
    user_id,
    minimax_username,
    minimax_password,
    organisation_id,
    organisation_name,
    is_test_environment,
    auto_sync_enabled,
    sync_frequency,
    validation_status,
    validation_error,
    last_validated_at,
    updated_at
  ) VALUES (
    p_company_id,
    v_user_id,
    TRIM(p_username),
    p_password,
    p_organisation_id,
    p_organisation_name,
    COALESCE(p_is_test, false),
    COALESCE(p_auto_sync, true),
    COALESCE(p_sync_frequency, 'daily'),
    'pending',
    NULL,
    now(),
    now()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    minimax_username = EXCLUDED.minimax_username,
    minimax_password = EXCLUDED.minimax_password,
    organisation_id = COALESCE(EXCLUDED.organisation_id, company_minimax_credentials.organisation_id),
    organisation_name = COALESCE(EXCLUDED.organisation_name, company_minimax_credentials.organisation_name),
    is_test_environment = EXCLUDED.is_test_environment,
    auto_sync_enabled = EXCLUDED.auto_sync_enabled,
    sync_frequency = EXCLUDED.sync_frequency,
    validation_status = 'pending',
    updated_at = now()
  RETURNING id INTO v_res_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_res_id,
    'company_id', p_company_id,
    'validation_status', 'pending'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.save_minimax_credentials TO authenticated, service_role;

-- 5. RPC get_minimax_credentials (safe, masks password)
CREATE OR REPLACE FUNCTION public.get_minimax_credentials(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rec RECORD;
BEGIN
  SELECT
    id,
    company_id,
    minimax_username,
    organisation_id,
    organisation_name,
    is_test_environment,
    auto_sync_enabled,
    sync_frequency,
    validation_status,
    validation_error,
    last_validated_at,
    last_synced_at,
    last_sync_result,
    (minimax_password IS NOT NULL AND length(minimax_password) > 0) AS has_password,
    created_at,
    updated_at
  INTO v_rec
  FROM public.company_minimax_credentials
  WHERE company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  RETURN jsonb_build_object(
    'exists', true,
    'id', v_rec.id,
    'company_id', v_rec.company_id,
    'minimax_username', v_rec.minimax_username,
    'organisation_id', v_rec.organisation_id,
    'organisation_name', v_rec.organisation_name,
    'is_test_environment', v_rec.is_test_environment,
    'auto_sync_enabled', v_rec.auto_sync_enabled,
    'sync_frequency', v_rec.sync_frequency,
    'validation_status', v_rec.validation_status,
    'validation_error', v_rec.validation_error,
    'last_validated_at', v_rec.last_validated_at,
    'last_synced_at', v_rec.last_synced_at,
    'last_sync_result', v_rec.last_sync_result,
    'has_password', v_rec.has_password
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_minimax_credentials TO authenticated, service_role;

-- 6. RPC disconnect_minimax_credentials
CREATE OR REPLACE FUNCTION public.disconnect_minimax_credentials(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.company_minimax_credentials
  WHERE company_id = p_company_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.disconnect_minimax_credentials TO authenticated, service_role;
