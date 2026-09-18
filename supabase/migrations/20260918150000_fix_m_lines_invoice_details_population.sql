-- Migration: 20260918150000_fix_m_lines_invoice_details_population.sql
-- Purpose: Fix M-sheet (vat_return_m_lines) columns and populate invoice_details JSONB so drilldowns expand properly.

DROP FUNCTION IF EXISTS public.calculate_vat_return(UUID, INT, INT, TEXT);

CREATE OR REPLACE FUNCTION calculate_vat_return(
  p_company_id UUID,
  p_year INT,
  p_month INT,
  p_frequency TEXT DEFAULT 'H'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_date_from DATE;
  v_date_to DATE;
  v_return_id UUID;
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
  v_line45_base NUMERIC := 0;
  v_line91_base NUMERIC := 0;
  v_line92_base NUMERIC := 0;

  v_line18_base NUMERIC := 0; v_line18_tax NUMERIC := 0;
  v_line27_base NUMERIC := 0; v_line27_tax NUMERIC := 0;

  v_line64_base NUMERIC := 0; v_line64_tax NUMERIC := 0;
  v_line65_base NUMERIC := 0; v_line65_tax NUMERIC := 0;
  v_line66_base NUMERIC := 0; v_line66_tax NUMERIC := 0;
  v_line67_base NUMERIC := 0; v_line67_tax NUMERIC := 0;
  v_line77_tax NUMERIC := 0;

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
  v_is_settled BOOLEAN;
  v_override_row TEXT;
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
    WHERE company_id = p_company_id AND frequency = p_frequency AND (
      (p_frequency = 'H' AND (
        (period_year = p_year AND period_month = p_month - 1) OR
        (p_month = 1 AND period_year = p_year - 1 AND period_month = 12)
      )) OR
      (p_frequency = 'N' AND (
        (period_year = p_year AND period_month = p_month - 1) OR
        (p_month = 1 AND period_year = p_year - 1 AND period_month = 4)
      ))
    ) AND id != v_return_id
    LIMIT 1;
  END IF;
  v_line82_tax := COALESCE(v_prev_carry, 0);

  -- 5. Main invoice aggregation loop
  FOR inv_rec IN
    SELECT
      ni.id AS invoice_id,
      ni.invoice_direction,
      COALESCE(ni.currency, 'HUF') AS currency,
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
      COALESCE(nii.deductible_percentage, 100.0) AS deductible_pct,
      COALESCE(app_inv.is_advance, nii.line_description ILIKE '%előleg%', false) AS is_advance,
      COALESCE(app_inv.is_tangible_asset, false) AS is_tangible_asset,
      COALESCE(ni.vat_row_override, app_inv.vat_row_override, vc.target_row) AS vat_row_override
    FROM nav_invoices ni
    LEFT JOIN nav_invoice_items nii ON nii.nav_invoice_id = ni.id
    LEFT JOIN vat_codes vc ON vc.id = ni.vat_code_id
    LEFT JOIN LATERAL (
      SELECT 
        ai.vat_row_override,
        ai.is_advance,
        ai.is_tangible_asset
      FROM invoices ai
      WHERE ai.company_id = p_company_id 
        AND ai.bizonylatsorszam = ni.invoice_number
      LIMIT 1
    ) app_inv ON true
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
  LOOP
    -- A. Determine exchange rate
    IF inv_rec.currency = 'HUF' THEN
      v_rate := 1.0;
    ELSE
      SELECT rate INTO v_rate
      FROM daily_exchange_rates
      WHERE currency = inv_rec.currency AND rate_date <= inv_rec.delivery_date
      ORDER BY rate_date DESC LIMIT 1;
      v_rate := COALESCE(v_rate, 1.0);
    END IF;

    -- B. Compute base and tax in HUF considering deductible %
    v_net_huf := ROUND(inv_rec.net_amount * (inv_rec.deductible_pct / 100.0) * v_rate, 2);
    v_tax_huf := ROUND(inv_rec.vat_amount * (inv_rec.deductible_pct / 100.0) * v_rate, 2);

    -- C. Determine cash accounting payment status
    v_is_paid := (inv_rec.transaction_id IS NOT NULL OR inv_rec.tx_id IS NOT NULL OR inv_rec.manual_payment_date IS NOT NULL);
    v_effective_tax_date := CASE
      WHEN (v_is_penzforgalmi OR COALESCE(inv_rec.is_cash_accounting, false) = true) AND COALESCE(inv_rec.payment_method, '') <> 'CASH'
        THEN COALESCE(inv_rec.manual_payment_date, inv_rec.transaction_date, inv_rec.delivery_date)
      ELSE inv_rec.delivery_date
    END;

    IF v_effective_tax_date BETWEEN v_date_from AND v_date_to THEN
      IF (v_is_penzforgalmi OR COALESCE(inv_rec.is_cash_accounting, false) = true) AND COALESCE(inv_rec.payment_method, '') <> 'CASH' THEN
        v_is_settled := v_is_paid;
      ELSE
        v_is_settled := true;
      END IF;

      IF v_is_settled THEN
        v_override_row := TRIM(COALESCE(inv_rec.vat_row_override, ''));

        -- PRIORITY 1: Manual row override if set
        IF v_override_row = '01' THEN
          v_line01_base := v_line01_base + v_net_huf;
        ELSIF v_override_row = '03' THEN
          v_line03_base := v_line03_base + v_net_huf;
          v_line03_tax  := v_line03_tax  + v_tax_huf;
        ELSIF v_override_row = '05' THEN
          v_line05_base := v_line05_base + v_net_huf;
          v_line05_tax  := v_line05_tax  + v_tax_huf;
        ELSIF v_override_row = '07' THEN
          v_line07_base := v_line07_base + v_net_huf;
          v_line07_tax  := v_line07_tax  + v_tax_huf;
        ELSIF v_override_row = '45' THEN
          v_line07_base := v_line07_base + v_net_huf;
          v_line07_tax  := v_line07_tax  + v_tax_huf;
          v_line45_base := v_line45_base + v_net_huf;
        ELSIF v_override_row = '91' THEN
          v_line91_base := v_line91_base + v_net_huf;
        ELSIF v_override_row = '92' THEN
          v_line92_base := v_line92_base + v_net_huf;
        ELSIF v_override_row = '18' THEN
          v_line18_base := v_line18_base + v_net_huf;
          v_line18_tax  := v_line18_tax  + v_tax_huf;
        ELSIF v_override_row = '27' THEN
          v_line27_base := v_line27_base + v_net_huf;
          v_line27_tax  := v_line27_tax  + v_tax_huf;
        ELSIF v_override_row = '29' THEN
          v_line67_base := v_line67_base + v_net_huf;
          v_line67_tax  := v_line67_tax  + v_tax_huf;
        ELSIF v_override_row = '64' THEN
          v_line64_base := v_line64_base + v_net_huf;
          v_line64_tax  := v_line64_tax  + v_tax_huf;
        ELSIF v_override_row = '65' THEN
          v_line65_base := v_line65_base + v_net_huf;
          v_line65_tax  := v_line65_tax  + v_tax_huf;
        ELSIF v_override_row = '66' THEN
          v_line66_base := v_line66_base + v_net_huf;
          v_line66_tax  := v_line66_tax  + v_tax_huf;
        ELSIF v_override_row = '67' THEN
          v_line67_base := v_line67_base + v_net_huf;
          v_line67_tax  := v_line67_tax  + v_tax_huf;
        ELSIF v_override_row = '77' THEN
          v_line66_base := v_line66_base + v_net_huf;
          v_line66_tax  := v_line66_tax  + v_tax_huf;
          v_line77_tax  := v_line77_tax  + v_tax_huf;
        ELSE
          -- PRIORITY 2: Default standard classification logic
          IF inv_rec.invoice_direction = 'OUTBOUND' THEN
            v_customer_tax_num := TRIM(COALESCE(inv_rec.customer_tax_number, ''));
            v_is_eu_partner := v_customer_tax_num ~ '^[A-Z]{2}' AND NOT v_customer_tax_num LIKE 'HU%';

            IF v_is_eu_partner AND (v_tax_huf = 0 OR inv_rec.vat_rate IN ('0%','EU','EUK')) THEN
              v_line92_base := v_line92_base + v_net_huf;
            ELSIF inv_rec.vat_rate IN ('AAM','TAM','0%','MENTES') OR v_tax_huf = 0 THEN
              v_line01_base := v_line01_base + v_net_huf;
            ELSIF inv_rec.vat_rate IN ('0.05','5','5.0','5.00','5%') THEN
              v_line03_base := v_line03_base + v_net_huf;
              v_line03_tax  := v_line03_tax  + v_tax_huf;
            ELSIF inv_rec.vat_rate IN ('0.18','18','18.0','18.00','18%') THEN
              v_line05_base := v_line05_base + v_net_huf;
              v_line05_tax  := v_line05_tax  + v_tax_huf;
            ELSE
              -- 27% standard sales
              v_line07_base := v_line07_base + v_net_huf;
              v_line07_tax  := v_line07_tax  + v_tax_huf;

              IF inv_rec.is_advance THEN
                v_line45_base := v_line45_base + v_net_huf;
              END IF;
            END IF;

          ELSIF inv_rec.invoice_direction = 'INBOUND' THEN
            v_supplier_tax_num := TRIM(COALESCE(inv_rec.supplier_tax_number, ''));
            v_is_eu_supplier := v_supplier_tax_num ~ '^[A-Z]{2}' AND NOT v_supplier_tax_num LIKE 'HU%';
            v_is_foreign_supplier := v_is_eu_supplier OR (inv_rec.currency <> 'HUF' AND NOT v_supplier_tax_num LIKE 'HU%');

            IF inv_rec.is_reverse_charge OR inv_rec.vat_rate IN ('DOMESTIC_REVERSE_CHARGE','FAD') THEN
              v_line67_base := v_line67_base + v_net_huf;
              v_line67_tax  := v_line67_tax  + COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
            ELSIF v_is_eu_supplier THEN
              v_line18_base := v_line18_base + v_net_huf;
              v_line18_tax  := v_line18_tax  + COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
              v_line66_base := v_line66_base + v_net_huf;
              v_line66_tax  := v_line66_tax  + COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
            ELSIF v_is_foreign_supplier THEN
              v_line27_base := v_line27_base + v_net_huf;
              v_line27_tax  := v_line27_tax  + COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
              v_line66_base := v_line66_base + v_net_huf;
              v_line66_tax  := v_line66_tax  + COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
            ELSIF inv_rec.vat_rate IN ('0.05','5','5.0','5.00','5%') THEN
              v_line64_base := v_line64_base + v_net_huf;
              v_line64_tax  := v_line64_tax  + v_tax_huf;
            ELSIF inv_rec.vat_rate IN ('0.18','18','18.0','18.00','18%') THEN
              v_line65_base := v_line65_base + v_net_huf;
              v_line65_tax  := v_line65_tax  + v_tax_huf;
            ELSE
              -- 27% domestic purchase
              v_line66_base := v_line66_base + v_net_huf;
              v_line66_tax  := v_line66_tax  + v_tax_huf;

              IF inv_rec.is_tangible_asset THEN
                v_line77_tax := v_line77_tax + v_tax_huf;
              END IF;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 6. Insert Calculated Rows into vat_return_lines
  -- Page 1: Payable VAT
  IF v_line01_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '01', v_line01_base, 0, ROUND(v_line01_base/1000)::int, 0, ARRAY['AAM']);
  END IF;

  IF v_line03_base > 0 OR v_line03_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '03', v_line03_base, v_line03_tax, ROUND(v_line03_base/1000)::int, ROUND(v_line03_tax/1000)::int, ARRAY['5%']);
  END IF;

  IF v_line05_base > 0 OR v_line05_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '05', v_line05_base, v_line05_tax, ROUND(v_line05_base/1000)::int, ROUND(v_line05_tax/1000)::int, ARRAY['18%']);
  END IF;

  IF v_line07_base > 0 OR v_line07_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '07', v_line07_base, v_line07_tax, ROUND(v_line07_base/1000)::int, ROUND(v_line07_tax/1000)::int, ARRAY['27%']);
  END IF;

  IF v_line45_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '45', v_line45_base, 0, ROUND(v_line45_base/1000)::int, 0, ARRAY['ELOLEG']);
  END IF;

  IF v_line91_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '91', v_line91_base, 0, ROUND(v_line91_base/1000)::int, 0, ARRAY['EXP']);
  END IF;

  IF v_line92_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '92', v_line92_base, 0, ROUND(v_line92_base/1000)::int, 0, ARRAY['EU_EXP']);
  END IF;

  IF v_line18_base > 0 OR v_line18_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '18', v_line18_base, v_line18_tax, ROUND(v_line18_base/1000)::int, ROUND(v_line18_tax/1000)::int, ARRAY['EU_IMP']);
  END IF;

  IF v_line27_base > 0 OR v_line27_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '27', v_line27_base, v_line27_tax, ROUND(v_line27_base/1000)::int, ROUND(v_line27_tax/1000)::int, ARRAY['IMP']);
  END IF;

  -- Page 2: Deductible VAT
  IF v_line64_base > 0 OR v_line64_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '64', v_line64_base, v_line64_tax, ROUND(v_line64_base/1000)::int, ROUND(v_line64_tax/1000)::int, ARRAY['BE_5%']);
  END IF;

  IF v_line65_base > 0 OR v_line65_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '65', v_line65_base, v_line65_tax, ROUND(v_line65_base/1000)::int, ROUND(v_line65_tax/1000)::int, ARRAY['BE_18%']);
  END IF;

  IF v_line66_base > 0 OR v_line66_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '66', v_line66_base, v_line66_tax, ROUND(v_line66_base/1000)::int, ROUND(v_line66_tax/1000)::int, ARRAY['BE_27%']);
  END IF;

  IF v_line67_base > 0 OR v_line67_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '67', v_line67_base, v_line67_tax, ROUND(v_line67_base/1000)::int, ROUND(v_line67_tax/1000)::int, ARRAY['FAD']);
  END IF;

  IF v_line77_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '77', 0, v_line77_tax, 0, ROUND(v_line77_tax/1000)::int, ARRAY['TARGYESZKOZ']);
  END IF;

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

  -- Balance Calculation
  v_net_tax_balance := v_total_payable_tax - v_total_deductible_tax;

  -- Line 83 (Különbözet / nettó egyenleg)
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
  VALUES (v_return_id, '83', 0, v_net_tax_balance, 0, ROUND(v_net_tax_balance/1000)::int);

  -- Line 84 (Befizetendő adó)
  IF (v_net_tax_balance - v_prev_carry) > 0 THEN
    v_line85_tax := v_net_tax_balance - v_prev_carry;
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '84', 0, v_line85_tax, 0, ROUND(v_line85_tax/1000)::int);
  END IF;

  -- Line 86 (Következő időszakra átvihető követelés)
  IF (v_net_tax_balance - v_prev_carry) < 0 THEN
    v_line86_tax := ABS(v_net_tax_balance - v_prev_carry);
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '86', 0, v_line86_tax, 0, ROUND(v_line86_tax/1000)::int);
    
    UPDATE vat_returns SET amount_carryforward = v_line86_tax WHERE id = v_return_id;
  END IF;

  -- 7. Populate M-sheet lines (All domestic tax-bearing invoices)
  INSERT INTO vat_return_m_lines (
    vat_return_id,
    partner_tax_number,
    partner_name,
    invoice_count,
    base_amount,
    tax_amount,
    base_amount_rounded,
    tax_amount_rounded,
    tax_5_amount,
    tax_18_amount,
    tax_27_amount,
    invoice_details
  )
  SELECT
    v_return_id,
    SUBSTRING(ni.supplier_tax_number FROM 1 FOR 8),
    MAX(COALESCE(ni.supplier_name, 'Partner')),
    COUNT(DISTINCT ni.id)::int,
    COALESCE(SUM(ROUND(COALESCE(nii.net_amount, ni.invoice_net_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)), 0),
    COALESCE(SUM(ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)), 0),
    ROUND(COALESCE(SUM(ROUND(COALESCE(nii.net_amount, ni.invoice_net_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)), 0) / 1000)::int,
    ROUND(COALESCE(SUM(ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)), 0) / 1000)::int,
    COALESCE(SUM(CASE WHEN COALESCE(nii.vat_rate, '') IN ('0.05','5','5.0','5.00','5%') THEN ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(nii.vat_rate, '') IN ('0.18','18','18.0','18.00','18%') THEN ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(nii.vat_rate, '') IN ('0.27','27','27.0','27.00','27%') OR (nii.vat_rate IS NULL AND COALESCE(ni.invoice_vat_amount, 0) > 0) THEN ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2) ELSE 0 END), 0),
    (
      SELECT COALESCE(jsonb_agg(inv_summary ORDER BY inv_summary->>'delivery_date'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'invoice_number', COALESCE(ni2.invoice_number, ni2.id::text),
          'invoice_id', ni2.id,
          'delivery_date', COALESCE(ni2.ti_override, ni2.calculated_ti, ni2.invoice_delivery_date, ni2.invoice_issue_date),
          'net', COALESCE(SUM(ROUND(COALESCE(nii2.net_amount, ni2.invoice_net_amount, 0) * (COALESCE(nii2.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni2.currency IS NULL OR ni2.currency = 'HUF' THEN 1.0 ELSE COALESCE(er2.rate, 1.0) END), 2)), ni2.invoice_net_amount, 0),
          'vat', COALESCE(SUM(ROUND(COALESCE(nii2.vat_amount, ni2.invoice_vat_amount, 0) * (COALESCE(nii2.deductible_percentage, 100.0) / 100.0) * (CASE WHEN ni2.currency IS NULL OR ni2.currency = 'HUF' THEN 1.0 ELSE COALESCE(er2.rate, 1.0) END), 2)), ni2.invoice_vat_amount, 0),
          'vat_rate', CASE
            WHEN ni2.vat_row_override IS NOT NULL THEN ni2.vat_row_override || '. sor'
            WHEN ni2.invoice_vat_amount = 0 THEN '0%'
            WHEN ROUND(COALESCE(ni2.invoice_vat_amount, 0) / NULLIF(ni2.invoice_net_amount, 0), 2) = 0.27 THEN '27%'
            WHEN ROUND(COALESCE(ni2.invoice_vat_amount, 0) / NULLIF(ni2.invoice_net_amount, 0), 2) = 0.18 THEN '18%'
            WHEN ROUND(COALESCE(ni2.invoice_vat_amount, 0) / NULLIF(ni2.invoice_net_amount, 0), 2) = 0.05 THEN '5%'
            ELSE '27%'
          END
        ) AS inv_summary
        FROM nav_invoices ni2
        LEFT JOIN nav_invoice_items nii2 ON nii2.nav_invoice_id = ni2.id
        LEFT JOIN LATERAL (
          SELECT rate FROM daily_exchange_rates
          WHERE currency = ni2.currency AND rate_date <= COALESCE(ni2.manual_payment_date, ni2.ti_override, ni2.calculated_ti, ni2.invoice_delivery_date, ni2.invoice_issue_date)::date
          ORDER BY rate_date DESC LIMIT 1
        ) er2 ON true
        WHERE ni2.company_id = p_company_id
          AND ni2.invoice_direction = 'INBOUND'
          AND SUBSTRING(COALESCE(ni2.supplier_tax_number, '') FROM 1 FOR 8) = SUBSTRING(ni.supplier_tax_number FROM 1 FOR 8)
          AND COALESCE(ni2.ti_override, ni2.calculated_ti, ni2.invoice_delivery_date, ni2.invoice_issue_date)::date BETWEEN v_date_from AND v_date_to
          AND COALESCE(ni2.invoice_vat_amount, nii2.vat_amount, 0) > 0
        GROUP BY ni2.id, ni2.invoice_number, ni2.ti_override, ni2.calculated_ti, ni2.invoice_delivery_date, ni2.invoice_issue_date, ni2.vat_row_override, ni2.invoice_net_amount, ni2.invoice_vat_amount
      ) sub
    )
  FROM nav_invoices ni
  LEFT JOIN nav_invoice_items nii ON nii.nav_invoice_id = ni.id
  LEFT JOIN LATERAL (
    SELECT rate FROM daily_exchange_rates
    WHERE currency = ni.currency AND rate_date <= COALESCE(ni.manual_payment_date, ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date
    ORDER BY rate_date DESC LIMIT 1
  ) er ON true
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = 'INBOUND'
    AND COALESCE(ni.invoice_vat_amount, nii.vat_amount, 0) > 0
    AND ni.supplier_tax_number IS NOT NULL
    AND TRIM(ni.supplier_tax_number) <> ''
    AND NOT ni.supplier_tax_number ~ '^[A-Z]{2}'
    AND COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date BETWEEN v_date_from AND v_date_to
  GROUP BY SUBSTRING(ni.supplier_tax_number FROM 1 FOR 8)
  HAVING SUM(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0)) > 0;

  RETURN jsonb_build_object(
    'success', true,
    'vat_return_id', v_return_id,
    'total_payable_tax', v_total_payable_tax,
    'total_deductible_tax', v_total_deductible_tax,
    'net_balance', v_net_tax_balance
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_vat_return(UUID, INT, INT, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_vat_return(UUID, INT, INT, TEXT) TO authenticated, service_role;

-- Backfill existing vat_return_m_lines where invoice_details is null or empty
UPDATE vat_return_m_lines ml
SET invoice_details = (
  SELECT COALESCE(jsonb_agg(inv_summary ORDER BY inv_summary->>'delivery_date'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'invoice_number', COALESCE(ni.invoice_number, ni.id::text),
      'invoice_id', ni.id,
      'delivery_date', COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date),
      'net', COALESCE(ni.invoice_net_amount, 0),
      'vat', COALESCE(ni.invoice_vat_amount, 0),
      'vat_rate', CASE
        WHEN ni.vat_row_override IS NOT NULL THEN ni.vat_row_override || '. sor'
        WHEN ni.invoice_vat_amount = 0 THEN '0%'
        WHEN ROUND(COALESCE(ni.invoice_vat_amount, 0) / NULLIF(ni.invoice_net_amount, 0), 2) = 0.27 THEN '27%'
        WHEN ROUND(COALESCE(ni.invoice_vat_amount, 0) / NULLIF(ni.invoice_net_amount, 0), 2) = 0.18 THEN '18%'
        WHEN ROUND(COALESCE(ni.invoice_vat_amount, 0) / NULLIF(ni.invoice_net_amount, 0), 2) = 0.05 THEN '5%'
        ELSE '27%'
      END
    ) AS inv_summary
    FROM nav_invoices ni
    JOIN vat_returns vr ON vr.id = ml.vat_return_id
    WHERE ni.company_id = vr.company_id
      AND ni.invoice_direction = 'INBOUND'
      AND SUBSTRING(COALESCE(ni.supplier_tax_number, '') FROM 1 FOR 8) = SUBSTRING(ml.partner_tax_number FROM 1 FOR 8)
      AND COALESCE(ni.invoice_vat_amount, 0) > 0
  ) sub
)
WHERE ml.invoice_details IS NULL OR ml.invoice_details = '[]'::jsonb;
