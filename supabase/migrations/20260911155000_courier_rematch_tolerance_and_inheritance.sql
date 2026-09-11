-- Migration: Improve courier report rematch logic with Hungarian cash rounding tolerance (<= 5 HUF) and aggregated transaction inheritance
CREATE OR REPLACE FUNCTION rematch_courier_report(p_report_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report courier_reports%ROWTYPE;
  v_nav_id uuid;
  v_trx_id uuid;
  v_status text;
  v_reason text := '';
  v_confidence numeric := 0;
  v_cod numeric;
  v_ref text;
  v_delivery date;
  v_company uuid;
  v_row_type text;
  v_upload_id uuid;
BEGIN
  SELECT * INTO v_report FROM courier_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Report not found');
  END IF;

  v_cod := abs(v_report.cod_amount);
  v_ref := v_report.reference_number;
  v_delivery := v_report.delivery_date;
  v_company := v_report.company_id;
  v_row_type := v_report.row_type;
  v_upload_id := v_report.upload_id;

  -- ═══ TOTAL/SUMMARY rows: match against GLS bank transactions ═══
  IF v_row_type = 'total' THEN
    IF v_delivery IS NULL THEN
      SELECT MAX(delivery_date) INTO v_delivery
      FROM courier_reports
      WHERE upload_id = v_upload_id AND row_type = 'item' AND delivery_date IS NOT NULL;
    END IF;

    SELECT id INTO v_trx_id
    FROM transactions
    WHERE company_id = v_company
      AND amount > 0
      AND description ILIKE '%GLS%'
      AND abs(amount) >= v_cod * 0.70
      AND abs(amount) <= v_cod * 1.02
      AND (v_delivery IS NULL OR (
        transaction_date >= v_delivery
        AND transaction_date <= (v_delivery + interval '21 days')::date
      ))
    ORDER BY abs(abs(amount) - v_cod) ASC
    LIMIT 1;

    IF v_trx_id IS NOT NULL THEN
      v_status := 'partial_trx';
      v_confidence := 0.88;
      v_reason := 'GLS aggregált COD átutalás';
    ELSE
      v_status := 'total';
      v_confidence := 0;
      v_reason := 'Összesítő sor — nincs tranzakció egyezés';
    END IF;

    UPDATE courier_reports
    SET match_status = v_status,
        matched_nav_invoice_id = null,
        matched_transaction_id = v_trx_id,
        match_reason = v_reason,
        match_confidence = v_confidence
    WHERE id = p_report_id;

    RETURN jsonb_build_object(
      'status', v_status, 'reason', v_reason,
      'confidence', v_confidence, 'transaction_id', v_trx_id
    );
  END IF;

  -- ═══ ITEM rows: NAV Invoice matching ═══
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
    SELECT id INTO v_nav_id
    FROM nav_invoices
    WHERE company_id = v_company
      AND invoice_direction = 'OUTBOUND'
      AND abs(invoice_gross_amount - v_cod) <= 5.0
      AND v_delivery IS NOT NULL
      AND invoice_issue_date BETWEEN (v_delivery - interval '7 days')::date AND (v_delivery + interval '3 days')::date
    ORDER BY abs(invoice_gross_amount - v_cod) ASC, abs(invoice_issue_date - v_delivery) ASC
    LIMIT 1;

    IF v_nav_id IS NOT NULL THEN
      v_reason := 'NAV Összeg + Dátum egyezés (kerekítés kezelve)';
      v_confidence := 0.85;
    END IF;
  END IF;

  -- Transaction matching for items:
  -- Direct match first
  IF v_ref IS NOT NULL AND v_ref != '' THEN
    SELECT id INTO v_trx_id
    FROM transactions
    WHERE company_id = v_company
      AND (description ILIKE '%' || v_ref || '%'
           OR description ILIKE '%' || v_report.package_number || '%')
    ORDER BY transaction_date DESC
    LIMIT 1;

    IF v_trx_id IS NOT NULL THEN
      v_reason := v_reason || CASE WHEN v_reason != '' THEN ' | ' ELSE '' END || 'Tranzakció hivatkozás egyezés';
      v_confidence := GREATEST(v_confidence, 0.80);
    END IF;
  END IF;

  -- If still no direct transaction match, inherit from the total row of the same upload
  IF v_trx_id IS NULL AND v_upload_id IS NOT NULL THEN
    SELECT matched_transaction_id INTO v_trx_id
    FROM courier_reports
    WHERE upload_id = v_upload_id AND row_type = 'total' AND matched_transaction_id IS NOT NULL
    LIMIT 1;

    IF v_trx_id IS NOT NULL THEN
      v_reason := v_reason || CASE WHEN v_reason != '' THEN ' | ' ELSE '' END || 'Tranzakció az összesítő soron keresztül párosítva';
      v_confidence := GREATEST(v_confidence, 0.80);
    END IF;
  END IF;

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

  UPDATE courier_reports
  SET match_status = v_status,
      matched_nav_invoice_id = v_nav_id,
      matched_transaction_id = v_trx_id,
      match_reason = v_reason,
      match_confidence = v_confidence
  WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'status', v_status, 'reason', v_reason,
    'confidence', v_confidence,
    'nav_invoice_id', v_nav_id, 'transaction_id', v_trx_id
  );
END;
$$;
