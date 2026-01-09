-- Drop the old user_id only unique constraint
ALTER TABLE public.user_nav_credentials
DROP CONSTRAINT IF EXISTS user_nav_credentials_user_id_key;

-- Add composite unique constraint (allows multiple companies per user)
ALTER TABLE public.user_nav_credentials
ADD CONSTRAINT user_nav_credentials_user_id_company_id_key 
UNIQUE (user_id, company_id);

-- Clean up orphaned records where company_id is NULL
DELETE FROM public.user_nav_credentials 
WHERE company_id IS NULL;

-- Update the save_nav_credentials function with correct ON CONFLICT handling
CREATE OR REPLACE FUNCTION public.save_nav_credentials(
  p_nav_username text, 
  p_nav_password text, 
  p_nav_tax_number text, 
  p_nav_sign_key text, 
  p_nav_exchange_key text, 
  p_software_dev_name text DEFAULT NULL::text, 
  p_software_dev_contact text DEFAULT NULL::text, 
  p_is_test_environment boolean DEFAULT true, 
  p_company_id uuid DEFAULT NULL::uuid
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
  v_company_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- company_id is now REQUIRED
  v_company_id := p_company_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;

  -- Validate tax number (8 digits)
  IF p_nav_tax_number !~ '^[0-9]{8}$' THEN
    RAISE EXCEPTION 'Tax number must be 8 digits';
  END IF;

  -- Check if credentials already exist for this company
  SELECT * INTO v_existing_cred
  FROM public.user_nav_credentials
  WHERE company_id = v_company_id;

  -- Prepare secret names scoped to company
  v_password_name := 'nav_password_company_' || v_company_id::text;
  v_sign_name := 'nav_sign_key_company_' || v_company_id::text;
  v_exchange_name := 'nav_exchange_key_company_' || v_company_id::text;

  -- Idempotent secret handling: delete by name if already present
  DELETE FROM vault.secrets WHERE name IN (v_password_name, v_sign_name, v_exchange_name);

  -- Create secrets
  v_password_secret_id := vault.create_secret(
    p_nav_password,
    v_password_name,
    'NAV password for company'
  );

  v_sign_key_secret_id := vault.create_secret(
    p_nav_sign_key,
    v_sign_name,
    'NAV sign key for company'
  );

  v_exchange_key_secret_id := vault.create_secret(
    p_nav_exchange_key,
    v_exchange_name,
    'NAV exchange key for company'
  );

  -- Preserve existing software_id if present, otherwise generate a new one
  IF FOUND AND v_existing_cred.software_id IS NOT NULL THEN
    v_software_id := v_existing_cred.software_id;
  ELSE
    v_software_id := 'HU' || p_nav_tax_number || substr(md5(random()::text), 1, 8);
    v_software_id := upper(substr(v_software_id, 1, 18));
  END IF;

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
    validation_status
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
    'pending'
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

-- Drop the old 8-parameter version of save_nav_credentials (without company_id)
DROP FUNCTION IF EXISTS public.save_nav_credentials(text, text, text, text, text, text, text, boolean);