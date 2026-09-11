-- Migration: Auto-settle INBOUND invoices when a compensation courier report is uploaded/inserted
-- Handles GLS / courier compensation letters (row_type = 'compensation')

-- 1. Helper function: settle invoices referenced in a compensation report row
CREATE OR REPLACE FUNCTION public.settle_compensation_for_courier_report(
  p_report_id uuid,
  p_company_id uuid,
  p_package_number text,
  p_reference_number text,
  p_delivery_date date,
  p_report_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num_str text;
  v_raw_item text;
  v_clean_num text;
  v_matched_nav_id uuid := NULL;
  v_settled_nav_count int := 0;
  v_settled_manual_count int := 0;
  v_settle_date date;
  v_carrier_label text;
BEGIN
  v_num_str := COALESCE(p_package_number, '') || ' ' || COALESCE(p_reference_number, '');
  IF trim(v_num_str) = '' THEN
    RETURN jsonb_build_object('matched', false, 'reason', 'Nincs számlaszám a kompenzációs sorban');
  END IF;

  v_settle_date := COALESCE(p_delivery_date, CURRENT_DATE);
  v_carrier_label := UPPER(COALESCE(p_report_type, 'Futár'));

  -- Split by commas, semicolons or whitespace to handle single or multi-invoice compensation lines
  FOR v_raw_item IN
    SELECT regexp_split_to_table(v_num_str, E'[,;\\s]+')
  LOOP
    -- Clean: strip everything except alphanumeric
    v_clean_num := regexp_replace(v_raw_item, '[^a-zA-Z0-9]', '', 'g');

    -- Only consider invoice number candidates with length >= 4 (e.g. HU00879073)
    IF length(v_clean_num) >= 4 THEN
      
      -- ── A) Settle in nav_invoices ──
      FOR v_matched_nav_id IN
        SELECT id
        FROM nav_invoices
        WHERE company_id = p_company_id
          AND invoice_direction = 'INBOUND'
          AND (
            invoice_number = v_clean_num
            OR regexp_replace(invoice_number, '[^a-zA-Z0-9]', '', 'g') = v_clean_num
            OR (length(v_clean_num) >= 6 AND (
              invoice_number ILIKE '%' || v_clean_num || '%' 
              OR v_clean_num ILIKE '%' || regexp_replace(invoice_number, '[^a-zA-Z0-9]', '', 'g') || '%'
            ))
          )
      LOOP
        UPDATE nav_invoices
        SET paid = true,
            is_manual_payment = CASE WHEN transaction_id IS NULL THEN true ELSE is_manual_payment END,
            manual_payment_type = 'compensation',
            manual_payment_date = COALESCE(manual_payment_date, v_settle_date),
            manual_payment_note = COALESCE(manual_payment_note, v_carrier_label || ' kompenzációs értesítő alapján automatikusan rendezve')
        WHERE id = v_matched_nav_id;

        v_settled_nav_count := v_settled_nav_count + 1;
      END LOOP;

      -- ── B) Settle in invoices (manual/uploaded) ──
      UPDATE invoices
      SET fizetve = true,
          is_manual_payment = true,
          manual_payment_type = 'compensation',
          manual_payment_date = COALESCE(manual_payment_date, v_settle_date),
          manual_payment_note = COALESCE(manual_payment_note, v_carrier_label || ' kompenzációs értesítő alapján automatikusan rendezve'),
          frissitve = NOW()
      WHERE company_id = p_company_id
        AND invoice_direction = 'INBOUND'
        AND (
          bizonylatsorszam = v_clean_num
          OR regexp_replace(bizonylatsorszam, '[^a-zA-Z0-9]', '', 'g') = v_clean_num
          OR (length(v_clean_num) >= 6 AND (
            bizonylatsorszam ILIKE '%' || v_clean_num || '%'
            OR v_clean_num ILIKE '%' || regexp_replace(bizonylatsorszam, '[^a-zA-Z0-9]', '', 'g') || '%'
          ))
        );

      IF FOUND THEN
        v_settled_manual_count := v_settled_manual_count + 1;
      END IF;

    END IF;
  END LOOP;

  -- Update courier_reports row with match info if we matched a NAV invoice or manual invoice
  IF v_settled_nav_count > 0 OR v_settled_manual_count > 0 THEN
    UPDATE courier_reports
    SET matched_nav_invoice_id = COALESCE(v_matched_nav_id, matched_nav_invoice_id),
        match_status = 'full',
        match_confidence = 1.0,
        match_reason = v_carrier_label || ' kompenzáció: bejövő számla automatikusan rendezve'
    WHERE id = p_report_id;

    RETURN jsonb_build_object(
      'matched', true,
      'nav_settled', v_settled_nav_count,
      'manual_settled', v_settled_manual_count,
      'last_nav_id', v_matched_nav_id
    );
  END IF;

  RETURN jsonb_build_object(
    'matched', false,
    'reason', 'Nem található nyitott bejövő számla a megadott számlaszám(ok)hoz'
  );
END;
$$;


-- 2. Trigger function on courier_reports
CREATE OR REPLACE FUNCTION public.trg_auto_settle_compensation_courier_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger for compensation rows
  IF NEW.row_type = 'compensation' THEN
    PERFORM settle_compensation_for_courier_report(
      NEW.id,
      NEW.company_id,
      NEW.package_number,
      NEW.reference_number,
      NEW.delivery_date,
      NEW.report_type
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_courier_reports_auto_settle_compensation ON public.courier_reports;

CREATE TRIGGER trg_courier_reports_auto_settle_compensation
AFTER INSERT OR UPDATE OF package_number, reference_number, row_type
ON public.courier_reports
FOR EACH ROW
WHEN (NEW.row_type = 'compensation')
EXECUTE FUNCTION public.trg_auto_settle_compensation_courier_report();


-- 3. Extend rematch_courier_report() to handle row_type = 'compensation'
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
  v_comp_res jsonb;
BEGIN
  SELECT * INTO v_report FROM courier_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Report not found');
  END IF;

  v_cod := abs(COALESCE(v_report.cod_amount, 0));
  v_ref := v_report.reference_number;
  v_delivery := v_report.delivery_date;
  v_company := v_report.company_id;
  v_row_type := v_report.row_type;
  v_upload_id := v_report.upload_id;

  -- ═══ COMPENSATION rows: auto-settle referenced INBOUND invoices ═══
  IF v_row_type = 'compensation' THEN
    v_comp_res := settle_compensation_for_courier_report(
      p_report_id,
      v_company,
      v_report.package_number,
      v_ref,
      v_delivery,
      v_report.report_type
    );
    RETURN v_comp_res;
  END IF;

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


-- 4. Retroactively apply auto-settle to all existing compensation rows in courier_reports
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, company_id, package_number, reference_number, delivery_date, report_type
    FROM courier_reports
    WHERE row_type = 'compensation'
  LOOP
    PERFORM public.settle_compensation_for_courier_report(
      r.id,
      r.company_id,
      r.package_number,
      r.reference_number,
      r.delivery_date,
      r.report_type
    );
  END LOOP;
END;
$$;
