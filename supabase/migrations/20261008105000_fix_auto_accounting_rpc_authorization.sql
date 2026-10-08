-- Migration: 20261008105000_fix_auto_accounting_rpc_authorization.sql
-- Description:
--   EB-0256: Extend authorization in acc_get_auto_accounting_rules and acc_copy_auto_accounting_rules
--   to support accounty_assignments (assigned external accountants) and support admins (is_support_admin()).

-- 1. Fix acc_get_auto_accounting_rules authorization check
CREATE OR REPLACE FUNCTION public.acc_get_auto_accounting_rules(
    p_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_rules RECORD;
  v_active_preset_id UUID;
  v_ve_journal_id UUID;
  v_suggested jsonb;
  v_has_access boolean := false;
BEGIN
  -- 1. Check access: company member, accounty assignment, or support admin
  IF (SELECT auth.role()) <> 'service_role' THEN
    SELECT (
      EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = p_company_id AND cm.user_id = v_user_id)
      OR EXISTS (SELECT 1 FROM public.accounty_assignments aa WHERE aa.company_id = p_company_id AND aa.accountant_user_id = v_user_id)
      OR is_support_admin()
    ) INTO v_has_access;

    IF NOT v_has_access THEN
      RAISE EXCEPTION 'Nincs jogosultság a cég szabályainak megtekintéséhez!';
    END IF;
  END IF;

  -- 2. Check if explicit configured row exists
  SELECT r.*,
         -- VAT accounts
         g1.gl_number AS vat_pf_payable_gl_number, g1.short_name AS vat_pf_payable_name,
         g2.gl_number AS vat_pf_deductible_gl_number, g2.short_name AS vat_pf_deductible_name,
         g3.gl_number AS vat_advance_gross_gl_number, g3.short_name AS vat_advance_gross_name,
         g4.gl_number AS vat_intra_year_payable_gl_number, g4.short_name AS vat_intra_year_payable_name,
         g5.gl_number AS vat_intra_year_deductible_gl_number, g5.short_name AS vat_intra_year_deductible_name,
         g6.gl_number AS vat_cross_year_payable_gl_number, g6.short_name AS vat_cross_year_payable_name,
         g7.gl_number AS vat_cross_year_deductible_gl_number, g7.short_name AS vat_cross_year_deductible_name,
         -- Realized FX
         j1.code AS fx_realized_journal_code, j1.name AS fx_realized_journal_name,
         g8.gl_number AS fx_realized_gain_gl_number, g8.short_name AS fx_realized_gain_name,
         g9.gl_number AS fx_realized_loss_gl_number, g9.short_name AS fx_realized_loss_name,
         -- Unrealized FX
         j2.code AS fx_unrealized_journal_code, j2.name AS fx_unrealized_journal_name,
         g10.gl_number AS fx_unrealized_gain_gl_number, g10.short_name AS fx_unrealized_gain_name,
         g11.gl_number AS fx_unrealized_loss_gl_number, g11.short_name AS fx_unrealized_loss_name,
         -- Rounding
         g12.gl_number AS rounding_gain_gl_number, g12.short_name AS rounding_gain_name,
         g13.gl_number AS rounding_loss_gl_number, g13.short_name AS rounding_loss_name
    INTO v_rules
    FROM public.company_auto_accounting_rules r
    LEFT JOIN public.gl_accounts g1 ON g1.id = r.vat_pf_payable_gl_id
    LEFT JOIN public.gl_accounts g2 ON g2.id = r.vat_pf_deductible_gl_id
    LEFT JOIN public.gl_accounts g3 ON g3.id = r.vat_advance_gross_gl_id
    LEFT JOIN public.gl_accounts g4 ON g4.id = r.vat_intra_year_payable_gl_id
    LEFT JOIN public.gl_accounts g5 ON g5.id = r.vat_intra_year_deductible_gl_id
    LEFT JOIN public.gl_accounts g6 ON g6.id = r.vat_cross_year_payable_gl_id
    LEFT JOIN public.gl_accounts g7 ON g7.id = r.vat_cross_year_deductible_gl_id
    LEFT JOIN public.acc_journals j1 ON j1.id = r.fx_realized_journal_id
    LEFT JOIN public.gl_accounts g8 ON g8.id = r.fx_realized_gain_gl_id
    LEFT JOIN public.gl_accounts g9 ON g9.id = r.fx_realized_loss_gl_id
    LEFT JOIN public.acc_journals j2 ON j2.id = r.fx_unrealized_journal_id
    LEFT JOIN public.gl_accounts g10 ON g10.id = r.fx_unrealized_gain_gl_id
    LEFT JOIN public.gl_accounts g11 ON g11.id = r.fx_unrealized_loss_gl_id
    LEFT JOIN public.gl_accounts g12 ON g12.id = r.rounding_gain_gl_id
    LEFT JOIN public.gl_accounts g13 ON g13.id = r.rounding_loss_gl_id
   WHERE r.company_id = p_company_id;

  IF FOUND AND v_rules.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'is_configured', true,
      'rules', to_jsonb(v_rules)
    );
  END IF;

  -- 3. If NOT configured, calculate suggested defaults from company chart of accounts
  SELECT id INTO v_active_preset_id
    FROM public.chart_of_accounts_presets
   WHERE company_id = p_company_id AND is_active = true
   LIMIT 1;

  IF v_active_preset_id IS NULL THEN
    SELECT id INTO v_active_preset_id
      FROM public.chart_of_accounts_presets
     WHERE company_id = p_company_id
     LIMIT 1;
  END IF;

  IF v_active_preset_id IS NULL THEN
    SELECT id INTO v_active_preset_id
      FROM public.chart_of_accounts_presets
     WHERE type = 'generic'
     LIMIT 1;
  END IF;

  -- Default VE journal
  SELECT id INTO v_ve_journal_id
    FROM public.acc_journals
   WHERE company_id = p_company_id AND (code = 'VE' OR type = 'MIXED' OR type = 'GENERAL')
   ORDER BY (code = 'VE') DESC LIMIT 1;

  -- Build suggested payload
  RETURN jsonb_build_object(
    'is_configured', false,
    'rules', jsonb_build_object(
      'company_id', p_company_id,
      'rounding_max_limit_huf', 10.00,
      'fx_realized_journal_id', v_ve_journal_id,
      'fx_unrealized_journal_id', v_ve_journal_id
    ),
    'active_preset_id', v_active_preset_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_get_auto_accounting_rules(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_get_auto_accounting_rules(uuid) TO authenticated, service_role;

-- 2. Fix acc_copy_auto_accounting_rules authorization check
CREATE OR REPLACE FUNCTION public.acc_copy_auto_accounting_rules(
    p_source_company_id uuid,
    p_target_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_source RECORD;
  v_target_rules RECORD;
  v_source_preset_id UUID;
  v_target_preset_id UUID;
  v_unmatched TEXT[] := ARRAY[]::TEXT[];
  v_matched_count INTEGER := 0;

  -- Resolved target IDs
  v_target_vat_pf_payable_gl_id UUID;
  v_target_vat_pf_deductible_gl_id UUID;
  v_target_vat_advance_gross_gl_id UUID;
  v_target_vat_intra_year_payable_gl_id UUID;
  v_target_vat_intra_year_deductible_gl_id UUID;
  v_target_vat_cross_year_payable_gl_id UUID;
  v_target_vat_cross_year_deductible_gl_id UUID;
  v_target_fx_realized_journal_id UUID;
  v_target_fx_realized_gain_gl_id UUID;
  v_target_fx_realized_loss_gl_id UUID;
  v_target_fx_unrealized_journal_id UUID;
  v_target_fx_unrealized_gain_gl_id UUID;
  v_target_fx_unrealized_loss_gl_id UUID;
  v_target_rounding_gain_gl_id UUID;
  v_target_rounding_loss_gl_id UUID;
  v_target_rounding_max_limit NUMERIC(10,2) := 10.00;

  -- Helper function to resolve target account by matching gl_number
  v_src_num VARCHAR(50);
  v_res_id UUID;
  v_has_src_access boolean := false;
  v_has_target_access boolean := false;
BEGIN
  -- 1. Authorization check: company member, accounty assignment, or support admin
  IF (SELECT auth.role()) <> 'service_role' THEN
    -- Must have access to source company
    SELECT (
      EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = p_source_company_id AND cm.user_id = v_user_id)
      OR EXISTS (SELECT 1 FROM public.accounty_assignments aa WHERE aa.company_id = p_source_company_id AND aa.accountant_user_id = v_user_id)
      OR is_support_admin()
    ) INTO v_has_src_access;

    IF NOT v_has_src_access THEN
      RAISE EXCEPTION 'Nincs hozzáférés a forrás céghez!';
    END IF;

    -- Must have access to target company
    SELECT (
      EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = p_target_company_id AND cm.user_id = v_user_id)
      OR EXISTS (SELECT 1 FROM public.accounty_assignments aa WHERE aa.company_id = p_target_company_id AND aa.accountant_user_id = v_user_id)
      OR is_support_admin()
    ) INTO v_has_target_access;

    IF NOT v_has_target_access THEN
      RAISE EXCEPTION 'Nincs jogosultság a cél cég szabályainak módosítására!';
    END IF;
  END IF;

  -- 2. Fetch source rules
  SELECT * INTO v_source 
    FROM public.company_auto_accounting_rules 
   WHERE company_id = p_source_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A forrás céghez még nincsenek elmentve automatikus könyvelési szabályok!';
  END IF;

  -- 3. Resolve target active preset
  SELECT id INTO v_target_preset_id
    FROM public.chart_of_accounts_presets
   WHERE company_id = p_target_company_id AND is_active = true
   LIMIT 1;

  IF v_target_preset_id IS NULL THEN
    SELECT id INTO v_target_preset_id
      FROM public.chart_of_accounts_presets
     WHERE company_id = p_target_company_id
     LIMIT 1;
  END IF;

  -- Helper block to map GL account from source to target
  -- A) vat_pf_payable_gl_id
  IF v_source.vat_pf_payable_gl_id IS NOT NULL THEN
    SELECT gl_number INTO v_src_num FROM public.gl_accounts WHERE id = v_source.vat_pf_payable_gl_id;
    IF v_src_num IS NOT NULL THEN
      SELECT id INTO v_res_id FROM public.gl_accounts 
       WHERE (company_id = p_target_company_id OR preset_id = v_target_preset_id) AND gl_number = v_src_num LIMIT 1;
      IF v_res_id IS NOT NULL THEN
        v_target_vat_pf_payable_gl_id := v_res_id;
        v_matched_count := v_matched_count + 1;
      ELSE
        v_unmatched := array_append(v_unmatched, 'Pénzforgalmi fizetendő ÁFA (' || v_src_num || ')');
      END IF;
    END IF;
  END IF;

  -- B) vat_pf_deductible_gl_id
  IF v_source.vat_pf_deductible_gl_id IS NOT NULL THEN
    SELECT gl_number INTO v_src_num FROM public.gl_accounts WHERE id = v_source.vat_pf_deductible_gl_id;
    IF v_src_num IS NOT NULL THEN
      SELECT id INTO v_res_id FROM public.gl_accounts 
       WHERE (company_id = p_target_company_id OR preset_id = v_target_preset_id) AND gl_number = v_src_num LIMIT 1;
      IF v_res_id IS NOT NULL THEN
        v_target_vat_pf_deductible_gl_id := v_res_id;
        v_matched_count := v_matched_count + 1;
      ELSE
        v_unmatched := array_append(v_unmatched, 'Pénzforgalmi levonható ÁFA (' || v_src_num || ')');
      END IF;
    END IF;
  END IF;

  -- C) vat_advance_gross_gl_id
  IF v_source.vat_advance_gross_gl_id IS NOT NULL THEN
    SELECT gl_number INTO v_src_num FROM public.gl_accounts WHERE id = v_source.vat_advance_gross_gl_id;
    IF v_src_num IS NOT NULL THEN
      SELECT id INTO v_res_id FROM public.gl_accounts 
       WHERE (company_id = p_target_company_id OR preset_id = v_target_preset_id) AND gl_number = v_src_num LIMIT 1;
      IF v_res_id IS NOT NULL THEN
        v_target_vat_advance_gross_gl_id := v_res_id;
        v_matched_count := v_matched_count + 1;
      ELSE
        v_unmatched := array_append(v_unmatched, 'Bruttó előleg ÁFA (' || v_src_num || ')');
      END IF;
    END IF;
  END IF;

  -- D) vat_intra_year_payable_gl_id
  IF v_source.vat_intra_year_payable_gl_id IS NOT NULL THEN
    SELECT gl_number INTO v_src_num FROM public.gl_accounts WHERE id = v_source.vat_intra_year_payable_gl_id;
    IF v_src_num IS NOT NULL THEN
      SELECT id INTO v_res_id FROM public.gl_accounts 
       WHERE (company_id = p_target_company_id OR preset_id = v_target_preset_id) AND gl_number = v_src_num LIMIT 1;
      IF v_res_id IS NOT NULL THEN
        v_target_vat_intra_year_payable_gl_id := v_res_id;
        v_matched_count := v_matched_count + 1;
      ELSE
        v_unmatched := array_append(v_unmatched, 'Éven belüli fizetendő ÁFA (' || v_src_num || ')');
      END IF;
    END IF;
  END IF;

  -- E) vat_intra_year_deductible_gl_id
  IF v_source.vat_intra_year_deductible_gl_id IS NOT NULL THEN
    SELECT gl_number INTO v_src_num FROM public.gl_accounts WHERE id = v_source.vat_intra_year_deductible_gl_id;
    IF v_src_num IS NOT NULL THEN
      SELECT id INTO v_res_id FROM public.gl_accounts 
       WHERE (company_id = p_target_company_id OR preset_id = v_target_preset_id) AND gl_number = v_src_num LIMIT 1;
      IF v_res_id IS NOT NULL THEN
        v_target_vat_intra_year_deductible_gl_id := v_res_id;
        v_matched_count := v_matched_count + 1;
      ELSE
        v_unmatched := array_append(v_unmatched, 'Éven belüli levonható ÁFA (' || v_src_num || ')');
      END IF;
    END IF;
  END IF;

  -- F) vat_cross_year_payable_gl_id
  IF v_source.vat_cross_year_payable_gl_id IS NOT NULL THEN
    SELECT gl_number INTO v_src_num FROM public.gl_accounts WHERE id = v_source.vat_cross_year_payable_gl_id;
    IF v_src_num IS NOT NULL THEN
      SELECT id INTO v_res_id FROM public.gl_accounts 
       WHERE (company_id = p_target_company_id OR preset_id = v_target_preset_id) AND gl_number = v_src_num LIMIT 1;
      IF v_res_id IS NOT NULL THEN
        v_target_vat_cross_year_payable_gl_id := v_res_id;
        v_matched_count := v_matched_count + 1;
      ELSE
        v_unmatched := array_append(v_unmatched, 'Évek közötti fizetendő ÁFA (' || v_src_num || ')');
      END IF;
    END IF;
  END IF;

  -- G) vat_cross_year_deductible_gl_id
  IF v_source.vat_cross_year_deductible_gl_id IS NOT NULL THEN
    SELECT gl_number INTO v_src_num FROM public.gl_accounts WHERE id = v_source.vat_cross_year_deductible_gl_id;
    IF v_src_num IS NOT NULL THEN
      SELECT id INTO v_res_id FROM public.gl_accounts 
       WHERE (company_id = p_target_company_id OR preset_id = v_target_preset_id) AND gl_number = v_src_num LIMIT 1;
      IF v_res_id IS NOT NULL THEN
        v_target_vat_cross_year_deductible_gl_id := v_res_id;
        v_matched_count := v_matched_count + 1;
      ELSE
        v_unmatched := array_append(v_unmatched, 'Évek közötti levonható ÁFA (' || v_src_num || ')');
      END IF;
    END IF;
  END IF;

  -- H) Vegyes napló target (code = 'VE' OR type = 'MIXED')
  SELECT id INTO v_target_fx_realized_journal_id
    FROM public.acc_journals
   WHERE company_id = p_target_company_id AND (code = 'VE' OR type = 'MIXED' OR type = 'GENERAL')
   ORDER BY (code = 'VE') DESC LIMIT 1;

  IF v_target_fx_realized_journal_id IS NOT NULL THEN
    v_target_fx_unrealized_journal_id := v_target_fx_realized_journal_id;
    v_matched_count := v_matched_count + 1;
  ELSE
    v_unmatched := array_append(v_unmatched, 'Vegyes (VE) napló');
  END IF;

  -- I) fx_realized_gain_gl_id
  IF v_source.fx_realized_gain_gl_id IS NOT NULL THEN
    SELECT gl_number INTO v_src_num FROM public.gl_accounts WHERE id = v_source.fx_realized_gain_gl_id;
    IF v_src_num IS NOT NULL THEN
      SELECT id INTO v_res_id FROM public.gl_accounts 
       WHERE (company_id = p_target_company_id OR preset_id = v_target_preset_id) AND gl_number = v_src_num LIMIT 1;
      IF v_res_id IS NOT NULL THEN
        v_target_fx_realized_gain_gl_id := v_res_id;
        v_matched_count := v_matched_count + 1;
      ELSE
        v_unmatched := array_append(v_unmatched, 'Realizált árfolyamnyereség (' || v_src_num || ')');
      END IF;
    END IF;
  END IF;

  -- J) fx_realized_loss_gl_id
  IF v_source.fx_realized_loss_gl_id IS NOT NULL THEN
    SELECT gl_number INTO v_src_num FROM public.gl_accounts WHERE id = v_source.fx_realized_loss_gl_id;
    IF v_src_num IS NOT NULL THEN
      SELECT id INTO v_res_id FROM public.gl_accounts 
       WHERE (company_id = p_target_company_id OR preset_id = v_target_preset_id) AND gl_number = v_src_num LIMIT 1;
      IF v_res_id IS NOT NULL THEN
        v_target_fx_realized_loss_gl_id := v_res_id;
        v_matched_count := v_matched_count + 1;
      ELSE
        v_unmatched := array_append(v_unmatched, 'Realizált árfolyamveszteség (' || v_src_num || ')');
      END IF;
    END IF;
  END IF;

  -- K) fx_unrealized_gain_gl_id
  IF v_source.fx_unrealized_gain_gl_id IS NOT NULL THEN
    SELECT gl_number INTO v_src_num FROM public.gl_accounts WHERE id = v_source.fx_unrealized_gain_gl_id;
    IF v_src_num IS NOT NULL THEN
      SELECT id INTO v_res_id FROM public.gl_accounts 
       WHERE (company_id = p_target_company_id OR preset_id = v_target_preset_id) AND gl_number = v_src_num LIMIT 1;
      IF v_res_id IS NOT NULL THEN
        v_target_fx_unrealized_gain_gl_id := v_res_id;
        v_matched_count := v_matched_count + 1;
      ELSE
        v_unmatched := array_append(v_unmatched, 'Nem realizált árfolyamnyereség (' || v_src_num || ')');
      END IF;
    END IF;
  END IF;

  -- L) fx_unrealized_loss_gl_id
  IF v_source.fx_unrealized_loss_gl_id IS NOT NULL THEN
    SELECT gl_number INTO v_src_num FROM public.gl_accounts WHERE id = v_source.fx_unrealized_loss_gl_id;
    IF v_src_num IS NOT NULL THEN
      SELECT id INTO v_res_id FROM public.gl_accounts 
       WHERE (company_id = p_target_company_id OR preset_id = v_target_preset_id) AND gl_number = v_src_num LIMIT 1;
      IF v_res_id IS NOT NULL THEN
        v_target_fx_unrealized_loss_gl_id := v_res_id;
        v_matched_count := v_matched_count + 1;
      ELSE
        v_unmatched := array_append(v_unmatched, 'Nem realizált árfolyamveszteség (' || v_src_num || ')');
      END IF;
    END IF;
  END IF;

  -- M) rounding_gain_gl_id
  IF v_source.rounding_gain_gl_id IS NOT NULL THEN
    SELECT gl_number INTO v_src_num FROM public.gl_accounts WHERE id = v_source.rounding_gain_gl_id;
    IF v_src_num IS NOT NULL THEN
      SELECT id INTO v_res_id FROM public.gl_accounts 
       WHERE (company_id = p_target_company_id OR preset_id = v_target_preset_id) AND gl_number = v_src_num LIMIT 1;
      IF v_res_id IS NOT NULL THEN
        v_target_rounding_gain_gl_id := v_res_id;
        v_matched_count := v_matched_count + 1;
      ELSE
        v_unmatched := array_append(v_unmatched, 'Kerekítési többlet (' || v_src_num || ')');
      END IF;
    END IF;
  END IF;

  -- N) rounding_loss_gl_id
  IF v_source.rounding_loss_gl_id IS NOT NULL THEN
    SELECT gl_number INTO v_src_num FROM public.gl_accounts WHERE id = v_source.rounding_loss_gl_id;
    IF v_src_num IS NOT NULL THEN
      SELECT id INTO v_res_id FROM public.gl_accounts 
       WHERE (company_id = p_target_company_id OR preset_id = v_target_preset_id) AND gl_number = v_src_num LIMIT 1;
      IF v_res_id IS NOT NULL THEN
        v_target_rounding_loss_gl_id := v_res_id;
        v_matched_count := v_matched_count + 1;
      ELSE
        v_unmatched := array_append(v_unmatched, 'Kerekítési veszteség (' || v_src_num || ')');
      END IF;
    END IF;
  END IF;

  -- O) rounding_max_limit_huf
  v_target_rounding_max_limit := COALESCE(v_source.rounding_max_limit_huf, 10.00);

  -- 4. Upsert into target company
  INSERT INTO public.company_auto_accounting_rules (
    company_id,
    vat_pf_payable_gl_id,
    vat_pf_deductible_gl_id,
    vat_advance_gross_gl_id,
    vat_intra_year_payable_gl_id,
    vat_intra_year_deductible_gl_id,
    vat_cross_year_payable_gl_id,
    vat_cross_year_deductible_gl_id,
    fx_realized_journal_id,
    fx_realized_gain_gl_id,
    fx_realized_loss_gl_id,
    fx_unrealized_journal_id,
    fx_unrealized_gain_gl_id,
    fx_unrealized_loss_gl_id,
    rounding_gain_gl_id,
    rounding_loss_gl_id,
    rounding_max_limit_huf,
    updated_at
  ) VALUES (
    p_target_company_id,
    v_target_vat_pf_payable_gl_id,
    v_target_vat_pf_deductible_gl_id,
    v_target_vat_advance_gross_gl_id,
    v_target_vat_intra_year_payable_gl_id,
    v_target_vat_intra_year_deductible_gl_id,
    v_target_vat_cross_year_payable_gl_id,
    v_target_vat_cross_year_deductible_gl_id,
    v_target_fx_realized_journal_id,
    v_target_fx_realized_gain_gl_id,
    v_target_fx_realized_loss_gl_id,
    v_target_fx_unrealized_journal_id,
    v_target_fx_unrealized_gain_gl_id,
    v_target_fx_unrealized_loss_gl_id,
    v_target_rounding_gain_gl_id,
    v_target_rounding_loss_gl_id,
    v_target_rounding_max_limit,
    now()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    vat_pf_payable_gl_id = EXCLUDED.vat_pf_payable_gl_id,
    vat_pf_deductible_gl_id = EXCLUDED.vat_pf_deductible_gl_id,
    vat_advance_gross_gl_id = EXCLUDED.vat_advance_gross_gl_id,
    vat_intra_year_payable_gl_id = EXCLUDED.vat_intra_year_payable_gl_id,
    vat_intra_year_deductible_gl_id = EXCLUDED.vat_intra_year_deductible_gl_id,
    vat_cross_year_payable_gl_id = EXCLUDED.vat_cross_year_payable_gl_id,
    vat_cross_year_deductible_gl_id = EXCLUDED.vat_cross_year_deductible_gl_id,
    fx_realized_journal_id = EXCLUDED.fx_realized_journal_id,
    fx_realized_gain_gl_id = EXCLUDED.fx_realized_gain_gl_id,
    fx_realized_loss_gl_id = EXCLUDED.fx_realized_loss_gl_id,
    fx_unrealized_journal_id = EXCLUDED.fx_unrealized_journal_id,
    fx_unrealized_gain_gl_id = EXCLUDED.fx_unrealized_gain_gl_id,
    fx_unrealized_loss_gl_id = EXCLUDED.fx_unrealized_loss_gl_id,
    rounding_gain_gl_id = EXCLUDED.rounding_gain_gl_id,
    rounding_loss_gl_id = EXCLUDED.rounding_loss_gl_id,
    rounding_max_limit_huf = EXCLUDED.rounding_max_limit_huf,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'source_company_id', p_source_company_id,
    'target_company_id', p_target_company_id,
    'matched_rules', v_matched_count,
    'unmatched_rules', v_unmatched
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_copy_auto_accounting_rules(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_copy_auto_accounting_rules(uuid, uuid) TO authenticated, service_role;
