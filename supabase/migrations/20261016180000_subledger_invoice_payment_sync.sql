-- Migration: 20261016180000_subledger_invoice_payment_sync.sql
-- Description:
--   1. Implements public.sync_invoice_settlement_status(p_company_id uuid, p_line_id uuid)
--      Automatically synchronizes invoices.fizetve, is_manual_payment, manual_payment_type
--      with double-entry subledger settlements in acc_open_item_matches.
--   2. Updates settle_open_items to automatically trigger sync_invoice_settlement_status.
--   3. Updates unsettle_open_items to automatically reopen invoices when matches are unlinked.
--   4. Updates write_off_subledger_difference to synchronize settled invoices upon write-off.
--   5. Implements public.sync_all_subledger_invoices(p_company_id uuid) backfill utility.
--   6. Performs one-time data reconciliation for VBV Vision Kft. and all active companies.

-- 1. Helper Function: sync_invoice_settlement_status
CREATE OR REPLACE FUNCTION public.sync_invoice_settlement_status(
  p_company_id uuid,
  p_line_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_line RECORD;
  v_inv RECORD;
  v_total_settled NUMERIC(18,2) := 0;
  v_settle_date DATE;
  v_j_type TEXT;
  v_j_code TEXT;
  v_payment_type TEXT;
  v_note TEXT;
BEGIN
  IF p_company_id IS NULL OR p_line_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Fetch journal line, header, and GL account details
  SELECT 
    l.id,
    l.amount,
    l.gl_account_id,
    h.document_id,
    h.company_id,
    h.posting_date,
    g.subledger_type,
    g.is_open_item_managed
  INTO v_line
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON h.id = l.header_id
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  WHERE l.id = p_line_id AND h.company_id = p_company_id;

  IF NOT FOUND OR v_line.document_id IS NULL OR TRIM(v_line.document_id) = '' THEN
    RETURN FALSE;
  END IF;

  -- Only proceed for subledger managed lines (partner or open-item accounts)
  IF NOT (COALESCE(v_line.is_open_item_managed, false) = true OR v_line.subledger_type IN ('partner', 'detail')) THEN
    RETURN FALSE;
  END IF;

  -- 2. Check if a corresponding invoice exists in the invoices table
  SELECT id, fizetve, manual_payment_note, is_manual_payment, manual_payment_type
  INTO v_inv
  FROM public.invoices
  WHERE company_id = p_company_id
    AND UPPER(TRIM(bizonylatsorszam)) = UPPER(TRIM(v_line.document_id))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 3. Calculate total settled amount for this journal line from acc_open_item_matches
  SELECT COALESCE(SUM(settled_amount_huf), 0)
  INTO v_total_settled
  FROM (
    SELECT settled_amount_huf FROM public.acc_open_item_matches 
    WHERE company_id = p_company_id AND invoice_line_id = p_line_id
    UNION ALL
    SELECT settled_amount_huf FROM public.acc_open_item_matches 
    WHERE company_id = p_company_id AND settling_line_id = p_line_id
  ) s;

  -- 4. Case A: Line is 100% settled (remaining amount <= 0.01 Ft)
  IF v_total_settled >= (v_line.amount - 0.01) THEN
    -- Find the latest counter-line details (journal type and posting date)
    SELECT other_h.posting_date, other_j.type, other_j.code
    INTO v_settle_date, v_j_type, v_j_code
    FROM public.acc_open_item_matches m
    JOIN public.acc_journal_lines other_l 
      ON other_l.id = (CASE WHEN m.invoice_line_id = p_line_id THEN m.settling_line_id ELSE m.invoice_line_id END)
    JOIN public.acc_journal_headers other_h ON other_h.id = other_l.header_id
    LEFT JOIN public.acc_journals other_j ON other_j.id = other_h.journal_id
    WHERE m.company_id = p_company_id 
      AND (m.invoice_line_id = p_line_id OR m.settling_line_id = p_line_id)
    ORDER BY m.settled_at DESC
    LIMIT 1;

    IF v_j_type = 'CASH' OR v_j_code = 'P1' THEN
      v_payment_type := 'petty_cash';
      v_note := 'Folyószámlán készpénzzel rendezve';
    ELSIF v_j_type = 'BANK' OR v_j_code = 'B1' THEN
      v_payment_type := 'transfer';
      v_note := 'Folyószámlán banki átutalással rendezve';
    ELSIF v_j_type = 'MIXED' OR v_j_code = 'VE' THEN
      v_payment_type := 'compensation';
      v_note := 'Folyószámlán kompenzációval rendezve';
    ELSE
      v_payment_type := 'manual';
      v_note := 'Folyószámlán rendezve';
    END IF;

    -- Update invoice to paid
    UPDATE public.invoices
    SET 
      fizetve = true,
      is_manual_payment = true,
      manual_payment_date = COALESCE(manual_payment_date, v_settle_date, v_line.posting_date),
      manual_payment_type = COALESCE(manual_payment_type, v_payment_type),
      manual_payment_note = COALESCE(manual_payment_note, v_note)
    WHERE id = v_inv.id
      AND fizetve = false;

    -- Also synchronize nav_invoices if exists
    UPDATE public.nav_invoices
    SET 
      paid = true,
      payment_date = COALESCE(payment_date, v_settle_date, v_line.posting_date)
    WHERE company_id = p_company_id
      AND UPPER(TRIM(invoice_number)) = UPPER(TRIM(v_line.document_id))
      AND paid = false;

    RETURN TRUE;

  -- 4. Case B: Line is reopened / not fully settled (remaining amount > 0.01 Ft)
  ELSIF v_total_settled < (v_line.amount - 0.01) THEN
    -- If it was previously marked paid by subledger settlement, reopen it
    IF v_inv.fizetve = true AND (v_inv.manual_payment_note LIKE 'Folyószámlán%' OR v_inv.manual_payment_note IS NULL) THEN
      UPDATE public.invoices
      SET 
        fizetve = false,
        is_manual_payment = false,
        manual_payment_date = NULL,
        manual_payment_type = NULL,
        manual_payment_note = NULL
      WHERE id = v_inv.id;

      UPDATE public.nav_invoices
      SET 
        paid = false,
        payment_date = NULL
      WHERE company_id = p_company_id
        AND UPPER(TRIM(invoice_number)) = UPPER(TRIM(v_line.document_id))
        AND paid = true;

      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_invoice_settlement_status(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_invoice_settlement_status(uuid, uuid) TO authenticated, service_role;


-- 2. Enhanced settle_open_items (with automatic invoice synchronization)
CREATE OR REPLACE FUNCTION public.settle_open_items(
  p_company_id uuid,
  p_invoice_line_id uuid,
  p_settling_line_id uuid,
  p_amount_huf numeric,
  p_amount_foreign numeric DEFAULT NULL::numeric,
  p_match_type character varying DEFAULT 'MANUAL'::character varying,
  p_notes text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_match_id UUID;
BEGIN
  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  IF p_amount_huf <= 0 THEN
    RAISE EXCEPTION 'A rendezett összegnek pozitívnak kell lennie!';
  END IF;

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

  -- Two-way synchronization: update invoice settlement status for both lines
  PERFORM public.sync_invoice_settlement_status(p_company_id, p_invoice_line_id);
  PERFORM public.sync_invoice_settlement_status(p_company_id, p_settling_line_id);

  RETURN v_match_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.settle_open_items(uuid, uuid, uuid, numeric, numeric, character varying, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_open_items(uuid, uuid, uuid, numeric, numeric, character varying, text) TO authenticated, service_role;


-- 3. Enhanced unsettle_open_items (with automatic invoice reopening)
CREATE OR REPLACE FUNCTION public.unsettle_open_items(
  p_company_id uuid,
  p_match_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inv_line_id UUID;
  v_set_line_id UUID;
BEGIN
  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  -- Capture lines before deletion
  SELECT invoice_line_id, settling_line_id
  INTO v_inv_line_id, v_set_line_id
  FROM public.acc_open_item_matches
  WHERE id = p_match_id AND company_id = p_company_id;

  DELETE FROM public.acc_open_item_matches
  WHERE id = p_match_id AND company_id = p_company_id;

  IF FOUND THEN
    -- Two-way synchronization: reopen invoices if lines are no longer 100% settled
    PERFORM public.sync_invoice_settlement_status(p_company_id, v_inv_line_id);
    PERFORM public.sync_invoice_settlement_status(p_company_id, v_set_line_id);
  END IF;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.unsettle_open_items(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsettle_open_items(uuid, uuid) TO authenticated, service_role;


-- 4. Enhanced write_off_subledger_difference (with automatic invoice synchronization)
CREATE OR REPLACE FUNCTION public.write_off_subledger_difference(
  p_company_id uuid,
  p_line_id uuid,
  p_type character varying DEFAULT 'ROUNDING'::character varying,
  p_amount_huf numeric DEFAULT 0,
  p_target_gl_id uuid DEFAULT NULL::uuid,
  p_description text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_line RECORD;
  v_header RECORD;
  v_auto_rules RECORD;
  v_journal_id UUID;
  v_target_gl UUID;
  v_new_header_id UUID;
  v_new_line1_id UUID;
  v_new_line2_id UUID;
  v_dc1 CHAR(1);
  v_dc2 CHAR(1);
  v_match_id UUID;
  v_desc TEXT;
BEGIN
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  SELECT l.*, g.subledger_type, g.gl_number, g.is_open_item_managed
  INTO v_line
  FROM public.acc_journal_lines l
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  WHERE l.id = p_line_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A könyvelési sor nem található!';
  END IF;

  SELECT * INTO v_header
  FROM public.acc_journal_headers
  WHERE id = v_line.header_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A naplófej nem található vagy jogosulatlan hozzáférés!';
  END IF;

  -- Find Vegyes (VE) journal
  SELECT id INTO v_journal_id
  FROM public.acc_journals
  WHERE company_id = p_company_id AND (code = 'VE' OR type = 'MIXED')
  LIMIT 1;

  IF v_journal_id IS NULL THEN
    RAISE EXCEPTION 'A Vegyes (VE) napló nem található ennél a cégnél!';
  END IF;

  -- Determine target GL account for write-off
  IF p_target_gl_id IS NOT NULL THEN
    v_target_gl := p_target_gl_id;
  ELSE
    SELECT rounding_expense_gl_id, rounding_income_gl_id, fx_loss_gl_id, fx_gain_gl_id
    INTO v_auto_rules
    FROM public.company_auto_accounting_rules
    WHERE company_id = p_company_id;

    IF p_type = 'ROUNDING' THEN
      IF v_line.dc_type = 'T' THEN
        v_target_gl := COALESCE(v_auto_rules.rounding_income_gl_id, (SELECT id FROM public.gl_accounts WHERE company_id = p_company_id AND gl_number LIKE '9779%' LIMIT 1));
      ELSE
        v_target_gl := COALESCE(v_auto_rules.rounding_expense_gl_id, (SELECT id FROM public.gl_accounts WHERE company_id = p_company_id AND gl_number LIKE '8755%' LIMIT 1));
      END IF;
    ELSE
      IF v_line.dc_type = 'T' THEN
        v_target_gl := COALESCE(v_auto_rules.fx_gain_gl_id, (SELECT id FROM public.gl_accounts WHERE company_id = p_company_id AND gl_number LIKE '9762%' LIMIT 1));
      ELSE
        v_target_gl := COALESCE(v_auto_rules.fx_loss_gl_id, (SELECT id FROM public.gl_accounts WHERE company_id = p_company_id AND gl_number LIKE '8762%' LIMIT 1));
      END IF;
    END IF;
  END IF;

  IF v_target_gl IS NULL THEN
    RAISE EXCEPTION 'A különbözet leírási ellenszámla nem található!';
  END IF;

  v_desc := COALESCE(p_description, CASE WHEN p_type = 'ROUNDING' THEN 'Kerekítési különbözet leírása' ELSE 'Árfolyamkülönbözet leírása' END || ' (' || v_header.document_id || ')');

  -- Create offsetting 2-legged journal entry in VE journal
  INSERT INTO public.acc_journal_headers (
    company_id,
    journal_id,
    posting_date,
    document_date,
    document_id,
    partner_id,
    description,
    status
  ) VALUES (
    p_company_id,
    v_journal_id,
    CURRENT_DATE,
    CURRENT_DATE,
    v_header.document_id,
    v_header.partner_id,
    v_desc,
    'KONYVELT'
  ) RETURNING id INTO v_new_header_id;

  -- Line 1: offsetting the open line (opposite DC)
  v_dc1 := CASE WHEN v_line.dc_type = 'T' THEN 'K' ELSE 'T' END;
  INSERT INTO public.acc_journal_lines (
    header_id,
    gl_account_id,
    dc_type,
    amount,
    description,
    sequence_number
  ) VALUES (
    v_new_header_id,
    v_line.gl_account_id,
    v_dc1,
    p_amount_huf,
    v_desc,
    1
  ) RETURNING id INTO v_new_line1_id;

  -- Line 2: write-off expense/revenue
  v_dc2 := v_line.dc_type;
  INSERT INTO public.acc_journal_lines (
    header_id,
    gl_account_id,
    dc_type,
    amount,
    description,
    sequence_number
  ) VALUES (
    v_new_header_id,
    v_target_gl,
    v_dc2,
    p_amount_huf,
    v_desc,
    2
  ) RETURNING id INTO v_new_line2_id;

  -- Create matching record in acc_open_item_matches
  INSERT INTO public.acc_open_item_matches (
    company_id,
    invoice_line_id,
    settling_line_id,
    settled_amount_huf,
    settled_by,
    match_type,
    notes
  ) VALUES (
    p_company_id,
    p_line_id,
    v_new_line1_id,
    p_amount_huf,
    auth.uid(),
    p_type,
    v_desc
  ) RETURNING id INTO v_match_id;

  -- Synchronize invoice settlement status
  PERFORM public.sync_invoice_settlement_status(p_company_id, p_line_id);

  RETURN jsonb_build_object(
    'success', true,
    'match_id', v_match_id,
    'header_id', v_new_header_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.write_off_subledger_difference(uuid, uuid, character varying, numeric, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_off_subledger_difference(uuid, uuid, character varying, numeric, uuid, text) TO authenticated, service_role;


-- 5. Backfill Utility: sync_all_subledger_invoices
CREATE OR REPLACE FUNCTION public.sync_all_subledger_invoices(p_company_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rec RECORD;
  v_count integer := 0;
BEGIN
  IF p_company_id IS NOT NULL THEN
    PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');
  END IF;

  FOR v_rec IN
    WITH line_settlements AS (
      SELECT 
        l_id,
        SUM(s_amt) as total_settled
      FROM (
        SELECT invoice_line_id as l_id, settled_amount_huf as s_amt FROM public.acc_open_item_matches
        UNION ALL
        SELECT settling_line_id as l_id, settled_amount_huf as s_amt FROM public.acc_open_item_matches
      ) raw_s
      GROUP BY l_id
    )
    SELECT 
      l.id as line_id,
      h.company_id,
      h.document_id
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON h.id = l.header_id
    JOIN public.gl_accounts g ON g.id = l.gl_account_id
    JOIN line_settlements ls ON ls.l_id = l.id
    JOIN public.invoices inv ON inv.company_id = h.company_id 
      AND UPPER(TRIM(inv.bizonylatsorszam)) = UPPER(TRIM(h.document_id))
    WHERE (p_company_id IS NULL OR h.company_id = p_company_id)
      AND (g.subledger_type = 'partner' OR g.is_open_item_managed = true)
      AND ls.total_settled >= (l.amount - 0.01)
      AND inv.fizetve = false
  LOOP
    IF public.sync_invoice_settlement_status(v_rec.company_id, v_rec.line_id) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_all_subledger_invoices(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_all_subledger_invoices(uuid) TO authenticated, service_role;


-- 6. One-time data cleanup and backfill for VBV Vision Kft.
-- 6a. Link SZE-2026-3 petty cash entry to invoice
UPDATE public.petty_cash_entries
SET 
  source_id = '779b6a3f-e99a-488f-ad4d-cbd1b54b98b3',
  source_table = 'invoices'
WHERE id = '58522b7b-3fce-4eb0-8d8b-1aef95f40bcb'
  AND company_id = '5364d0be-e92a-4b94-9704-f457cf71f140';

-- 6b. Synchronize all fully settled subledger invoices for VBV Vision Kft.
DO $$
BEGIN
  PERFORM public.sync_all_subledger_invoices('5364d0be-e92a-4b94-9704-f457cf71f140');
END;
$$;
