-- Migration: Enhance settle_compensation_for_courier_report with zero-prefix normalization
-- Fixes cases where OCR or AI extractions produce '0HU...' or 'HU000xxxxxx' (11 digits instead of standard 10)

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
  v_normalized_num text;
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

    -- Strip leading zeroes if followed by HU (e.g. '0HU00929915' -> 'HU00929915')
    IF v_clean_num ~* '^0+HU' THEN
      v_clean_num := regexp_replace(v_clean_num, '^0+', '', 'i');
    END IF;

    -- Normalize 'HU000xxxxxx' (11 chars) to standard GLS 10-char format 'HU00xxxxxx'
    IF v_clean_num ~* '^HU000[0-9]{6}$' THEN
      v_clean_num := regexp_replace(v_clean_num, '^HU000', 'HU00', 'i');
    END IF;

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
