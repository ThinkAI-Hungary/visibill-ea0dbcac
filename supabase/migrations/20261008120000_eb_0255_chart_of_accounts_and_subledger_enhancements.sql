-- Migration: 20261008120000_eb_0255_chart_of_accounts_and_subledger_enhancements.sql
-- Description:
--   1. Adds account_type ('group' | 'detail') column to gl_accounts.
--   2. Automatically updates existing accounts to 'group' if child accounts reference them via parent_id.
--   3. Adds performance index on gl_accounts (preset_id, subledger_type, is_open_item_managed).
--   4. Implements acc_copy_chart_of_accounts RPC for 1-click cross-company chart of accounts cloning
--      with hierarchical parent_id remapping and automatic preset activation.

-- 1. Alter gl_accounts table with account_type
ALTER TABLE public.gl_accounts
  ADD COLUMN IF NOT EXISTS account_type VARCHAR(16) DEFAULT 'detail' CHECK (account_type IN ('group', 'detail'));

-- 2. Backfill existing accounts: if an account has child accounts pointing to it, set account_type = 'group'
UPDATE public.gl_accounts parent_acc
SET account_type = 'group'
WHERE EXISTS (
  SELECT 1 FROM public.gl_accounts child_acc
  WHERE child_acc.parent_id = parent_acc.id
);

-- 3. Composite performance index for subledger filtering and open item lookups
CREATE INDEX IF NOT EXISTS idx_gl_accounts_subledger_lookup
  ON public.gl_accounts(preset_id, is_open_item_managed, subledger_type);

CREATE INDEX IF NOT EXISTS idx_gl_accounts_account_type
  ON public.gl_accounts(preset_id, account_type);

