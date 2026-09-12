-- Migration: Auto-settle OUTBOUND customer COD invoices when a compensation courier report is uploaded
-- Handles GLS / courier compensation letters (row_type = 'compensation') by linking them to the matching
-- courier report batch that had 0 bank payout due to compensation.

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
  v_settled_outbound_count int := 0;
  v_settle_date date;
  v_carrier_label text;
  
  -- Outbound compensation linking
  v_cr_row courier_reports%ROWTYPE;
  v_comp_amt numeric;
  v_target_upload_id uuid;
  v_item_record RECORD;
BEGIN
  v_num_str := COALESCE(p_package_number, '') || ' ' || COALESCE(p_reference_number, '');
  IF trim(v_num_str) = '' THEN
    RETURN jsonb_build_object('matched', false, 'reason', 'Nincs számlaszám a kompenzációs sorban');
  END IF;

  v_settle_date := COALESCE(p_delivery_date, CURRENT_DATE);
  v_carrier_label := UPPER(COALESCE(p_report_type, 'Futár'));

  -- ── A) Settle INBOUND supplier invoices (e.g. HU00879073) ──
  FOR v_raw_item IN
    SELECT regexp_split_to_table(v_num_str, E'[,;\\s]+')
  LOOP
    v_clean_num := regexp_replace(v_raw_item, '[^a-zA-Z0-9]', '', 'g');

    IF length(v_clean_num) >= 4 THEN
      -- A.1) In nav_invoices
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

      -- A.2) In invoices (manual/uploaded)
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

  -- ── B) Settle OUTBOUND customer COD invoices if compensation retained COD (0 bank transfer) ──
  SELECT * INTO v_cr_row FROM courier_reports WHERE id = p_report_id;
  IF FOUND THEN
    v_comp_amt := abs(COALESCE(v_cr_row.cod_amount, 0));
    IF v_comp_amt > 0 THEN
      -- Find matching courier report batch where total amount equals compensation amount and no bank transaction arrived
      SELECT upload_id INTO v_target_upload_id
      FROM courier_reports
      WHERE company_id = p_company_id
        AND report_type = v_cr_row.report_type
        AND row_type = 'total'
        AND abs(cod_amount - v_comp_amt) <= 5.0
        AND (delivery_date BETWEEN (v_settle_date - interval '5 days')::date AND (v_settle_date + interval '2 days')::date
             OR delivery_date IS NULL)
        AND matched_transaction_id IS NULL
      ORDER BY abs(COALESCE(delivery_date, v_settle_date) - v_settle_date) ASC
      LIMIT 1;

      IF v_target_upload_id IS NOT NULL THEN
        FOR v_item_record IN
          SELECT id, matched_nav_invoice_id
          FROM courier_reports
          WHERE upload_id = v_target_upload_id
            AND row_type = 'item'
        LOOP
          IF v_item_record.matched_nav_invoice_id IS NOT NULL THEN
            UPDATE nav_invoices
            SET paid = true,
                is_manual_payment = true,
                manual_payment_type = 'compensation',
                manual_payment_date = COALESCE(manual_payment_date, v_settle_date),
                manual_payment_note = COALESCE(manual_payment_note, v_carrier_label || ' kompenzációs értesítő alapján automatikusan rendezve')
            WHERE id = v_item_record.matched_nav_invoice_id
              AND (paid IS NULL OR paid = false);

            v_settled_outbound_count := v_settled_outbound_count + 1;
          END IF;

          UPDATE courier_reports
          SET match_status = 'full',
              match_confidence = 1.0,
              match_reason = v_carrier_label || ' kompenzáció alapján rendezve'
          WHERE id = v_item_record.id;
        END LOOP;

        UPDATE courier_reports
        SET match_status = 'full',
            match_confidence = 1.0,
            match_reason = v_carrier_label || ' kompenzáció: 100% beszámítva (banki utalás nélkül)'
        WHERE upload_id = v_target_upload_id AND row_type = 'total';
      END IF;
    END IF;
  END IF;

  -- Update courier_reports row with match info
  IF v_settled_nav_count > 0 OR v_settled_manual_count > 0 OR v_settled_outbound_count > 0 THEN
    UPDATE courier_reports
    SET matched_nav_invoice_id = COALESCE(v_matched_nav_id, matched_nav_invoice_id),
        match_status = 'full',
        match_confidence = 1.0,
        match_reason = v_carrier_label || ' kompenzáció: számlák automatikusan rendezve'
    WHERE id = p_report_id;

    RETURN jsonb_build_object(
      'matched', true,
      'nav_settled', v_settled_nav_count,
      'manual_settled', v_settled_manual_count,
      'outbound_settled', v_settled_outbound_count,
      'last_nav_id', v_matched_nav_id
    );
  END IF;

  RETURN jsonb_build_object(
    'matched', false,
    'reason', 'Nem található nyitott számla a megadott adatokhoz'
  );
END;
$$;
