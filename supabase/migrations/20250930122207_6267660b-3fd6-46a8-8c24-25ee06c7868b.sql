-- Fix security warning: Function Search Path Mutable
-- Update functions to have immutable search_path

CREATE OR REPLACE FUNCTION save_nav_credentials(
  p_nav_username TEXT,
  p_nav_password TEXT,
  p_nav_tax_number TEXT,
  p_nav_sign_key TEXT,
  p_nav_exchange_key TEXT,
  p_software_dev_name TEXT DEFAULT NULL,
  p_software_dev_contact TEXT DEFAULT NULL,
  p_is_test_environment BOOLEAN DEFAULT true
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_password_secret_id UUID;
  v_sign_key_secret_id UUID;
  v_exchange_key_secret_id UUID;
  v_software_id TEXT;
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
  
  -- Generate software ID
  v_software_id := 'HU' || p_nav_tax_number || substr(md5(random()::text), 1, 8);
  v_software_id := upper(substr(v_software_id, 1, 18));
  
  -- Store secrets in Vault
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
END;
$$;

CREATE OR REPLACE FUNCTION get_nav_credentials(p_user_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_cred RECORD;
  v_password TEXT;
  v_sign_key TEXT;
  v_exchange_key TEXT;
BEGIN
  -- Get credentials
  SELECT * INTO v_cred
  FROM public.user_nav_credentials
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Credentials not found');
  END IF;
  
  -- Decrypt from Vault
  SELECT decrypted_secret INTO v_password
  FROM vault.decrypted_secrets
  WHERE id = v_cred.password_secret_id;
  
  SELECT decrypted_secret INTO v_sign_key
  FROM vault.decrypted_secrets
  WHERE id = v_cred.sign_key_secret_id;
  
  SELECT decrypted_secret INTO v_exchange_key
  FROM vault.decrypted_secrets
  WHERE id = v_cred.exchange_key_secret_id;
  
  RETURN json_build_object(
    'nav_username', v_cred.nav_username,
    'nav_password', v_password,
    'nav_tax_number', v_cred.nav_tax_number,
    'nav_sign_key', v_sign_key,
    'nav_exchange_key', v_exchange_key,
    'software_id', v_cred.software_id,
    'software_dev_name', v_cred.software_dev_name,
    'software_dev_contact', v_cred.software_dev_contact,
    'is_test_environment', v_cred.is_test_environment
  );
END;
$$;