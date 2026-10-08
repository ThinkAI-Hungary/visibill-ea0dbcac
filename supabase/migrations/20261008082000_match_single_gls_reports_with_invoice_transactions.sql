-- Migration: 20261008082000_match_single_gls_reports_with_invoice_transactions.sql
-- Description: Enable courier report matching (GLS/MPL) for single-item or direct COD shipments
--              where the bank transaction has already been paired with the invoice.
--              Links both matched_transaction_id and matched_nav_invoice_id to the courier report.

CREATE OR REPLACE FUNCTION public.rematch_courier_report(p_report_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_report RECORD;
  v_upload RECORD;
  v_total_row RECORD;
  v_company uuid;
  v_upload_id uuid;
  v_report_type text;
  v_row_type text;
  v_ref text;
  v_cod numeric;
  v_delivery date;
  v_nav_id uuid;
  v_trx_id uuid;
  v_cand_trx_id uuid;
  v_cand_nav_id uuid;
  v_existing_status text;
  v_existing_reason text;
  v_existing_confidence numeric;
  v_existing_nav_id uuid;
  v_existing_trx_id uuid;
  v_status text := 'unmatched';
  v_reason text := '';
  v_confidence numeric := 0;
  v_items_updated integer := 0;
BEGIN
  -- Fetch the courier report row
  SELECT * INTO v_report FROM courier_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'report_not_found');
  END IF;

  v_company := v_report.company_id;
  v_upload_id := v_report.upload_id;
  v_report_type := COALESCE(v_report.report_type, 'gls');
  v_row_type := COALESCE(v_report.row_type, 'item');
  v_ref := v_report.reference_number;
  v_cod := v_report.cod_amount;
  v_delivery := v_report.delivery_date;
  v_existing_status := v_report.match_status;
  v_existing_reason := v_report.match_reason;
  v_existing_confidence := v_report.match_confidence;
  v_existing_nav_id := v_report.matched_nav_invoice_id;
  v_existing_trx_id := v_report.matched_transaction_id;

  -- ═══════════════════════════════════════════════════════════════
  -- ═══ TOTAL / SUMMARY rows ═══
  -- ═══════════════════════════════════════════════════════════════
  IF v_row_type = 'total' THEN
    -- If total row has no delivery_date, derive from max of sibling items
    IF v_delivery IS NULL THEN
      SELECT max(delivery_date) INTO v_delivery
      FROM courier_reports
      WHERE upload_id = v_upload_id AND row_type = 'item' AND delivery_date IS NOT NULL;
    END IF;

    -- Match aggregated transaction: 70%..102% of total COD, 3..21 days after delivery
    SELECT id INTO v_trx_id
    FROM transactions
    WHERE company_id = v_company
      AND (
        (v_report_type = 'gls' AND (description ILIKE '%gls%' OR description ILIKE '%cod%'))
        OR (v_report_type = 'mpl' AND (description ILIKE '%posta%' OR description ILIKE '%mpl%'))
        OR (description ILIKE '%' || v_report_type || '%')
      )
      AND amount > 0
      AND amount <= abs(v_cod) * 1.02
      AND amount >= abs(v_cod) * 0.70
      AND (v_delivery IS NULL OR transaction_date BETWEEN v_delivery AND (v_delivery + interval '21 days')::date)
    ORDER BY abs(abs(v_cod) - amount) ASC, transaction_date ASC
    LIMIT 1;

    IF v_trx_id IS NOT NULL THEN
      v_status := 'total';
      v_confidence := 0.90;
      v_reason := upper(v_report_type) || ' aggregált COD átutalás (auto rematch)';

      -- Update the total row
      UPDATE courier_reports
      SET match_status = v_status,
          matched_transaction_id = v_trx_id,
          match_reason = v_reason,
          match_confidence = v_confidence,
          matched_nav_invoice_id = null
      WHERE id = p_report_id;

      -- Propagate this transaction to all child item rows
      UPDATE courier_reports
      SET matched_transaction_id = v_trx_id,
          match_status = CASE 
            WHEN matched_nav_invoice_id IS NOT NULL THEN 'full'
            ELSE 'partial_trx'
          END,
          match_confidence = CASE
            WHEN matched_nav_invoice_id IS NOT NULL THEN GREATEST(COALESCE(match_confidence, 0.8), 0.90)
            ELSE 0.80
          END,
          match_reason = CASE
            WHEN match_reason IS NOT NULL AND match_reason != '' AND match_reason NOT ILIKE '%aggregált%' 
              THEN match_reason || ' | ' || upper(v_report_type) || ' aggregált COD átutalás (összesítőből)'
            ELSE upper(v_report_type) || ' aggregált COD átutalás (összesítőből)'
          END
      WHERE upload_id = v_upload_id
        AND row_type = 'item'
        AND (matched_transaction_id IS NULL OR matched_transaction_id != v_trx_id);

      GET DIAGNOSTICS v_items_updated = ROW_COUNT;

    ELSE
      IF v_existing_trx_id IS NOT NULL THEN
        v_status := v_existing_status;
        v_reason := v_existing_reason;
        v_confidence := v_existing_confidence;
        v_trx_id := v_existing_trx_id;
      ELSE
        v_status := 'total';
        v_confidence := 0;
        v_reason := 'Összesítő sor — nincs tranzakció egyezés';
        UPDATE courier_reports
        SET match_status = v_status, matched_transaction_id = null,
            match_reason = v_reason, match_confidence = v_confidence
        WHERE id = p_report_id;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'status', v_status,
      'reason', v_reason,
      'confidence', v_confidence,
      'transaction_id', v_trx_id,
      'items_updated', v_items_updated
    );
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- ═══ ITEM rows ═══
  -- ═══════════════════════════════════════════════════════════════

  -- Strategy 1: Reference number match with NAV outbound invoices
  SELECT id INTO v_nav_id
  FROM nav_invoices
  WHERE company_id = v_company
    AND invoice_direction = 'OUTBOUND'
    AND invoice_number = v_ref
  LIMIT 1;

  IF v_nav_id IS NOT NULL THEN
    v_reason := 'NAV Számlaszám egyezés';
    v_confidence := 0.95;
  ELSE
    -- Strategy 2: Amount + 14-day lookback, 5-day forward (with ±5 HUF cash rounding tolerance)
    SELECT id INTO v_nav_id
    FROM nav_invoices
    WHERE company_id = v_company
      AND invoice_direction = 'OUTBOUND'
      AND abs(invoice_gross_amount - v_cod) <= 5.0
      AND v_delivery IS NOT NULL
      AND invoice_issue_date BETWEEN (v_delivery - interval '14 days')::date 
                                 AND (v_delivery + interval '5 days')::date
    ORDER BY abs(invoice_gross_amount - v_cod) ASC, abs(invoice_issue_date - v_delivery) ASC
    LIMIT 1;

    IF v_nav_id IS NOT NULL THEN
      v_reason := 'NAV Összeg + Dátum egyezés (kerekítés kezelve)';
      v_confidence := 0.85;
    END IF;
  END IF;

  -- Preserve existing NAV match if no new one found
  IF v_nav_id IS NULL AND v_existing_nav_id IS NOT NULL THEN
    v_nav_id := v_existing_nav_id;
    IF v_reason = '' THEN
      v_reason := COALESCE(v_existing_reason, 'Meglévő NAV számla párosítás');
      v_confidence := v_existing_confidence;
    END IF;
  END IF;

  -- Transaction matching for items:
  -- 1. Check if the sibling 'total' row already has a matched transaction
  SELECT * INTO v_total_row
  FROM courier_reports
  WHERE upload_id = v_upload_id AND row_type = 'total'
  LIMIT 1;

  IF FOUND AND v_total_row.matched_transaction_id IS NOT NULL THEN
    v_trx_id := v_total_row.matched_transaction_id;
    v_reason := v_reason || CASE WHEN v_reason != '' THEN ' | ' ELSE '' END || upper(v_report_type) || ' aggregált COD átutalás (összesítőből)';
    v_confidence := GREATEST(v_confidence, 0.85);
  ELSIF FOUND AND v_total_row.matched_transaction_id IS NULL THEN
    -- Try to match the total row first!
    PERFORM public.rematch_courier_report(v_total_row.id);
    -- Check if total row is now matched
    SELECT matched_transaction_id INTO v_trx_id
    FROM courier_reports
    WHERE id = v_total_row.id;

    IF v_trx_id IS NOT NULL THEN
      v_reason := v_reason || CASE WHEN v_reason != '' THEN ' | ' ELSE '' END || upper(v_report_type) || ' aggregált COD átutalás (összesítőből)';
      v_confidence := GREATEST(v_confidence, 0.85);
    END IF;
  END IF;

  -- 2. If still no transaction, try direct reference/package_number lookup
  IF v_trx_id IS NULL AND v_ref IS NOT NULL AND v_ref != '' THEN
    SELECT id INTO v_trx_id
    FROM transactions
    WHERE company_id = v_company
      AND (description ILIKE '%' || v_ref || '%'
           OR (v_report.package_number IS NOT NULL AND v_report.package_number != '' AND description ILIKE '%' || v_report.package_number || '%'))
    ORDER BY transaction_date DESC
    LIMIT 1;

    IF v_trx_id IS NOT NULL THEN
      v_reason := v_reason || CASE WHEN v_reason != '' THEN ' | ' ELSE '' END || 'Tranzakció hivatkozás egyezés';
      v_confidence := GREATEST(v_confidence, 0.80);
    END IF;
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- Strategy 3: 1-item / Direct COD Match via paired Transaction + Invoice
  -- If we don't have a full match, check if there is an existing courier transaction
  -- that is already matched to a NAV invoice with the same amount
  -- ═══════════════════════════════════════════════════════════════
  IF (v_nav_id IS NULL OR v_trx_id IS NULL) AND v_cod IS NOT NULL THEN
    SELECT t.id, t.matched_invoice_id INTO v_cand_trx_id, v_cand_nav_id
    FROM transactions t
    JOIN nav_invoices ni ON ni.id = t.matched_invoice_id
    WHERE t.company_id = v_company
      AND abs(t.amount - v_cod) <= 1.0
      AND abs(ni.invoice_gross_amount - v_cod) <= 5.0
      AND (
        t.description ILIKE '%gls%' 
        OR t.description ILIKE '%cod%' 
        OR t.description ILIKE '%utánvét%' 
        OR t.description ILIKE '%utanvet%'
        OR (v_report_type = 'mpl' AND (t.description ILIKE '%posta%' OR t.description ILIKE '%mpl%'))
      )
      AND (v_delivery IS NULL OR t.transaction_date BETWEEN (v_delivery - interval '3 days')::date AND (v_delivery + interval '21 days')::date)
    ORDER BY abs(t.transaction_date - COALESCE(v_delivery, t.transaction_date)) ASC
    LIMIT 1;

    IF v_cand_trx_id IS NOT NULL AND v_cand_nav_id IS NOT NULL THEN
      v_trx_id := v_cand_trx_id;
      v_nav_id := v_cand_nav_id;
      v_confidence := 0.95;
      v_reason := upper(v_report_type) || ' utánvét: meglévő számla + tranzakció párhoz rendelve';
    END IF;
  END IF;

  -- Strategy 4: Direct COD Match via transaction_invoice_matches junction
  IF (v_nav_id IS NULL OR v_trx_id IS NULL) AND v_cod IS NOT NULL THEN
    SELECT tim.transaction_id, tim.invoice_id INTO v_cand_trx_id, v_cand_nav_id
    FROM transaction_invoice_matches tim
    JOIN transactions t ON t.id = tim.transaction_id
    JOIN nav_invoices ni ON ni.id = tim.invoice_id
    WHERE t.company_id = v_company
      AND abs(t.amount - v_cod) <= 1.0
      AND abs(ni.invoice_gross_amount - v_cod) <= 5.0
      AND (
        t.description ILIKE '%gls%' 
        OR t.description ILIKE '%cod%' 
        OR t.description ILIKE '%utánvét%' 
        OR t.description ILIKE '%utanvet%'
        OR (v_report_type = 'mpl' AND (t.description ILIKE '%posta%' OR t.description ILIKE '%mpl%'))
      )
      AND (v_delivery IS NULL OR t.transaction_date BETWEEN (v_delivery - interval '3 days')::date AND (v_delivery + interval '21 days')::date)
    ORDER BY abs(t.transaction_date - COALESCE(v_delivery, t.transaction_date)) ASC
    LIMIT 1;

    IF v_cand_trx_id IS NOT NULL AND v_cand_nav_id IS NOT NULL THEN
      v_trx_id := v_cand_trx_id;
      v_nav_id := v_cand_nav_id;
      v_confidence := 0.95;
      v_reason := upper(v_report_type) || ' utánvét: meglévő számla + tranzakció párhoz rendelve (kapcsolótáblából)';
    END IF;
  END IF;

  -- Strategy 5: If NAV invoice was matched, but transaction is missing, check if the NAV invoice already has transaction_id
  IF v_nav_id IS NOT NULL AND v_trx_id IS NULL THEN
    SELECT transaction_id INTO v_cand_trx_id
    FROM nav_invoices
    WHERE id = v_nav_id AND transaction_id IS NOT NULL;

    IF v_cand_trx_id IS NOT NULL THEN
      v_trx_id := v_cand_trx_id;
      v_confidence := GREATEST(v_confidence, 0.90);
      v_reason := v_reason || ' | Tranzakció átvéve a számláról';
    END IF;
  END IF;

  -- Strategy 6: If transaction was matched, but NAV invoice is missing, check if the transaction has matched_invoice_id
  IF v_trx_id IS NOT NULL AND v_nav_id IS NULL THEN
    SELECT matched_invoice_id INTO v_cand_nav_id
    FROM transactions
    WHERE id = v_trx_id AND matched_invoice_id IS NOT NULL;

    IF v_cand_nav_id IS NOT NULL THEN
      v_nav_id := v_cand_nav_id;
      v_confidence := GREATEST(v_confidence, 0.90);
      v_reason := v_reason || ' | Számla átvéve a tranzakcióról';
    END IF;
  END IF;

  -- Preserve existing transaction match if no new match found
  IF v_trx_id IS NULL AND v_existing_trx_id IS NOT NULL THEN
    v_trx_id := v_existing_trx_id;
  END IF;

  -- Determine match status
  IF v_nav_id IS NOT NULL AND v_trx_id IS NOT NULL THEN
    v_status := 'full';
  ELSIF v_nav_id IS NOT NULL THEN
    v_status := 'partial_nav';
  ELSIF v_trx_id IS NOT NULL THEN
    v_status := 'partial_trx';
  ELSE
    v_status := 'unmatched';
    v_reason := 'Nincs egyezés (auto rematch)';
    v_confidence := 0;
  END IF;

  IF v_reason = '' AND (v_nav_id IS NOT NULL OR v_trx_id IS NOT NULL) THEN
    v_reason := COALESCE(v_existing_reason, 'Meglévő párosítás megtartva');
    v_confidence := GREATEST(v_confidence, v_existing_confidence);
  END IF;

  UPDATE courier_reports
  SET match_status = v_status,
      matched_nav_invoice_id = v_nav_id,
      matched_transaction_id = v_trx_id,
      match_reason = v_reason,
      match_confidence = v_confidence
  WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'status', v_status,
    'reason', v_reason,
    'confidence', v_confidence,
    'nav_invoice_id', v_nav_id,
    'transaction_id', v_trx_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rematch_courier_report(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rematch_courier_report(uuid) TO authenticated;
