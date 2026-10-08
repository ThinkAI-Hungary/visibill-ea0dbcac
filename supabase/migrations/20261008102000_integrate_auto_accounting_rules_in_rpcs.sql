-- Migration: 20261008102000_integrate_auto_accounting_rules_in_rpcs.sql
-- Description:
--   EB-0256: Integrate company_auto_accounting_rules into write_off_subledger_difference RPC
--   matching the exact signature expected by the frontend and existing callers.

-- Drop any alternate overload to avoid ambiguity
DROP FUNCTION IF EXISTS public.write_off_subledger_difference(UUID, UUID, NUMERIC, TEXT, UUID, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.write_off_subledger_difference(UUID, UUID, VARCHAR, NUMERIC, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.write_off_subledger_difference(
  p_company_id UUID,
  p_line_id UUID,
  p_type VARCHAR DEFAULT 'ROUNDING',
  p_amount_huf NUMERIC DEFAULT 0,
  p_target_gl_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line public.acc_journal_lines%ROWTYPE;
  v_header public.acc_journal_headers%ROWTYPE;
  v_journal_ve public.acc_journals%ROWTYPE;
  v_auto_rules public.company_auto_accounting_rules%ROWTYPE;
  v_diff_gl_id UUID;
  v_new_header_id UUID;
  v_line1_id UUID;
  v_line2_id UUID;
  v_dc1 VARCHAR(1);
  v_dc2 VARCHAR(1);
  v_is_gain BOOLEAN;
BEGIN
  -- 1. Fetch line and header
  SELECT * INTO v_line FROM public.acc_journal_lines WHERE id = p_line_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A könyvelési sor nem található!';
  END IF;

  SELECT * INTO v_header FROM public.acc_journal_headers WHERE id = v_line.header_id;
  IF v_header.company_id <> p_company_id THEN
    RAISE EXCEPTION 'Jogosulatlan hozzáférés!';
  END IF;

  -- 1.1 Read company auto accounting rules if configured
  SELECT * INTO v_auto_rules
    FROM public.company_auto_accounting_rules
   WHERE company_id = p_company_id;

  -- 2. Find Vegyes (VE) journal (prefer configured journal, fallback to VE)
  IF v_auto_rules.fx_realized_journal_id IS NOT NULL AND p_type = 'FX_DIFFERENCE' THEN
    SELECT * INTO v_journal_ve FROM public.acc_journals WHERE id = v_auto_rules.fx_realized_journal_id;
  END IF;

  IF v_journal_ve.id IS NULL THEN
    SELECT * INTO v_journal_ve FROM public.acc_journals
     WHERE company_id = p_company_id AND (code = 'VE' OR type = 'MIXED' OR type = 'GENERAL')
     ORDER BY (code = 'VE') DESC, is_active DESC
     LIMIT 1;
  END IF;

  IF v_journal_ve.id IS NULL THEN
    RAISE EXCEPTION 'A Vegyes (VE) napló nem található a cégnél!';
  END IF;

  -- Determine T / K directions to offset the open line
  -- If open line was T, the offset line must be K
  IF v_line.dc_type = 'T' THEN
    v_dc1 := 'K'; -- Offset to original GL account
    v_dc2 := 'T'; -- Difference account (Expense/Loss when T)
    v_is_gain := false;
  ELSE
    v_dc1 := 'T'; -- Offset to original GL account
    v_dc2 := 'K'; -- Difference account (Income/Gain when K)
    v_is_gain := true;
  END IF;

  -- 3. Determine difference GL account
  IF p_target_gl_id IS NOT NULL THEN
    v_diff_gl_id := p_target_gl_id;
  ELSE
    IF p_type = 'ROUNDING' THEN
      -- Validate max rounding limit if set
      IF v_auto_rules.rounding_max_limit_huf IS NOT NULL AND ABS(p_amount_huf) > v_auto_rules.rounding_max_limit_huf THEN
        RAISE EXCEPTION 'A kerekítési különbözet (% Ft) meghaladja a beállított maximum limitet (% Ft)!', 
          ABS(p_amount_huf), v_auto_rules.rounding_max_limit_huf;
      END IF;

      -- Check configured rules first (9699 Nyereség vs 8699 Veszteség)
      IF v_is_gain AND v_auto_rules.rounding_gain_gl_id IS NOT NULL THEN
        v_diff_gl_id := v_auto_rules.rounding_gain_gl_id;
      ELSIF NOT v_is_gain AND v_auto_rules.rounding_loss_gl_id IS NOT NULL THEN
        v_diff_gl_id := v_auto_rules.rounding_loss_gl_id;
      ELSE
        -- Fallback to any configured rounding account
        v_diff_gl_id := COALESCE(v_auto_rules.rounding_loss_gl_id, v_auto_rules.rounding_gain_gl_id);
      END IF;

      -- Legacy heuristic fallback if still null
      IF v_diff_gl_id IS NULL THEN
        SELECT id INTO v_diff_gl_id FROM public.gl_accounts
         WHERE (company_id = p_company_id OR preset_id IS NOT NULL)
           AND (
             (v_is_gain AND (gl_number LIKE '9699%' OR gl_number LIKE '969%'))
             OR (NOT v_is_gain AND (gl_number LIKE '8699%' OR gl_number LIKE '869%'))
             OR gl_number LIKE '8755%' 
             OR gl_number LIKE '9779%'
           )
         ORDER BY 
           CASE 
             WHEN v_is_gain AND gl_number LIKE '9699%' THEN 1
             WHEN NOT v_is_gain AND gl_number LIKE '8699%' THEN 1
             ELSE 2
           END
         LIMIT 1;
      END IF;

    ELSE
      -- FX difference: Realized FX gain (9779) / loss (8755)
      IF v_is_gain AND v_auto_rules.fx_realized_gain_gl_id IS NOT NULL THEN
        v_diff_gl_id := v_auto_rules.fx_realized_gain_gl_id;
      ELSIF NOT v_is_gain AND v_auto_rules.fx_realized_loss_gl_id IS NOT NULL THEN
        v_diff_gl_id := v_auto_rules.fx_realized_loss_gl_id;
      ELSE
        v_diff_gl_id := COALESCE(v_auto_rules.fx_realized_loss_gl_id, v_auto_rules.fx_realized_gain_gl_id);
      END IF;

      -- Legacy heuristic fallback if still null
      IF v_diff_gl_id IS NULL THEN
        SELECT id INTO v_diff_gl_id FROM public.gl_accounts
         WHERE (company_id = p_company_id OR preset_id IS NOT NULL)
           AND (
             (v_is_gain AND (gl_number LIKE '9779%' OR gl_number LIKE '976%'))
             OR (NOT v_is_gain AND (gl_number LIKE '8755%' OR gl_number LIKE '876%'))
             OR gl_number LIKE '876%' 
             OR gl_number LIKE '976%'
           )
         LIMIT 1;
      END IF;
    END IF;
  END IF;

  IF v_diff_gl_id IS NULL THEN
    RAISE EXCEPTION 'Nem található megfelelő különbözeti főkönyvi számla a cégnél!';
  END IF;

  -- 4. Create new journal header
  INSERT INTO public.acc_journal_headers (
    company_id,
    journal_id,
    accounting_year,
    status,
    entry_type,
    source,
    posting_date,
    document_date,
    document_id,
    partner_id,
    description,
    currency,
    created_by
  ) VALUES (
    p_company_id,
    v_journal_ve.id,
    v_header.accounting_year,
    'KEZI_PISZKOZAT',
    'NORMAL',
    'KEZI',
    current_date,
    current_date,
    COALESCE(v_header.document_id, 'LEIRAS'),
    v_header.partner_id,
    COALESCE(p_description, CASE WHEN p_type = 'ROUNDING' THEN 'Kerekítési különbözet leírása' ELSE 'Realizált árfolyamkülönbözet' END),
    'HUF',
    auth.uid()
  ) RETURNING id INTO v_new_header_id;

  -- 5. Insert lines
  -- Line 1: Offsetting line on original GL account
  INSERT INTO public.acc_journal_lines (
    header_id,
    sequence_number,
    gl_account_id,
    dc_type,
    amount,
    description
  ) VALUES (
    v_new_header_id,
    1,
    v_line.gl_account_id,
    v_dc1,
    ABS(p_amount_huf),
    COALESCE(p_description, 'Különbözet leírása')
  ) RETURNING id INTO v_line1_id;

  -- Line 2: Difference expense / income account
  INSERT INTO public.acc_journal_lines (
    header_id,
    sequence_number,
    gl_account_id,
    dc_type,
    amount,
    description
  ) VALUES (
    v_new_header_id,
    2,
    v_diff_gl_id,
    v_dc2,
    ABS(p_amount_huf),
    COALESCE(p_description, 'Különbözet ellenszámla')
  ) RETURNING id INTO v_line2_id;

  -- Automatically post the write-off entry
  PERFORM public.acc_post_journal_entry(v_new_header_id, auth.uid());

  -- Settle the open line with the newly created offset line
  PERFORM public.settle_open_items(
    p_company_id,
    p_line_id,
    v_line1_id,
    ABS(p_amount_huf),
    NULL,
    p_type,
    'Automatikus különbözet leírás'
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_header_id', v_new_header_id,
    'line1_id', v_line1_id,
    'line2_id', v_line2_id,
    'diff_gl_id', v_diff_gl_id,
    'amount_huf', ABS(p_amount_huf)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.write_off_subledger_difference(UUID, UUID, VARCHAR, NUMERIC, UUID, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.write_off_subledger_difference(UUID, UUID, VARCHAR, NUMERIC, UUID, TEXT) TO authenticated, service_role;
