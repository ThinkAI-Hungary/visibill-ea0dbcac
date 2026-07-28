-- Update save_nav_credentials to default validation_status to 'valid' and set last_validated_at on upsert
CREATE OR REPLACE FUNCTION public.save_nav_credentials(
  p_nav_username text,
  p_nav_password text,
  p_nav_tax_number text,
  p_nav_sign_key text,
  p_nav_exchange_key text,
  p_software_dev_name text DEFAULT NULL::text,
  p_software_dev_contact text DEFAULT NULL::text,
  p_is_test_environment boolean DEFAULT false,
  p_company_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_software_id TEXT;
  v_password_secret_id UUID;
  v_sign_key_secret_id UUID;
  v_exchange_key_secret_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_company_id := p_company_id;

  -- Validate tax number format (exactly 8 digits)
  IF p_nav_tax_number IS NULL OR NOT (p_nav_tax_number ~ '^[0-9]{8}$') THEN
    RAISE EXCEPTION 'Tax number must be 8 digits (without dashes or HU prefix)';
  END IF;

  -- Store encrypted secrets using Vault
  v_password_secret_id := vault.create_secret(
    p_nav_password,
    'nav_password_' || v_user_id || '_' || COALESCE(v_company_id::text, 'default'),
    'NAV API Password'
  );

  v_sign_key_secret_id := vault.create_secret(
    p_nav_sign_key,
    'nav_sign_key_' || v_user_id || '_' || COALESCE(v_company_id::text, 'default'),
    'NAV API Signature Key'
  );

  v_exchange_key_secret_id := vault.create_secret(
    p_nav_exchange_key,
    'nav_exchange_key_' || v_user_id || '_' || COALESCE(v_company_id::text, 'default'),
    'NAV API Exchange Key'
  );

  -- Generate software_id if not exists
  v_software_id := 'VISIBILL_' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));

  -- Upsert credentials using composite key (user_id, company_id)
  INSERT INTO public.user_nav_credentials (
    user_id,
    company_id,
    nav_username,
    nav_tax_number,
    password_secret_id,
    sign_key_secret_id,
    exchange_key_secret_id,
    software_id,
    software_dev_name,
    software_dev_contact,
    is_test_environment,
    validation_status,
    last_validated_at
  ) VALUES (
    v_user_id,
    v_company_id,
    p_nav_username,
    p_nav_tax_number,
    v_password_secret_id,
    v_sign_key_secret_id,
    v_exchange_key_secret_id,
    v_software_id,
    p_software_dev_name,
    p_software_dev_contact,
    p_is_test_environment,
    'valid',
    NOW()
  )
  ON CONFLICT (user_id, company_id) DO UPDATE SET
    nav_username = EXCLUDED.nav_username,
    nav_tax_number = EXCLUDED.nav_tax_number,
    password_secret_id = EXCLUDED.password_secret_id,
    sign_key_secret_id = EXCLUDED.sign_key_secret_id,
    exchange_key_secret_id = EXCLUDED.exchange_key_secret_id,
    software_dev_name = EXCLUDED.software_dev_name,
    software_dev_contact = EXCLUDED.software_dev_contact,
    is_test_environment = EXCLUDED.is_test_environment,
    validation_status = 'valid',
    last_validated_at = NOW(),
    updated_at = NOW();

  RETURN json_build_object(
    'success', true,
    'message', 'Credentials saved successfully',
    'software_id', v_software_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to save NAV credentials: %', SQLERRM;
END;
$function$;
