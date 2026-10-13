-- Migration: 20261011190000_set_active_gl_view_template_rpc.sql
-- Description: RPC for company members and assigned accountants to set the active GL view template

CREATE OR REPLACE FUNCTION public.set_active_gl_view_template(
  p_company_id UUID,
  p_template_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_authorized BOOLEAN := FALSE;
  v_template_exists BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nem azonosított felhasználó' USING ERRCODE = '42501';
  END IF;

  -- 1. Check authorization: user is company member OR assigned accountant
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id AND user_id = v_user_id
    UNION
    SELECT 1 FROM public.accounty_assignments
    WHERE company_id = p_company_id AND accountant_user_id = v_user_id
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég főkönyvi nézetének módosítására' USING ERRCODE = '42501';
  END IF;

  -- 2. Validate template exists (builtin or belongs to this company)
  SELECT EXISTS (
    SELECT 1 FROM public.gl_view_templates
    WHERE id = p_template_id
      AND (template_type = 'builtin' OR company_id = p_company_id)
  ) INTO v_template_exists;

  IF NOT v_template_exists THEN
    RAISE EXCEPTION 'A megadott sablon nem található vagy nem ehhez a céghez tartozik' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Upsert active_gl_view_template_id in company_settings
  INSERT INTO public.company_settings (company_id, active_gl_view_template_id, updated_at)
  VALUES (p_company_id, p_template_id, now())
  ON CONFLICT (company_id)
  DO UPDATE SET
    active_gl_view_template_id = EXCLUDED.active_gl_view_template_id,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'active_gl_view_template_id', p_template_id
  );
END;
$$;

-- Security Grants
REVOKE EXECUTE ON FUNCTION public.set_active_gl_view_template(UUID, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION public.set_active_gl_view_template(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_active_gl_view_template(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_gl_view_template(UUID, TEXT) TO service_role;
