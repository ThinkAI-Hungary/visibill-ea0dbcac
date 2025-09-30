-- Drop and recreate save_nav_credentials with idempotent secret handling (delete by name before create)
DROP FUNCTION IF EXISTS public.save_nav_credentials(text, text, text, text, text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.save_nav_credentials(
  p_nav_username text,
  p_nav_password text,
  p_nav_tax_number text,
  p_nav_sign_key text,
  p_nav_exchange_key text,
  p_software_dev_name text DEFAULT NULL::text,
  p_software_dev_contact text DEFAULT NULL::text,
  p_is_test_environment boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_password_secret_id UUID;
  v_sign_key_secret_id UUID;
  v_exchange_key_secret_id UUID;
  v_software_id TEXT;
  v_existing_cred public.user_nav_credentials%ROWTYPE;
  v_password_name TEXT;
  v_sign_name TEXT;
  v_exchange_name TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate tax number (8 digits)
  IF p_nav_tax_number !~ '^\\d{8}$' THEN
    RAISE EXCEPTION 'Tax number must be 8 digits';
  END IF;

  -- Check if user already has credentials
  SELECT * INTO v_existing_cred
  FROM public.user_nav_credentials
  WHERE user_id = v_user_id;

  -- Prepare secret names scoped to user
  v_password_name := 'nav_password_' || v_user_id::text;
  v_sign_name := 'nav_sign_key_' || v_user_id::text;
  v_exchange_name := 'nav_exchange_key_' || v_user_id::text;

  -- Idempotent secret handling: delete by name if already present to avoid unique name conflict
  DELETE FROM vault.secrets WHERE name IN (v_password_name, v_sign_name, v_exchange_name);

  -- Create (replace) secrets
  v_password_secret_id := vault.create_secret(
    p_nav_password,
    v_password_name,
    'NAV password for user'
  );

  v_sign_key_secret_id := vault.create_secret(
    p_nav_sign_key,
    v_sign_name,
    'NAV sign key for user'
  );

  v_exchange_key_secret_id := vault.create_secret(
    p_nav_exchange_key,
    v_exchange_name,
    'NAV exchange key for user'
  );

  -- Preserve existing software_id if present, otherwise generate a new one
  IF FOUND AND v_existing_cred.software_id IS NOT NULL THEN
    v_software_id := v_existing_cred.software_id;
  ELSE
    v_software_id := 'HU' || p_nav_tax_number || substr(md5(random()::text), 1, 8);
    v_software_id := upper(substr(v_software_id, 1, 18));
  END IF;

  -- Upsert credentials
  INSERT INTO public.user_nav_credentials (
    user_id,
    nav_username,
    nav_tax_number,
    password_secret_id,
    sign_key_secret_id,
    exchange_key_secret_id,
    software_id,
    software_dev_name,
    software_dev_contact,
    is_test_environment,
    validation_status
  ) VALUES (
    v_user_id,
    p_nav_username,
    p_nav_tax_number,
    v_password_secret_id,
    v_sign_key_secret_id,
    v_exchange_key_secret_id,
    v_software_id,
    p_software_dev_name,
    p_software_dev_contact,
    p_is_test_environment,
    'pending'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    nav_username = EXCLUDED.nav_username,
    nav_tax_number = EXCLUDED.nav_tax_number,
    password_secret_id = EXCLUDED.password_secret_id,
    sign_key_secret_id = EXCLUDED.sign_key_secret_id,
    exchange_key_secret_id = EXCLUDED.exchange_key_secret_id,
    software_dev_name = EXCLUDED.software_dev_name,
    software_dev_contact = EXCLUDED.software_dev_contact,
    is_test_environment = EXCLUDED.is_test_environment,
    validation_status = 'pending',
    updated_at = NOW();

  RETURN json_build_object(
    'success', true,
    'message', 'Credentials saved successfully',
    'software_id', v_software_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error saving credentials: %', SQLERRM;
END;
$function$;