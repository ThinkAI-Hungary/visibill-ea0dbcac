-- Drop and recreate the save_nav_credentials function with proper upsert logic
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
  v_existing_cred RECORD;
  v_secret_name TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Validate tax number (8 digits)
  IF p_nav_tax_number !~ '^\d{8}$' THEN
    RAISE EXCEPTION 'Tax number must be 8 digits';
  END IF;
  
  -- Check if user already has credentials
  SELECT * INTO v_existing_cred
  FROM public.user_nav_credentials
  WHERE user_id = v_user_id;
  
  -- If credentials exist, delete old secrets from Vault
  IF FOUND THEN
    -- Delete existing password secret
    IF v_existing_cred.password_secret_id IS NOT NULL THEN
      DELETE FROM vault.secrets WHERE id = v_existing_cred.password_secret_id;
    END IF;
    
    -- Delete existing sign key secret
    IF v_existing_cred.sign_key_secret_id IS NOT NULL THEN
      DELETE FROM vault.secrets WHERE id = v_existing_cred.sign_key_secret_id;
    END IF;
    
    -- Delete existing exchange key secret
    IF v_existing_cred.exchange_key_secret_id IS NOT NULL THEN
      DELETE FROM vault.secrets WHERE id = v_existing_cred.exchange_key_secret_id;
    END IF;
  END IF;
  
  -- Generate software ID
  v_software_id := 'HU' || p_nav_tax_number || substr(md5(random()::text), 1, 8);
  v_software_id := upper(substr(v_software_id, 1, 18));
  
  -- Store new secrets in Vault
  v_password_secret_id := vault.create_secret(
    p_nav_password,
    'nav_password_' || v_user_id::text,
    'NAV password for user'
  );
  
  v_sign_key_secret_id := vault.create_secret(
    p_nav_sign_key,
    'nav_sign_key_' || v_user_id::text,
    'NAV sign key for user'
  );
  
  v_exchange_key_secret_id := vault.create_secret(
    p_nav_exchange_key,
    'nav_exchange_key_' || v_user_id::text,
    'NAV exchange key for user'
  );
  
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