-- Migration: 20261017133000_acc_settle_open_items_with_fx_rpc.sql
-- Description: Automatic realized exchange rate difference booking on open item settlement.

CREATE OR REPLACE FUNCTION public.settle_open_items_with_fx(
  p_company_id uuid,
  p_invoice_line_id uuid,
  p_settling_line_id uuid,
  p_amount_huf numeric,
  p_amount_foreign numeric DEFAULT 0,
  p_match_type character varying DEFAULT 'MANUAL',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id uuid;
  v_inv_line record;
  v_settle_line record;
  v_inv_gl record;
  v_settle_gl record;
  v_inv_hdr record;
  v_settle_hdr record;
  v_preset_id uuid;
  v_journal_id uuid;
  v_gl_9762_id uuid;
  v_gl_8762_id uuid;
  v_fx_diff_huf numeric := 0;
  v_fx_header_id uuid := NULL;
  v_inv_rate numeric := 1.0;
  v_settle_rate numeric := 1.0;
  v_eff_inv_huf numeric := 0;
  v_eff_settle_huf numeric := 0;
  v_target_partner_id uuid;
  v_is_receivable boolean := false;
  v_is_payable boolean := false;
BEGIN
  -- Permission guard
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  IF p_amount_huf <= 0 AND COALESCE(p_amount_foreign, 0) <= 0 THEN
    RAISE EXCEPTION 'A rendezett összegnek pozitívnak kell lennie!';
  END IF;

  -- 1. Fetch line and header data
  SELECT l.* INTO v_inv_line FROM public.acc_journal_lines l WHERE l.id = p_invoice_line_id;
  SELECT l.* INTO v_settle_line FROM public.acc_journal_lines l WHERE l.id = p_settling_line_id;

  IF v_inv_line.id IS NULL OR v_settle_line.id IS NULL THEN
    RAISE EXCEPTION 'A párosítandó tételek egyike nem található!';
  END IF;

  SELECT h.* INTO v_inv_hdr FROM public.acc_journal_headers h WHERE h.id = v_inv_line.header_id;
  SELECT h.* INTO v_settle_hdr FROM public.acc_journal_headers h WHERE h.id = v_settle_line.header_id;

  SELECT a.* INTO v_inv_gl FROM public.gl_accounts a WHERE a.id = v_inv_line.gl_account_id;
  SELECT a.* INTO v_settle_gl FROM public.gl_accounts a WHERE a.id = v_settle_line.gl_account_id;

  v_target_partner_id := COALESCE(v_inv_line.partner_id, v_settle_line.partner_id, v_inv_hdr.partner_id, v_settle_hdr.partner_id);

  -- 2. Detect if foreign currency matching
  IF (COALESCE(p_amount_foreign, 0) > 0 OR COALESCE(v_inv_line.foreign_amount, 0) > 0) THEN
    -- Calculate rates
    IF COALESCE(v_inv_line.foreign_amount, 0) > 0 THEN
      v_inv_rate := ABS(v_inv_line.amount) / ABS(v_inv_line.foreign_amount);
    ELSIF v_inv_hdr.exchange_rate IS NOT NULL AND v_inv_hdr.exchange_rate > 0 THEN
      v_inv_rate := v_inv_hdr.exchange_rate;
    END IF;

    IF COALESCE(v_settle_line.foreign_amount, 0) > 0 THEN
      v_settle_rate := ABS(v_settle_line.amount) / ABS(v_settle_line.foreign_amount);
    ELSIF v_settle_hdr.exchange_rate IS NOT NULL AND v_settle_hdr.exchange_rate > 0 THEN
      v_settle_rate := v_settle_hdr.exchange_rate;
    ELSE
      -- Settling in HUF
      v_settle_rate := p_amount_huf / NULLIF(p_amount_foreign, 0);
    END IF;

    IF v_settle_rate IS NOT NULL AND v_inv_rate IS NOT NULL AND p_amount_foreign > 0 THEN
      v_eff_inv_huf := ROUND(p_amount_foreign * v_inv_rate);
      v_eff_settle_huf := ROUND(p_amount_foreign * v_settle_rate);
      v_fx_diff_huf := v_eff_settle_huf - v_eff_inv_huf;
    END IF;
  END IF;

  -- 3. If there is FX difference, book realized FX gain / loss
  IF v_fx_diff_huf <> 0 THEN
    v_preset_id := v_inv_gl.preset_id;
    
    -- Find 9762 / 8762 accounts
    SELECT id INTO v_gl_9762_id FROM public.gl_accounts 
    WHERE preset_id = v_preset_id AND (gl_number LIKE '9762%' OR gl_number LIKE '976%')
    ORDER BY gl_number LIMIT 1;

    SELECT id INTO v_gl_8762_id FROM public.gl_accounts 
    WHERE preset_id = v_preset_id AND (gl_number LIKE '8762%' OR gl_number LIKE '876%')
    ORDER BY gl_number LIMIT 1;

    -- Find Vegyes journal
    SELECT id INTO v_journal_id FROM public.acc_journals 
    WHERE company_id = p_company_id AND (code IN ('V1', 'VE', 'ARF') OR sub_type = 'general')
    LIMIT 1;

    IF v_journal_id IS NOT NULL AND (v_gl_9762_id IS NOT NULL OR v_gl_8762_id IS NOT NULL) THEN
      v_is_receivable := (v_inv_gl.gl_number LIKE '31%' OR v_settle_gl.gl_number LIKE '31%');
      v_is_payable := (v_inv_gl.gl_number LIKE '45%' OR v_settle_gl.gl_number LIKE '45%');

      -- Insert header
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
        exchange_rate,
        created_by
      ) VALUES (
        p_company_id,
        v_journal_id,
        EXTRACT(YEAR FROM COALESCE(v_settle_hdr.posting_date, now()))::integer,
        'KONYVELT',
        'VEGYES',
        'AUTO_ARFOLYAM',
        COALESCE(v_settle_hdr.posting_date, CURRENT_DATE),
        COALESCE(v_settle_hdr.document_date, CURRENT_DATE),
        'ARF-' || SUBSTRING(COALESCE(v_settle_hdr.document_id, v_inv_hdr.document_id, 'FX') FROM 1 FOR 15),
        v_target_partner_id,
        'Realizált árfolyamkülönbözet: ' || COALESCE(v_inv_hdr.document_id, ''),
        'HUF',
        1.0,
        auth.uid()
      ) RETURNING id INTO v_fx_header_id;

      -- Post lines:
      -- Case A: Vevő (Receivable)
      IF v_is_receivable OR NOT v_is_payable THEN
        IF v_fx_diff_huf > 0 AND v_gl_9762_id IS NOT NULL THEN
          -- GAIN: T 316 (vevő) / K 9762 (nyereség)
          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, partner_id, description)
          VALUES (v_fx_header_id, 1, v_inv_gl.id, 'T', v_fx_diff_huf, v_target_partner_id, 'Realizált árfolyamnyereség');
          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
          VALUES (v_fx_header_id, 2, v_gl_9762_id, 'K', v_fx_diff_huf, 'Pénzügyi műveletek egyéb bevételei');
        ELSIF v_fx_diff_huf < 0 AND v_gl_8762_id IS NOT NULL THEN
          -- LOSS: T 8762 (veszteség) / K 316 (vevő)
          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
          VALUES (v_fx_header_id, 1, v_gl_8762_id, 'T', ABS(v_fx_diff_huf), 'Pénzügyi műveletek egyéb ráfordításai');
          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, partner_id, description)
          VALUES (v_fx_header_id, 2, v_inv_gl.id, 'K', ABS(v_fx_diff_huf), v_target_partner_id, 'Realizált árfolyamveszteség');
        END IF;
      -- Case B: Szállító (Payable)
      ELSE
        IF v_fx_diff_huf < 0 AND v_gl_9762_id IS NOT NULL THEN
          -- GAIN: Paid less HUF than original invoice: T 4542 / K 9762
          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, partner_id, description)
          VALUES (v_fx_header_id, 1, v_inv_gl.id, 'T', ABS(v_fx_diff_huf), v_target_partner_id, 'Realizált árfolyamnyereség');
          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
          VALUES (v_fx_header_id, 2, v_gl_9762_id, 'K', ABS(v_fx_diff_huf), 'Pénzügyi műveletek egyéb bevételei');
        ELSIF v_fx_diff_huf > 0 AND v_gl_8762_id IS NOT NULL THEN
          -- LOSS: Paid more HUF than original invoice: T 8762 / K 4542
          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
          VALUES (v_fx_header_id, 1, v_gl_8762_id, 'T', v_fx_diff_huf, 'Pénzügyi műveletek egyéb ráfordításai');
          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, partner_id, description)
          VALUES (v_fx_header_id, 2, v_inv_gl.id, 'K', v_fx_diff_huf, v_target_partner_id, 'Realizált árfolyamveszteség');
        END IF;
      END IF;
    END IF;
  END IF;

  -- 4. Record the match in acc_open_item_matches
  INSERT INTO public.acc_open_item_matches (
    company_id,
    invoice_line_id,
    settling_line_id,
    settled_amount_huf,
    settled_amount_foreign,
    settled_by,
    match_type,
    notes
  ) VALUES (
    p_company_id,
    p_invoice_line_id,
    p_settling_line_id,
    p_amount_huf,
    p_amount_foreign,
    auth.uid(),
    p_match_type,
    p_notes
  ) RETURNING id INTO v_match_id;

  RETURN jsonb_build_object(
    'match_id', v_match_id,
    'fx_diff_huf', v_fx_diff_huf,
    'fx_header_id', v_fx_header_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_open_items_with_fx(uuid, uuid, uuid, numeric, numeric, character varying, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_open_items_with_fx(uuid, uuid, uuid, numeric, numeric, character varying, text) TO authenticated, service_role;
