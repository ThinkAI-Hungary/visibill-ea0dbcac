-- Migration: 20260910160000_fix_batch_payments_and_multi_match_journals.sql
-- Description: Fix batch payment settlement reclassifications (composite import_key) and multi-match coverage in calculate_vat_return and acc_generate_drafts_from_ledger

-- 1. Update calculate_vat_return to support multi-matched transactions
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
      nii.net_amount,
      nii.vat_amount,
      nii.vat_rate,
      COALESCE(nii.deductible_percentage, 100.0) AS deductible_pct
    FROM nav_invoices ni
    JOIN nav_invoice_items nii ON nii.nav_invoice_id = ni.id
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
        -- Matches either by delivery date or by actual payment date
        COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date BETWEEN v_date_from AND v_date_to
        OR COALESCE(ni.manual_payment_date, t.transaction_date)::date BETWEEN v_date_from AND v_date_to
      )
  LOOP
    -- Cash-Basis (Pénzforgalmi) Date Determination
    v_is_paid := (COALESCE(inv_rec.payment_method, '') = 'CASH' OR inv_rec.transaction_id IS NOT NULL OR inv_rec.tx_id IS NOT NULL OR inv_rec.manual_payment_date IS NOT NULL);

    IF inv_rec.invoice_direction = 'OUTBOUND' THEN
      IF v_is_penzforgalmi AND COALESCE(inv_rec.payment_method, '') <> 'CASH' THEN
        -- If company is cash-basis, unpaid transfer invoice has NO tax liability yet
        IF NOT v_is_paid THEN
          CONTINUE;
        END IF;
        v_effective_tax_date := COALESCE(inv_rec.manual_payment_date, inv_rec.transaction_date)::date;
      ELSE
        v_effective_tax_date := inv_rec.delivery_date;
      END IF;
    ELSE -- INBOUND
      IF (v_is_penzforgalmi OR COALESCE(inv_rec.is_cash_accounting, false) = true) AND COALESCE(inv_rec.payment_method, '') <> 'CASH' THEN
        -- If company or supplier is cash-basis, unpaid transfer invoice has NO deduction right yet
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

  -- Line 65 (Belföldi 18% levonható)
  IF v_line65_base > 0 OR v_line65_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '65', v_line65_base, v_line65_tax, ROUND(v_line65_base/1000)::int, ROUND(v_line65_tax/1000)::int);
  END IF;

  -- Line 66 (Belföldi 27% levonható)
  IF v_line66_base > 0 OR v_line66_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '66', v_line66_base, v_line66_tax, ROUND(v_line66_base/1000)::int, ROUND(v_line66_tax/1000)::int);
  END IF;

  -- Line 67 (Import és EU szolgáltatás levonható 27%)
  IF v_line67_base > 0 OR v_line67_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '67', v_line67_base, v_line67_tax, ROUND(v_line67_base/1000)::int, ROUND(v_line67_tax/1000)::int);
  END IF;

  -- Line 91 (Közösségi adómentes termékértékesítés)
  IF v_line91_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '91', v_line91_base, 0, ROUND(v_line91_base/1000)::int, 0);
  END IF;

  -- Line 92 (Közösségi adómentes szolgáltatásnyújtás)
  IF v_line92_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '92', v_line92_base, 0, ROUND(v_line92_base/1000)::int, 0);
  END IF;

  -- Line 82 (Előző időszaki göngyölt követelés)
  IF v_prev_carry > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '82', 0, v_prev_carry, 0, ROUND(v_prev_carry/1000)::int);
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
    -- Line 77 / 84: Befizetendő adó
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '77', 0, v_net_tax_balance, 0, ROUND(v_net_tax_balance/1000)::int);

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

  -- 7. Populate M-sheet details with identical cash-basis date logic
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
    COALESCE(SUM(ROUND(COALESCE(nii.net_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)), 0),
    COALESCE(SUM(ROUND(COALESCE(nii.vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)), 0),
    ROUND(COALESCE(SUM(ROUND(COALESCE(nii.net_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)), 0) / 1000)::int,
    ROUND(COALESCE(SUM(ROUND(COALESCE(nii.vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)), 0) / 1000)::int,
    COALESCE(SUM(CASE WHEN nii.vat_rate IN ('0.05','5','5.0','5.00') THEN ROUND(COALESCE(nii.vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN nii.vat_rate IN ('0.18','18','18.0','18.00') THEN ROUND(COALESCE(nii.vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN nii.vat_rate IN ('0.27','27','27.0','27.00') THEN ROUND(COALESCE(nii.vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2) ELSE 0 END), 0)
  FROM nav_invoices ni
  JOIN nav_invoice_items nii ON nii.nav_invoice_id = ni.id
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
    AND ni.supplier_tax_number LIKE 'HU%'
    AND (
      -- If cash-basis applies, must be paid within period
      CASE 
        WHEN (v_is_penzforgalmi OR COALESCE(ni.is_cash_accounting, false) = true) AND COALESCE(ni.payment_method, '') <> 'CASH' THEN
          (ni.transaction_id IS NOT NULL OR t.tx_id IS NOT NULL OR ni.manual_payment_date IS NOT NULL)
          AND COALESCE(ni.manual_payment_date, t.transaction_date)::date BETWEEN v_date_from AND v_date_to
        ELSE
          COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date BETWEEN v_date_from AND v_date_to
      END
    )
  GROUP BY ni.supplier_tax_number, ni.supplier_name
  HAVING SUM(ROUND(COALESCE(nii.vat_amount, 0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)) >= 100000;

  RETURN v_return_id;
END;
$function$;


-- 2. Update acc_generate_drafts_from_ledger to handle batch payments & composite import_key
CREATE OR REPLACE FUNCTION public.acc_generate_drafts_from_ledger(p_company_id uuid, p_preset_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_row RECORD;
  v_journal_id UUID;
  v_journal_ve_id UUID;
  v_header_id UUID;
  v_ve_header_id UUID;
  v_base_line_id UUID;
  v_gl_bank_id UUID;
  v_gl_cash_id UUID;
  v_gl_cust_id UUID;
  v_gl_supp_id UUID;
  v_gl_vat_ded_id UUID;
  v_gl_vat_pay_id UUID;
  v_gl_pf_pay_id UUID; -- 47993 Pénzforgalmi ÁFA kötelezettség
  v_gl_pf_ded_id UUID; -- 3689 Pénzforgalmi levonható ÁFA
  v_count INTEGER := 0;
  v_date DATE;
  v_amount NUMERIC;
  v_amount_foreign NUMERIC;
  v_currency CHAR(3);
  v_exchange_rate NUMERIC(12,6);
  v_exchange_rate_date DATE;
  
  -- Company VAT regime
  v_company_vat_regime TEXT := 'normal';
  v_is_penzforgalmi BOOLEAN := false;

  -- Local variables for resolved details
  v_doc_id VARCHAR(64);
  v_partner_id UUID;
  v_partner_name TEXT;
  v_partner_tax VARCHAR(32);
  v_gl_cls JSONB;
  v_final_direction VARCHAR(32);
  v_is_credit BOOLEAN;
  v_payment_method VARCHAR(32);
  v_is_cash_accounting BOOLEAN;
  v_transaction_id UUID;
  v_manual_payment_date DATE;
  v_is_paid BOOLEAN;
  
  -- Item level VAT, Gross, and Deductibility
  v_item_net NUMERIC;
  v_item_vat NUMERIC;
  v_item_gross NUMERIC;
  v_item_vat_rate VARCHAR(16);
  v_deductible_pct NUMERIC;
  
  -- Converted HUF amounts for lines
  v_huf_net NUMERIC;
  v_huf_vat NUMERIC;
  v_huf_gross NUMERIC;
  v_huf_vat_deductible NUMERIC;
  v_huf_vat_non_deductible NUMERIC;
  v_huf_expense NUMERIC;
  
  -- Foreign currency amounts for lines
  v_foreign_net NUMERIC;
  v_foreign_vat NUMERIC;
  v_foreign_gross NUMERIC;
  v_foreign_vat_deductible NUMERIC;
  v_foreign_vat_non_deductible NUMERIC;
  v_foreign_expense NUMERIC;

  -- Selected VAT account for the draft entry
  v_selected_vat_gl_id UUID;
  v_selected_vat_role_desc TEXT;

  -- Matched invoice details for Bank reclassification entry
  v_matched_inv RECORD;
  v_matched_tr RECORD;
BEGIN
  -- 1. Delete existing system suggestions to allow clean refresh
  DELETE FROM public.acc_journal_headers 
   WHERE company_id = p_company_id 
     AND status = 'GEPI_JAVASLAT';

  -- 2. Ensure default journals are seeded
  PERFORM public.acc_seed_default_journals(p_company_id);

  -- 2.1 Lookup company VAT regime
  SELECT COALESCE(c.vat_regime, 'normal') INTO v_company_vat_regime
  FROM public.companies c WHERE c.id = p_company_id;
  v_is_penzforgalmi := (v_company_vat_regime = 'penzforgalmi');

  -- 2.2 Resolve Vegyes (VE) journal
  SELECT id INTO v_journal_ve_id 
    FROM public.acc_journals 
   WHERE company_id = p_company_id AND code = 'VE' 
   LIMIT 1;

  -- 3. Resolve Customer (311%) control account
  SELECT id INTO v_gl_cust_id 
    FROM public.gl_accounts 
   WHERE preset_id = p_preset_id AND gl_number LIKE '311%' 
   ORDER BY gl_number LIMIT 1;
   
  IF v_gl_cust_id IS NULL THEN
    SELECT id INTO v_gl_cust_id 
      FROM public.gl_accounts 
     WHERE company_id = p_company_id AND gl_number LIKE '311%' 
     ORDER BY gl_number LIMIT 1;
  END IF;

  -- 4. Resolve Supplier (454%) control account (prefer 4541 if available)
  SELECT id INTO v_gl_supp_id 
    FROM public.gl_accounts 
   WHERE preset_id = p_preset_id AND (gl_number = '4541' OR gl_number LIKE '454%') 
   ORDER BY (gl_number = '4541') DESC, gl_number LIMIT 1;
   
  IF v_gl_supp_id IS NULL THEN
    SELECT id INTO v_gl_supp_id 
      FROM public.gl_accounts 
     WHERE company_id = p_company_id AND (gl_number = '4541' OR gl_number LIKE '454%') 
     ORDER BY (gl_number = '4541') DESC, gl_number LIMIT 1;
  END IF;

  -- 5. Resolve VAT accounts (466% Levonható, 467% Fizetendő)
  SELECT id INTO v_gl_vat_ded_id 
    FROM public.gl_accounts 
   WHERE preset_id = p_preset_id AND gl_number LIKE '466%' 
   ORDER BY gl_number LIMIT 1;
   
  IF v_gl_vat_ded_id IS NULL THEN
    SELECT id INTO v_gl_vat_ded_id 
      FROM public.gl_accounts 
     WHERE company_id = p_company_id AND gl_number LIKE '466%' 
     ORDER BY gl_number LIMIT 1;
  END IF;

  SELECT id INTO v_gl_vat_pay_id 
    FROM public.gl_accounts 
   WHERE preset_id = p_preset_id AND gl_number LIKE '467%' 
   ORDER BY gl_number LIMIT 1;
   
  IF v_gl_vat_pay_id IS NULL THEN
    SELECT id INTO v_gl_vat_pay_id 
      FROM public.gl_accounts 
     WHERE company_id = p_company_id AND gl_number LIKE '467%' 
     ORDER BY gl_number LIMIT 1;
  END IF;

  -- 5.1 Resolve Pénzforgalmi VAT accounts (47993 Fizetendő, 3689 Levonható)
  SELECT id INTO v_gl_pf_pay_id 
    FROM public.gl_accounts 
   WHERE preset_id = p_preset_id AND (gl_number = '47993' OR gl_number LIKE '4799%') 
   ORDER BY (gl_number = '47993') DESC, gl_number LIMIT 1;

  IF v_gl_pf_pay_id IS NULL THEN
    SELECT id INTO v_gl_pf_pay_id 
      FROM public.gl_accounts 
     WHERE company_id = p_company_id AND (gl_number = '47993' OR gl_number LIKE '4799%') 
     ORDER BY (gl_number = '47993') DESC, gl_number LIMIT 1;
  END IF;

  IF v_gl_pf_pay_id IS NULL THEN
    v_gl_pf_pay_id := v_gl_vat_pay_id;
  END IF;

  SELECT id INTO v_gl_pf_ded_id 
    FROM public.gl_accounts 
   WHERE preset_id = p_preset_id AND (gl_number = '3689' OR gl_number LIKE '368%') 
   ORDER BY (gl_number = '3689') DESC, gl_number LIMIT 1;

  IF v_gl_pf_ded_id IS NULL THEN
    SELECT id INTO v_gl_pf_ded_id 
      FROM public.gl_accounts 
     WHERE company_id = p_company_id AND (gl_number = '3689' OR gl_number LIKE '368%') 
     ORDER BY (gl_number = '3689') DESC, gl_number LIMIT 1;
  END IF;

  IF v_gl_pf_ded_id IS NULL THEN
    v_gl_pf_ded_id := v_gl_vat_ded_id;
  END IF;

  -- 6. Loop over operative items from GL categorized items
  FOR v_row IN 
      SELECT * FROM public.get_gl_categorized_items(p_company_id, p_preset_id, null, null)
       WHERE gl_account_id IS NOT NULL 
         AND gl_account_id <> '00000000-0000-0000-0000-000000000000'::uuid
         AND amount IS NOT NULL 
         AND amount <> 0
         AND source_table IN ('transactions', 'invoice_items', 'nav_invoice_items', 'journal_entry')
  LOOP
    -- Double check that gl_account_id exists in gl_accounts table
    IF NOT EXISTS (SELECT 1 FROM public.gl_accounts WHERE id = v_row.gl_account_id) THEN
      CONTINUE;
    END IF;

    -- Check if already imported
    IF EXISTS (
      SELECT 1 FROM public.acc_journal_headers 
       WHERE company_id = p_company_id AND import_key = v_row.item_id::text
    ) THEN
      CONTINUE;
    END IF;

    -- Determine date
    v_date := COALESCE(v_row.item_date::date, CURRENT_DATE);
    v_currency := COALESCE(v_row.original_currency, 'HUF');
    
    -- Currency & daily exchange rate lookup
    IF v_currency <> 'HUF' THEN
      v_amount_foreign := ROUND(ABS(COALESCE(v_row.original_amount, v_row.amount)), 2);
      
      SELECT rate, rate_date 
        INTO v_exchange_rate, v_exchange_rate_date
        FROM public.daily_exchange_rates
       WHERE currency = v_currency
         AND rate_date <= v_date
       ORDER BY rate_date DESC
       LIMIT 1;

      IF v_exchange_rate IS NULL OR v_exchange_rate <= 0 THEN
        SELECT rate, rate_date 
          INTO v_exchange_rate, v_exchange_rate_date
          FROM public.daily_exchange_rates
         WHERE currency = v_currency
         ORDER BY rate_date DESC
         LIMIT 1;
      END IF;

      IF v_exchange_rate IS NULL OR v_exchange_rate <= 0 THEN
        v_exchange_rate := 1.000000;
        v_exchange_rate_date := v_date;
      END IF;

      v_amount := ROUND(v_amount_foreign * v_exchange_rate, 2);
    ELSE
      v_exchange_rate := 1.000000;
      v_exchange_rate_date := v_date;
      v_amount_foreign := NULL;
      v_amount := ROUND(ABS(v_row.amount), 2);
    END IF;

    IF v_amount <= 0 THEN
      CONTINUE;
    END IF;

    -- Case A: Bank transaction (2-legged double entry in B1/B2, + Pénzforgalmi ÁFA átvezetés ha párosított)
    IF v_row.source_table = 'transactions' THEN
      IF v_currency = 'HUF' THEN
        SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'B1' LIMIT 1;
      ELSIF v_currency = 'EUR' THEN
        SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'B2' LIMIT 1;
      ELSE
        SELECT id INTO v_journal_id FROM public.acc_journals 
         WHERE company_id = p_company_id AND type = 'BANK' AND currency = v_currency LIMIT 1;
      END IF;

      IF v_journal_id IS NULL THEN
        INSERT INTO public.acc_journals (company_id, code, name, type, connected_gl_account, currency)
        VALUES (
          p_company_id, 
          'B_' || v_currency, 
          'Deviza bank ' || v_currency, 
          'BANK', 
          '386',
          v_currency
        )
        ON CONFLICT (company_id, code) DO UPDATE SET currency = EXCLUDED.currency
        RETURNING id INTO v_journal_id;
      END IF;

      IF v_currency = 'HUF' THEN
        SELECT id INTO v_gl_bank_id 
          FROM public.gl_accounts 
         WHERE (preset_id = p_preset_id OR company_id = p_company_id) AND gl_number LIKE '384%' 
         ORDER BY gl_number LIMIT 1;
      ELSE
        SELECT id INTO v_gl_bank_id 
          FROM public.gl_accounts 
         WHERE (preset_id = p_preset_id OR company_id = p_company_id) AND gl_number LIKE '386%' 
         ORDER BY gl_number LIMIT 1;
      END IF;
      
      IF v_gl_bank_id IS NULL THEN
        SELECT id INTO v_gl_bank_id 
          FROM public.gl_accounts 
         WHERE preset_id = p_preset_id OR company_id = p_company_id 
         ORDER BY gl_number LIMIT 1;
      END IF;
      
      v_doc_id := 'TR-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8));
      
      INSERT INTO public.acc_journal_headers (
        company_id, journal_id, accounting_year, status, entry_type, source,
        posting_date, document_date, document_id, partner_id,
        description, currency, exchange_rate, exchange_rate_date, import_key,
        ai_recommendation, confidence
      ) VALUES (
        p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_BANK',
        v_date, v_date, v_doc_id, NULL,
        COALESCE(v_row.description, 'Banki tranzakció'), v_currency, v_exchange_rate, v_exchange_rate_date, v_row.item_id::text,
        v_gl_cls, (v_gl_cls ->> 'confidence_score')::numeric
      ) RETURNING id INTO v_header_id;

      IF v_row.amount >= 0 THEN
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
        VALUES 
          (v_header_id, 1, v_gl_bank_id, 'T', v_amount, v_amount_foreign, COALESCE(v_row.description, '')),
          (v_header_id, 2, v_row.gl_account_id, 'K', v_amount, v_amount_foreign, COALESCE(v_row.description, ''));
      ELSE
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
        VALUES 
          (v_header_id, 1, v_row.gl_account_id, 'T', v_amount, v_amount_foreign, COALESCE(v_row.description, '')),
          (v_header_id, 2, v_gl_bank_id, 'K', v_amount, v_amount_foreign, COALESCE(v_row.description, ''));
      END IF;

      -- Check if this transaction settles a cash-basis transfer invoice -> generate secondary ÁFA reclassification in VE
      FOR v_matched_inv IN
        SELECT ni.id, ni.invoice_number, ni.invoice_direction, ni.is_cash_accounting, 
               COALESCE(ni.invoice_vat_amount, 0) as vat_amount, ni.payment_method
          FROM public.nav_invoices ni
         WHERE ni.company_id = p_company_id 
           AND (ni.transaction_id = v_row.item_id OR ni.id = (SELECT matched_invoice_id FROM public.transactions WHERE id = v_row.item_id)
                OR EXISTS (SELECT 1 FROM public.transaction_invoice_matches tim WHERE tim.transaction_id = v_row.item_id AND tim.invoice_id = ni.id))
        UNION
        SELECT inv.id, inv.bizonylatsorszam AS invoice_number, inv.invoice_direction, inv.penzforgalmi_elszamolas AS is_cash_accounting,
               COALESCE(inv.afa_osszeg_osszesen, 0) as vat_amount, inv.fizetesi_mod AS payment_method
          FROM public.invoices inv
         WHERE inv.company_id = p_company_id
           AND (inv.transaction_id = v_row.item_id OR inv.id = (SELECT matched_invoice_id FROM public.transactions WHERE id = v_row.item_id)
                OR EXISTS (SELECT 1 FROM public.transaction_invoice_matches tim WHERE tim.transaction_id = v_row.item_id AND tim.invoice_id = inv.id))
      LOOP
        IF v_matched_inv.id IS NOT NULL AND v_matched_inv.vat_amount > 0 AND COALESCE(v_matched_inv.payment_method, '') <> 'CASH' AND v_journal_ve_id IS NOT NULL THEN
          -- Case A.1: Outbound invoice customer payment -> Reclassify 47993 to 467
          IF v_matched_inv.invoice_direction = 'OUTBOUND' AND v_is_penzforgalmi THEN
            IF NOT EXISTS (
              SELECT 1 FROM public.acc_journal_headers
               WHERE company_id = p_company_id 
                 AND import_key = 'PF-VAT-TR-' || v_row.item_id::text || '-' || v_matched_inv.id::text
            ) THEN
              INSERT INTO public.acc_journal_headers (
                company_id, journal_id, accounting_year, status, entry_type, source,
                posting_date, document_date, document_id, partner_id,
                description, currency, exchange_rate, exchange_rate_date, import_key
              ) VALUES (
                p_company_id, v_journal_ve_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_SZAMLA',
                v_date, v_date, 'AFA-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(v_matched_inv.id::text FROM 1 FOR 4)), NULL,
                'Pénzforgalmi ÁFA átvezetés (47993->467) - ' || COALESCE(v_matched_inv.invoice_number, ''),
                'HUF', 1.0, v_date, 'PF-VAT-TR-' || v_row.item_id::text || '-' || v_matched_inv.id::text
              ) RETURNING id INTO v_ve_header_id;

              INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
              VALUES 
                (v_ve_header_id, 1, v_gl_pf_pay_id, 'T', v_matched_inv.vat_amount, 'Pénzforgalmi ÁFA kötelezettség kivezetése'),
                (v_ve_header_id, 2, v_gl_vat_pay_id, 'K', v_matched_inv.vat_amount, 'Fizetendő ÁFA előírása');
            END IF;

          -- Case A.2: Inbound invoice supplier payment -> Reclassify 3689 to 466
          ELSIF v_matched_inv.invoice_direction = 'INBOUND' AND (v_is_penzforgalmi OR COALESCE(v_matched_inv.is_cash_accounting, false) = true) THEN
            IF NOT EXISTS (
              SELECT 1 FROM public.acc_journal_headers
               WHERE company_id = p_company_id 
                 AND import_key = 'PF-VAT-TR-' || v_row.item_id::text || '-' || v_matched_inv.id::text
            ) THEN
              INSERT INTO public.acc_journal_headers (
                company_id, journal_id, accounting_year, status, entry_type, source,
                posting_date, document_date, document_id, partner_id,
                description, currency, exchange_rate, exchange_rate_date, import_key
              ) VALUES (
                p_company_id, v_journal_ve_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_SZAMLA',
                v_date, v_date, 'AFA-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(v_matched_inv.id::text FROM 1 FOR 4)), NULL,
                'Pénzforgalmi ÁFA átvezetés (466->3689) - ' || COALESCE(v_matched_inv.invoice_number, ''),
                'HUF', 1.0, v_date, 'PF-VAT-TR-' || v_row.item_id::text || '-' || v_matched_inv.id::text
              ) RETURNING id INTO v_ve_header_id;

              INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
              VALUES 
                (v_ve_header_id, 1, v_gl_vat_ded_id, 'T', v_matched_inv.vat_amount, 'Levonható ÁFA előírása'),
                (v_ve_header_id, 2, v_gl_pf_ded_id, 'K', v_matched_inv.vat_amount, 'Pénzforgalmi levonható ÁFA kivezetése');
            END IF;
          END IF;
        END IF;
      END LOOP;

    -- Case B: Invoices (Double entry with Deductibility and Cash-Basis Support)
    ELSIF v_row.source_table IN ('invoice_items', 'nav_invoice_items') THEN
      v_item_net := NULL;
      v_item_vat := NULL;
      v_item_gross := NULL;
      v_item_vat_rate := NULL;
      v_deductible_pct := 100.00;
      v_payment_method := 'TRANSFER';
      v_is_cash_accounting := false;
      v_transaction_id := NULL;
      v_manual_payment_date := NULL;

      IF v_row.source_table = 'invoice_items' THEN
        DECLARE
          v_invoice_direction VARCHAR(32);
          v_elado_nev VARCHAR(255);
          v_elado_vat VARCHAR(255);
          v_vevo_nev VARCHAR(255);
          v_vevo_vat VARCHAR(255);
        BEGIN
          SELECT 
            i.bizonylatsorszam,
            i.invoice_direction,
            i.elado_nev,
            i.elado_vat_id,
            i.vevo_nev,
            i.vevo_vat_id,
            ii.net_amount,
            ii.vat_amount,
            ii.gross_amount,
            ii.vat_rate,
            COALESCE(ii.deductible_percentage, 100.00),
            COALESCE(i.fizetesi_mod, 'TRANSFER'),
            COALESCE(i.penzforgalmi_elszamolas, false),
            i.transaction_id,
            i.manual_payment_date
          INTO 
            v_doc_id,
            v_invoice_direction,
            v_elado_nev,
            v_elado_vat,
            v_vevo_nev,
            v_vevo_vat,
            v_item_net,
            v_item_vat,
            v_item_gross,
            v_item_vat_rate,
            v_deductible_pct,
            v_payment_method,
            v_is_cash_accounting,
            v_transaction_id,
            v_manual_payment_date
          FROM public.invoice_items ii
          JOIN public.invoices i ON i.id = ii.invoice_id
          WHERE ii.id = v_row.item_id;

          v_final_direction := v_invoice_direction;
          v_doc_id := COALESCE(v_doc_id, 'SZ-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8)));
          
          IF v_invoice_direction = 'OUTBOUND' THEN
            v_partner_name := v_vevo_nev;
            v_partner_tax := v_vevo_vat;
          ELSE
            v_partner_name := v_elado_nev;
            v_partner_tax := v_elado_vat;
          END IF;
        END;
      ELSE
        -- nav_invoice_items
        DECLARE
          v_nav_direction VARCHAR(32);
          v_supplier_name VARCHAR(255);
          v_customer_name VARCHAR(255);
        BEGIN
          SELECT 
            ni.invoice_number,
            ni.invoice_direction,
            ni.supplier_name,
            ni.customer_name,
            CASE WHEN ni.invoice_direction = 'OUTBOUND' THEN ni.customer_tax_number ELSE ni.supplier_tax_number END,
            nii.net_amount,
            nii.vat_amount,
            nii.gross_amount,
            nii.vat_rate,
            COALESCE(nii.deductible_percentage, 100.00),
            COALESCE(ni.payment_method, 'TRANSFER'),
            COALESCE(ni.is_cash_accounting, false),
            ni.transaction_id,
            ni.manual_payment_date
          INTO 
            v_doc_id,
            v_nav_direction,
            v_supplier_name,
            v_customer_name,
            v_partner_tax,
            v_item_net,
            v_item_vat,
            v_item_gross,
            v_item_vat_rate,
            v_deductible_pct,
            v_payment_method,
            v_is_cash_accounting,
            v_transaction_id,
            v_manual_payment_date
          FROM public.nav_invoice_items nii
          JOIN public.nav_invoices ni ON ni.id = nii.nav_invoice_id
          WHERE nii.id = v_row.item_id;

          v_final_direction := v_nav_direction;
          v_doc_id := COALESCE(v_doc_id, 'NAV-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8)));
          
          IF v_nav_direction = 'OUTBOUND' THEN
            v_partner_name := v_customer_name;
          ELSE
            v_partner_name := v_supplier_name;
          END IF;
        END;
      END IF;

      -- Check if invoice is paid
      v_is_paid := (COALESCE(v_payment_method, '') = 'CASH' OR v_transaction_id IS NOT NULL OR v_manual_payment_date IS NOT NULL);

      -- Robust Partner resolution
      v_partner_id := NULL;
      
      IF v_partner_tax IS NOT NULL AND TRIM(v_partner_tax) <> '' THEN
        SELECT id INTO v_partner_id FROM public.partners 
         WHERE company_id = p_company_id 
           AND (
             tax_number = v_partner_tax
             OR (
               length(regexp_replace(v_partner_tax, '[^0-9]', '', 'g')) >= 8
               AND length(regexp_replace(tax_number, '[^0-9]', '', 'g')) >= 8
               AND SUBSTRING(regexp_replace(tax_number, '[^0-9]', '', 'g') FROM 1 FOR 8) = SUBSTRING(regexp_replace(v_partner_tax, '[^0-9]', '', 'g') FROM 1 FOR 8)
             )
           )
         LIMIT 1;
      END IF;
      
      IF v_partner_id IS NULL AND v_partner_name IS NOT NULL AND TRIM(v_partner_name) <> '' THEN
        SELECT id INTO v_partner_id FROM public.partners 
         WHERE company_id = p_company_id 
           AND LOWER(TRIM(name)) = LOWER(TRIM(v_partner_name)) 
           AND (
             v_partner_tax IS NULL OR TRIM(v_partner_tax) = ''
             OR tax_number IS NULL OR tax_number LIKE 'FOREIGN:%'
             OR length(regexp_replace(v_partner_tax, '[^0-9]', '', 'g')) < 8
             OR length(regexp_replace(tax_number, '[^0-9]', '', 'g')) < 8
             OR SUBSTRING(regexp_replace(tax_number, '[^0-9]', '', 'g') FROM 1 FOR 8) = SUBSTRING(regexp_replace(v_partner_tax, '[^0-9]', '', 'g') FROM 1 FOR 8)
           )
         LIMIT 1;
      END IF;

      -- Determine base amounts
      v_item_net := COALESCE(v_item_net, v_row.amount);
      v_is_credit := (v_item_net < 0);
      
      v_foreign_net := ROUND(ABS(v_item_net), 2);
      v_huf_net := ROUND(v_foreign_net * v_exchange_rate, 2);

      IF v_item_vat IS NOT NULL AND v_item_vat <> 0 THEN
        v_foreign_vat := ROUND(ABS(v_item_vat), 2);
        v_huf_vat := ROUND(v_foreign_vat * v_exchange_rate, 2);
      ELSE
        v_foreign_vat := 0;
        v_huf_vat := 0;
      END IF;

      v_huf_gross := v_huf_net + v_huf_vat;
      IF v_currency <> 'HUF' THEN
        v_foreign_gross := v_foreign_net + v_foreign_vat;
      ELSE
        v_foreign_gross := NULL;
      END IF;

      -- Calculate VAT deductibility split for Inbound purchases
      v_deductible_pct := COALESCE(v_deductible_pct, 100.00);
      IF v_final_direction <> 'OUTBOUND' THEN
        v_huf_vat_deductible := ROUND(v_huf_vat * (v_deductible_pct / 100.0), 2);
        v_huf_vat_non_deductible := v_huf_vat - v_huf_vat_deductible;
        v_huf_expense := v_huf_net + v_huf_vat_non_deductible;
        
        IF v_foreign_vat IS NOT NULL AND v_foreign_vat <> 0 THEN
          v_foreign_vat_deductible := ROUND(v_foreign_vat * (v_deductible_pct / 100.0), 2);
          v_foreign_vat_non_deductible := v_foreign_vat - v_foreign_vat_deductible;
          v_foreign_expense := v_foreign_net + v_foreign_vat_non_deductible;
        ELSE
          v_foreign_vat_deductible := 0;
          v_foreign_vat_non_deductible := 0;
          v_foreign_expense := v_foreign_net;
        END IF;
      ELSE
        -- For outbound sales, VAT is 100%
        v_huf_vat_deductible := v_huf_vat;
        v_huf_vat_non_deductible := 0;
        v_huf_expense := v_huf_net;
        v_foreign_vat_deductible := v_foreign_vat;
        v_foreign_vat_non_deductible := 0;
        v_foreign_expense := v_foreign_net;
      END IF;

      -- B1: Outbound sales invoice (V napló)
      IF v_final_direction = 'OUTBOUND' THEN
        IF v_gl_cust_id IS NULL OR v_row.gl_account_id IS NULL THEN
          CONTINUE;
        END IF;

        -- Resolve VAT account: if cash-basis and unpaid transfer, use 47993
        IF v_is_penzforgalmi AND COALESCE(v_payment_method, '') <> 'CASH' AND NOT v_is_paid THEN
          v_selected_vat_gl_id := v_gl_pf_pay_id;
          v_selected_vat_role_desc := 'Pénzforgalmi ÁFA kötelezettség';
        ELSE
          v_selected_vat_gl_id := v_gl_vat_pay_id;
          v_selected_vat_role_desc := 'Fizetendő ÁFA';
        END IF;

        SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'V' LIMIT 1;
        IF v_journal_id IS NULL THEN SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id LIMIT 1; END IF;
        
        INSERT INTO public.acc_journal_headers (
          company_id, journal_id, accounting_year, status, entry_type, source,
          posting_date, document_date, document_id, partner_id,
          description, currency, exchange_rate, exchange_rate_date, import_key,
          ai_recommendation, confidence
        ) VALUES (
          p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_SZAMLA',
          v_date, v_date, v_doc_id, v_partner_id,
          COALESCE(v_partner_name, 'Vevő') || ' - ' || COALESCE(v_row.description, 'Értékesítés'), v_currency, v_exchange_rate, v_exchange_rate_date, v_row.item_id::text,
          v_gl_cls, (v_gl_cls ->> 'confidence_score')::numeric
        ) RETURNING id INTO v_header_id;

        IF NOT v_is_credit THEN
          INSERT INTO public.acc_journal_lines (
            header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
          ) VALUES (
            v_header_id, 1, v_gl_cust_id, 'T', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
          );

          INSERT INTO public.acc_journal_lines (
            header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description
          ) VALUES (
            v_header_id, 2, v_row.gl_account_id, 'K', v_huf_net, v_foreign_net, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'ALAP', COALESCE(v_row.description, '')
          ) RETURNING id INTO v_base_line_id;

          IF v_huf_vat > 0 AND v_selected_vat_gl_id IS NOT NULL THEN
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
            ) VALUES (
              v_header_id, 3, v_selected_vat_gl_id, 'K', v_huf_vat, v_foreign_vat, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, v_selected_vat_role_desc
            );
          END IF;
        ELSE
          INSERT INTO public.acc_journal_lines (
            header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description
          ) VALUES (
            v_header_id, 1, v_row.gl_account_id, 'T', v_huf_net, v_foreign_net, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'ALAP', COALESCE(v_row.description, '')
          ) RETURNING id INTO v_base_line_id;

          IF v_huf_vat > 0 AND v_selected_vat_gl_id IS NOT NULL THEN
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
            ) VALUES (
              v_header_id, 2, v_selected_vat_gl_id, 'T', v_huf_vat, v_foreign_vat, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, v_selected_vat_role_desc || ' helyesbítés'
            );

            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
            ) VALUES (
              v_header_id, 3, v_gl_cust_id, 'K', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
            );
          ELSE
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
            ) VALUES (
              v_header_id, 2, v_gl_cust_id, 'K', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
            );
          END IF;
        END IF;

      -- B2: Inbound purchase invoice (SZ napló with Deductibility and Cash-Basis Support)
      ELSE
        IF v_gl_supp_id IS NULL OR v_row.gl_account_id IS NULL THEN
          CONTINUE;
        END IF;

        -- Resolve VAT account: if cash-basis (company or supplier) and unpaid transfer, use 3689
        IF (v_is_penzforgalmi OR COALESCE(v_is_cash_accounting, false) = true) AND COALESCE(v_payment_method, '') <> 'CASH' AND NOT v_is_paid THEN
          v_selected_vat_gl_id := v_gl_pf_ded_id;
          v_selected_vat_role_desc := 'Pénzforgalmi levonható ÁFA';
        ELSE
          v_selected_vat_gl_id := v_gl_vat_ded_id;
          v_selected_vat_role_desc := 'Levonható ÁFA';
        END IF;

        SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'SZ' LIMIT 1;
        IF v_journal_id IS NULL THEN SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id LIMIT 1; END IF;

        INSERT INTO public.acc_journal_headers (
          company_id, journal_id, accounting_year, status, entry_type, source,
          posting_date, document_date, document_id, partner_id,
          description, currency, exchange_rate, exchange_rate_date, import_key,
          ai_recommendation, confidence
        ) VALUES (
          p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_SZAMLA',
          v_date, v_date, v_doc_id, v_partner_id,
          COALESCE(v_partner_name, 'Szállító') || ' - ' || COALESCE(v_row.description, 'Költség számla'), v_currency, v_exchange_rate, v_exchange_rate_date, v_row.item_id::text,
          v_gl_cls, (v_gl_cls ->> 'confidence_score')::numeric
        ) RETURNING id INTO v_header_id;

        IF NOT v_is_credit THEN
          -- Normal purchase:
          -- 1. T Expense: Net amount + Non-deductible VAT
          INSERT INTO public.acc_journal_lines (
            header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description
          ) VALUES (
            v_header_id, 1, v_row.gl_account_id, 'T', v_huf_expense, v_foreign_expense, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'ALAP', COALESCE(v_row.description, '')
          ) RETURNING id INTO v_base_line_id;

          -- 2. T Levonható ÁFA (ONLY if deductible VAT > 0)
          IF v_huf_vat_deductible > 0 AND v_selected_vat_gl_id IS NOT NULL THEN
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
            ) VALUES (
              v_header_id, 2, v_selected_vat_gl_id, 'T', v_huf_vat_deductible, v_foreign_vat_deductible, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, v_selected_vat_role_desc
            );

            -- 3. K Supplier: Gross amount
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
            ) VALUES (
              v_header_id, 3, v_gl_supp_id, 'K', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
            );
          ELSE
            -- 0% VAT or non-deductible: 2-legged entry
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
            ) VALUES (
              v_header_id, 2, v_gl_supp_id, 'K', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
            );
          END IF;
        ELSE
          -- Credit note / Storno purchase:
          INSERT INTO public.acc_journal_lines (
            header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
          ) VALUES (
            v_header_id, 1, v_gl_supp_id, 'T', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
          );

          INSERT INTO public.acc_journal_lines (
            header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description
          ) VALUES (
            v_header_id, 2, v_row.gl_account_id, 'K', v_huf_expense, v_foreign_expense, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'ALAP', COALESCE(v_row.description, '')
          ) RETURNING id INTO v_base_line_id;

          IF v_huf_vat_deductible > 0 AND v_selected_vat_gl_id IS NOT NULL THEN
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
            ) VALUES (
              v_header_id, 3, v_selected_vat_gl_id, 'K', v_huf_vat_deductible, v_foreign_vat_deductible, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, v_selected_vat_role_desc || ' helyesbítés'
            );
          END IF;
        END IF;
      END IF;

    -- Case C: External Audit Journal Entry (Vegyes napló)
    ELSIF v_row.source_table = 'journal_entry' THEN
      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'VE' LIMIT 1;
      IF v_journal_id IS NULL THEN SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id LIMIT 1; END IF;
      
      v_doc_id := 'VE-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8));
      
      INSERT INTO public.acc_journal_headers (
        company_id, journal_id, accounting_year, status, entry_type, source,
        posting_date, document_date, document_id, partner_id,
        description, currency, exchange_rate, exchange_rate_date, import_key,
        ai_recommendation, confidence
      ) VALUES (
        p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_VEGYES',
        v_date, v_date, v_doc_id, NULL,
        COALESCE(v_row.description, 'Vegyes könyvelési tétel'), v_currency, v_exchange_rate, v_exchange_rate_date, v_row.item_id::text,
        v_gl_cls, (v_gl_cls ->> 'confidence_score')::numeric
      ) RETURNING id INTO v_header_id;

      IF v_row.amount >= 0 THEN
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
        VALUES 
          (v_header_id, 1, v_row.gl_account_id, 'T', v_amount, v_amount_foreign, COALESCE(v_row.description, ''));
      ELSE
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
        VALUES 
          (v_header_id, 1, v_row.gl_account_id, 'K', v_amount, v_amount_foreign, COALESCE(v_row.description, ''));
      END IF;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  -- 7. Loop over MATCHED bank transactions to book Bank settlements and Pénzforgalmi ÁFA reclassifications
  FOR v_matched_tr IN
    WITH all_matches AS (
      -- 1. Direct matched_invoice_id or nav_invoices.transaction_id
      SELECT 
        t.id AS transaction_id,
        t.transaction_date,
        t.description,
        t.amount,
        COALESCE(t.currency, 'HUF') AS currency,
        ni.id AS invoice_id,
        ni.invoice_number,
        ni.invoice_direction,
        COALESCE(ni.is_cash_accounting, false) AS is_cash_accounting,
        COALESCE(ni.payment_method, 'TRANSFER') AS payment_method,
        COALESCE(ni.invoice_vat_amount, 0) AS vat_amount,
        ni.customer_name,
        ni.customer_tax_number AS customer_tax,
        ni.supplier_name,
        ni.supplier_tax_number AS supplier_tax
      FROM public.transactions t
      JOIN public.nav_invoices ni ON ni.company_id = p_company_id AND (ni.transaction_id = t.id OR ni.id = t.matched_invoice_id)
      WHERE t.company_id = p_company_id
        AND t.amount IS NOT NULL AND t.amount <> 0

      UNION

      -- 2. Direct submitted invoices (invoices table)
      SELECT 
        t.id AS transaction_id,
        t.transaction_date,
        t.description,
        t.amount,
        COALESCE(t.currency, 'HUF') AS currency,
        inv.id AS invoice_id,
        inv.bizonylatsorszam AS invoice_number,
        inv.invoice_direction,
        COALESCE(inv.penzforgalmi_elszamolas, false) AS is_cash_accounting,
        COALESCE(inv.fizetesi_mod, 'TRANSFER') AS payment_method,
        COALESCE(inv.afa_osszeg_osszesen, 0) AS vat_amount,
        inv.vevo_nev AS customer_name,
        inv.vevo_vat_id AS customer_tax,
        inv.elado_nev AS supplier_name,
        inv.elado_vat_id AS supplier_tax
      FROM public.transactions t
      JOIN public.invoices inv ON inv.company_id = p_company_id AND (inv.transaction_id = t.id OR inv.id = t.matched_invoice_id)
      WHERE t.company_id = p_company_id
        AND t.amount IS NOT NULL AND t.amount <> 0

      UNION

      -- 3. Matches via transaction_invoice_matches (multi-match table)
      SELECT 
        t.id AS transaction_id,
        t.transaction_date,
        t.description,
        t.amount,
        COALESCE(t.currency, 'HUF') AS currency,
        COALESCE(ni.id, inv.id) AS invoice_id,
        COALESCE(ni.invoice_number, inv.bizonylatsorszam) AS invoice_number,
        COALESCE(ni.invoice_direction, inv.invoice_direction) AS invoice_direction,
        COALESCE(ni.is_cash_accounting, inv.penzforgalmi_elszamolas, false) AS is_cash_accounting,
        COALESCE(ni.payment_method, inv.fizetesi_mod, 'TRANSFER') AS payment_method,
        COALESCE(ni.invoice_vat_amount, inv.afa_osszeg_osszesen, 0) AS vat_amount,
        COALESCE(ni.customer_name, inv.vevo_nev) AS customer_name,
        COALESCE(ni.customer_tax_number, inv.vevo_vat_id) AS customer_tax,
        COALESCE(ni.supplier_name, inv.elado_nev) AS supplier_name,
        COALESCE(ni.supplier_tax_number, inv.elado_vat_id) AS supplier_tax
      FROM public.transactions t
      JOIN public.transaction_invoice_matches tim ON tim.transaction_id = t.id
      LEFT JOIN public.nav_invoices ni ON ni.id = tim.invoice_id AND tim.invoice_source = 'nav'
      LEFT JOIN public.invoices inv ON inv.id = tim.invoice_id AND tim.invoice_source = 'submitted'
      WHERE t.company_id = p_company_id
        AND t.amount IS NOT NULL AND t.amount <> 0
        AND (ni.id IS NOT NULL OR inv.id IS NOT NULL)
    )
    SELECT DISTINCT ON (transaction_id, invoice_id) *
    FROM all_matches
    ORDER BY transaction_id, invoice_id
  LOOP
    v_date := COALESCE(v_matched_tr.transaction_date::date, CURRENT_DATE);
    v_currency := COALESCE(v_matched_tr.currency, 'HUF');
    v_amount := ROUND(ABS(v_matched_tr.amount), 2);
    
    -- Resolve Bank Journal
    IF v_currency = 'HUF' THEN
      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'B1' LIMIT 1;
    ELSIF v_currency = 'EUR' THEN
      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'B2' LIMIT 1;
    ELSE
      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND type = 'BANK' AND currency = v_currency LIMIT 1;
    END IF;
    IF v_journal_id IS NULL THEN
      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND type = 'BANK' LIMIT 1;
    END IF;

    -- Resolve Bank GL Account (384 for HUF, 386 for FX)
    IF v_currency = 'HUF' THEN
      SELECT id INTO v_gl_bank_id FROM public.gl_accounts WHERE (preset_id = p_preset_id OR company_id = p_company_id) AND gl_number LIKE '384%' ORDER BY gl_number LIMIT 1;
    ELSE
      SELECT id INTO v_gl_bank_id FROM public.gl_accounts WHERE (preset_id = p_preset_id OR company_id = p_company_id) AND gl_number LIKE '386%' ORDER BY gl_number LIMIT 1;
    END IF;

    v_doc_id := 'TR-' || UPPER(SUBSTRING(v_matched_tr.transaction_id::text FROM 1 FOR 8));

    -- Resolve Partner
    v_partner_id := NULL;
    IF v_matched_tr.invoice_direction = 'OUTBOUND' THEN
      v_partner_name := v_matched_tr.customer_name;
      v_partner_tax := v_matched_tr.customer_tax;
    ELSE
      v_partner_name := v_matched_tr.supplier_name;
      v_partner_tax := v_matched_tr.supplier_tax;
    END IF;

    IF v_partner_tax IS NOT NULL AND TRIM(v_partner_tax) <> '' THEN
      SELECT id INTO v_partner_id FROM public.partners 
       WHERE company_id = p_company_id 
         AND (
           tax_number = v_partner_tax
           OR (
             length(regexp_replace(v_partner_tax, '[^0-9]', '', 'g')) >= 8
             AND length(regexp_replace(tax_number, '[^0-9]', '', 'g')) >= 8
             AND SUBSTRING(regexp_replace(tax_number, '[^0-9]', '', 'g') FROM 1 FOR 8) = SUBSTRING(regexp_replace(v_partner_tax, '[^0-9]', '', 'g') FROM 1 FOR 8)
           )
         )
       LIMIT 1;
    END IF;
    IF v_partner_id IS NULL AND v_partner_name IS NOT NULL AND TRIM(v_partner_name) <> '' THEN
      SELECT id INTO v_partner_id FROM public.partners 
       WHERE company_id = p_company_id AND LOWER(TRIM(name)) = LOWER(TRIM(v_partner_name))
       LIMIT 1;
    END IF;

    -- 1. Insert Bank Journal Entry ONCE per transaction_id
    IF NOT EXISTS (
      SELECT 1 FROM public.acc_journal_headers 
       WHERE company_id = p_company_id AND import_key = v_matched_tr.transaction_id::text
    ) THEN
      INSERT INTO public.acc_journal_headers (
        company_id, journal_id, accounting_year, status, entry_type, source,
        posting_date, document_date, document_id, partner_id,
        description, currency, exchange_rate, exchange_rate_date, import_key
      ) VALUES (
        p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_BANK',
        v_date, v_date, v_doc_id, v_partner_id,
        COALESCE(v_matched_tr.description, 'Banki kiegyenlítés - ' || COALESCE(v_matched_tr.invoice_number, '')),
        v_currency, 1.0, v_date, v_matched_tr.transaction_id::text
      ) RETURNING id INTO v_header_id;

      IF v_matched_tr.amount >= 0 THEN
        -- Inflow: Customer Payment (T 384 Bank - K 311 Vevő)
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
        VALUES 
          (v_header_id, 1, v_gl_bank_id, 'T', v_amount, COALESCE(v_matched_tr.description, 'Bank jóváírás')),
          (v_header_id, 2, v_gl_cust_id, 'K', v_amount, 'Vevő követelés kiegyenlítése - ' || COALESCE(v_matched_tr.invoice_number, ''));
      ELSE
        -- Outflow: Supplier Payment (T 454 Szállító - K 384 Bank)
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
        VALUES 
          (v_header_id, 1, v_gl_supp_id, 'T', v_amount, 'Szállító tartozás kiegyenlítése - ' || COALESCE(v_matched_tr.invoice_number, '')),
          (v_header_id, 2, v_gl_bank_id, 'K', v_amount, COALESCE(v_matched_tr.description, 'Bank terhelés'));
      END IF;

      v_count := v_count + 1;
    END IF;

    -- 2. Pénzforgalmi ÁFA átvezetés Vegyes naplóban (VE) for each settled invoice
    IF v_matched_tr.invoice_id IS NOT NULL 
       AND v_matched_tr.vat_amount > 0 
       AND COALESCE(v_matched_tr.payment_method, '') <> 'CASH' 
       AND v_journal_ve_id IS NOT NULL 
    THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers
         WHERE company_id = p_company_id 
           AND import_key = 'PF-VAT-TR-' || v_matched_tr.transaction_id::text || '-' || v_matched_tr.invoice_id::text
      ) THEN
        -- Case A: Outbound invoice customer payment -> Reclassify 47993 to 467
        IF v_matched_tr.invoice_direction = 'OUTBOUND' AND v_is_penzforgalmi THEN
          INSERT INTO public.acc_journal_headers (
            company_id, journal_id, accounting_year, status, entry_type, source,
            posting_date, document_date, document_id, partner_id,
            description, currency, exchange_rate, exchange_rate_date, import_key
          ) VALUES (
            p_company_id, v_journal_ve_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_SZAMLA',
            v_date, v_date, 'AFA-' || UPPER(SUBSTRING(v_matched_tr.transaction_id::text FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(v_matched_tr.invoice_id::text FROM 1 FOR 4)), v_partner_id,
            'Pénzforgalmi ÁFA átvezetés (47993->467) - ' || COALESCE(v_matched_tr.invoice_number, ''),
            'HUF', 1.0, v_date, 'PF-VAT-TR-' || v_matched_tr.transaction_id::text || '-' || v_matched_tr.invoice_id::text
          ) RETURNING id INTO v_ve_header_id;

          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
          VALUES 
            (v_ve_header_id, 1, v_gl_pf_pay_id, 'T', v_matched_tr.vat_amount, 'Pénzforgalmi ÁFA kötelezettség kivezetése'),
            (v_ve_header_id, 2, v_gl_vat_pay_id, 'K', v_matched_tr.vat_amount, 'Fizetendő ÁFA előírása');

          v_count := v_count + 1;

        -- Case B: Inbound invoice supplier payment -> Reclassify 3689 to 466
        ELSIF v_matched_tr.invoice_direction = 'INBOUND' AND (v_is_penzforgalmi OR COALESCE(v_matched_tr.is_cash_accounting, false) = true) THEN
          INSERT INTO public.acc_journal_headers (
            company_id, journal_id, accounting_year, status, entry_type, source,
            posting_date, document_date, document_id, partner_id,
            description, currency, exchange_rate, exchange_rate_date, import_key
          ) VALUES (
            p_company_id, v_journal_ve_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_SZAMLA',
            v_date, v_date, 'AFA-' || UPPER(SUBSTRING(v_matched_tr.transaction_id::text FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(v_matched_tr.invoice_id::text FROM 1 FOR 4)), v_partner_id,
            'Pénzforgalmi ÁFA átvezetés (466->3689) - ' || COALESCE(v_matched_tr.invoice_number, ''),
            'HUF', 1.0, v_date, 'PF-VAT-TR-' || v_matched_tr.transaction_id::text || '-' || v_matched_tr.invoice_id::text
          ) RETURNING id INTO v_ve_header_id;

          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
          VALUES 
            (v_ve_header_id, 1, v_gl_vat_ded_id, 'T', v_matched_tr.vat_amount, 'Levonható ÁFA előírása'),
            (v_ve_header_id, 2, v_gl_pf_ded_id, 'K', v_matched_tr.vat_amount, 'Pénzforgalmi levonható ÁFA kivezetése');

          v_count := v_count + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_generate_drafts_from_ledger(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_generate_drafts_from_ledger(uuid, uuid) TO authenticated, service_role;