-- 4. RPC: acc_copy_chart_of_accounts
-- Clones the active chart of accounts from p_source_company_id into p_target_company_id
CREATE OR REPLACE FUNCTION public.acc_copy_chart_of_accounts(
  p_source_company_id UUID,
  p_target_company_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source_company_name TEXT;
  v_target_company_name TEXT;
  v_source_preset RECORD;
  v_new_preset_id UUID;
  v_new_preset_name TEXT;
  v_caller_user_id UUID;
  v_has_source_access BOOLEAN;
  v_has_target_access BOOLEAN;
  v_copied_count INTEGER := 0;
  v_bs_copied INTEGER := 0;
  v_pnl_copied INTEGER := 0;
  v_source_preset_id UUID;
BEGIN
  v_caller_user_id := auth.uid();

  -- 1. Validate companies exist
  SELECT name INTO v_source_company_name FROM public.companies WHERE id = p_source_company_id;
  IF v_source_company_name IS NULL THEN
    RAISE EXCEPTION 'Forrás cég nem található: %', p_source_company_id;
  END IF;

  SELECT name INTO v_target_company_name FROM public.companies WHERE id = p_target_company_id;
  IF v_target_company_name IS NULL THEN
    RAISE EXCEPTION 'Cél cég nem található: %', p_target_company_id;
  END IF;

  IF p_source_company_id = p_target_company_id THEN
    RAISE EXCEPTION 'A forrás és cél cég nem lehet azonos!';
  END IF;

  -- 2. Authorization check (caller must have access to both companies or be service_role)
  IF v_caller_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_members WHERE company_id = p_source_company_id AND user_id = v_caller_user_id
    ) INTO v_has_source_access;

    SELECT EXISTS (
      SELECT 1 FROM public.company_members WHERE company_id = p_target_company_id AND user_id = v_caller_user_id
    ) INTO v_has_target_access;

    -- Also check accounty_assignments or management role
    IF NOT v_has_source_access THEN
      SELECT EXISTS (
        SELECT 1 FROM public.accounty_assignments WHERE company_id = p_source_company_id AND user_id = v_caller_user_id
      ) INTO v_has_source_access;
    END IF;

    IF NOT v_has_target_access THEN
      SELECT EXISTS (
        SELECT 1 FROM public.accounty_assignments WHERE company_id = p_target_company_id AND user_id = v_caller_user_id
      ) INTO v_has_target_access;
    END IF;

    -- Allow platform admin / management / thinkai override
    IF NOT (v_has_source_access AND v_has_target_access) THEN
      IF EXISTS (
        SELECT 1 FROM public.profiles WHERE user_id = v_caller_user_id AND role IN ('thinkai', 'management')
      ) THEN
        v_has_source_access := TRUE;
        v_has_target_access := TRUE;
      END IF;
    END IF;

    IF NOT (v_has_source_access AND v_has_target_access) THEN
      RAISE EXCEPTION 'Nincs megfelelő jogosultsága mindkét céghez a számlatükör átmásolásához!';
    END IF;
  END IF;

  -- 3. Resolve active source preset
  SELECT * INTO v_source_preset
  FROM public.chart_of_accounts_presets
  WHERE company_id = p_source_company_id
    AND is_active = TRUE
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_source_preset.id IS NULL THEN
    -- Fallback to any company custom preset
    SELECT * INTO v_source_preset
    FROM public.chart_of_accounts_presets
    WHERE company_id = p_source_company_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_source_preset.id IS NULL THEN
    -- Fallback to standard generic preset
    SELECT * INTO v_source_preset
    FROM public.chart_of_accounts_presets
    WHERE type = 'generic'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_source_preset.id IS NULL THEN
    RAISE EXCEPTION 'A forrás céghez nem található használható számlatükör sablon!';
  END IF;

  v_source_preset_id := v_source_preset.id;

  -- 4. Check if source preset has any accounts
  SELECT COUNT(*) INTO v_copied_count
  FROM public.gl_accounts
  WHERE preset_id = v_source_preset_id;

  IF v_copied_count = 0 THEN
    RAISE EXCEPTION 'A forrás számlatükörben (% / %) nem találhatók főkönyvi számlák!', 
      v_source_preset.name, v_source_preset_id;
  END IF;

  -- 5. Inactivate existing custom presets for the target company (Single Active COA rule)
  UPDATE public.chart_of_accounts_presets
  SET is_active = FALSE
  WHERE company_id = p_target_company_id;

  -- 6. Create new active custom preset for target company
  v_new_preset_name := COALESCE(v_source_company_name, 'Másolt') || ' — Számlatükör';
  
  INSERT INTO public.chart_of_accounts_presets (
    name,
    type,
    is_active,
    company_id
  ) VALUES (
    v_new_preset_name,
    'custom',
    TRUE,
    p_target_company_id
  )
  RETURNING id INTO v_new_preset_id;

  -- 7. Clone gl_accounts with hierarchical parent_id remapping using temporary table
  CREATE TEMP TABLE temp_coa_id_map (
    old_id UUID PRIMARY KEY,
    new_id UUID NOT NULL
  ) ON COMMIT DROP;

  -- Step 7a: Insert accounts without parent_id, capturing mapping between old and new IDs
  WITH inserted_accounts AS (
    INSERT INTO public.gl_accounts (
      preset_id,
      company_id,
      gl_number,
      short_name,
      description,
      currency,
      is_multicurrency,
      subledger_type,
      is_open_item_managed,
      account_type
    )
    SELECT
      v_new_preset_id,
      p_target_company_id,
      g.gl_number,
      g.short_name,
      g.description,
      g.currency,
      COALESCE(g.is_multicurrency, FALSE),
      COALESCE(g.subledger_type, 'none'),
      COALESCE(g.is_open_item_managed, FALSE),
      COALESCE(g.account_type, 'detail')
    FROM public.gl_accounts g
    WHERE g.preset_id = v_source_preset_id
    RETURNING id, gl_number
  )
  INSERT INTO temp_coa_id_map (old_id, new_id)
  SELECT old_g.id, ins.id
  FROM inserted_accounts ins
  JOIN public.gl_accounts old_g 
    ON old_g.preset_id = v_source_preset_id 
   AND old_g.gl_number = ins.gl_number;

  -- Step 7b: Remap parent_id in target accounts based on old parent_id
  UPDATE public.gl_accounts target_acc
  SET parent_id = m_parent.new_id
  FROM temp_coa_id_map m_self
  JOIN public.gl_accounts source_acc ON source_acc.id = m_self.old_id
  JOIN temp_coa_id_map m_parent ON m_parent.old_id = source_acc.parent_id
  WHERE target_acc.id = m_self.new_id
    AND source_acc.parent_id IS NOT NULL;

  -- Step 7c: Copy bs_mapping for cloned accounts if present in source preset
  INSERT INTO public.bs_mapping (
    company_id,
    preset_id,
    gl_account_id,
    bs_structure_id,
    user_id
  )
  SELECT
    p_target_company_id,
    v_new_preset_id,
    m.new_id,
    bm.bs_structure_id,
    v_caller_user_id
  FROM public.bs_mapping bm
  JOIN temp_coa_id_map m ON m.old_id = bm.gl_account_id
  WHERE bm.preset_id = v_source_preset_id;
  GET DIAGNOSTICS v_bs_copied = ROW_COUNT;

  -- Step 7d: Copy pnl_mapping for cloned accounts if present in source preset
  INSERT INTO public.pnl_mapping (
    company_id,
    preset_id,
    gl_account_id,
    pnl_structure_id,
    user_id
  )
  SELECT
    p_target_company_id,
    v_new_preset_id,
    m.new_id,
    pm.pnl_structure_id,
    v_caller_user_id
  FROM public.pnl_mapping pm
  JOIN temp_coa_id_map m ON m.old_id = pm.gl_account_id
  WHERE pm.preset_id = v_source_preset_id;
  GET DIAGNOSTICS v_pnl_copied = ROW_COUNT;

  -- 8. Return JSON summary
  RETURN jsonb_build_object(
    'success', TRUE,
    'source_company_id', p_source_company_id,
    'source_company_name', v_source_company_name,
    'source_preset_id', v_source_preset_id,
    'source_preset_name', v_source_preset.name,
    'target_company_id', p_target_company_id,
    'target_company_name', v_target_company_name,
    'target_preset_id', v_new_preset_id,
    'target_preset_name', v_new_preset_name,
    'accounts_copied', v_copied_count,
    'bs_mappings_copied', v_bs_copied,
    'pnl_mappings_copied', v_pnl_copied
  );
END;
$$;

-- Grant permissions on RPC
REVOKE ALL ON FUNCTION public.acc_copy_chart_of_accounts(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_copy_chart_of_accounts(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acc_copy_chart_of_accounts(UUID, UUID) TO service_role;
