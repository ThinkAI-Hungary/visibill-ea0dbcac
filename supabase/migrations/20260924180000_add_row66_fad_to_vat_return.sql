-- Migration: 20260924180000_add_row66_fad_to_vat_return.sql
-- Description: Add dedicated row 66 FAD (reverse charge) deductible tax line (66_fad) to vat_return_lines
-- Description: Exclude mandatory redemption deposit fees (DRS / visszaváltási díj / kupakdíj)
--              from the official NAV 65 VAT return calculation, return lines (vat_return_lines),
--              and domestic partner summary (vat_return_m_lines) in accordance with Section 71 of
--              the Hungarian VAT Act (Áfa tv. 71. § - Out-of-scope / Nem képezi az adó alapját).

CREATE OR REPLACE FUNCTION public.calculate_vat_return(
  p_company_id uuid,
  p_year integer,
  p_month integer,
  p_frequency text DEFAULT 'H'::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_return_id UUID;
  v_date_from DATE;
  v_date_to DATE;
  v_company_vat_regime TEXT := 'normal';
  v_is_penzforgalmi BOOLEAN := false;

  -- Accumulators for NAV 65 declaration rows (in exact HUF)
  v_line01_base NUMERIC := 0;
  v_line02_base NUMERIC := 0;
  v_line04_base NUMERIC := 0;
  v_line05_base NUMERIC := 0; v_line05_tax NUMERIC := 0;
  v_line06_base NUMERIC := 0; v_line06_tax NUMERIC := 0;
  v_line07_base NUMERIC := 0; v_line07_tax NUMERIC := 0;
  v_line08_base NUMERIC := 0;
  v_line45_base NUMERIC := 0;
  v_line91_base NUMERIC := 0;
  v_line92_base NUMERIC := 0;

  v_line18_base NUMERIC := 0; v_line18_tax NUMERIC := 0;
  v_line27_base NUMERIC := 0; v_line27_tax NUMERIC := 0;
  v_line29_base NUMERIC := 0; v_line29_tax NUMERIC := 0;

  v_line63_base NUMERIC := 0;
  v_line64_base NUMERIC := 0; v_line64_tax NUMERIC := 0;
  v_line65_base NUMERIC := 0; v_line65_tax NUMERIC := 0;
  v_line66_base NUMERIC := 0; v_line66_tax NUMERIC := 0;
  v_line66_fad_base NUMERIC := 0; v_line66_fad_tax NUMERIC := 0;
  v_line67_base NUMERIC := 0; v_line67_tax NUMERIC := 0;
  v_line77_tax  NUMERIC := 0;

  v_total_payable_base NUMERIC := 0;
  v_total_payable_tax NUMERIC := 0;
  v_total_deductible_base NUMERIC := 0;
  v_total_deductible_tax NUMERIC := 0;
  v_net_tax_balance NUMERIC := 0;

  v_prev_carry NUMERIC := 0;
  v_line85_tax NUMERIC := 0;
  v_line86_tax NUMERIC := 0;

  inv_rec RECORD;
  v_rate NUMERIC;
  v_net_huf NUMERIC;
  v_tax_huf NUMERIC;
  v_supplier_tax_num TEXT;
  v_customer_tax_num TEXT;
  v_is_eu_partner BOOLEAN;
  v_is_foreign_supplier BOOLEAN;
  v_is_eu_supplier BOOLEAN;
  v_effective_tax_date DATE;
  v_is_paid BOOLEAN;

  v_prev_month INTEGER;
  v_prev_year INTEGER;

  v_override_row TEXT;
  v_target_row_obj JSONB;
BEGIN
  -- 1. Auto-seed VAT codes if not present
  IF NOT EXISTS (SELECT 1 FROM vat_codes WHERE company_id = p_company_id) THEN
    PERFORM seed_default_vat_codes(p_company_id);
    PERFORM seed_fad_vat_codes(p_company_id);
  END IF;

  -- 2. Lookup company VAT regime
  SELECT COALESCE(c.vat_regime, 'normal') INTO v_company_vat_regime
  FROM companies c WHERE c.id = p_company_id;
  v_is_penzforgalmi := (v_company_vat_regime = 'penzforgalmi');

  -- 3. Calculate date range
  IF p_frequency = 'H' THEN
    v_date_from := make_date(p_year, p_month, 1);
    v_date_to := (v_date_from + interval '1 month' - interval '1 day')::date;
  ELSIF p_frequency = 'N' THEN
    v_date_from := make_date(p_year, (p_month - 1) * 3 + 1, 1);
    v_date_to := (v_date_from + interval '3 months' - interval '1 day')::date;
  ELSE
    v_date_from := make_date(p_year, 1, 1);
    v_date_to := make_date(p_year, 12, 31);
  END IF;

  -- 4. Get previous period carryforward (line 82)
  IF p_frequency = 'H' THEN
    v_prev_month := CASE WHEN p_month = 1 THEN 12 ELSE p_month - 1 END;
    v_prev_year  := CASE WHEN p_month = 1 THEN p_year - 1 ELSE p_year END;
  ELSIF p_frequency = 'N' THEN
    v_prev_month := CASE WHEN p_month = 1 THEN 4 ELSE p_month - 1 END;
    v_prev_year  := CASE WHEN p_month = 1 THEN p_year - 1 ELSE p_year END;
  ELSE
    v_prev_month := 1;
    v_prev_year  := p_year - 1;
  END IF;

  SELECT COALESCE(vr.amount_carryforward, vrl.tax_amount, 0)
  INTO v_prev_carry
  FROM vat_returns vr
  LEFT JOIN vat_return_lines vrl ON vrl.vat_return_id = vr.id AND vrl.row_number = '86'
  WHERE vr.company_id = p_company_id
    AND vr.period_year = v_prev_year
    AND vr.period_month = v_prev_month
    AND vr.frequency = p_frequency
  ORDER BY vr.created_at DESC LIMIT 1;

  v_prev_carry := COALESCE(v_prev_carry, 0);

  -- 5. Upsert header in vat_returns
  SELECT id INTO v_return_id
  FROM vat_returns
  WHERE company_id = p_company_id
    AND period_year = p_year
    AND period_month = p_month
    AND frequency = p_frequency
  LIMIT 1;

  IF v_return_id IS NULL THEN
    INSERT INTO vat_returns (
      company_id, period_year, period_month, frequency,
      status, prev_period_carryforward, created_at, updated_at
    ) VALUES (
      p_company_id, p_year, p_month, p_frequency,
      'draft', v_prev_carry, now(), now()
    )
    RETURNING id INTO v_return_id;
  ELSE
    UPDATE vat_returns SET
      prev_period_carryforward = v_prev_carry,
      updated_at = now()
    WHERE id = v_return_id;
  END IF;

  -- Delete previous calculated lines for this return
  DELETE FROM vat_return_lines WHERE vat_return_id = v_return_id;
  DELETE FROM vat_return_m_lines WHERE vat_return_id = v_return_id;

  -- 6. Process Invoices
  FOR inv_rec IN
    SELECT
      ni.id,
      ni.invoice_number,
      ni.invoice_direction,
      COALESCE(ni.currency, 'HUF') AS currency,
      COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date AS delivery_date,
      ni.payment_method,
      ni.supplier_name,
      ni.supplier_tax_number,
      ni.customer_name,
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
      COALESCE(ni.vat_row_override, app_inv.vat_row_override, vc.target_rows->0->>'row') AS vat_row_override,
      COALESCE(vc.code, '') AS vat_code_code,
      vc.target_rows AS vat_code_target_rows,
      -- Check if line item is DRS deposit fee (Áfa tv. 71. §)
      (
        COALESCE(nii.vat_amount, 0) = 0
        AND (
          nii.line_description ILIKE '%visszavált%'
          OR nii.line_description ILIKE '%visszavalt%'
          OR nii.line_description ILIKE '%drs%'
          OR nii.line_description ILIKE '%betétdíj%'
          OR nii.line_description ILIKE '%betetdij%'
          OR nii.line_description ILIKE '%kupakdíj%'
          OR nii.line_description ILIKE '%kupakdij%'
          OR nii.line_description ILIKE '%palackdíj%'
          OR nii.line_description ILIKE '%palackdij%'
        )
      ) AS is_drs
    FROM nav_invoices ni
    LEFT JOIN nav_invoice_items nii ON nii.nav_invoice_id = ni.id
    LEFT JOIN vat_codes vc ON vc.id = ni.vat_code_id
    LEFT JOIN LATERAL (
      SELECT 
        (
          COALESCE(inv.invoice_type, '') = 'elolegszamla'
          OR EXISTS (
            SELECT 1 FROM public.invoice_items ii 
            WHERE ii.invoice_id = inv.id 
              AND (ii.line_description ILIKE '%előleg%' OR ii.gl_classifications::text ILIKE '%"gl_number": "453%')
          )
        ) AS is_advance,
        (
          EXISTS (
            SELECT 1 FROM public.invoice_items ii 
            WHERE ii.invoice_id = inv.id 
              AND (ii.gl_classifications::text ~ '"gl_number":\s*"1[0-9]{2}')
          )
        ) AS is_tangible_asset,
        inv.vat_row_override
      FROM public.invoices inv
      WHERE inv.company_id = p_company_id 
        AND inv.bizonylatsorszam = ni.invoice_number
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
    -- EXCLUDE DRS / Visszaváltási díj / Kupakdíj from NAV 65 return lines (Áfa tv. 71. §)
    IF inv_rec.is_drs = true THEN
      CONTINUE;
    END IF;

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

    -- B. Base and tax
    v_net_huf := ROUND(inv_rec.net_amount * (inv_rec.deductible_pct / 100.0) * v_rate, 2);
    v_tax_huf := ROUND(inv_rec.vat_amount * (inv_rec.deductible_pct / 100.0) * v_rate, 2);

    -- C. Settlement date
    v_is_paid := (inv_rec.transaction_id IS NOT NULL OR inv_rec.tx_id IS NOT NULL OR inv_rec.manual_payment_date IS NOT NULL);
    v_effective_tax_date := CASE
      WHEN (v_is_penzforgalmi OR COALESCE(inv_rec.is_cash_accounting, false) = true) AND COALESCE(inv_rec.payment_method, '') <> 'CASH'
        THEN COALESCE(inv_rec.manual_payment_date, inv_rec.transaction_date, inv_rec.delivery_date)
      ELSE inv_rec.delivery_date
    END;

    -- D. Check date range
    IF v_effective_tax_date BETWEEN v_date_from AND v_date_to THEN

      -- E. PRIORITY 1: Target rows from vat_code_target_rows JSONB
      IF inv_rec.vat_code_target_rows IS NOT NULL AND jsonb_array_length(inv_rec.vat_code_target_rows) > 0 THEN
        FOR v_target_row_obj IN SELECT * FROM jsonb_array_elements(inv_rec.vat_code_target_rows)
        LOOP
          v_override_row := v_target_row_obj->>'row';
          IF v_override_row = '01' THEN v_line01_base := v_line01_base + v_net_huf;
          ELSIF v_override_row = '02' THEN v_line02_base := v_line02_base + v_net_huf;
          ELSIF v_override_row = '04' THEN v_line04_base := v_line04_base + v_net_huf;
          ELSIF v_override_row = '05' THEN v_line05_base := v_line05_base + v_net_huf; v_line05_tax := v_line05_tax + v_tax_huf;
          ELSIF v_override_row = '06' THEN v_line06_base := v_line06_base + v_net_huf; v_line06_tax := v_line06_tax + v_tax_huf;
          ELSIF v_override_row = '07' THEN v_line07_base := v_line07_base + v_net_huf; v_line07_tax := v_line07_tax + v_tax_huf;
          ELSIF v_override_row = '08' THEN v_line08_base := v_line08_base + v_net_huf;
          ELSIF v_override_row = '45' THEN v_line45_base := v_line45_base + v_net_huf;
          ELSIF v_override_row = '91' THEN v_line91_base := v_line91_base + v_net_huf;
          ELSIF v_override_row = '92' THEN v_line92_base := v_line92_base + v_net_huf;
          ELSIF v_override_row = '18' THEN v_line18_base := v_line18_base + v_net_huf; v_line18_tax := v_line18_tax + v_tax_huf;
          ELSIF v_override_row = '27' THEN v_line27_base := v_line27_base + v_net_huf; v_line27_tax := v_line27_tax + v_tax_huf;
          ELSIF v_override_row = '29' THEN
            v_line29_base := v_line29_base + v_net_huf;
            v_line29_tax  := v_line29_tax  + v_tax_huf;
            v_line66_base := v_line66_base + v_net_huf;
            v_line66_tax  := v_line66_tax  + v_tax_huf;
            v_line66_fad_base := v_line66_fad_base + v_net_huf;
            v_line66_fad_tax  := v_line66_fad_tax  + v_tax_huf;
            v_line66_fad_base := v_line66_fad_base + v_net_huf;
            v_line66_fad_tax  := v_line66_fad_tax  + v_tax_huf;
          ELSIF v_override_row = '63' THEN v_line63_base := v_line63_base + v_net_huf;
          ELSIF v_override_row = '64' THEN v_line64_base := v_line64_base + v_net_huf; v_line64_tax := v_line64_tax + v_tax_huf;
          ELSIF v_override_row = '65' THEN v_line65_base := v_line65_base + v_net_huf; v_line65_tax := v_line65_tax + v_tax_huf;
          ELSIF v_override_row = '66' THEN v_line66_base := v_line66_base + v_net_huf; v_line66_tax := v_line66_tax + v_tax_huf;
          ELSIF v_override_row = '67' THEN v_line67_base := v_line67_base + v_net_huf; v_line67_tax := v_line67_tax + v_tax_huf;
          END IF;
        END LOOP;

      ELSE
        -- Single vat_row_override
        v_override_row := inv_rec.vat_row_override;
        IF v_override_row IS NOT NULL THEN
          IF v_override_row = '01' THEN v_line01_base := v_line01_base + v_net_huf;
          ELSIF v_override_row = '02' THEN v_line02_base := v_line02_base + v_net_huf;
          ELSIF v_override_row = '04' THEN v_line04_base := v_line04_base + v_net_huf;
          ELSIF v_override_row = '05' THEN v_line05_base := v_line05_base + v_net_huf; v_line05_tax := v_line05_tax + v_tax_huf;
          ELSIF v_override_row = '06' THEN v_line06_base := v_line06_base + v_net_huf; v_line06_tax := v_line06_tax + v_tax_huf;
          ELSIF v_override_row = '07' THEN v_line07_base := v_line07_base + v_net_huf; v_line07_tax := v_line07_tax + v_tax_huf;
          ELSIF v_override_row = '08' THEN v_line08_base := v_line08_base + v_net_huf;
          ELSIF v_override_row = '45' THEN v_line45_base := v_line45_base + v_net_huf;
          ELSIF v_override_row = '91' THEN v_line91_base := v_line91_base + v_net_huf;
          ELSIF v_override_row = '92' THEN v_line92_base := v_line92_base + v_net_huf;
          ELSIF v_override_row = '18' THEN v_line18_base := v_line18_base + v_net_huf; v_line18_tax := v_line18_tax + v_tax_huf;
          ELSIF v_override_row = '27' THEN v_line27_base := v_line27_base + v_net_huf; v_line27_tax := v_line27_tax + v_tax_huf;
          ELSIF v_override_row = '29' THEN
            v_line29_base := v_line29_base + v_net_huf;
            v_line29_tax  := v_line29_tax  + v_tax_huf;
            v_line66_base := v_line66_base + v_net_huf;
            v_line66_tax  := v_line66_tax  + v_tax_huf;
          ELSIF v_override_row = '63' THEN v_line63_base := v_line63_base + v_net_huf;
          ELSIF v_override_row = '64' THEN v_line64_base := v_line64_base + v_net_huf; v_line64_tax := v_line64_tax + v_tax_huf;
          ELSIF v_override_row = '65' THEN v_line65_base := v_line65_base + v_net_huf; v_line65_tax := v_line65_tax + v_tax_huf;
          ELSIF v_override_row = '66' THEN v_line66_base := v_line66_base + v_net_huf; v_line66_tax := v_line66_tax + v_tax_huf;
          ELSIF v_override_row = '67' THEN v_line67_base := v_line67_base + v_net_huf; v_line67_tax := v_line67_tax + v_tax_huf;
          END IF;
        ELSE
          -- PRIORITY 2: Default standard NAV mapping
          IF inv_rec.invoice_direction = 'OUTBOUND' THEN
            IF inv_rec.vat_rate IN ('27%', '0.27', '27') THEN
              v_line07_base := v_line07_base + v_net_huf;
              v_line07_tax  := v_line07_tax  + v_tax_huf;
            ELSIF inv_rec.vat_rate IN ('18%', '0.18', '18') THEN
              v_line06_base := v_line06_base + v_net_huf;
              v_line06_tax  := v_line06_tax  + v_tax_huf;
            ELSIF inv_rec.vat_rate IN ('5%', '0.05', '5') THEN
              v_line05_base := v_line05_base + v_net_huf;
              v_line05_tax  := v_line05_tax  + v_tax_huf;
            ELSIF inv_rec.is_reverse_charge = true OR inv_rec.vat_code_code ILIKE '%FAD%' THEN
              v_line04_base := v_line04_base + v_net_huf;
            ELSIF inv_rec.vat_code_code ILIKE '%EXP%' THEN
              v_line01_base := v_line01_base + v_net_huf;
            ELSE
              v_customer_tax_num := TRIM(COALESCE(inv_rec.customer_tax_number, ''));
              v_is_eu_partner := (v_customer_tax_num ~ '^[A-Z]{2}') AND (NOT v_customer_tax_num ILIKE 'HU%');
              IF v_is_eu_partner THEN
                v_line02_base := v_line02_base + v_net_huf;
              ELSE
                v_line08_base := v_line08_base + v_net_huf;
              END IF;
            END IF;

            IF inv_rec.is_advance THEN
              v_line45_base := v_line45_base + v_net_huf;
            END IF;

          ELSIF inv_rec.invoice_direction = 'INBOUND' THEN
            v_supplier_tax_num := TRIM(COALESCE(inv_rec.supplier_tax_number, ''));
            v_is_eu_supplier := (v_supplier_tax_num ~ '^[A-Z]{2}') AND (NOT v_supplier_tax_num ILIKE 'HU%');
            v_is_foreign_supplier := v_is_eu_supplier OR (inv_rec.currency <> 'HUF' AND NOT (v_supplier_tax_num ~ '^[0-9]{8}'));

            IF inv_rec.is_reverse_charge = true OR inv_rec.vat_code_code ILIKE '%FAD%' THEN
              v_line29_base := v_line29_base + v_net_huf;
              v_line29_tax  := v_line29_tax  + v_tax_huf;
              v_line66_base := v_line66_base + v_net_huf;
              v_line66_tax  := v_line66_tax  + v_tax_huf;
              v_line66_fad_base := v_line66_fad_base + v_net_huf;
              v_line66_fad_tax  := v_line66_fad_tax  + v_tax_huf;
            ELSIF v_is_foreign_supplier THEN
              v_line67_base := v_line67_base + v_net_huf;
              v_line67_tax  := v_line67_tax  + v_tax_huf;
            ELSE
              IF inv_rec.vat_rate IN ('27%', '0.27', '27') THEN
                v_line66_base := v_line66_base + v_net_huf;
                v_line66_tax  := v_line66_tax  + v_tax_huf;
              ELSIF inv_rec.vat_rate IN ('18%', '0.18', '18') THEN
                v_line65_base := v_line65_base + v_net_huf;
                v_line65_tax  := v_line65_tax  + v_tax_huf;
              ELSIF inv_rec.vat_rate IN ('5%', '0.05', '5') THEN
                v_line64_base := v_line64_base + v_net_huf;
                v_line64_tax  := v_line64_tax  + v_tax_huf;
              ELSE
                v_line63_base := v_line63_base + v_net_huf;
              END IF;
            END IF;

            IF inv_rec.is_tangible_asset AND v_tax_huf > 0 THEN
              v_line77_tax := v_line77_tax + v_tax_huf;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 7. Insert aggregated lines into vat_return_lines
  IF v_line01_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '01', v_line01_base, 0, ROUND(v_line01_base/1000)::int, 0, ARRAY['KI_EXP'], true);
  END IF;

  IF v_line02_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '02', v_line02_base, 0, ROUND(v_line02_base/1000)::int, 0, ARRAY['KI_EU_MENTES'], true);
  END IF;

  IF v_line04_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '04', v_line04_base, 0, ROUND(v_line04_base/1000)::int, 0, ARRAY['KI_FORD'], true);
  END IF;

  IF v_line05_base > 0 OR v_line05_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '05', v_line05_base, v_line05_tax, ROUND(v_line05_base/1000)::int, ROUND(v_line05_tax/1000)::int, ARRAY['KI_5%'], true);
  END IF;

  IF v_line06_base > 0 OR v_line06_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '06', v_line06_base, v_line06_tax, ROUND(v_line06_base/1000)::int, ROUND(v_line06_tax/1000)::int, ARRAY['KI_18%'], true);
  END IF;

  IF v_line07_base > 0 OR v_line07_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '07', v_line07_base, v_line07_tax, ROUND(v_line07_base/1000)::int, ROUND(v_line07_tax/1000)::int, ARRAY['KI_27%'], true);
  END IF;

  IF v_line08_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '08', v_line08_base, 0, ROUND(v_line08_base/1000)::int, 0, ARRAY['KI_TAM'], true);
  END IF;

  IF v_line45_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '45', v_line45_base, 0, ROUND(v_line45_base/1000)::int, 0, ARRAY['ELOLEG'], true);
  END IF;

  IF v_line91_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '91', v_line91_base, 0, ROUND(v_line91_base/1000)::int, 0, ARRAY['KI_HAT_KIV'], true);
  END IF;

  IF v_line92_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '92', v_line92_base, 0, ROUND(v_line92_base/1000)::int, 0, ARRAY['KI_EU_HAT_KIV'], true);
  END IF;

  IF v_line18_base > 0 OR v_line18_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '18', v_line18_base, v_line18_tax, ROUND(v_line18_base/1000)::int, ROUND(v_line18_tax/1000)::int, ARRAY['EU_SZOLG'], true);
  END IF;

  IF v_line27_base > 0 OR v_line27_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '27', v_line27_base, v_line27_tax, ROUND(v_line27_base/1000)::int, ROUND(v_line27_tax/1000)::int, ARRAY['3_ORSZ_SZOLG'], true);
  END IF;

  IF v_line29_base > 0 OR v_line29_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '29', v_line29_base, v_line29_tax, ROUND(v_line29_base/1000)::int, ROUND(v_line29_tax/1000)::int, ARRAY['BE_FORD'], true);
  END IF;

  IF v_line63_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '63', v_line63_base, 0, ROUND(v_line63_base/1000)::int, 0, ARRAY['BE_MENTES'], true);
  END IF;

  IF v_line64_base > 0 OR v_line64_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '64', v_line64_base, v_line64_tax, ROUND(v_line64_base/1000)::int, ROUND(v_line64_tax/1000)::int, ARRAY['BE_5%'], true);
  END IF;

  IF v_line65_base > 0 OR v_line65_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '65', v_line65_base, v_line65_tax, ROUND(v_line65_base/1000)::int, ROUND(v_line65_tax/1000)::int, ARRAY['BE_18%'], true);
  END IF;

  IF v_line66_base > 0 OR v_line66_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '66', v_line66_base, v_line66_tax, ROUND(v_line66_base/1000)::int, ROUND(v_line66_tax/1000)::int, ARRAY['BE_27%'], true);
  END IF;

  IF v_line66_fad_tax > 0 OR v_line66_fad_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '66_fad', v_line66_fad_base, v_line66_fad_tax, ROUND(v_line66_fad_base/1000)::int, ROUND(v_line66_fad_tax/1000)::int, ARRAY['BE_FORD_27'], true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE
    SET base_amount = EXCLUDED.base_amount,
        tax_amount = EXCLUDED.tax_amount,
        base_amount_rounded = EXCLUDED.base_amount_rounded,
        tax_amount_rounded = EXCLUDED.tax_amount_rounded,
        source_vat_codes = EXCLUDED.source_vat_codes,
        is_calculated = EXCLUDED.is_calculated;
  END IF;

  IF v_line67_base > 0 OR v_line67_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '67', v_line67_base, v_line67_tax, ROUND(v_line67_base/1000)::int, ROUND(v_line67_tax/1000)::int, ARRAY['BE_IMPORT'], true);
  END IF;

  IF v_line77_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '77', 0, v_line77_tax, 0, ROUND(v_line77_tax/1000)::int, ARRAY['BE_TARGYI_ESZKOZ'], true);
  END IF;

  -- Line 82 (Előző időszaki követelés)
  IF v_prev_carry > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '82', 0, v_prev_carry, 0, ROUND(v_prev_carry/1000)::int, ARRAY['GONGYOLT'], true);
  END IF;

  -- Totals
  v_total_payable_base := v_line01_base + v_line02_base + v_line04_base + v_line05_base + v_line06_base + v_line07_base + v_line08_base + v_line18_base + v_line27_base + v_line29_base + v_line91_base + v_line92_base;
  v_total_payable_tax  := v_line05_tax + v_line06_tax + v_line07_tax + v_line18_tax + v_line27_tax + v_line29_tax;

  v_total_deductible_base := v_line63_base + v_line64_base + v_line65_base + v_line66_base + v_line67_base;
  v_total_deductible_tax  := v_line64_tax + v_line65_tax + v_line66_tax + v_line67_tax;

  v_net_tax_balance := v_total_payable_tax - v_total_deductible_tax;

  -- Line 36 (Összes fizetendő adó)
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '36', v_total_payable_base, v_total_payable_tax, ROUND(v_total_payable_base/1000)::int, ROUND(v_total_payable_tax/1000)::int, true);

  -- Line 76 (Összes levonható adó)
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '76', v_total_deductible_base, v_total_deductible_tax, ROUND(v_total_deductible_base/1000)::int, ROUND(v_total_deductible_tax/1000)::int, true);

  -- Line 83 (Különbözet: Fizetendő - Levonható)
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '83', 0, v_net_tax_balance, 0, ROUND(v_net_tax_balance/1000)::int, true);

  -- Line 84 (Befizetendő adó)
  IF (v_net_tax_balance - v_prev_carry) > 0 THEN
    v_line85_tax := v_net_tax_balance - v_prev_carry;
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
    VALUES (v_return_id, '84', 0, v_line85_tax, 0, ROUND(v_line85_tax/1000)::int, true);
  END IF;

  -- Line 86 (Következő időszakra átvihető követelés)
  IF (v_net_tax_balance - v_prev_carry) < 0 THEN
    v_line86_tax := ABS(v_net_tax_balance - v_prev_carry);
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
    VALUES (v_return_id, '86', 0, v_line86_tax, 0, ROUND(v_line86_tax/1000)::int, true);
  END IF;

  -- Update vat_returns totals header
  UPDATE vat_returns SET
    total_payable_tax = v_total_payable_tax,
    total_deductible_tax = v_total_deductible_tax,
    net_result = v_net_tax_balance,
    amount_to_pay = CASE WHEN (v_net_tax_balance - v_prev_carry) > 0 THEN (v_net_tax_balance - v_prev_carry) ELSE 0 END,
    amount_carryforward = CASE WHEN (v_net_tax_balance - v_prev_carry) < 0 THEN ABS(v_net_tax_balance - v_prev_carry) ELSE 0 END,
    prev_period_carryforward = v_prev_carry,
    updated_at = now()
  WHERE id = v_return_id;

  -- 8. Populate 65M Domestic Partner Summary lines (vat_return_m_lines)
  -- Includes ALL suppliers from whom goods/services were purchased in the period,
  -- EXCLUDING out-of-scope DRS deposit fees (Áfa tv. 71. §)
  WITH all_inbounds AS (
    -- A. Inbound invoices from NAV Online Számla
    SELECT
      ni.id AS invoice_id,
      ni.company_id,
      ni.invoice_number,
      COALESCE(ni.supplier_name, 'Ismeretlen partner') AS partner_name,
      COALESCE(
        NULLIF(SUBSTRING(REGEXP_REPLACE(COALESCE(ni.supplier_tax_number, ''), '[^0-9]', '', 'g') FROM 1 FOR 8), ''),
        NULLIF(TRIM(COALESCE(ni.supplier_tax_number, '')), ''),
        'ISMERETLEN_' || SUBSTRING(MD5(COALESCE(ni.supplier_name, 'partner')) FROM 1 FOR 8)
      ) AS partner_tax_number,
      COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date) AS delivery_date,
      ni.invoice_issue_date AS issue_date,
      CASE 
        WHEN EXISTS (SELECT 1 FROM nav_invoice_items sub_nii WHERE sub_nii.nav_invoice_id = ni.id) THEN
          COALESCE(SUM(ROUND(nii.net_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2)), 0)
        ELSE
          ROUND(COALESCE(ni.invoice_net_amount, 0) * COALESCE(er.rate, 1.0), 2)
      END AS net_amount,
      CASE 
        WHEN EXISTS (SELECT 1 FROM nav_invoice_items sub_nii WHERE sub_nii.nav_invoice_id = ni.id) THEN
          COALESCE(SUM(ROUND(nii.vat_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2)), 0)
        ELSE
          ROUND(COALESCE(ni.invoice_vat_amount, 0) * COALESCE(er.rate, 1.0), 2)
      END AS vat_amount,
      CASE 
        WHEN EXISTS (SELECT 1 FROM nav_invoice_items sub_nii WHERE sub_nii.nav_invoice_id = ni.id) THEN
          COALESCE(SUM(ROUND((nii.net_amount + nii.vat_amount) * COALESCE(er.rate, 1.0), 2)), 0)
        ELSE
          ROUND((COALESCE(ni.invoice_net_amount, 0) + COALESCE(ni.invoice_vat_amount, 0)) * COALESCE(er.rate, 1.0), 2)
      END AS gross_amount,
      COALESCE(
        SUM(CASE WHEN COALESCE(nii.vat_rate, '') IN ('27%','0.27','27') THEN ROUND(nii.vat_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2) ELSE 0 END),
        CASE WHEN ni.invoice_vat_amount > 0 AND (ni.invoice_net_amount = 0 OR ROUND(ni.invoice_vat_amount / ni.invoice_net_amount, 2) = 0.27) THEN ROUND(ni.invoice_vat_amount * COALESCE(er.rate, 1.0), 2) ELSE 0 END
      ) AS tax_27,
      COALESCE(
        SUM(CASE WHEN COALESCE(nii.vat_rate, '') IN ('18%','0.18','18') THEN ROUND(nii.vat_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2) ELSE 0 END),
        0
      ) AS tax_18,
      COALESCE(
        SUM(CASE WHEN COALESCE(nii.vat_rate, '') IN ('5%','0.05','5') THEN ROUND(nii.vat_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2) ELSE 0 END),
        0
      ) AS tax_5
    FROM nav_invoices ni
    LEFT JOIN nav_invoice_items nii ON nii.nav_invoice_id = ni.id
      AND NOT (
        COALESCE(nii.vat_amount, 0) = 0
        AND (
          nii.line_description ILIKE '%visszavált%'
          OR nii.line_description ILIKE '%visszavalt%'
          OR nii.line_description ILIKE '%drs%'
          OR nii.line_description ILIKE '%betétdíj%'
          OR nii.line_description ILIKE '%betetdij%'
          OR nii.line_description ILIKE '%kupakdíj%'
          OR nii.line_description ILIKE '%kupakdij%'
          OR nii.line_description ILIKE '%palackdíj%'
          OR nii.line_description ILIKE '%palackdij%'
        )
      )
    LEFT JOIN LATERAL (
      SELECT rate FROM daily_exchange_rates
      WHERE currency = ni.currency AND rate_date <= COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date)
      ORDER BY rate_date DESC LIMIT 1
    ) er ON true
    WHERE ni.company_id = p_company_id
      AND ni.invoice_direction = 'INBOUND'
      AND COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date) BETWEEN v_date_from AND v_date_to
    GROUP BY ni.id, ni.company_id, ni.invoice_number, ni.supplier_name, ni.supplier_tax_number, ni.invoice_delivery_date, ni.invoice_issue_date, ni.invoice_net_amount, ni.invoice_vat_amount, er.rate

    UNION ALL

    -- B. Inbound invoices from manual upload / invoices table (excluding duplicates already in nav_invoices)
    SELECT
      inv.id AS invoice_id,
      inv.company_id,
      inv.bizonylatsorszam AS invoice_number,
      COALESCE(inv.elado_nev, 'Ismeretlen partner') AS partner_name,
      COALESCE(
        NULLIF(SUBSTRING(REGEXP_REPLACE(COALESCE(inv.elado_vat_id, ''), '[^0-9]', '', 'g') FROM 1 FOR 8), ''),
        NULLIF(TRIM(COALESCE(inv.elado_vat_id, '')), ''),
        'ISMERETLEN_' || SUBSTRING(MD5(COALESCE(inv.elado_nev, 'partner')) FROM 1 FOR 8)
      ) AS partner_tax_number,
      COALESCE(inv.teljesites_datuma, inv.kibocsatas_datuma) AS delivery_date,
      inv.kibocsatas_datuma AS issue_date,
      COALESCE(inv.adoalap_osszesen, 0) AS net_amount,
      COALESCE(inv.afa_osszeg_osszesen, 0) AS vat_amount,
      (COALESCE(inv.adoalap_osszesen, 0) + COALESCE(inv.afa_osszeg_osszesen, 0)) AS gross_amount,
      CASE WHEN COALESCE(inv.adoalap_osszesen, 0) > 0 AND ROUND(COALESCE(inv.afa_osszeg_osszesen, 0) / inv.adoalap_osszesen, 2) = 0.27 THEN COALESCE(inv.afa_osszeg_osszesen, 0) ELSE 0 END AS tax_27,
      CASE WHEN COALESCE(inv.adoalap_osszesen, 0) > 0 AND ROUND(COALESCE(inv.afa_osszeg_osszesen, 0) / inv.adoalap_osszesen, 2) = 0.18 THEN COALESCE(inv.afa_osszeg_osszesen, 0) ELSE 0 END AS tax_18,
      CASE WHEN COALESCE(inv.adoalap_osszesen, 0) > 0 AND ROUND(COALESCE(inv.afa_osszeg_osszesen, 0) / inv.adoalap_osszesen, 2) = 0.05 THEN COALESCE(inv.afa_osszeg_osszesen, 0) ELSE 0 END AS tax_5
    FROM invoices inv
    WHERE inv.company_id = p_company_id
      AND inv.invoice_direction = 'INBOUND'
      AND COALESCE(inv.teljesites_datuma, inv.kibocsatas_datuma) BETWEEN v_date_from AND v_date_to
      AND NOT EXISTS (
        SELECT 1 FROM nav_invoices ni2 
        WHERE ni2.company_id = p_company_id 
          AND ni2.invoice_number = inv.bizonylatsorszam
      )
  )
  INSERT INTO vat_return_m_lines (
    vat_return_id, partner_name, partner_tax_number,
    invoice_count, base_amount, tax_amount,
    base_amount_rounded, tax_amount_rounded,
    tax_27_amount, tax_18_amount, tax_5_amount,
    invoice_details
  )
  SELECT
    v_return_id,
    MAX(partner_name) AS partner_name,
    partner_tax_number,
    COUNT(invoice_id)::int AS invoice_count,
    SUM(net_amount) AS base_amount,
    SUM(vat_amount) AS tax_amount,
    ROUND(SUM(net_amount) / 1000)::int AS base_amount_rounded,
    ROUND(SUM(vat_amount) / 1000)::int AS tax_amount_rounded,
    SUM(tax_27) AS tax_27_amount,
    SUM(tax_18) AS tax_18_amount,
    SUM(tax_5) AS tax_5_amount,
    jsonb_agg(
      jsonb_build_object(
        'invoice_number', invoice_number,
        'delivery_date', delivery_date,
        'issue_date', issue_date,
        'net', net_amount,
        'vat', vat_amount,
        'gross', gross_amount,
        'amount_unit', 'HUF',
        'is_e_ft', false
      ) ORDER BY delivery_date, invoice_number
    ) AS invoice_details
  FROM all_inbounds
  GROUP BY partner_tax_number;

  RETURN jsonb_build_object(
    'success', true,
    'vat_return_id', v_return_id,
    'total_payable_tax', v_total_payable_tax,
    'total_deductible_tax', v_total_deductible_tax,
    'net_balance', v_net_tax_balance
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
