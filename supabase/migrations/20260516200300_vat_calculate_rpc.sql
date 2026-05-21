-- ============================================================
-- ÁFA BEVALLÁS — Számítási Motor (RPC)
-- ============================================================
-- Aggregálja a számlák ÁFA adatait az adott időszakra,
-- és feltölti a vat_return_lines + vat_return_m_lines táblákat.

CREATE OR REPLACE FUNCTION calculate_vat_return(
  p_company_id UUID,
  p_year INT,
  p_month INT,
  p_frequency TEXT DEFAULT 'H'
)
RETURNS UUID AS $$
DECLARE
  v_return_id UUID;
  v_date_from DATE;
  v_date_to DATE;
  v_code RECORD;
  v_row_num TEXT;
  v_base NUMERIC;
  v_tax NUMERIC;
  v_total_payable_base NUMERIC := 0;
  v_total_payable_tax NUMERIC := 0;
  v_total_deductible_base NUMERIC := 0;
  v_total_deductible_tax NUMERIC := 0;
  v_prev_carry NUMERIC := 0;
  v_net NUMERIC;
BEGIN
  -- 1. Calculate date range
  IF p_frequency = 'H' THEN
    v_date_from := make_date(p_year, p_month, 1);
    v_date_to := (v_date_from + INTERVAL '1 month' - INTERVAL '1 day')::date;
  ELSE
    -- Quarterly
    v_date_from := make_date(p_year, (p_month - 1) * 3 + 1, 1);
    v_date_to := (v_date_from + INTERVAL '3 months' - INTERVAL '1 day')::date;
  END IF;

  -- 2. Upsert vat_returns header (partial unique index requires manual check)
  SELECT id INTO v_return_id
  FROM vat_returns
  WHERE company_id = p_company_id
    AND period_year = p_year
    AND period_month = p_month;

  IF v_return_id IS NULL THEN
    INSERT INTO vat_returns (company_id, period_year, period_month, frequency, status, user_id)
    VALUES (p_company_id, p_year, p_month, p_frequency, 'draft', auth.uid())
    RETURNING id INTO v_return_id;
  ELSE
    UPDATE vat_returns SET updated_at = now(), status = 'draft' WHERE id = v_return_id;
  END IF;

  -- 3. Clear old lines
  DELETE FROM vat_return_lines WHERE vat_return_id = v_return_id;
  DELETE FROM vat_return_m_lines WHERE vat_return_id = v_return_id;

  -- 4. Get previous period carryforward (row 86 from last return)
  SELECT COALESCE(amount_carryforward, 0) INTO v_prev_carry
  FROM vat_returns
  WHERE company_id = p_company_id
    AND period_year = CASE WHEN p_month = 1 THEN p_year - 1 ELSE p_year END
    AND period_month = CASE WHEN p_month = 1 THEN 12 ELSE p_month - 1 END
    AND id != v_return_id
  LIMIT 1;

  -- 5. For each VAT code, aggregate from nav_invoice_items
  FOR v_code IN
    SELECT * FROM vat_codes WHERE company_id = p_company_id ORDER BY sort_order
  LOOP
    -- Sum from NAV invoices + items matching this VAT rate and direction
    SELECT
      COALESCE(SUM(nii.net_amount), 0),
      COALESCE(SUM(nii.vat_amount), 0)
    INTO v_base, v_tax
    FROM nav_invoice_items nii
    JOIN nav_invoices ni ON ni.id = nii.nav_invoice_id
    WHERE ni.company_id = p_company_id
      AND ni.invoice_direction = CASE
        WHEN v_code.direction = 'OUTBOUND' THEN 'OUTBOUND'
        ELSE 'INBOUND'
      END
      AND ni.invoice_delivery_date::date >= v_date_from
      AND ni.invoice_delivery_date::date <= v_date_to
      AND (
        -- Match by vat_rate (string like "0.27", "0.18", "0.05", "0")
        (nii.vat_rate IS NOT NULL AND (
          (v_code.vat_percent = 27 AND nii.vat_rate IN ('0.27', '27', '27.0', '27.00')) OR
          (v_code.vat_percent = 18 AND nii.vat_rate IN ('0.18', '18', '18.0', '18.00')) OR
          (v_code.vat_percent = 5  AND nii.vat_rate IN ('0.05', '5', '5.0', '5.00')) OR
          (v_code.vat_percent = 0  AND nii.vat_rate IN ('0', '0.0', '0.00', 'TAM', 'AAM', 'DOMESTIC_REVERSE_CHARGE'))
        ))
      )
      -- Filter for reverse charge if needed
      AND (
        NOT v_code.is_reverse_charge
        OR nii.vat_rate IN ('0', '0.0', '0.00', 'DOMESTIC_REVERSE_CHARGE')
      );

    -- Skip if no data
    IF v_base = 0 AND v_tax = 0 THEN
      CONTINUE;
    END IF;

    -- For reverse charge: recalculate tax from base
    IF v_code.is_reverse_charge AND v_tax = 0 AND v_base != 0 THEN
      v_tax := ROUND(v_base * v_code.vat_percent / 100, 2);
    END IF;

    -- Insert into target rows
    DECLARE
      v_target JSONB;
      v_tr RECORD;
    BEGIN
      FOR v_tr IN SELECT * FROM jsonb_to_recordset(v_code.target_rows) AS x(row TEXT, col TEXT)
      LOOP
        INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
        VALUES (
          v_return_id,
          v_tr.row,
          CASE WHEN v_tr.col = 'base' THEN v_base ELSE 0 END,
          CASE WHEN v_tr.col = 'tax' THEN v_tax ELSE 0 END,
          CASE WHEN v_tr.col = 'base' THEN ROUND(v_base / 1000)::int ELSE 0 END,
          CASE WHEN v_tr.col = 'tax' THEN ROUND(v_tax / 1000)::int ELSE 0 END,
          ARRAY[v_code.code]
        )
        ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
          base_amount = vat_return_lines.base_amount + EXCLUDED.base_amount,
          tax_amount = vat_return_lines.tax_amount + EXCLUDED.tax_amount,
          base_amount_rounded = ROUND((vat_return_lines.base_amount + EXCLUDED.base_amount) / 1000)::int,
          tax_amount_rounded = ROUND((vat_return_lines.tax_amount + EXCLUDED.tax_amount) / 1000)::int,
          source_vat_codes = vat_return_lines.source_vat_codes || EXCLUDED.source_vat_codes;
      END LOOP;
    END;
  END LOOP;

  -- 6. Calculate summary rows
  -- Row 36: Sum of payable (rows 01-35, 110-114)
  SELECT COALESCE(SUM(base_amount), 0), COALESCE(SUM(tax_amount), 0)
  INTO v_total_payable_base, v_total_payable_tax
  FROM vat_return_lines
  WHERE vat_return_id = v_return_id
    AND row_number NOT IN ('36','76','82','83','84','85','86','105','106','108','109');

  -- Split payable vs deductible by checking form row section
  SELECT COALESCE(SUM(vrl.base_amount), 0), COALESCE(SUM(vrl.tax_amount), 0)
  INTO v_total_payable_base, v_total_payable_tax
  FROM vat_return_lines vrl
  JOIN vat_form_rows vfr ON vfr.row_number = vrl.row_number
  WHERE vrl.vat_return_id = v_return_id
    AND vfr.section = 'payable'
    AND NOT vfr.is_summary;

  SELECT COALESCE(SUM(vrl.base_amount), 0), COALESCE(SUM(vrl.tax_amount), 0)
  INTO v_total_deductible_base, v_total_deductible_tax
  FROM vat_return_lines vrl
  JOIN vat_form_rows vfr ON vfr.row_number = vrl.row_number
  WHERE vrl.vat_return_id = v_return_id
    AND vfr.section = 'deductible'
    AND NOT vfr.is_summary;

  -- Insert summary row 36
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '36', v_total_payable_base, v_total_payable_tax, ROUND(v_total_payable_base/1000)::int, ROUND(v_total_payable_tax/1000)::int, true)
  ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
    base_amount = EXCLUDED.base_amount, tax_amount = EXCLUDED.tax_amount,
    base_amount_rounded = EXCLUDED.base_amount_rounded, tax_amount_rounded = EXCLUDED.tax_amount_rounded, is_calculated = true;

  -- Insert summary row 76
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '76', v_total_deductible_base, v_total_deductible_tax, ROUND(v_total_deductible_base/1000)::int, ROUND(v_total_deductible_tax/1000)::int, true)
  ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
    base_amount = EXCLUDED.base_amount, tax_amount = EXCLUDED.tax_amount,
    base_amount_rounded = EXCLUDED.base_amount_rounded, tax_amount_rounded = EXCLUDED.tax_amount_rounded, is_calculated = true;

  -- Row 82: previous carryforward
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '82', 0, v_prev_carry, 0, ROUND(v_prev_carry/1000)::int, true)
  ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
    tax_amount = EXCLUDED.tax_amount, tax_amount_rounded = EXCLUDED.tax_amount_rounded, is_calculated = true;

  -- Row 83: net = payable_tax - deductible_tax - prev_carry
  v_net := v_total_payable_tax - v_total_deductible_tax - v_prev_carry;

  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '83', 0, v_net, 0, ROUND(v_net/1000)::int, true)
  ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
    tax_amount = EXCLUDED.tax_amount, tax_amount_rounded = EXCLUDED.tax_amount_rounded, is_calculated = true;

  -- Row 84 (pay) or 85 (reclaim)
  IF v_net > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
    VALUES (v_return_id, '84', 0, v_net, 0, ROUND(v_net/1000)::int, true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
      tax_amount = EXCLUDED.tax_amount, tax_amount_rounded = EXCLUDED.tax_amount_rounded;
  ELSE
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
    VALUES (v_return_id, '85', 0, ABS(v_net), 0, ROUND(ABS(v_net)/1000)::int, true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
      tax_amount = EXCLUDED.tax_amount, tax_amount_rounded = EXCLUDED.tax_amount_rounded;
    -- Row 86: carryforward = same as 85
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
    VALUES (v_return_id, '86', 0, ABS(v_net), 0, ROUND(ABS(v_net)/1000)::int, true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
      tax_amount = EXCLUDED.tax_amount, tax_amount_rounded = EXCLUDED.tax_amount_rounded;
  END IF;

  -- 7. M-LAP: Domestic inbound deductible invoices grouped by partner
  INSERT INTO vat_return_m_lines (
    vat_return_id, partner_name, partner_tax_number, invoice_count,
    base_amount, tax_amount, base_amount_rounded, tax_amount_rounded,
    tax_5_amount, tax_18_amount, tax_27_amount, invoice_details
  )
  SELECT
    v_return_id,
    COALESCE(ni.supplier_name, 'Ismeretlen'),
    COALESCE(ni.supplier_tax_number, ''),
    COUNT(DISTINCT ni.id)::int,
    COALESCE(SUM(nii.net_amount), 0),
    COALESCE(SUM(nii.vat_amount), 0),
    ROUND(COALESCE(SUM(nii.net_amount), 0) / 1000)::int,
    ROUND(COALESCE(SUM(nii.vat_amount), 0) / 1000)::int,
    COALESCE(SUM(CASE WHEN nii.vat_rate IN ('0.05','5','5.0','5.00') THEN nii.vat_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN nii.vat_rate IN ('0.18','18','18.0','18.00') THEN nii.vat_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN nii.vat_rate IN ('0.27','27','27.0','27.00') THEN nii.vat_amount ELSE 0 END), 0),
    jsonb_agg(jsonb_build_object(
      'invoice_number', ni.invoice_number,
      'delivery_date', ni.invoice_delivery_date,
      'net', nii.net_amount,
      'vat', nii.vat_amount,
      'vat_rate', nii.vat_rate
    ))
  FROM nav_invoice_items nii
  JOIN nav_invoices ni ON ni.id = nii.nav_invoice_id
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = 'INBOUND'
    AND ni.invoice_delivery_date::date >= v_date_from
    AND ni.invoice_delivery_date::date <= v_date_to
    AND nii.vat_rate NOT IN ('0','0.0','0.00','TAM','AAM')
    AND ni.supplier_tax_number IS NOT NULL
    AND ni.supplier_tax_number != ''
  GROUP BY ni.supplier_name, ni.supplier_tax_number;

  -- M-lap summary rows (105, 108)
  DECLARE
    v_m_partner_count INT;
    v_m_invoice_count INT;
    v_m_base NUMERIC;
    v_m_tax NUMERIC;
  BEGIN
    SELECT
      COUNT(DISTINCT partner_tax_number),
      COALESCE(SUM(invoice_count), 0),
      COALESCE(SUM(base_amount), 0),
      COALESCE(SUM(tax_amount), 0)
    INTO v_m_partner_count, v_m_invoice_count, v_m_base, v_m_tax
    FROM vat_return_m_lines
    WHERE vat_return_id = v_return_id;

    -- Row 105
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
    VALUES (v_return_id, '105', v_m_base, v_m_tax, ROUND(v_m_base/1000)::int, ROUND(v_m_tax/1000)::int, true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
      base_amount = EXCLUDED.base_amount, tax_amount = EXCLUDED.tax_amount,
      base_amount_rounded = EXCLUDED.base_amount_rounded, tax_amount_rounded = EXCLUDED.tax_amount_rounded;

    -- Row 108 = 105 (no corrections for now)
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
    VALUES (v_return_id, '108', v_m_base, v_m_tax, ROUND(v_m_base/1000)::int, ROUND(v_m_tax/1000)::int, true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
      base_amount = EXCLUDED.base_amount, tax_amount = EXCLUDED.tax_amount,
      base_amount_rounded = EXCLUDED.base_amount_rounded, tax_amount_rounded = EXCLUDED.tax_amount_rounded;

    -- Update header with summary
    UPDATE vat_returns SET
      total_payable_base = v_total_payable_base,
      total_payable_tax = v_total_payable_tax,
      total_deductible_base = v_total_deductible_base,
      total_deductible_tax = v_total_deductible_tax,
      net_result = v_net,
      amount_to_pay = CASE WHEN v_net > 0 THEN v_net ELSE 0 END,
      amount_reclaimable = CASE WHEN v_net < 0 THEN ABS(v_net) ELSE 0 END,
      amount_carryforward = CASE WHEN v_net < 0 THEN ABS(v_net) ELSE 0 END,
      prev_period_carryforward = v_prev_carry,
      m_sheet_summary = jsonb_build_object(
        'partner_count', v_m_partner_count,
        'invoice_count', v_m_invoice_count,
        'base', v_m_base,
        'tax', v_m_tax
      )
    WHERE id = v_return_id;
  END;

  RETURN v_return_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
