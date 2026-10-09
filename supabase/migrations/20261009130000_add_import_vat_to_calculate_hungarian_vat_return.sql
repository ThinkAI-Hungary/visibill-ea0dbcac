-- Migration: 20261009130000_add_import_vat_to_calculate_hungarian_vat_return.sql
-- Description: Include Import Customs Declarations (Termékimport) in NAV 2665 calculation:
--              - Row 70: Levy import VAT actually paid in period (Áfa tv. 120. § c), 127. § (1) c), 154. §)
--              - Row 71: Self-assessment import VAT deductible in period (Áfa tv. 120. § d), 127. § (1) d), 155-156. §)
--              - Rows 24, 25, 26: Self-assessment import VAT payable in period (5%, 18%, 27%)
--              - Row 23: Exempt import under procedure 42 (Áfa tv. 95. §)

CREATE OR REPLACE FUNCTION public.calculate_hungarian_vat_return(p_company_id uuid, p_year integer, p_month integer, p_frequency text DEFAULT 'H'::text)
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

  v_line01_base NUMERIC := 0;
  v_line02_base NUMERIC := 0;
  v_line04_base NUMERIC := 0;
  v_line05_base NUMERIC := 0; v_line05_tax NUMERIC := 0;
  v_line06_base NUMERIC := 0; v_line06_tax NUMERIC := 0;
  v_line07_base NUMERIC := 0; v_line07_tax NUMERIC := 0;
  v_line08_base NUMERIC := 0;
  v_line43_base NUMERIC := 0; v_line43_tax NUMERIC := 0;
  v_line45_base NUMERIC := 0; v_line45_tax NUMERIC := 0;
  v_line91_base NUMERIC := 0;
  v_line92_base NUMERIC := 0;

  v_line18_base NUMERIC := 0; v_line18_tax NUMERIC := 0;
  v_line23_base NUMERIC := 0;
  v_line24_base NUMERIC := 0; v_line24_tax NUMERIC := 0;
  v_line25_base NUMERIC := 0; v_line25_tax NUMERIC := 0;
  v_line26_base NUMERIC := 0; v_line26_tax NUMERIC := 0;
  v_line27_base NUMERIC := 0; v_line27_tax NUMERIC := 0;
  v_line29_base NUMERIC := 0; v_line29_tax NUMERIC := 0;

  v_line63_base NUMERIC := 0;
  v_line64_base NUMERIC := 0; v_line64_tax NUMERIC := 0;
  v_line65_base NUMERIC := 0; v_line65_tax NUMERIC := 0;
  v_line66_base NUMERIC := 0; v_line66_tax NUMERIC := 0;
  v_line66_fad_base NUMERIC := 0; v_line66_fad_tax NUMERIC := 0;
  v_line67_base NUMERIC := 0; v_line67_tax NUMERIC := 0;
  v_line70_base NUMERIC := 0; v_line70_tax NUMERIC := 0;
  v_line71_base NUMERIC := 0; v_line71_tax NUMERIC := 0;
  v_line77_base NUMERIC := 0;
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
  customs_rec RECORD;
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
  v_is_fad BOOLEAN;
  v_calculated_fad_tax NUMERIC;

  v_prev_month INTEGER;
  v_prev_year INTEGER;

  v_override_row TEXT;
  v_target_row_obj JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vat_codes WHERE company_id = p_company_id) THEN
    PERFORM seed_default_vat_codes(p_company_id);
    PERFORM seed_fad_vat_codes(p_company_id);
  END IF;

  SELECT COALESCE(c.vat_regime, 'normal') INTO v_company_vat_regime
  FROM companies c WHERE c.id = p_company_id;
  v_is_penzforgalmi := (v_company_vat_regime = 'penzforgalmi');

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

  DELETE FROM vat_return_lines WHERE vat_return_id = v_return_id;
  DELETE FROM vat_return_m_lines WHERE vat_return_id = v_return_id;

  -- 1. Inbound & Outbound Invoices loop
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
      nii.product_code,
      nii.line_description,
      nii.net_weight_kg,
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
          COALESCE(inv.vat_row_override, '') = '77'
          OR COALESCE(inv.vat_row_override, '') = '43'
          OR EXISTS (
            SELECT 1 FROM public.invoice_items ii 
            WHERE ii.invoice_id = inv.id 
              AND (ii.gl_classifications::text ~ '"gl_number":\s*"(1[0-9]{2}|9611|8611)')
          )
        ) AS is_tangible_asset,
        inv.vat_row_override
      FROM public.invoices inv
      WHERE inv.company_id = p_company_id 
        AND inv.bizonylatsorszam = ni.invoice_number
      LIMIT 1
    ) app_inv ON true
    LEFT JOIN LATERAL (
      SELECT tx_id, transaction_date FROM (
        SELECT t1.id AS tx_id, t1.transaction_date
        FROM public.transactions t1
        WHERE ni.transaction_id IS NOT NULL AND t1.id = ni.transaction_id
        UNION ALL
        SELECT t2.id AS tx_id, t2.transaction_date
        FROM public.transactions t2
        WHERE t2.company_id = p_company_id AND t2.matched_invoice_id = ni.id
        UNION ALL
        SELECT t3.id AS tx_id, t3.transaction_date
        FROM public.transaction_invoice_matches tim
        JOIN public.transactions t3 ON t3.id = tim.transaction_id
        WHERE tim.invoice_id = ni.id
      ) candidate_tx
      ORDER BY transaction_date DESC NULLS LAST
      LIMIT 1
    ) t ON true
    WHERE ni.company_id = p_company_id
  LOOP
    IF inv_rec.is_drs THEN
      CONTINUE;
    END IF;

    IF inv_rec.currency <> 'HUF' THEN
      SELECT rate INTO v_rate
      FROM daily_exchange_rates
      WHERE currency = inv_rec.currency AND rate_date = inv_rec.delivery_date
      LIMIT 1;
      v_rate := COALESCE(v_rate, 1.0);
    ELSE
      v_rate := 1.0;
    END IF;

    v_net_huf := inv_rec.net_amount * v_rate;
    v_tax_huf := inv_rec.vat_amount * v_rate;

    IF inv_rec.invoice_direction = 'INBOUND' THEN
      v_net_huf := v_net_huf * (inv_rec.deductible_pct / 100.0);
      v_tax_huf := v_tax_huf * (inv_rec.deductible_pct / 100.0);
    END IF;

    v_supplier_tax_num := COALESCE(inv_rec.supplier_tax_number, '');
    v_customer_tax_num := COALESCE(inv_rec.customer_tax_number, '');
    v_is_eu_partner := (v_customer_tax_num ~ '^[A-Z]{2}') AND NOT (v_customer_tax_num ~ '^HU');
    v_is_foreign_supplier := (v_supplier_tax_num ~ '^[A-Z]{2}') AND NOT (v_supplier_tax_num ~ '^HU');
    v_is_eu_supplier := v_is_foreign_supplier;

    v_is_paid := false;
    IF inv_rec.payment_method = 'CASH' THEN
      v_is_paid := true;
      v_effective_tax_date := inv_rec.delivery_date;
    ELSIF inv_rec.manual_payment_date IS NOT NULL THEN
      v_is_paid := true;
      v_effective_tax_date := inv_rec.manual_payment_date;
    ELSIF inv_rec.transaction_date IS NOT NULL THEN
      v_is_paid := true;
      v_effective_tax_date := inv_rec.transaction_date;
    ELSE
      v_effective_tax_date := inv_rec.delivery_date;
    END IF;

    IF v_is_penzforgalmi AND NOT v_is_paid THEN
      CONTINUE;
    END IF;

    IF NOT (v_effective_tax_date >= v_date_from AND v_effective_tax_date <= v_date_to) THEN
      CONTINUE;
    END IF;

    v_is_fad := false;
    v_calculated_fad_tax := 0;
    IF inv_rec.invoice_direction = 'INBOUND' THEN
      IF inv_rec.is_reverse_charge = true 
         OR inv_rec.vat_code_code = 'BE_FORD_27'
         OR (inv_rec.vat_rate IN ('0%', 'FAD') AND inv_rec.vat_amount = 0 AND (
              inv_rec.product_code ILIKE 'FAD%'
              OR inv_rec.line_description ILIKE '%fordított%'
              OR inv_rec.line_description ILIKE '%forditott%'
              OR inv_rec.line_description ILIKE '%építési-szerelési%'
              OR inv_rec.line_description ILIKE '%epitesi-szerelesi%'
              OR inv_rec.line_description ILIKE '%alvállalkozó%'
              OR inv_rec.line_description ILIKE '%alvallalkozo%'
         )) THEN
        v_is_fad := true;
        v_calculated_fad_tax := ROUND(v_net_huf * 0.27);
      END IF;
    END IF;

    IF v_is_fad THEN
      v_line29_base := v_line29_base + v_net_huf;
      v_line29_tax  := v_line29_tax  + v_calculated_fad_tax;
      v_line66_fad_base := v_line66_fad_base + v_net_huf;
      v_line66_fad_tax  := v_line66_fad_tax  + v_calculated_fad_tax;
      CONTINUE;
    END IF;

    v_override_row := inv_rec.vat_row_override;
    IF v_override_row IS NOT NULL AND v_override_row <> '' THEN
      IF inv_rec.invoice_direction = 'OUTBOUND' THEN
        CASE v_override_row
          WHEN '01' THEN v_line01_base := v_line01_base + v_net_huf;
          WHEN '02' THEN v_line02_base := v_line02_base + v_net_huf;
          WHEN '04' THEN v_line04_base := v_line04_base + v_net_huf;
          WHEN '05' THEN v_line05_base := v_line05_base + v_net_huf; v_line05_tax := v_line05_tax + v_tax_huf;
          WHEN '06' THEN v_line06_base := v_line06_base + v_net_huf; v_line06_tax := v_line06_tax + v_tax_huf;
          WHEN '07' THEN v_line07_base := v_line07_base + v_net_huf; v_line07_tax := v_line07_tax + v_tax_huf;
          WHEN '08' THEN v_line08_base := v_line08_base + v_net_huf;
          WHEN '18' THEN v_line18_base := v_line18_base + v_net_huf; v_line18_tax := v_line18_tax + v_tax_huf;
          WHEN '43' THEN v_line43_base := v_line43_base + v_net_huf; v_line43_tax := v_line43_tax + v_tax_huf;
          WHEN '45' THEN v_line45_base := v_line45_base + v_net_huf; v_line45_tax := v_line45_tax + v_tax_huf;
          WHEN '91' THEN v_line91_base := v_line91_base + v_net_huf;
          WHEN '92' THEN v_line92_base := v_line92_base + v_net_huf;
          ELSE
            IF inv_rec.vat_rate = '27%' THEN v_line07_base := v_line07_base + v_net_huf; v_line07_tax := v_line07_tax + v_tax_huf;
            ELSIF inv_rec.vat_rate = '18%' THEN v_line06_base := v_line06_base + v_net_huf; v_line06_tax := v_line06_tax + v_tax_huf;
            ELSIF inv_rec.vat_rate = '5%' THEN v_line05_base := v_line05_base + v_net_huf; v_line05_tax := v_line05_tax + v_tax_huf;
            END IF;
        END CASE;
      ELSE
        CASE v_override_row
          WHEN '63' THEN v_line63_base := v_line63_base + v_net_huf;
          WHEN '64' THEN v_line64_base := v_line64_base + v_net_huf; v_line64_tax := v_line64_tax + v_tax_huf;
          WHEN '65' THEN v_line65_base := v_line65_base + v_net_huf; v_line65_tax := v_line65_tax + v_tax_huf;
          WHEN '66' THEN v_line66_base := v_line66_base + v_net_huf; v_line66_tax := v_line66_tax + v_tax_huf;
          WHEN '67' THEN v_line67_base := v_line67_base + v_net_huf; v_line67_tax := v_line67_tax + v_tax_huf;
          WHEN '77' THEN
            v_line77_base := v_line77_base + v_net_huf;
            v_line77_tax  := v_line77_tax  + v_tax_huf;
            IF inv_rec.vat_rate = '27%' THEN v_line66_base := v_line66_base + v_net_huf; v_line66_tax := v_line66_tax + v_tax_huf;
            ELSIF inv_rec.vat_rate = '18%' THEN v_line65_base := v_line65_base + v_net_huf; v_line65_tax := v_line65_tax + v_tax_huf;
            ELSIF inv_rec.vat_rate = '5%' THEN v_line64_base := v_line64_base + v_net_huf; v_line64_tax := v_line64_tax + v_tax_huf;
            END IF;
          ELSE
            IF inv_rec.vat_rate = '27%' THEN v_line66_base := v_line66_base + v_net_huf; v_line66_tax := v_line66_tax + v_tax_huf;
            ELSIF inv_rec.vat_rate = '18%' THEN v_line65_base := v_line65_base + v_net_huf; v_line65_tax := v_line65_tax + v_tax_huf;
            ELSIF inv_rec.vat_rate = '5%' THEN v_line64_base := v_line64_base + v_net_huf; v_line64_tax := v_line64_tax + v_tax_huf;
            ELSE v_line63_base := v_line63_base + v_net_huf;
            END IF;
        END CASE;
      END IF;
      CONTINUE;
    END IF;

    IF inv_rec.invoice_direction = 'OUTBOUND' THEN
      IF inv_rec.is_advance THEN
        v_line45_base := v_line45_base + v_net_huf;
        v_line45_tax  := v_line45_tax  + v_tax_huf;
      END IF;

      IF inv_rec.is_tangible_asset THEN
        v_line43_base := v_line43_base + v_net_huf;
        v_line43_tax  := v_line43_tax  + v_tax_huf;
      END IF;

      IF inv_rec.vat_rate = '27%' THEN
        v_line07_base := v_line07_base + v_net_huf;
        v_line07_tax  := v_line07_tax  + v_tax_huf;
      ELSIF inv_rec.vat_rate = '18%' THEN
        v_line06_base := v_line06_base + v_net_huf;
        v_line06_tax  := v_line06_tax  + v_tax_huf;
      ELSIF inv_rec.vat_rate = '5%' THEN
        v_line05_base := v_line05_base + v_net_huf;
        v_line05_tax  := v_line05_tax  + v_tax_huf;
      ELSIF inv_rec.is_reverse_charge THEN
        v_line04_base := v_line04_base + v_net_huf;
      ELSIF v_is_eu_partner THEN
        v_line02_base := v_line02_base + v_net_huf;
      ELSIF v_customer_tax_num <> '' AND NOT (v_customer_tax_num ~ '^HU') THEN
        v_line01_base := v_line01_base + v_net_huf;
      ELSE
        v_line08_base := v_line08_base + v_net_huf;
      END IF;
    ELSE
      -- INBOUND Invoices
      IF inv_rec.is_tangible_asset THEN
        v_line77_base := v_line77_base + v_net_huf;
        v_line77_tax  := v_line77_tax  + v_tax_huf;
      END IF;

      IF v_is_eu_supplier THEN
        v_line18_base := v_line18_base + v_net_huf;
        v_line18_tax  := v_line18_tax  + v_tax_huf;
        v_line67_base := v_line67_base + v_net_huf;
        v_line67_tax  := v_line67_tax  + v_tax_huf;
      ELSIF v_is_foreign_supplier THEN
        v_line27_base := v_line27_base + v_net_huf;
        v_line27_tax  := v_line27_tax  + v_tax_huf;
        v_line67_base := v_line67_base + v_net_huf;
        v_line67_tax  := v_line67_tax  + v_tax_huf;
      ELSE
        IF inv_rec.vat_rate = '27%' THEN
          v_line66_base := v_line66_base + v_net_huf;
          v_line66_tax  := v_line66_tax  + v_tax_huf;
        ELSIF inv_rec.vat_rate = '18%' THEN
          v_line65_base := v_line65_base + v_net_huf;
          v_line65_tax  := v_line65_tax  + v_tax_huf;
        ELSIF inv_rec.vat_rate = '5%' THEN
          v_line64_base := v_line64_base + v_net_huf;
          v_line64_tax  := v_line64_tax  + v_tax_huf;
        ELSE
          v_line63_base := v_line63_base + v_net_huf;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- =========================================================================
  -- 2. IMPORT CUSTOMS DECLARATIONS LOOP (Termékimport Áfa tv. 24., 74-75., 95., 120., 154-156. §)
  -- =========================================================================
  FOR customs_rec IN
    SELECT
      icd.procedure_type,
      icd.vat_code,
      icd.vat_rate_percent,
      icd.vat_base_huf,
      icd.vat_amount_huf,
      icd.is_deductible,
      icd.payment_status,
      icd.payment_date,
      icd.tax_period_date
    FROM public.import_customs_declarations icd
    WHERE icd.company_id = p_company_id
      AND icd.status IN ('CONFIRMED', 'PAID')
  LOOP
    -- 1. Kivetéses eljárás (Áfa tv. 154. §)
    -- Levonhatóság feltétele: Áfa tv. 120. § c) és 127. § (1) c) szerint kizárólag A MEGFIZETÉS IDŐSZAKÁBAN vonható le!
    IF customs_rec.procedure_type = 'LEVY' THEN
      IF customs_rec.is_deductible
         AND customs_rec.payment_status = 'PAID'
         AND customs_rec.payment_date IS NOT NULL
         AND customs_rec.payment_date >= v_date_from
         AND customs_rec.payment_date <= v_date_to THEN
        v_line70_base := v_line70_base + COALESCE(customs_rec.vat_base_huf, 0);
        v_line70_tax  := v_line70_tax  + COALESCE(customs_rec.vat_amount_huf, 0);
      END IF;

    -- 2. Önadózásos eljárás (Áfa tv. 155-156. §)
    ELSIF customs_rec.procedure_type = 'SELF_ASSESSMENT' THEN
      IF customs_rec.tax_period_date >= v_date_from AND customs_rec.tax_period_date <= v_date_to THEN
        -- Fizetendő oldal (24., 25., 26. sorok kulcs szerint)
        IF customs_rec.vat_rate_percent = 5 THEN
          v_line24_base := v_line24_base + COALESCE(customs_rec.vat_base_huf, 0);
          v_line24_tax  := v_line24_tax  + COALESCE(customs_rec.vat_amount_huf, 0);
        ELSIF customs_rec.vat_rate_percent = 18 THEN
          v_line25_base := v_line25_base + COALESCE(customs_rec.vat_base_huf, 0);
          v_line25_tax  := v_line25_tax  + COALESCE(customs_rec.vat_amount_huf, 0);
        ELSE -- 27% vagy egyéb
          v_line26_base := v_line26_base + COALESCE(customs_rec.vat_base_huf, 0);
          v_line26_tax  := v_line26_tax  + COALESCE(customs_rec.vat_amount_huf, 0);
        END IF;

        -- Levonható oldal (71. sor, ha levonható)
        IF customs_rec.is_deductible THEN
          v_line71_base := v_line71_base + COALESCE(customs_rec.vat_base_huf, 0);
          v_line71_tax  := v_line71_tax  + COALESCE(customs_rec.vat_amount_huf, 0);
        END IF;
      END IF;
    END IF;

    -- 3. Adómentes termékimport (Áfa tv. 95. § / 42-es eljárás) -> 23. sor
    IF customs_rec.vat_code = 'IMP_MENTES'
       AND customs_rec.tax_period_date >= v_date_from
       AND customs_rec.tax_period_date <= v_date_to THEN
      v_line23_base := v_line23_base + COALESCE(customs_rec.vat_base_huf, 0);
    END IF;
  END LOOP;

  -- =========================================================================
  -- 3. INSERT VAT RETURN LINES (vat_return_lines)
  -- =========================================================================
  IF v_line01_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '01', v_line01_base, 0, ROUND(v_line01_base/1000)::int, 0, ARRAY['KI_EXPORT'], true);
  END IF;

  IF v_line02_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '02', v_line02_base, 0, ROUND(v_line02_base/1000)::int, 0, ARRAY['KI_EU'], true);
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

  IF v_line43_base > 0 OR v_line43_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '43', v_line43_base, v_line43_tax, ROUND(v_line43_base/1000)::int, ROUND(v_line43_tax/1000)::int, ARRAY['KIM_TE_ERT'], true);
  END IF;

  IF v_line45_base > 0 OR v_line45_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '45', v_line45_base, v_line45_tax, ROUND(v_line45_base/1000)::int, ROUND(v_line45_tax/1000)::int, ARRAY['ELOLEG'], true);
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

  -- Import ÁFA Fizetendő sorok (23, 24, 25, 26)
  IF v_line23_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '23', v_line23_base, 0, ROUND(v_line23_base/1000)::int, 0, ARRAY['IMP_MENTES'], true);
  END IF;

  IF v_line24_base > 0 OR v_line24_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '24', v_line24_base, v_line24_tax, ROUND(v_line24_base/1000)::int, ROUND(v_line24_tax/1000)::int, ARRAY['IMP_ON_5'], true);
  END IF;

  IF v_line25_base > 0 OR v_line25_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '25', v_line25_base, v_line25_tax, ROUND(v_line25_base/1000)::int, ROUND(v_line25_tax/1000)::int, ARRAY['IMP_ON_18'], true);
  END IF;

  IF v_line26_base > 0 OR v_line26_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '26', v_line26_base, v_line26_tax, ROUND(v_line26_base/1000)::int, ROUND(v_line26_tax/1000)::int, ARRAY['IMP_ON_27'], true);
  END IF;

  IF v_line27_base > 0 OR v_line27_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '27', v_line27_base, v_line27_tax, ROUND(v_line27_base/1000)::int, ROUND(v_line27_tax/1000)::int, ARRAY['3_ORSZ_SZOLG'], true);
  END IF;

  IF v_line29_base > 0 OR v_line29_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '29', v_line29_base, v_line29_tax, ROUND(v_line29_base/1000)::int, ROUND(v_line29_tax/1000)::int, ARRAY['BE_FORD'], true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE
    SET base_amount = EXCLUDED.base_amount,
        tax_amount = EXCLUDED.tax_amount,
        base_amount_rounded = EXCLUDED.base_amount_rounded,
        tax_amount_rounded = EXCLUDED.tax_amount_rounded,
        source_vat_codes = EXCLUDED.source_vat_codes,
        is_calculated = EXCLUDED.is_calculated;
  END IF;

  -- Levonható belföldi és egyéb sorok
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
    VALUES (v_return_id, '66', v_line66_base, v_line66_tax, ROUND(v_line66_base/1000)::int, ROUND(v_line66_tax/1000)::int, ARRAY['BE_27%'], true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE
    SET base_amount = EXCLUDED.base_amount,
        tax_amount = EXCLUDED.tax_amount,
        base_amount_rounded = EXCLUDED.base_amount_rounded,
        tax_amount_rounded = EXCLUDED.tax_amount_rounded,
        source_vat_codes = EXCLUDED.source_vat_codes,
        is_calculated = EXCLUDED.is_calculated;
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

  -- Import ÁFA Levonható sorok (70, 71)
  IF v_line70_base > 0 OR v_line70_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '70', v_line70_base, v_line70_tax, ROUND(v_line70_base/1000)::int, ROUND(v_line70_tax/1000)::int, ARRAY['IMP_KIV_27', 'IMP_KIV_18', 'IMP_KIV_5'], true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE
    SET base_amount = EXCLUDED.base_amount,
        tax_amount = EXCLUDED.tax_amount,
        base_amount_rounded = EXCLUDED.base_amount_rounded,
        tax_amount_rounded = EXCLUDED.tax_amount_rounded,
        source_vat_codes = EXCLUDED.source_vat_codes,
        is_calculated = EXCLUDED.is_calculated;
  END IF;

  IF v_line71_base > 0 OR v_line71_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '71', v_line71_base, v_line71_tax, ROUND(v_line71_base/1000)::int, ROUND(v_line71_tax/1000)::int, ARRAY['IMP_ON_27', 'IMP_ON_18', 'IMP_ON_5'], true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE
    SET base_amount = EXCLUDED.base_amount,
        tax_amount = EXCLUDED.tax_amount,
        base_amount_rounded = EXCLUDED.base_amount_rounded,
        tax_amount_rounded = EXCLUDED.tax_amount_rounded,
        source_vat_codes = EXCLUDED.source_vat_codes,
        is_calculated = EXCLUDED.is_calculated;
  END IF;

  IF v_line77_base > 0 OR v_line77_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '77', v_line77_base, v_line77_tax, ROUND(v_line77_base/1000)::int, ROUND(v_line77_tax/1000)::int, ARRAY['TARGYI_ESZKOZ'], true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE
    SET base_amount = EXCLUDED.base_amount,
        tax_amount = EXCLUDED.tax_amount,
        base_amount_rounded = EXCLUDED.base_amount_rounded,
        tax_amount_rounded = EXCLUDED.tax_amount_rounded,
        source_vat_codes = EXCLUDED.source_vat_codes,
        is_calculated = EXCLUDED.is_calculated;
  END IF;

  -- Totals calculation
  v_total_payable_base := v_line01_base + v_line02_base + v_line04_base + v_line05_base + v_line06_base + v_line07_base + v_line08_base + v_line18_base + v_line23_base + v_line24_base + v_line25_base + v_line26_base + v_line27_base + v_line29_base + v_line91_base + v_line92_base;
  v_total_payable_tax  := v_line05_tax + v_line06_tax + v_line07_tax + v_line18_tax + v_line24_tax + v_line25_tax + v_line26_tax + v_line27_tax + v_line29_tax;

  v_total_deductible_base := v_line63_base + v_line64_base + v_line65_base + v_line66_base + v_line67_base + v_line70_base + v_line71_base;
  v_total_deductible_tax  := v_line64_tax + v_line65_tax + v_line66_tax + v_line67_tax + v_line70_tax + v_line71_tax;

  v_net_tax_balance := v_total_payable_tax - v_total_deductible_tax;

  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '36', v_total_payable_base, v_total_payable_tax, ROUND(v_total_payable_base/1000)::int, ROUND(v_total_payable_tax/1000)::int, true);

  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '76', v_total_deductible_base, v_total_deductible_tax, ROUND(v_total_deductible_base/1000)::int, ROUND(v_total_deductible_tax/1000)::int, true);

  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '83', 0, v_net_tax_balance, 0, ROUND(v_net_tax_balance/1000)::int, true);

  IF (v_net_tax_balance - v_prev_carry) > 0 THEN
    v_line85_tax := v_net_tax_balance - v_prev_carry;
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
    VALUES (v_return_id, '84', 0, v_line85_tax, 0, ROUND(v_line85_tax/1000)::int, true);
  END IF;

  IF (v_net_tax_balance - v_prev_carry) < 0 THEN
    v_line86_tax := ABS(v_net_tax_balance - v_prev_carry);
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
    VALUES (v_return_id, '86', 0, v_line86_tax, 0, ROUND(v_line86_tax/1000)::int, true);
  END IF;

  UPDATE vat_returns SET
    total_payable_tax = v_total_payable_tax,
    total_deductible_tax = v_total_deductible_tax,
    net_result = v_net_tax_balance,
    amount_to_pay = CASE WHEN (v_net_tax_balance - v_prev_carry) > 0 THEN (v_net_tax_balance - v_prev_carry) ELSE 0 END,
    amount_carryforward = CASE WHEN (v_net_tax_balance - v_prev_carry) < 0 THEN ABS(v_net_tax_balance - v_prev_carry) ELSE 0 END,
    prev_period_carryforward = v_prev_carry,
    updated_at = now()
  WHERE id = v_return_id;

  -- =========================================================================
  -- 4. POPULATE 65M DOMESTIC PARTNER SUMMARY LINES (vat_return_m_lines)
  -- =========================================================================
  WITH all_inbounds AS (
    -- A. Inbound invoices from nav_invoices
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
          COALESCE(SUM(ROUND(COALESCE(nii.gross_amount, (nii.net_amount + nii.vat_amount)) * COALESCE(er.rate, 1.0), 2)), 0)
        ELSE
          ROUND(COALESCE(ni.invoice_gross_amount, 0) * COALESCE(er.rate, 1.0), 2)
      END AS gross_amount,
      CASE 
        WHEN COALESCE(nii.vat_rate, '') IN ('27%', '0.27', '27') THEN 
          COALESCE(SUM(ROUND(nii.vat_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2)), 0)
        ELSE 0 
      END AS tax_27,
      CASE 
        WHEN COALESCE(nii.vat_rate, '') IN ('18%', '0.18', '18') THEN 
          COALESCE(SUM(ROUND(nii.vat_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2)), 0)
        ELSE 0 
      END AS tax_18,
      CASE 
        WHEN COALESCE(nii.vat_rate, '') IN ('5%', '0.05', '5') THEN 
          COALESCE(SUM(ROUND(nii.vat_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2)), 0)
        ELSE 0 
      END AS tax_5
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
    LEFT JOIN daily_exchange_rates er ON er.currency = ni.currency AND er.rate_date = ni.invoice_delivery_date
    WHERE ni.company_id = p_company_id
      AND ni.invoice_direction = 'INBOUND'
      AND (
        COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date BETWEEN v_date_from AND v_date_to
        OR (
          (v_is_penzforgalmi OR COALESCE(ni.is_cash_accounting, false) = true)
          AND COALESCE(ni.payment_method, '') <> 'CASH'
          AND COALESCE(ni.manual_payment_date, ni.invoice_delivery_date)::date BETWEEN v_date_from AND v_date_to
        )
      )
      -- 1. Exclude Proforma / Díjbekérő
      AND ni.invoice_number NOT ILIKE 'DÍJ%'
      AND ni.invoice_number NOT ILIKE 'DIJ%'
      AND ni.invoice_number NOT ILIKE 'PROFORMA%'
      AND ni.invoice_number NOT ILIKE 'PRO-%'
      AND ni.invoice_number NOT ILIKE 'PRO_%'
      AND ni.invoice_number NOT ILIKE 'PRO/%'
      AND ni.invoice_number NOT ILIKE '%PREDRACUN%'
      AND ni.invoice_number NOT ILIKE '%PREDRAČUN%'

      -- 2. Exclude Alanyi Adómentes (AAM) partners (Hungarian tax number 9th digit = '1')
      AND NOT (
        LENGTH(REGEXP_REPLACE(COALESCE(ni.supplier_tax_number, ''), '[^0-9]', '', 'g')) >= 9
        AND SUBSTRING(REGEXP_REPLACE(COALESCE(ni.supplier_tax_number, ''), '[^0-9]', '', 'g') FROM 9 FOR 1) = '1'
      )
      AND NOT (
        COALESCE(ni.supplier_name, '') ILIKE '%alanyi adómentes%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%alanyi mentes%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%(aam)%'
      )

      -- 3. Exclude Insurance companies and insurance policies
      AND NOT (
        COALESCE(ni.supplier_name, '') ILIKE '%biztosító%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%biztositó%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%biztosítás%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%biztositas%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%insurance%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%allianz%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%generali%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%groupama%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%uniqa%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%aegon%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%k&h biztosító%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%posta biztosító%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%signal iduna%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%colonnade%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%cig pannónia%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%cig pannonia%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%grawe%'
      )
    GROUP BY ni.id, ni.company_id, ni.invoice_number, ni.supplier_name, ni.supplier_tax_number, ni.invoice_delivery_date, ni.invoice_issue_date, ni.currency, er.rate, nii.vat_rate

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
      -- 1. Exclude Proforma / Díjbekérő
      AND inv.invoice_type NOT IN ('dijbekero_proforma', 'dijbekero', 'proforma', 'garanciajegy')
      AND inv.bizonylatsorszam NOT ILIKE 'DÍJ%'
      AND inv.bizonylatsorszam NOT ILIKE 'DIJ%'
      AND inv.bizonylatsorszam NOT ILIKE 'PROFORMA%'
      AND inv.bizonylatsorszam NOT ILIKE 'PRO-%'
      AND inv.bizonylatsorszam NOT ILIKE 'PRO_%'
      AND inv.bizonylatsorszam NOT ILIKE 'PRO/%'
      AND inv.bizonylatsorszam NOT ILIKE '%PREDRACUN%'
      AND inv.bizonylatsorszam NOT ILIKE '%PREDRAČUN%'

      -- 2. Exclude Alanyi Adómentes (AAM) partners
      AND NOT (
        LENGTH(REGEXP_REPLACE(COALESCE(inv.elado_vat_id, ''), '[^0-9]', '', 'g')) >= 9
        AND SUBSTRING(REGEXP_REPLACE(COALESCE(inv.elado_vat_id, ''), '[^0-9]', '', 'g') FROM 9 FOR 1) = '1'
      )
      AND NOT (
        COALESCE(inv.elado_nev, '') ILIKE '%alanyi adómentes%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%alanyi mentes%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%(aam)%'
      )

      -- 3. Exclude Insurance companies and insurance policies
      AND NOT (
        COALESCE(inv.elado_nev, '') ILIKE '%biztosító%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%biztositó%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%biztosítás%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%biztositas%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%insurance%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%allianz%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%generali%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%groupama%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%uniqa%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%aegon%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%k&h biztosító%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%posta biztosító%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%signal iduna%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%colonnade%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%cig pannónia%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%cig pannonia%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%grawe%'
        OR COALESCE(inv.termek_szolgaltatas_tipusa, '') ILIKE '%biztosítás%'
        OR COALESCE(inv.termek_szolgaltatas_tipusa, '') ILIKE '%biztositás%'
      )
      AND NOT EXISTS (
        SELECT 1 FROM nav_invoices ni2 
        WHERE ni2.company_id = p_company_id 
          AND ni2.invoice_number = inv.bizonylatsorszam
      )
  )
  INSERT INTO vat_return_m_lines (
    vat_return_id,
    partner_name,
    partner_tax_number,
    invoice_count,
    base_amount,
    tax_amount,
    base_amount_rounded,
    tax_amount_rounded,
    tax_27_amount,
    tax_18_amount,
    tax_5_amount,
    invoice_details
  )
  SELECT
    v_return_id,
    MAX(partner_name) AS partner_name,
    partner_tax_number,
    COUNT(DISTINCT invoice_id) AS invoice_count,
    SUM(net_amount) AS base_amount,
    SUM(vat_amount) AS tax_amount,
    ROUND(SUM(net_amount) / 1000)::integer AS base_amount_rounded,
    ROUND(SUM(vat_amount) / 1000)::integer AS tax_amount_rounded,
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
  GROUP BY partner_tax_number
  HAVING (
    SUM(vat_amount) > 0 
    OR SUM(tax_27) > 0 
    OR SUM(tax_18) > 0 
    OR SUM(tax_5) > 0
  );

  RETURN jsonb_build_object(
    'success', true,
    'vat_return_id', v_return_id,
    'total_payable_tax', v_total_payable_tax,
    'total_deductible_tax', v_total_deductible_tax,
    'net_balance', v_net_tax_balance
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.calculate_hungarian_vat_return(uuid, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_hungarian_vat_return(uuid, integer, integer, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
