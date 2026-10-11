-- Migration: 20261011210000_vat_view_templates_firm_sharing.sql
-- Description: Enable accounting firm sharing for VAT view templates and update RPC validation

-- 1. Update SELECT policy
DROP POLICY IF EXISTS "vat_view_templates_select" ON public.vat_view_templates;
CREATE POLICY "vat_view_templates_select" ON public.vat_view_templates
  FOR SELECT
  USING (
    template_type = 'builtin'
    OR company_id IS NULL
    OR company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    OR company_id IN (SELECT company_id FROM public.accounty_assignments WHERE accountant_user_id = auth.uid())
    OR (
      accounting_firm_id IS NOT NULL 
      AND accounting_firm_id IN (
        SELECT accounting_firm_id FROM public.accounty_assignments WHERE accountant_user_id = auth.uid()
      )
    )
  );

-- 2. Update INSERT policy
DROP POLICY IF EXISTS "vat_view_templates_insert" ON public.vat_view_templates;
CREATE POLICY "vat_view_templates_insert" ON public.vat_view_templates
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
    OR company_id IN (
      SELECT company_id FROM public.accounty_assignments 
      WHERE accountant_user_id = auth.uid()
    )
    OR (
      accounting_firm_id IS NOT NULL
      AND accounting_firm_id IN (
        SELECT accounting_firm_id FROM public.accounty_assignments 
        WHERE accountant_user_id = auth.uid()
      )
    )
  );

-- 3. Update set_active_vat_view_template RPC to recognize firm-shared templates
CREATE OR REPLACE FUNCTION public.set_active_vat_view_template(
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
    RAISE EXCEPTION 'Nincs jogosultsága a cég ÁFA analitika nézetének módosítására' USING ERRCODE = '42501';
  END IF;

  -- 2. Validate template exists (builtin, company-owned, or firm-shared)
  SELECT EXISTS (
    SELECT 1 FROM public.vat_view_templates
    WHERE id = p_template_id
      AND (
        template_type = 'builtin' 
        OR company_id = p_company_id
        OR (
          accounting_firm_id IS NOT NULL
          AND accounting_firm_id IN (
            SELECT accounting_firm_id FROM public.accounty_assignments WHERE company_id = p_company_id
          )
        )
      )
  ) INTO v_template_exists;

  IF NOT v_template_exists THEN
    RAISE EXCEPTION 'A megadott ÁFA sablon nem található vagy nem ehhez a céghez/könyvelőirodához tartozik' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Upsert active_vat_view_template_id in company_settings
  INSERT INTO public.company_settings (company_id, active_vat_view_template_id, updated_at)
  VALUES (p_company_id, p_template_id, now())
  ON CONFLICT (company_id)
  DO UPDATE SET
    active_vat_view_template_id = EXCLUDED.active_vat_view_template_id,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'active_vat_view_template_id', p_template_id
  );
END;
$$;

-- 4. Re-apply permissions
REVOKE EXECUTE ON FUNCTION public.set_active_vat_view_template(UUID, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION public.set_active_vat_view_template(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_active_vat_view_template(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_vat_view_template(UUID, TEXT) TO service_role;
