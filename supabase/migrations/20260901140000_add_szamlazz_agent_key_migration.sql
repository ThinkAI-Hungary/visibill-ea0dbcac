-- Add dedicated szamlazz_agent_key column to companies and company_email_settings
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS szamlazz_agent_key text;

ALTER TABLE public.company_email_settings 
ADD COLUMN IF NOT EXISTS szamlazz_agent_key text;

-- RPC to save Számlázz.hu Agent Key securely (bypassing RLS with owner validation)
CREATE OR REPLACE FUNCTION public.save_szamlazz_agent_key(
  p_company_id UUID,
  p_agent_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_is_member BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.company_members 
    WHERE company_id = p_company_id AND user_id = v_user_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    SELECT EXISTS (
      SELECT 1 FROM public.companies 
      WHERE id = p_company_id AND owner_id = v_user_id
    ) INTO v_is_member;
  END IF;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Csak a cég tagja mentheti a Számlázz.hu Agent kulcsot';
  END IF;

  UPDATE public.companies
  SET szamlazz_agent_key = p_agent_key,
      updated_at = now()
  WHERE id = p_company_id;

  INSERT INTO public.company_email_settings (company_id, user_id, szamlazz_agent_key, updated_at)
  VALUES (p_company_id, v_user_id, p_agent_key, now())
  ON CONFLICT (company_id) DO UPDATE SET
    szamlazz_agent_key = EXCLUDED.szamlazz_agent_key,
    updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- RPC to get Számlázz.hu Agent Key
CREATE OR REPLACE FUNCTION public.get_szamlazz_agent_key(
  p_company_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_key TEXT;
BEGIN
  SELECT szamlazz_agent_key INTO v_key
  FROM public.companies
  WHERE id = p_company_id;

  IF v_key IS NULL OR v_key = '' THEN
    SELECT szamlazz_agent_key INTO v_key
    FROM public.company_email_settings
    WHERE company_id = p_company_id;
  END IF;

  RETURN v_key;
END;
$function$;

-- RPC to delete Számlázz.hu Agent Key
CREATE OR REPLACE FUNCTION public.delete_szamlazz_agent_key(
  p_company_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_is_member BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.companies
  SET szamlazz_agent_key = NULL,
      updated_at = now()
  WHERE id = p_company_id;

  UPDATE public.company_email_settings
  SET szamlazz_agent_key = NULL,
      updated_at = now()
  WHERE company_id = p_company_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.save_szamlazz_agent_key(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_szamlazz_agent_key(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_szamlazz_agent_key(UUID) TO authenticated;
