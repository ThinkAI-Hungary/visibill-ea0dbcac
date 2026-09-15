-- Migration: Fix VAT return foreign supplier heuristic for 8-digit Hungarian tax numbers,
-- populate source_vat_codes in vat_return_lines for drilldown,
-- and include document_id in get_gl_categorized_items descriptions.

-- 1. Update calculate_vat_return
CREATE OR REPLACE FUNCTION public.calculate_vat_return(
  p_company_id uuid,
  p_year integer,
  p_month integer,
  p_frequency text DEFAULT 'H'::text
)
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
  v_effective_tax_date DATE;
  v_is_paid BOOLEAN;
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

  -- 5. Process nav_invoices & nav_invoice_items with Cash-Basis Settlement Support
  FOR inv_rec IN
    SELECT 
      ni.id AS invoice_id,
      ni.invoice_direction,
      ni.currency,
      COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date AS delivery_date,
      ni.payment_method,
      ni.supplier_tax_number,
      ni.customer_tax_number,
      ni.is_cash_accounting,
      ni.transaction_id,
      ni.manual_payment_date,
      t.tx_id,
      t.transaction_date,
      ni.is_reverse_charge,
      COALESCE(nii.net_amount, ni.invoice_net_amount, 0) AS net_amount,
      COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) AS vat_amount,
      COALESCE(
        nii.vat_rate,
        CASE 
          WHEN COALESCE(ni.invoice_net_amount, 0) > 0 AND COALESCE(ni.invoice_vat_amount, 0) > 0 
               AND ROUND(ni.invoice_vat_amount / ni.invoice_net_amount, 2) = 0.27 THEN '27%'
          WHEN COALESCE(ni.invoice_net_amount, 0) > 0 AND COALESCE(ni.invoice_vat_amount, 0) > 0 
               AND ROUND(ni.invoice_vat_amount / ni.invoice_net_amount, 2) = 0.18 THEN '18%'
          WHEN COALESCE(ni.invoice_net_amount, 0) > 0 AND COALESCE(ni.invoice_vat_amount, 0) > 0 
               AND ROUND(ni.invoice_vat_amount / ni.invoice_net_amount, 2) = 0.05 THEN '5%'
          WHEN COALESCE(ni.invoice_vat_amount, 0) > 0 THEN '27%'
          ELSE '0%'
        END
      ) AS vat_rate,
      COALESCE(nii.deductible_percentage, 100.0) AS deductible_pct
    FROM nav_invoices ni
    LEFT JOIN nav_invoice_items nii ON nii.nav_invoice_id = ni.id
    LEFT JOIN LATERAL (
      SELECT t_sub.id AS tx_id, t_sub.transaction_date
      FROM public.transactions t_sub
      WHERE t_sub.id = ni.transaction_id
         OR t_sub.matched_invoice_id = ni.id
         OR EXISTS (
           SELECT 1 FROM public.transaction_invoice_matches tim
           WHERE tim.transaction_id = t_sub.id AND tim.invoice_id = ni.id
         )
      ORDER BY t_sub.transaction_date DESC
      LIMIT 1
    ) t ON true
    WHERE ni.company_id = p_company_id
      AND (
        COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date BETWEEN v_date_from AND v_date_to
        OR COALESCE(ni.manual_payment_date, t.transaction_date)::date BETWEEN v_date_from AND v_date_to
      )
  LOOP
    -- Cash-Basis (Pénzforgalmi) Date Determination
    v_is_paid := (COALESCE(inv_rec.payment_method, '') = 'CASH' OR inv_rec.transaction_id IS NOT NULL OR inv_rec.tx_id IS NOT NULL OR inv_rec.manual_payment_date IS NOT NULL);

    IF inv_rec.invoice_direction = 'OUTBOUND' THEN
      IF v_is_penzforgalmi AND COALESCE(inv_rec.payment_method, '') <> 'CASH' THEN
        IF NOT v_is_paid THEN
          CONTINUE;
        END IF;
        v_effective_tax_date := COALESCE(inv_rec.manual_payment_date, inv_rec.transaction_date)::date;
      ELSE
        v_effective_tax_date := inv_rec.delivery_date;
      END IF;
    ELSE -- INBOUND
      IF (v_is_penzforgalmi OR COALESCE(inv_rec.is_cash_accounting, false) = true) AND COALESCE(inv_rec.payment_method, '') <> 'CASH' THEN
        IF NOT v_is_paid THEN
          CONTINUE;
        END IF;
        v_effective_tax_date := COALESCE(inv_rec.manual_payment_date, inv_rec.transaction_date)::date;
      ELSE
        v_effective_tax_date := inv_rec.delivery_date;
      END IF;
    END IF;

    -- Strict check: effective tax date must fall within current reporting period
    IF v_effective_tax_date IS NULL OR v_effective_tax_date < v_date_from OR v_effective_tax_date > v_date_to THEN
      CONTINUE;
    END IF;

    -- Calculate exchange rate to HUF
    IF inv_rec.currency IS NULL OR inv_rec.currency = 'HUF' THEN
      v_rate := 1.0;
    ELSE
      SELECT rate INTO v_rate FROM daily_exchange_rates
      WHERE currency = inv_rec.currency AND rate_date <= v_effective_tax_date
      ORDER BY rate_date DESC LIMIT 1;
      IF v_rate IS NULL THEN
        SELECT rate INTO v_rate FROM daily_exchange_rates WHERE currency = inv_rec.currency ORDER BY rate_date DESC LIMIT 1;
      END IF;
      v_rate := COALESCE(v_rate, 1.0);
    END IF;

    v_net_huf := ROUND(COALESCE(inv_rec.net_amount, 0) * v_rate, 2);
    v_tax_huf := ROUND(COALESCE(inv_rec.vat_amount, 0) * v_rate, 2);
    v_vat_rate := UPPER(COALESCE(inv_rec.vat_rate, ''));

    -- Fallback calculation if vat_amount is 0 or null but vat_rate specifies a tax rate
    IF v_tax_huf = 0 AND v_net_huf > 0 THEN
      IF v_vat_rate IN ('0.27', '27', '27.0', '27.00', '27%') THEN
        v_tax_huf := ROUND(v_net_huf * 0.27, 2);
      ELSIF v_vat_rate IN ('0.18', '18', '18.0', '18.00', '18%') THEN
        v_tax_huf := ROUND(v_net_huf * 0.18, 2);
      ELSIF v_vat_rate IN ('0.05', '5', '5.0', '5.00', '5%') THEN
        v_tax_huf := ROUND(v_net_huf * 0.05, 2);
      END IF;
    END IF;

    v_customer_tax_num := UPPER(TRIM(COALESCE(inv_rec.customer_tax_number, '')));
    v_supplier_tax_num := UPPER(TRIM(COALESCE(inv_rec.supplier_tax_number, '')));

    v_is_eu_partner := v_customer_tax_num ~ '^[A-Z]{2}' AND NOT v_customer_tax_num LIKE 'HU%';
    v_is_eu_supplier := v_supplier_tax_num ~ '^[A-Z]{2}' AND NOT v_supplier_tax_num LIKE 'HU%';
    
    -- FIXED: 8-digit Hungarian tax numbers (^\d{8}$) or standard Hungarian tax numbers (^\d{8}-\d-\d{2}$)
    -- are domestic Hungarian suppliers, NEVER foreign suppliers!
    v_is_foreign_supplier := v_is_eu_supplier 
      OR (inv_rec.currency IS NOT NULL AND inv_rec.currency != 'HUF') 
      OR (v_supplier_tax_num != '' 
          AND NOT v_supplier_tax_num LIKE 'HU%' 
          AND NOT v_supplier_tax_num LIKE '%-%'
          AND NOT v_supplier_tax_num ~ '^[0-9]{8}$');

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

  -- 6. Insert Line Totals into vat_return_lines WITH source_vat_codes for drilldown
  -- Line 01 (Belföldi adómentes)
  IF v_line01_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '01', v_line01_base, 0, ROUND(v_line01_base/1000)::int, 0, ARRAY['AAM', 'TAM', '0%']);
  END IF;

  -- Line 03 (Belföldi 5% fizetendő)
  IF v_line03_base > 0 OR v_line03_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '03', v_line03_base, v_line03_tax, ROUND(v_line03_base/1000)::int, ROUND(v_line03_tax/1000)::int, ARRAY['05', '5%', '5', '0.05']);
  END IF;

  -- Line 05 (Belföldi 18% fizetendő)
  IF v_line05_base > 0 OR v_line05_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '05', v_line05_base, v_line05_tax, ROUND(v_line05_base/1000)::int, ROUND(v_line05_tax/1000)::int, ARRAY['18', '18%', '0.18']);
  END IF;

  -- Line 07 (Belföldi 27% fizetendő)
  IF v_line07_base > 0 OR v_line07_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '07', v_line07_base, v_line07_tax, ROUND(v_line07_base/1000)::int, ROUND(v_line07_tax/1000)::int, ARRAY['25', '27%', '27', '0.27']);
  END IF;

  -- Line 18 (EU szolgáltatás fizetendő 27%)
  IF v_line18_base > 0 OR v_line18_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '18', v_line18_base, v_line18_tax, ROUND(v_line18_base/1000)::int, ROUND(v_line18_tax/1000)::int, ARRAY['EUK', 'KIM_EU_SZOLG']);
  END IF;

  -- Line 27 (Harmadik országbeli szolgáltatás fizetendő 27%)
  IF v_line27_base > 0 OR v_line27_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '27', v_line27_base, v_line27_tax, ROUND(v_line27_base/1000)::int, ROUND(v_line27_tax/1000)::int, ARRAY['ATHK', 'KIM_ATHK', '0%']);
  END IF;

  -- Line 64 (Belföldi 5% levonható)
  IF v_line64_base > 0 OR v_line64_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '64', v_line64_base, v_line64_tax, ROUND(v_line64_base/1000)::int, ROUND(v_line64_tax/1000)::int, ARRAY['05', '5%', '5', '0.05']);
  END IF;

  -- Line 65 (Belföldi 18% levonható)
  IF v_line65_base > 0 OR v_line65_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '65', v_line65_base, v_line65_tax, ROUND(v_line65_base/1000)::int, ROUND(v_line65_tax/1000)::int, ARRAY['18', '18%', '0.18']);
  END IF;

  -- Line 66 (Belföldi 27% levonható)
  IF v_line66_base > 0 OR v_line66_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '66', v_line66_base, v_line66_tax, ROUND(v_line66_base/1000)::int, ROUND(v_line66_tax/1000)::int, ARRAY['25', '27%', '27', '0.27']);
  END IF;

  -- Line 67 (Import és EU szolgáltatás levonható 27%)
  IF v_line67_base > 0 OR v_line67_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '67', v_line67_base, v_line67_tax, ROUND(v_line67_base/1000)::int, ROUND(v_line67_tax/1000)::int, ARRAY['ATHK', 'EUK', 'KIM_ATHK', 'KIM_EU_SZOLG', '0%']);
  END IF;

  -- Line 91 (Közösségi adómentes termékértékesítés)
  IF v_line91_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '91', v_line91_base, 0, ROUND(v_line91_base/1000)::int, 0, ARRAY['ATHK', 'KIM_ATHK']);
  END IF;

  -- Line 92 (Közösségi adómentes szolgáltatásnyújtás)
  IF v_line92_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '92', v_line92_base, 0, ROUND(v_line92_base/1000)::int, 0, ARRAY['EUK', 'KIM_EU_SZOLG']);
  END IF;

  -- Line 82 (Előző időszaki göngyölt követelés)
  IF v_prev_carry > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '82', 0, v_prev_carry, 0, ROUND(v_prev_carry/1000)::int, ARRAY['GONGYOLT']);
  END IF;

  -- Calculate Totals
  v_total_payable_base := v_line01_base + v_line03_base + v_line05_base + v_line07_base + v_line18_base + v_line27_base;
  v_total_payable_tax  := v_line03_tax + v_line05_tax + v_line07_tax + v_line18_tax + v_line27_tax;

  v_total_deductible_base := v_line64_base + v_line65_base + v_line66_base + v_line67_base;
  v_total_deductible_tax  := v_line64_tax + v_line65_tax + v_line66_tax + v_line67_tax;

  -- Line 36 (Összes fizetendő adó)
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
  VALUES (v_return_id, '36', v_total_payable_base, v_total_payable_tax, ROUND(v_total_payable_base/1000)::int, ROUND(v_total_payable_tax/1000)::int);

  -- Line 76 (Összes levonható adó)
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
  VALUES (v_return_id, '76', v_total_deductible_base, v_total_deductible_tax, ROUND(v_total_deductible_base/1000)::int, ROUND(v_total_deductible_tax/1000)::int);

  -- Net Result (Payable - Deductible - Previous Carryforward)
  v_net_tax_balance := v_total_payable_tax - v_total_deductible_tax - v_prev_carry;

  IF v_net_tax_balance > 0 THEN
    -- Line 83: Különbözet (36. sor - 76. sor - 82. sor)
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '83', 0, v_net_tax_balance, 0, ROUND(v_net_tax_balance/1000)::int);

    -- Line 84: Befizetendő adó
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '84', 0, v_net_tax_balance, 0, ROUND(v_net_tax_balance/1000)::int);

    UPDATE vat_returns
    SET 
      total_payable_base = v_total_payable_base,
      total_payable_tax = v_total_payable_tax,
      total_deductible_base = v_total_deductible_base,
      total_deductible_tax = v_total_deductible_tax,
      net_result = v_net_tax_balance,
      amount_to_pay = v_net_tax_balance,
      amount_reclaimable = 0,
      amount_carryforward = 0,
      prev_period_carryforward = v_prev_carry,
      updated_at = now()
    WHERE id = v_return_id;
  ELSE
    -- Line 83 / 85 / 86: Visszaigényelhető vagy Következő időszakra átvihető adó
    v_line83_tax := ABS(v_net_tax_balance);
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '83', 0, v_line83_tax, 0, ROUND(v_line83_tax/1000)::int);

    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '86', 0, v_line83_tax, 0, ROUND(v_line83_tax/1000)::int);

    UPDATE vat_returns
    SET 
      total_payable_base = v_total_payable_base,
      total_payable_tax = v_total_payable_tax,
      total_deductible_base = v_total_deductible_base,
      total_deductible_tax = v_total_deductible_tax,
      net_result = v_net_tax_balance,
      amount_to_pay = 0,
      amount_reclaimable = 0,
      amount_carryforward = v_line83_tax,
      prev_period_carryforward = v_prev_carry,
      updated_at = now()
    WHERE id = v_return_id;
  END IF;

  -- 7. Populate M-sheet details
  INSERT INTO vat_return_m_lines (
    vat_return_id, partner_tax_number, partner_name,
    invoice_count, base_amount, tax_amount,
    base_amount_rounded, tax_amount_rounded,
    tax_5_amount, tax_18_amount, tax_27_amount
  )
  SELECT 
    v_return_id,
    ni.supplier_tax_number,
    COALESCE(ni.supplier_name, 'Partner'),
    COUNT(DISTINCT ni.id)::int,
    COALESCE(SUM(ROUND(COALESCE(nii.net_amount, ni.invoice_net_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)), 0),
    COALESCE(SUM(ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)), 0),
    ROUND(COALESCE(SUM(ROUND(COALESCE(nii.net_amount, ni.invoice_net_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)), 0) / 1000)::int,
    ROUND(COALESCE(SUM(ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)), 0) / 1000)::int,
    COALESCE(SUM(CASE WHEN COALESCE(nii.vat_rate, CASE WHEN ROUND(COALESCE(ni.invoice_vat_amount, 0) / NULLIF(ni.invoice_net_amount, 0), 2) = 0.05 THEN '5%' ELSE '0%' END) IN ('0.05','5','5.0','5.00','5%') THEN ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(nii.vat_rate, CASE WHEN ROUND(COALESCE(ni.invoice_vat_amount, 0) / NULLIF(ni.invoice_net_amount, 0), 2) = 0.18 THEN '18%' ELSE '0%' END) IN ('0.18','18','18.0','18.00','18%') THEN ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(nii.vat_rate, CASE WHEN ROUND(COALESCE(ni.invoice_vat_amount, 0) / NULLIF(ni.invoice_net_amount, 0), 2) = 0.27 OR COALESCE(ni.invoice_vat_amount, 0) > 0 THEN '27%' ELSE '0%' END) IN ('0.27','27','27.0','27.00','27%') THEN ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2) ELSE 0 END), 0)
  FROM nav_invoices ni
  LEFT JOIN nav_invoice_items nii ON nii.nav_invoice_id = ni.id
  LEFT JOIN LATERAL (
    SELECT t_sub.id AS tx_id, t_sub.transaction_date
    FROM public.transactions t_sub
    WHERE t_sub.id = ni.transaction_id
       OR t_sub.matched_invoice_id = ni.id
       OR EXISTS (
         SELECT 1 FROM public.transaction_invoice_matches tim
         WHERE tim.transaction_id = t_sub.id AND tim.invoice_id = ni.id
       )
    ORDER BY t_sub.transaction_date DESC
    LIMIT 1
  ) t ON true
  LEFT JOIN LATERAL (
    SELECT rate FROM daily_exchange_rates
    WHERE currency = ni.currency AND rate_date <= COALESCE(ni.manual_payment_date, t.transaction_date, ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date
    ORDER BY rate_date DESC LIMIT 1
  ) er ON true
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = 'INBOUND'
    AND ni.supplier_tax_number IS NOT NULL
    AND (ni.supplier_tax_number LIKE 'HU%' OR ni.supplier_tax_number ~ '^[0-9]{8}')
    AND (
      CASE 
        WHEN (v_is_penzforgalmi OR COALESCE(ni.is_cash_accounting, false) = true) AND COALESCE(ni.payment_method, '') <> 'CASH' THEN
          (ni.transaction_id IS NOT NULL OR t.tx_id IS NOT NULL OR ni.manual_payment_date IS NOT NULL)
          AND COALESCE(ni.manual_payment_date, t.transaction_date)::date BETWEEN v_date_from AND v_date_to
        ELSE
          COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date BETWEEN v_date_from AND v_date_to
      END
    )
  GROUP BY ni.supplier_tax_number, ni.supplier_name
  HAVING SUM(ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)) >= 100000;

  RETURN v_return_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text) TO authenticated, service_role;


