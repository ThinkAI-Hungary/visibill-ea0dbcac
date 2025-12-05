-- Drop and recreate get_nav_credentials to support company_id lookup
CREATE OR REPLACE FUNCTION public.get_nav_credentials(p_user_id uuid, p_company_id uuid DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cred RECORD;
  v_password TEXT;
  v_sign_key TEXT;
  v_exchange_key TEXT;
BEGIN
  -- Get credentials - if company_id is provided, use it; otherwise fallback to user_id only
  IF p_company_id IS NOT NULL THEN
    SELECT * INTO v_cred
    FROM public.user_nav_credentials
    WHERE company_id = p_company_id;
  ELSE
    SELECT * INTO v_cred
    FROM public.user_nav_credentials
    WHERE user_id = p_user_id AND company_id IS NULL;
  END IF;
  
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
$function$;