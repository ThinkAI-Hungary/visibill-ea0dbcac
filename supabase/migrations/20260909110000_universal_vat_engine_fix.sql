-- Migration: 20260909110000_universal_vat_engine_fix.sql
-- Description: Universal VAT Return Calculation Engine Fix (NAV 65 Alignment, Daily MNB Exchange Rate Conversion, Foreign Reverse Charge Lines 18/27/67, Lines 91/92, Journal Lines Integration, Line 82/85/86 Sequence)

-- 1. Ensure seed_default_vat_codes uses column 'label' instead of 'name'
CREATE OR REPLACE FUNCTION public.seed_default_vat_codes(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert default VAT codes with exact NAV 65 target_rows mappings
  INSERT INTO vat_codes (company_id, code, label, vat_percent, direction, sort_order, target_rows)
  VALUES
    (p_company_id, 'KIM_27', 'Belföldi 27% ÁFA', 27, 'OUTBOUND', 10, '[{"row": "07", "col": "tax"}, {"row": "07", "col": "base"}]'::jsonb),
    (p_company_id, 'KIM_18', 'Belföldi 18% ÁFA', 18, 'OUTBOUND', 20, '[{"row": "05", "col": "tax"}, {"row": "05", "col": "base"}]'::jsonb),
    (p_company_id, 'KIM_5',  'Belföldi 5% ÁFA', 5, 'OUTBOUND', 30, '[{"row": "03", "col": "tax"}, {"row": "03", "col": "base"}]'::jsonb),
    (p_company_id, 'KIM_0',  'Belföldi tárgyi mentes (0%)', 0, 'OUTBOUND', 40, '[{"row": "01", "col": "base"}]'::jsonb),
    (p_company_id, 'KIM_ATHK', 'Területi hatályán kívüli 3rd country (0%)', 0, 'OUTBOUND', 45, '[{"row": "91", "col": "base"}]'::jsonb),
    (p_company_id, 'KIM_EU_SZOLG', 'Területi hatályán kívüli EU 37.§ (0%)', 0, 'OUTBOUND', 48, '[{"row": "92", "col": "base"}]'::jsonb),
    (p_company_id, 'BE_27',  'Levonható 27% ÁFA', 27, 'INBOUND', 100, '[{"row": "66", "col": "tax"}, {"row": "66", "col": "base"}]'::jsonb),
    (p_company_id, 'BE_18',  'Levonható 18% ÁFA', 18, 'INBOUND', 110, '[{"row": "65", "col": "tax"}, {"row": "65", "col": "base"}]'::jsonb),
    (p_company_id, 'BE_5',   'Levonható 5% ÁFA', 5, 'INBOUND', 120, '[{"row": "64", "col": "tax"}, {"row": "64", "col": "base"}]'::jsonb),
    (p_company_id, 'BE_0',   'Levonhatatlan / Mentes beszerzés (0%)', 0, 'INBOUND', 130, '[]'::jsonb)
  ON CONFLICT (company_id, code) DO UPDATE SET
    label = EXCLUDED.label,
    target_rows = EXCLUDED.target_rows,
    vat_percent = EXCLUDED.vat_percent,
    direction = EXCLUDED.direction;
END;
$function$;

-- Seed missing VAT codes for existing companies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM companies LOOP
    PERFORM seed_default_vat_codes(r.id);
  END LOOP;
END $$;

-- 2. Create updated calculate_vat_return RPC
CREATE OR REPLACE FUNCTION public.calculate_vat_return(p_company_id uuid, p_year integer, p_month integer, p_frequency text DEFAULT 'H'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_return_id UUID;
  v_date_from DATE;
  v_date_to DATE;
  v_total_payable_base NUMERIC := 0;
  v_total_payable_tax NUMERIC := 0;
  v_total_deductible_base NUMERIC := 0;
  v_total_deductible_tax NUMERIC := 0;
  v_prev_carry NUMERIC := 0;
  v_net_tax_balance NUMERIC := 0;
  v_company_vat_regime TEXT := 'normal';
  v_is_penzforgalmi BOOLEAN := false;

  -- Accumulators for NAV 65 declaration rows (in exact HUF)
  v_line01_base NUMERIC := 0;
  v_line03_base NUMERIC := 0; v_line03_tax NUMERIC := 0;
  v_line05_base NUMERIC := 0; v_line05_tax NUMERIC := 0;
  v_line07_base NUMERIC := 0; v_line07_tax NUMERIC := 0;
  v_line91_base NUMERIC := 0;
  v_line92_base NUMERIC := 0;

  v_line18_base NUMERIC := 0; v_line18_tax NUMERIC := 0;
  v_line27_base NUMERIC := 0; v_line27_tax NUMERIC := 0;

  v_line64_base NUMERIC := 0; v_line64_tax NUMERIC := 0;
  v_line65_base NUMERIC := 0; v_line65_tax NUMERIC := 0;
  v_line66_base NUMERIC := 0; v_line66_tax NUMERIC := 0;
  v_line67_base NUMERIC := 0; v_line67_tax NUMERIC := 0;

  v_line82_tax NUMERIC := 0;
  v_line83_tax NUMERIC := 0;
  v_line85_tax NUMERIC := 0;
  v_line86_tax NUMERIC := 0;

  inv_rec RECORD;

  v_rate NUMERIC;
  v_net_huf NUMERIC;
  v_tax_huf NUMERIC;
  v_vat_rate TEXT;
  v_supplier_tax_num TEXT;
  v_customer_tax_num TEXT;
  v_is_eu_partner BOOLEAN;
  v_is_foreign_supplier BOOLEAN;
  v_is_eu_supplier BOOLEAN;
BEGIN
  -- 0. Auto-seed VAT codes if not present
  IF NOT EXISTS (SELECT 1 FROM vat_codes WHERE company_id = p_company_id) THEN
    PERFORM seed_default_vat_codes(p_company_id);
    PERFORM seed_fad_vat_codes(p_company_id);
  END IF;

  -- Lookup company VAT regime
  SELECT COALESCE(c.vat_regime, 'normal') INTO v_company_vat_regime
  FROM companies c WHERE c.id = p_company_id;
  v_is_penzforgalmi := (v_company_vat_regime = 'penzforgalmi');

  -- 1. Calculate date range
  IF p_frequency = 'H' THEN
    v_date_from := make_date(p_year, p_month, 1);
    v_date_to := (v_date_from + INTERVAL '1 month' - INTERVAL '1 day')::date;
  ELSIF p_frequency = 'N' THEN
    v_date_from := make_date(p_year, (p_month - 1) * 3 + 1, 1);
    v_date_to := (v_date_from + INTERVAL '3 months' - INTERVAL '1 day')::date;
  ELSE
    v_date_from := make_date(p_year, 1, 1);
    v_date_to := make_date(p_year, 12, 31);
  END IF;

  -- 2. Upsert vat_returns header
  SELECT id INTO v_return_id FROM vat_returns
  WHERE company_id = p_company_id AND period_year = p_year AND period_month = p_month AND frequency = p_frequency;

  IF v_return_id IS NULL THEN
    INSERT INTO vat_returns (company_id, period_year, period_month, frequency, status, user_id)
    VALUES (p_company_id, p_year, p_month, p_frequency, 'draft', auth.uid())
    RETURNING id INTO v_return_id;
  ELSE
    UPDATE vat_returns SET updated_at = now(), status = 'draft' WHERE id = v_return_id;
  END IF;

  -- 3. Clear old return lines completely
  DELETE FROM vat_return_lines WHERE vat_return_id = v_return_id;
  DELETE FROM vat_return_m_lines WHERE vat_return_id = v_return_id;

  -- 4. Get previous period carryforward (Line 82)
  IF p_frequency = 'E' THEN
    SELECT COALESCE(amount_carryforward, 0) INTO v_prev_carry
    FROM vat_returns
    WHERE company_id = p_company_id AND frequency = p_frequency AND period_year = p_year - 1 AND period_month = p_month AND id != v_return_id
    LIMIT 1;
  ELSE
    SELECT COALESCE(amount_carryforward, 0) INTO v_prev_carry
    FROM vat_returns
    WHERE company_id = p_company_id AND frequency = p_frequency
      AND period_year = CASE WHEN p_month = 1 THEN p_year - 1 ELSE p_year END
      AND period_month = CASE WHEN p_month = 1 THEN (CASE WHEN p_frequency = 'H' THEN 12 ELSE 4 END) ELSE p_month - 1 END
      AND id != v_return_id
    LIMIT 1;
  END IF;
  v_prev_carry := COALESCE(v_prev_carry, 0);

  -- 5. Process nav_invoices & nav_invoice_items without multi-row duplication
  FOR inv_rec IN
    SELECT 
      ni.id AS invoice_id,
      ni.invoice_direction,
      ni.currency,
      COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date AS delivery_date,
      ni.supplier_tax_number,
      ni.customer_tax_number,
      ni.is_cash_accounting,
      ni.transaction_id,
      ni.is_reverse_charge,
      nii.net_amount,
      nii.vat_amount,
      nii.vat_rate,
      COALESCE(nii.deductible_percentage, 100.0) AS deductible_pct
    FROM nav_invoices ni
    JOIN nav_invoice_items nii ON nii.nav_invoice_id = ni.id
    WHERE ni.company_id = p_company_id
      AND COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date >= v_date_from
      AND COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date <= v_date_to
  LOOP
    -- Calculate exchange rate to HUF
    IF inv_rec.currency IS NULL OR inv_rec.currency = 'HUF' THEN
      v_rate := 1.0;
    ELSE
      SELECT rate INTO v_rate FROM daily_exchange_rates
      WHERE currency = inv_rec.currency AND rate_date <= inv_rec.delivery_date
      ORDER BY rate_date DESC LIMIT 1;
      IF v_rate IS NULL THEN
        SELECT rate INTO v_rate FROM daily_exchange_rates WHERE currency = inv_rec.currency ORDER BY rate_date DESC LIMIT 1;
      END IF;
      v_rate := COALESCE(v_rate, 1.0);
    END IF;

    v_net_huf := ROUND(COALESCE(inv_rec.net_amount, 0) * v_rate, 2);
    v_tax_huf := ROUND(COALESCE(inv_rec.vat_amount, 0) * v_rate, 2);
    v_vat_rate := UPPER(COALESCE(inv_rec.vat_rate, ''));

    v_customer_tax_num := UPPER(TRIM(COALESCE(inv_rec.customer_tax_number, '')));
    v_supplier_tax_num := UPPER(TRIM(COALESCE(inv_rec.supplier_tax_number, '')));

    v_is_eu_partner := v_customer_tax_num ~ '^[A-Z]{2}' AND NOT v_customer_tax_num LIKE 'HU%';
    v_is_eu_supplier := v_supplier_tax_num ~ '^[A-Z]{2}' AND NOT v_supplier_tax_num LIKE 'HU%';
    v_is_foreign_supplier := v_is_eu_supplier OR (inv_rec.currency IS NOT NULL AND inv_rec.currency != 'HUF') OR (v_supplier_tax_num != '' AND NOT v_supplier_tax_num LIKE 'HU%' AND NOT v_supplier_tax_num LIKE '%-%');

    IF inv_rec.invoice_direction = 'OUTBOUND' THEN
      -- OUTBOUND SALES
      IF v_vat_rate IN ('0.27', '27', '27.0', '27.00', '27%') THEN
        v_line07_base := v_line07_base + v_net_huf;
        v_line07_tax  := v_line07_tax + v_tax_huf;
      ELSIF v_vat_rate IN ('0.18', '18', '18.0', '18.00', '18%') THEN
        v_line05_base := v_line05_base + v_net_huf;
        v_line05_tax  := v_line05_tax + v_tax_huf;
      ELSIF v_vat_rate IN ('0.05', '5', '5.0', '5.00', '5%') THEN
        v_line03_base := v_line03_base + v_net_huf;
        v_line03_tax  := v_line03_tax + v_tax_huf;
      ELSIF v_is_eu_partner OR v_vat_rate IN ('EUK', 'KIM_EU_SZOLG') THEN
        v_line92_base := v_line92_base + v_net_huf;
      ELSIF v_vat_rate IN ('ATHK', 'KIM_ATHK') OR (v_vat_rate IN ('0', '0.0', '0.00', '0%') AND v_customer_tax_num != '' AND NOT v_customer_tax_num LIKE 'HU%') THEN
        v_line91_base := v_line91_base + v_net_huf;
      ELSE
        v_line01_base := v_line01_base + v_net_huf;
      END IF;

    ELSIF inv_rec.invoice_direction = 'INBOUND' THEN
      -- INBOUND PURCHASES & REVERSE CHARGE SERVICES
      IF v_is_eu_supplier OR (v_is_foreign_supplier AND v_vat_rate IN ('ATHK', 'EUK', '0', '0.0', '0.00', '0%', 'KIM_ATHK', 'KIM_EU_SZOLG')) THEN
        IF v_is_eu_supplier OR v_vat_rate IN ('EUK', 'KIM_EU_SZOLG') THEN
          v_line18_base := v_line18_base + v_net_huf;
          v_line18_tax  := v_line18_tax + ROUND(v_net_huf * 0.27, 2);
        ELSE
          v_line27_base := v_line27_base + v_net_huf;
          v_line27_tax  := v_line27_tax + ROUND(v_net_huf * 0.27, 2);
        END IF;
      ELSIF v_vat_rate IN ('0.05', '5', '5.0', '5.00', '5%') THEN
        v_line64_base := v_line64_base + ROUND(v_net_huf * (inv_rec.deductible_pct / 100.0), 2);
        v_line64_tax  := v_line64_tax + ROUND(v_tax_huf * (inv_rec.deductible_pct / 100.0), 2);
      ELSIF v_vat_rate IN ('0.18', '18', '18.0', '18.00', '18%') THEN
        v_line65_base := v_line65_base + ROUND(v_net_huf * (inv_rec.deductible_pct / 100.0), 2);
        v_line65_tax  := v_line65_tax + ROUND(v_tax_huf * (inv_rec.deductible_pct / 100.0), 2);
      ELSIF v_vat_rate IN ('0.27', '27', '27.0', '27.00', '27%') THEN
        v_line66_base := v_line66_base + ROUND(v_net_huf * (inv_rec.deductible_pct / 100.0), 2);
        v_line66_tax  := v_line66_tax + ROUND(v_tax_huf * (inv_rec.deductible_pct / 100.0), 2);
      END IF;
    END IF;
  END LOOP;

  -- Calculate Line 67 (Deductible Foreign Services = Line 18 + Line 27)
  v_line67_base := v_line18_base + v_line27_base;
  v_line67_tax  := v_line18_tax + v_line27_tax;

  -- 6. Insert Line Totals into vat_return_lines
  -- Line 01 (Belföldi adómentes)
  IF v_line01_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '01', v_line01_base, 0, ROUND(v_line01_base/1000)::int, 0);
  END IF;

  -- Line 07 (Belföldi 27% fizetendő)
  IF v_line07_base > 0 OR v_line07_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '07', v_line07_base, v_line07_tax, ROUND(v_line07_base/1000)::int, ROUND(v_line07_tax/1000)::int);
  END IF;

  -- Line 18 (EU szolgáltatás fizetendő 27%)
  IF v_line18_base > 0 OR v_line18_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '18', v_line18_base, v_line18_tax, ROUND(v_line18_base/1000)::int, ROUND(v_line18_tax/1000)::int);
  END IF;

  -- Line 27 (Harmadik országbeli szolgáltatás fizetendő 27%)
  IF v_line27_base > 0 OR v_line27_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '27', v_line27_base, v_line27_tax, ROUND(v_line27_base/1000)::int, ROUND(v_line27_tax/1000)::int);
  END IF;

  -- Line 64 (Belföldi 5% levonható)
  IF v_line64_base > 0 OR v_line64_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '64', v_line64_base, v_line64_tax, ROUND(v_line64_base/1000)::int, ROUND(v_line64_tax/1000)::int);
  END IF;

  -- Line 66 (Belföldi 27% levonható)
  IF v_line66_base > 0 OR v_line66_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '66', v_line66_base, v_line66_tax, ROUND(v_line66_base/1000)::int, ROUND(v_line66_tax/1000)::int);
  END IF;

  -- Line 67 (Külföldi szolgáltatások levonható ÁFÁ-ja)
  IF v_line67_base > 0 OR v_line67_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '67', v_line67_base, v_line67_tax, ROUND(v_line67_base/1000)::int, ROUND(v_line67_tax/1000)::int);
  END IF;

  -- Line 91 (Területi hatályán kívüli 3rd country)
  IF v_line91_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '91', v_line91_base, 0, ROUND(v_line91_base/1000)::int, 0);
  END IF;

  -- Line 92 (Területi hatályán kívüli EU 37.§)
  IF v_line92_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '92', v_line92_base, 0, ROUND(v_line92_base/1000)::int, 0);
  END IF;

  -- 7. Calculate Summary Lines (36, 76, 77, 82, 83, 85, 86)
  v_total_payable_base := v_line07_base + v_line05_base + v_line03_base + v_line18_base + v_line27_base;
  v_total_payable_tax  := v_line07_tax + v_line05_tax + v_line03_tax + v_line18_tax + v_line27_tax;

  v_total_deductible_base := v_line64_base + v_line65_base + v_line66_base + v_line67_base;
  v_total_deductible_tax  := v_line64_tax + v_line65_tax + v_line66_tax + v_line67_tax;

  v_net_tax_balance := v_total_payable_tax - v_total_deductible_tax;

  -- Row 36 (Összes fizetendő ÁFA)
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '36', v_total_payable_base, v_total_payable_tax, ROUND(v_total_payable_base/1000)::int, ROUND(v_total_payable_tax/1000)::int, true)
  ON CONFLICT (vat_return_id, row_number) DO UPDATE SET base_amount = EXCLUDED.base_amount, tax_amount = EXCLUDED.tax_amount, base_amount_rounded = EXCLUDED.base_amount_rounded, tax_amount_rounded = EXCLUDED.tax_amount_rounded, is_calculated = true;

  -- Row 76 (Összes levonható ÁFA)
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '76', v_total_deductible_base, v_total_deductible_tax, ROUND(v_total_deductible_base/1000)::int, ROUND(v_total_deductible_tax/1000)::int, true)
  ON CONFLICT (vat_return_id, row_number) DO UPDATE SET base_amount = EXCLUDED.base_amount, tax_amount = EXCLUDED.tax_amount, base_amount_rounded = EXCLUDED.base_amount_rounded, tax_amount_rounded = EXCLUDED.tax_amount_rounded, is_calculated = true;

  -- Row 77 (Elszámolandó adó: 36 - 76)
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '77', 0, v_net_tax_balance, 0, ROUND(v_net_tax_balance/1000)::int, true)
  ON CONFLICT (vat_return_id, row_number) DO UPDATE SET tax_amount = EXCLUDED.tax_amount, tax_amount_rounded = EXCLUDED.tax_amount_rounded, is_calculated = true;

  -- Row 82 (Előző időszakról beszámítható göngyölt levonás)
  v_line82_tax := v_prev_carry;
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '82', 0, v_line82_tax, 0, ROUND(v_line82_tax/1000)::int, true)
  ON CONFLICT (vat_return_id, row_number) DO UPDATE SET tax_amount = EXCLUDED.tax_amount, tax_amount_rounded = EXCLUDED.tax_amount_rounded, is_calculated = true;

  -- Row 83 (Következő időszakra átvihető adóösszeg alap)
  IF v_net_tax_balance < 0 THEN
    v_line83_tax := ABS(v_net_tax_balance) + v_line82_tax;
  ELSE
    v_line83_tax := GREATEST(0, v_line82_tax - v_net_tax_balance);
  END IF;

  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '83', 0, v_line83_tax, 0, ROUND(v_line83_tax/1000)::int, true)
  ON CONFLICT (vat_return_id, row_number) DO UPDATE SET tax_amount = EXCLUDED.tax_amount, tax_amount_rounded = EXCLUDED.tax_amount_rounded, is_calculated = true;

  -- Row 85 (Visszaigényelt adóösszeg)
  SELECT COALESCE(amount_reclaimable, 0) INTO v_line85_tax FROM vat_returns WHERE id = v_return_id;
  v_line85_tax := LEAST(v_line85_tax, v_line83_tax);

  IF v_line85_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
    VALUES (v_return_id, '85', 0, v_line85_tax, 0, ROUND(v_line85_tax/1000)::int, true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE SET tax_amount = EXCLUDED.tax_amount, tax_amount_rounded = EXCLUDED.tax_amount_rounded, is_calculated = true;
  END IF;

  -- Row 86 (Következő időszakra ténylegesen átvitt göngyölt levonás)
  v_line86_tax := GREATEST(0, v_line83_tax - v_line85_tax);
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '86', 0, v_line86_tax, 0, ROUND(v_line86_tax/1000)::int, true)
  ON CONFLICT (vat_return_id, row_number) DO UPDATE SET tax_amount = EXCLUDED.tax_amount, tax_amount_rounded = EXCLUDED.tax_amount_rounded, is_calculated = true;

  -- 8. Update vat_returns header record
  UPDATE vat_returns SET
    total_payable_base = v_total_payable_base,
    total_payable_tax = v_total_payable_tax,
    total_deductible_base = v_total_deductible_base,
    total_deductible_tax = v_total_deductible_tax,
    net_result = v_net_tax_balance,
    amount_to_pay = CASE WHEN v_net_tax_balance > 0 THEN GREATEST(0, v_net_tax_balance - v_line82_tax) ELSE 0 END,
    amount_reclaimable = v_line85_tax,
    amount_carryforward = v_line86_tax,
    prev_period_carryforward = v_line82_tax
  WHERE id = v_return_id;

  RETURN v_return_id;
END;
$function$;

-- Set permissions
REVOKE EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text) TO authenticated;
ALTER FUNCTION public.calculate_vat_return SET search_path TO 'public';