-- 2. Update get_gl_categorized_items to include [document_id] in description for acc_journal_lines
DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_posting_status text DEFAULT 'ALL'::text,
  p_gl_account_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  item_id uuid,
  gl_account_id uuid,
  source_table text,
  item_type text,
  partner text,
  description text,
  amount numeric,
  original_amount numeric,
  original_currency text,
  item_date text,
  is_temporary boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH debit_map AS (
    SELECT DISTINCT ON (je_inner.debit_account)
      je_inner.debit_account,
      best_debit.id AS mapped_id
    FROM public.gl_journal_entries je_inner
    LEFT JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je_inner.debit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_debit ON true
    WHERE (
      p_gl_account_id IS NULL
      OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND (best_debit.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.gl_accounts ga WHERE ga.id = best_debit.id AND ga.preset_id = p_preset_id)))
      OR best_debit.id = p_gl_account_id
    )
  ),
  credit_map AS (
    SELECT DISTINCT ON (je_inner.credit_account)
      je_inner.credit_account,
      best_credit.id AS mapped_id
    FROM public.gl_journal_entries je_inner
    LEFT JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je_inner.credit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_credit ON true
    WHERE (
      p_gl_account_id IS NULL
      OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND (best_credit.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.gl_accounts ga WHERE ga.id = best_credit.id AND ga.preset_id = p_preset_id)))
      OR best_credit.id = p_gl_account_id
    )
  ),
  raw_items AS (
    -- ① transactions (banki tételek)
    SELECT
      t.id AS item_id,
      CASE WHEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'transactions'::text AS source_table,
      'Banki tranzakció'::text AS item_type,
      NULL::text AS partner,
      t.description::text AS description,
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1) AS amount,
      t.amount::numeric AS original_amount,
      COALESCE(t.currency, 'HUF')::text AS original_currency,
      t.transaction_date::text AS item_date,
      false AS is_temporary
    FROM public.transactions t
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND t.company_id = p_company_id
      AND t.matched_invoice_id IS NULL
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)
      AND (
        p_gl_account_id IS NULL
        OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND ((t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') IS NULL OR (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = '00000000-0000-0000-0000-000000000000'))
        OR ((t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = p_gl_account_id::text)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = t.company_id
          AND h.import_key = t.id::text
          AND h.status IN ('KONYVELT', 'SZTORNOZOTT')
      )

    UNION ALL

    -- ② invoice_items (számla tételek with non-deductible VAT in cost)
    SELECT
      ii.id AS item_id,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'invoice_items'::text AS source_table,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN 'Bejövő (Költség)' ELSE 'Kimenő (Bevétel)' END::text AS item_type,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN i.elado_nev ELSE i.vevo_nev END::text AS partner,
      COALESCE(ii.line_description, i.bizonylatsorszam)::text AS description,
      (CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0) + ROUND(COALESCE(ii.vat_amount, 0) * (1.0 - (COALESCE(ii.deductible_percentage, 100.0) / 100.0)), 2))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(ii.net_amount, 0)
        ELSE 0
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      (CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0) + ROUND(COALESCE(ii.vat_amount, 0) * (1.0 - (COALESCE(ii.deductible_percentage, 100.0) / 100.0)), 2))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(ii.net_amount, 0)
        ELSE 0
      END)::numeric AS original_amount,
      COALESCE(i.penznem, 'HUF')::text AS original_currency,
      CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::text
        ELSE i.kibocsatas_datuma::text
      END AS item_date,
      false AS is_temporary
    FROM public.invoice_items ii
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND i.company_id = p_company_id
      AND i.statusz != 'jovahagyasra_var'
      AND (i.nav_status IS NULL OR i.nav_status != 'missing_nav' OR i.approved_at IS NOT NULL)
      AND NOT COALESCE(i.exclude_from_accounting, false)
      AND NOT COALESCE(ii.exclude_from_accounting, false)
      AND (
        CASE 
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date <= p_date_to)
          ELSE
            (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from)
            AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)
        END
      )
      AND (
        p_gl_account_id IS NULL
        OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND ((ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') IS NULL OR (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = '00000000-0000-0000-0000-000000000000'))
        OR ((ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = p_gl_account_id::text)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = i.company_id
          AND h.import_key = ii.id::text
          AND h.status IN ('KONYVELT', 'SZTORNOZOTT')
      )

    UNION ALL

    -- ③ nav_invoice_items (NAV számla tételek with non-deductible VAT in cost)
    SELECT
      ni.id AS item_id,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'nav_invoice_items'::text AS source_table,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN 'NAV Bejövő tétel' ELSE 'NAV Kimenő tétel' END::text AS item_type,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN n.supplier_name ELSE n.customer_name END::text AS partner,
      COALESCE(ni.line_description, n.invoice_number)::text AS description,
      (CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0) + ROUND(COALESCE(ni.vat_amount, 0) * (1.0 - (COALESCE(ni.deductible_percentage, 100.0) / 100.0)), 2))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.net_amount, 0)
        ELSE 0
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      (CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0) + ROUND(COALESCE(ni.vat_amount, 0) * (1.0 - (COALESCE(ni.deductible_percentage, 100.0) / 100.0)), 2))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.net_amount, 0)
        ELSE 0
      END)::numeric AS original_amount,
      COALESCE(n.currency, 'HUF')::text AS original_currency,
      CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::text
        ELSE COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text
      END AS item_date,
      true AS is_temporary
    FROM public.nav_invoice_items ni
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND n.company_id = p_company_id
      AND (
        CASE 
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::date <= p_date_to)
          ELSE
            (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
        END
      )
      AND (
        p_gl_account_id IS NULL
        OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND ((ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') IS NULL OR (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = '00000000-0000-0000-0000-000000000000'))
        OR ((ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = p_gl_account_id::text)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.company_id = n.company_id
          AND REPLACE(LOWER(i.bizonylatsorszam), ' ', '') = REPLACE(LOWER(n.invoice_number), ' ', '')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = n.company_id
          AND h.import_key = ni.id::text
          AND h.status IN ('KONYVELT', 'SZTORNOZOTT')
      )

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT side (PRE-MAPPED)
    SELECT
      je.id AS item_id,
      dm.mapped_id AS mapped_id,
      'journal_entry'::text AS source_table,
      'XML Könyvelési tétel (T)'::text AS item_type,
      je.partner_name::text AS partner,
      COALESCE(je.description, je.voucher_number)::text AS description,
      je.amount AS amount,
      je.amount::numeric AS original_amount,
      'HUF'::text AS original_currency,
      je.voucher_date::text AS item_date,
      false AS is_temporary
    FROM public.gl_journal_entries je
    JOIN debit_map dm ON je.debit_account = dm.debit_account
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
      AND je.debit_account IS NOT NULL
      AND je.amount > 0

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (PRE-MAPPED)
    SELECT
      je.id AS item_id,
      dm.mapped_id AS mapped_id,
      'journal_entry'::text AS source_table,
      'XML Könyvelési tétel (K)'::text AS item_type,
      je.partner_name::text AS partner,
      COALESCE(je.description, je.voucher_number)::text AS description,
      -je.amount AS amount,
      -je.amount::numeric AS original_amount,
      'HUF'::text AS original_currency,
      je.voucher_date::text AS item_date,
      false AS is_temporary
    FROM public.gl_journal_entries je
    JOIN credit_map dm ON je.credit_account = dm.credit_account
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
      AND je.credit_account IS NOT NULL
      AND je.amount > 0

    UNION ALL

    -- ⑥ Internal accounting journals (acc_journal_lines - KONYVELT & SZTORNOZOTT properly net out)
    -- FIXED: Prepend [h.document_id] to description so invoice number is clear!
    SELECT
      l.id AS item_id,
      COALESCE(
        CASE WHEN g.preset_id = p_preset_id THEN g.id ELSE NULL END,
        best_active.id,
        g.id
      ) AS mapped_id,
      'acc_journal_lines'::text AS source_table,
      CASE
        WHEN h.entry_type = 'OPENING' OR j.code = 'NY' THEN 'Nyitó tétel'
        WHEN h.entry_type = 'CLOSING' OR j.code = 'Z' THEN 'Záró tétel'
        WHEN j.code = 'VE' THEN 'Vegyes napló tétel'
        WHEN l.dc_type = 'T' THEN 'Könyvelt napló tétel (T)'
        ELSE 'Könyvelt napló tétel (K)'
      END::text AS item_type,
      p.name::text AS partner,
      CASE
        WHEN h.document_id IS NOT NULL AND h.document_id != '' 
        THEN ('[' || h.document_id || '] ' || COALESCE(l.description, h.description, ''))::text
        ELSE COALESCE(l.description, h.description, h.document_id, '')::text
      END AS description,
      (CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END) AS amount,
      (CASE WHEN l.dc_type = 'T' THEN COALESCE(l.foreign_amount, l.amount) ELSE -COALESCE(l.foreign_amount, l.amount) END)::numeric AS original_amount,
      COALESCE(h.currency, 'HUF')::text AS original_currency,
      CASE
        WHEN p_date_basis = 'teljesites' THEN COALESCE(h.posting_date, h.document_date)::text
        ELSE COALESCE(h.document_date, h.posting_date)::text
      END AS item_date,
      false AS is_temporary
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.acc_journals j ON h.journal_id = j.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
    LEFT JOIN public.partners p ON h.partner_id = p.id
    LEFT JOIN LATERAL (
      SELECT ga.id
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND REPLACE(split_part(ga.gl_number, '-', 1), '.', '') = REPLACE(split_part(g.gl_number, '-', 1), '.', '')
      ORDER BY LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_active ON true
    WHERE h.company_id = p_company_id
      AND h.status IN ('KONYVELT', 'SZTORNOZOTT')
      AND (
        CASE
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(h.posting_date, h.document_date) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(h.posting_date, h.document_date) <= p_date_to)
          ELSE
            (p_date_from IS NULL OR COALESCE(h.document_date, h.posting_date) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(h.document_date, h.posting_date) <= p_date_to)
        END
      )
      AND (
        p_gl_account_id IS NULL
        OR COALESCE(CASE WHEN g.preset_id = p_preset_id THEN g.id ELSE NULL END, best_active.id, g.id) = p_gl_account_id
      )
  )
  SELECT
    r.item_id,
    r.mapped_id AS gl_account_id,
    r.source_table,
    r.item_type,
    r.partner,
    r.description,
    r.amount,
    r.original_amount,
    r.original_currency,
    r.item_date,
    r.is_temporary
  FROM raw_items r
  ORDER BY r.item_date DESC, r.item_id ASC
  LIMIT p_limit
  OFFSET COALESCE(p_offset, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer) TO authenticated, service_role;
