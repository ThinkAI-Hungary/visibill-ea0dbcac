-- Migration: 20261008110000_enhance_auto_accounting_smart_copy.sql
-- Description:
--   EB-0256: Enhance cross-company rule cloner with intelligent hierarchical prefix matching.
--   When an exact gl_number is not found in the target company, it resolves the closest
--   matching parent or sub-account with matching prefix (e.g. 4791101 -> 47911) and returns
--   a detailed audit breakdown (exact, smart_matched, unmatched).

-- 1. Helper function to resolve target GL account (exact or smart hierarchical match)
CREATE OR REPLACE FUNCTION public._acc_resolve_target_gl_account(
    p_source_gl_id uuid,
    p_target_company_id uuid,
    p_target_preset_id uuid,
    p_label text,
    OUT p_resolved_id uuid,
    OUT p_match_type text,
    OUT p_info text
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_src_num text;
  v_res_id uuid;
  v_res_num text;
BEGIN
  p_resolved_id := NULL;
  p_match_type := 'none';
  p_info := NULL;

  IF p_source_gl_id IS NULL THEN
    RETURN;
  END IF;

  SELECT gl_number INTO v_src_num FROM public.gl_accounts WHERE id = p_source_gl_id;
  IF v_src_num IS NULL THEN
    RETURN;
  END IF;

  -- 1. Exact match
  SELECT id, gl_number INTO v_res_id, v_res_num
    FROM public.gl_accounts
   WHERE (company_id = p_target_company_id OR preset_id = p_target_preset_id)
     AND gl_number = v_src_num
   LIMIT 1;

  IF v_res_id IS NOT NULL THEN
    p_resolved_id := v_res_id;
    p_match_type := 'exact';
    RETURN;
  END IF;

  -- 2. Smart hierarchical / prefix match (min 3 chars)
  IF length(v_src_num) >= 3 THEN
    SELECT id, gl_number INTO v_res_id, v_res_num
      FROM public.gl_accounts
     WHERE (company_id = p_target_company_id OR preset_id = p_target_preset_id)
       AND (
         (length(gl_number) >= 3 AND v_src_num LIKE (gl_number || '%'))
         OR (gl_number LIKE (v_src_num || '%'))
       )
     ORDER BY abs(length(gl_number) - length(v_src_num)) ASC, gl_number ASC
     LIMIT 1;

    IF v_res_id IS NOT NULL THEN
      p_resolved_id := v_res_id;
      p_match_type := 'smart';
      p_info := p_label || ': ' || v_src_num || ' ➔ ' || v_res_num;
      RETURN;
    END IF;
  END IF;

  -- 3. Not found
  p_match_type := 'none';
  p_info := p_label || ' (' || v_src_num || ')';
END;
$function$;

-- 2. Enhanced acc_copy_auto_accounting_rules with smart matching
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
  v_target_preset_id UUID;
  v_unmatched TEXT[] := ARRAY[]::TEXT[];
  v_smart_matched TEXT[] := ARRAY[]::TEXT[];
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

  -- Helper resolution variables
  v_res_id UUID;
  v_match_type TEXT;
  v_info TEXT;
  v_has_src_access boolean := false;
  v_has_target_access boolean := false;
BEGIN
  -- 1. Authorization check: company member, accounty assignment, or support admin
  IF (SELECT auth.role()) <> 'service_role' THEN
    -- Source access
    SELECT (
      EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = p_source_company_id AND cm.user_id = v_user_id)
      OR EXISTS (SELECT 1 FROM public.accounty_assignments aa WHERE aa.company_id = p_source_company_id AND aa.accountant_user_id = v_user_id)
      OR is_support_admin()
    ) INTO v_has_src_access;

    IF NOT v_has_src_access THEN
      RAISE EXCEPTION 'Nincs hozzáférés a forrás céghez!';
    END IF;

    -- Target access
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

  -- 4. Map GL accounts using smart resolution
  -- A) vat_pf_payable
  IF v_source.vat_pf_payable_gl_id IS NOT NULL THEN
    SELECT p_resolved_id, p_match_type, p_info INTO v_res_id, v_match_type, v_info
      FROM public._acc_resolve_target_gl_account(v_source.vat_pf_payable_gl_id, p_target_company_id, v_target_preset_id, 'Pénzforgalmi fizetendő ÁFA');
    IF v_match_type IN ('exact', 'smart') THEN
      v_target_vat_pf_payable_gl_id := v_res_id;
      v_matched_count := v_matched_count + 1;
      IF v_match_type = 'smart' THEN v_smart_matched := array_append(v_smart_matched, v_info); END IF;
    ELSE
      v_unmatched := array_append(v_unmatched, v_info);
    END IF;
  END IF;

  -- B) vat_pf_deductible
  IF v_source.vat_pf_deductible_gl_id IS NOT NULL THEN
    SELECT p_resolved_id, p_match_type, p_info INTO v_res_id, v_match_type, v_info
      FROM public._acc_resolve_target_gl_account(v_source.vat_pf_deductible_gl_id, p_target_company_id, v_target_preset_id, 'Pénzforgalmi levonható ÁFA');
    IF v_match_type IN ('exact', 'smart') THEN
      v_target_vat_pf_deductible_gl_id := v_res_id;
      v_matched_count := v_matched_count + 1;
      IF v_match_type = 'smart' THEN v_smart_matched := array_append(v_smart_matched, v_info); END IF;
    ELSE
      v_unmatched := array_append(v_unmatched, v_info);
    END IF;
  END IF;

  -- C) vat_advance_gross
  IF v_source.vat_advance_gross_gl_id IS NOT NULL THEN
    SELECT p_resolved_id, p_match_type, p_info INTO v_res_id, v_match_type, v_info
      FROM public._acc_resolve_target_gl_account(v_source.vat_advance_gross_gl_id, p_target_company_id, v_target_preset_id, 'Bruttó előleg ÁFA');
    IF v_match_type IN ('exact', 'smart') THEN
      v_target_vat_advance_gross_gl_id := v_res_id;
      v_matched_count := v_matched_count + 1;
      IF v_match_type = 'smart' THEN v_smart_matched := array_append(v_smart_matched, v_info); END IF;
    ELSE
      v_unmatched := array_append(v_unmatched, v_info);
    END IF;
  END IF;

  -- D) vat_intra_year_payable
  IF v_source.vat_intra_year_payable_gl_id IS NOT NULL THEN
    SELECT p_resolved_id, p_match_type, p_info INTO v_res_id, v_match_type, v_info
      FROM public._acc_resolve_target_gl_account(v_source.vat_intra_year_payable_gl_id, p_target_company_id, v_target_preset_id, 'Éven belüli fizetendő ÁFA');
    IF v_match_type IN ('exact', 'smart') THEN
      v_target_vat_intra_year_payable_gl_id := v_res_id;
      v_matched_count := v_matched_count + 1;
      IF v_match_type = 'smart' THEN v_smart_matched := array_append(v_smart_matched, v_info); END IF;
    ELSE
      v_unmatched := array_append(v_unmatched, v_info);
    END IF;
  END IF;

  -- E) vat_intra_year_deductible
  IF v_source.vat_intra_year_deductible_gl_id IS NOT NULL THEN
    SELECT p_resolved_id, p_match_type, p_info INTO v_res_id, v_match_type, v_info
      FROM public._acc_resolve_target_gl_account(v_source.vat_intra_year_deductible_gl_id, p_target_company_id, v_target_preset_id, 'Éven belüli levonható ÁFA');
    IF v_match_type IN ('exact', 'smart') THEN
      v_target_vat_intra_year_deductible_gl_id := v_res_id;
      v_matched_count := v_matched_count + 1;
      IF v_match_type = 'smart' THEN v_smart_matched := array_append(v_smart_matched, v_info); END IF;
    ELSE
      v_unmatched := array_append(v_unmatched, v_info);
    END IF;
  END IF;

  -- F) vat_cross_year_payable
  IF v_source.vat_cross_year_payable_gl_id IS NOT NULL THEN
    SELECT p_resolved_id, p_match_type, p_info INTO v_res_id, v_match_type, v_info
      FROM public._acc_resolve_target_gl_account(v_source.vat_cross_year_payable_gl_id, p_target_company_id, v_target_preset_id, 'Évek közötti fizetendő ÁFA');
    IF v_match_type IN ('exact', 'smart') THEN
      v_target_vat_cross_year_payable_gl_id := v_res_id;
      v_matched_count := v_matched_count + 1;
      IF v_match_type = 'smart' THEN v_smart_matched := array_append(v_smart_matched, v_info); END IF;
    ELSE
      v_unmatched := array_append(v_unmatched, v_info);
    END IF;
  END IF;

  -- G) vat_cross_year_deductible
  IF v_source.vat_cross_year_deductible_gl_id IS NOT NULL THEN
    SELECT p_resolved_id, p_match_type, p_info INTO v_res_id, v_match_type, v_info
      FROM public._acc_resolve_target_gl_account(v_source.vat_cross_year_deductible_gl_id, p_target_company_id, v_target_preset_id, 'Évek közötti levonható ÁFA');
    IF v_match_type IN ('exact', 'smart') THEN
      v_target_vat_cross_year_deductible_gl_id := v_res_id;
      v_matched_count := v_matched_count + 1;
      IF v_match_type = 'smart' THEN v_smart_matched := array_append(v_smart_matched, v_info); END IF;
    ELSE
      v_unmatched := array_append(v_unmatched, v_info);
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

  -- I) fx_realized_gain
  IF v_source.fx_realized_gain_gl_id IS NOT NULL THEN
    SELECT p_resolved_id, p_match_type, p_info INTO v_res_id, v_match_type, v_info
      FROM public._acc_resolve_target_gl_account(v_source.fx_realized_gain_gl_id, p_target_company_id, v_target_preset_id, 'Realizált árfolyamnyereség');
    IF v_match_type IN ('exact', 'smart') THEN
      v_target_fx_realized_gain_gl_id := v_res_id;
      v_matched_count := v_matched_count + 1;
      IF v_match_type = 'smart' THEN v_smart_matched := array_append(v_smart_matched, v_info); END IF;
    ELSE
      v_unmatched := array_append(v_unmatched, v_info);
    END IF;
  END IF;

  -- J) fx_realized_loss
  IF v_source.fx_realized_loss_gl_id IS NOT NULL THEN
    SELECT p_resolved_id, p_match_type, p_info INTO v_res_id, v_match_type, v_info
      FROM public._acc_resolve_target_gl_account(v_source.fx_realized_loss_gl_id, p_target_company_id, v_target_preset_id, 'Realizált árfolyamveszteség');
    IF v_match_type IN ('exact', 'smart') THEN
      v_target_fx_realized_loss_gl_id := v_res_id;
      v_matched_count := v_matched_count + 1;
      IF v_match_type = 'smart' THEN v_smart_matched := array_append(v_smart_matched, v_info); END IF;
    ELSE
      v_unmatched := array_append(v_unmatched, v_info);
    END IF;
  END IF;

  -- K) fx_unrealized_gain
  IF v_source.fx_unrealized_gain_gl_id IS NOT NULL THEN
    SELECT p_resolved_id, p_match_type, p_info INTO v_res_id, v_match_type, v_info
      FROM public._acc_resolve_target_gl_account(v_source.fx_unrealized_gain_gl_id, p_target_company_id, v_target_preset_id, 'Nem realizált árfolyamnyereség');
    IF v_match_type IN ('exact', 'smart') THEN
      v_target_fx_unrealized_gain_gl_id := v_res_id;
      v_matched_count := v_matched_count + 1;
      IF v_match_type = 'smart' THEN v_smart_matched := array_append(v_smart_matched, v_info); END IF;
    ELSE
      v_unmatched := array_append(v_unmatched, v_info);
    END IF;
  END IF;

  -- L) fx_unrealized_loss
  IF v_source.fx_unrealized_loss_gl_id IS NOT NULL THEN
    SELECT p_resolved_id, p_match_type, p_info INTO v_res_id, v_match_type, v_info
      FROM public._acc_resolve_target_gl_account(v_source.fx_unrealized_loss_gl_id, p_target_company_id, v_target_preset_id, 'Nem realizált árfolyamveszteség');
    IF v_match_type IN ('exact', 'smart') THEN
      v_target_fx_unrealized_loss_gl_id := v_res_id;
      v_matched_count := v_matched_count + 1;
      IF v_match_type = 'smart' THEN v_smart_matched := array_append(v_smart_matched, v_info); END IF;
    ELSE
      v_unmatched := array_append(v_unmatched, v_info);
    END IF;
  END IF;

  -- M) rounding_gain
  IF v_source.rounding_gain_gl_id IS NOT NULL THEN
    SELECT p_resolved_id, p_match_type, p_info INTO v_res_id, v_match_type, v_info
      FROM public._acc_resolve_target_gl_account(v_source.rounding_gain_gl_id, p_target_company_id, v_target_preset_id, 'Kerekítési többlet');
    IF v_match_type IN ('exact', 'smart') THEN
      v_target_rounding_gain_gl_id := v_res_id;
      v_matched_count := v_matched_count + 1;
      IF v_match_type = 'smart' THEN v_smart_matched := array_append(v_smart_matched, v_info); END IF;
    ELSE
      v_unmatched := array_append(v_unmatched, v_info);
    END IF;
  END IF;

  -- N) rounding_loss
  IF v_source.rounding_loss_gl_id IS NOT NULL THEN
    SELECT p_resolved_id, p_match_type, p_info INTO v_res_id, v_match_type, v_info
      FROM public._acc_resolve_target_gl_account(v_source.rounding_loss_gl_id, p_target_company_id, v_target_preset_id, 'Kerekítési veszteség');
    IF v_match_type IN ('exact', 'smart') THEN
      v_target_rounding_loss_gl_id := v_res_id;
      v_matched_count := v_matched_count + 1;
      IF v_match_type = 'smart' THEN v_smart_matched := array_append(v_smart_matched, v_info); END IF;
    ELSE
      v_unmatched := array_append(v_unmatched, v_info);
    END IF;
  END IF;

  -- O) rounding_max_limit_huf
  v_target_rounding_max_limit := COALESCE(v_source.rounding_max_limit_huf, 10.00);

  -- 5. Upsert into target company
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
    'matched_count', v_matched_count,
    'smart_matched_count', cardinality(v_smart_matched),
    'smart_matched', to_jsonb(v_smart_matched),
    'unmatched', to_jsonb(v_unmatched)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_copy_auto_accounting_rules(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_copy_auto_accounting_rules(uuid, uuid) TO authenticated, service_role;
