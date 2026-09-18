-- Migration: Fix VAT return engine for rows 45, 77, 67, and M-sheet threshold
-- 1. vat_form_rows: row 77 has_tax = true, has_base = false
-- 2. calculate_vat_return:
--    - Line 45: Advance received (kapott előleg adóalap a 05-07 sorokból)
--    - Line 77: Tangible asset acquisition deductible VAT (tárgyi eszköz levonható adó)
--    - Line 67: Strictly deductible side of foreign/EU services (rows 18 and 27), domestic AAM 0% completely excluded
--    - M-sheet: Remove outdated >= 100000 threshold (change to > 0 as per 2020+ Hungarian legislation)

-- 1. Fix vat_form_rows for row 77
UPDATE public.vat_form_rows
SET has_base = false, has_tax = true
WHERE row_number = '77';

-- 2. Update calculate_vat_return
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

  -- 5. Process nav_invoices & penztargep_zaras
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
      COALESCE(nii.deductible_percentage, 100.0) AS deductible_pct,
      COALESCE(app_inv.is_advance, nii.line_description ILIKE '%előleg%', false) AS is_advance,
      COALESCE(app_inv.is_tangible_asset, false) AS is_tangible_asset
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
        ) AS is_tangible_asset
      FROM public.invoices inv
      WHERE inv.company_id = ni.company_id 
        AND inv.bizonylatsorszam = ni.invoice_number
      LIMIT 1
    ) app_inv ON true
    WHERE ni.company_id = p_company_id
      AND (
        COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date BETWEEN v_date_from AND v_date_to
        OR COALESCE(ni.manual_payment_date, t.transaction_date)::date BETWEEN v_date_from AND v_date_to
      )
    UNION ALL
    -- Include cash register daily closures from invoices table
    SELECT
      i.id AS invoice_id,
      i.invoice_direction,
      COALESCE(i.penznem, 'HUF') AS currency,
      COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date AS delivery_date,
      i.fizetesi_mod AS payment_method,
      i.elado_vat_id AS supplier_tax_number,
      i.vevo_vat_id AS customer_tax_number,
      false AS is_cash_accounting,
      i.transaction_id,
      NULL::date AS manual_payment_date,
      NULL::uuid AS tx_id,
      NULL::date AS transaction_date,
      false AS is_reverse_charge,
      COALESCE(ii.net_amount, i.adoalap_osszesen, 0) AS net_amount,
      COALESCE(ii.vat_amount, i.afa_osszeg_osszesen, 0) AS vat_amount,
      COALESCE(ii.vat_rate, '27%') AS vat_rate,
      100.0 AS deductible_pct,
      false AS is_advance,
      false AS is_tangible_asset
    FROM invoices i
    LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
    WHERE i.company_id = p_company_id
      AND i.invoice_type = 'penztargep_zaras'
      AND i.statusz IN ('feldolgozott', 'processed')
      AND COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date BETWEEN v_date_from AND v_date_to
  LOOP
    -- Pénzforgalmi / Cash accounting date logic
    v_is_settled := (inv_rec.transaction_id IS NOT NULL OR inv_rec.tx_id IS NOT NULL OR inv_rec.manual_payment_date IS NOT NULL);

    IF (v_is_penzforgalmi OR COALESCE(inv_rec.is_cash_accounting, false) = true) AND COALESCE(inv_rec.payment_method, '') <> 'CASH' THEN
      IF NOT v_is_settled THEN
        CONTINUE;
      END IF;
      v_effective_tax_date := COALESCE(inv_rec.manual_payment_date, inv_rec.transaction_date, inv_rec.delivery_date);
    ELSE
      v_effective_tax_date := inv_rec.delivery_date;
    END IF;

    IF v_effective_tax_date < v_date_from OR v_effective_tax_date > v_date_to THEN
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

      -- Line 45: Előleg címén kapott összeg a 05-07. sorok összegéből (adóalap)
      IF COALESCE(inv_rec.is_advance, false) = true THEN
        v_line45_base := v_line45_base + v_net_huf;
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

      -- Line 77: Tárgyi eszköz beszerzése után levonható adó összege a 76. sor összegéből (apport nélkül)
      IF COALESCE(inv_rec.is_tangible_asset, false) = true THEN
        v_line77_tax := v_line77_tax + ROUND(v_tax_huf * (inv_rec.deductible_pct / 100.0), 2);
      END IF;
    END IF;
  END LOOP;

  -- Calculate Line 67: Strictly deductible side of foreign/EU services (rows 18 and 27)
  v_line67_base := v_line18_base + v_line27_base;
  v_line67_tax  := v_line18_tax + v_line27_tax;

  -- 6. Insert computed return lines
  -- Line 01 (Adómentes értékesítés)
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

  -- Line 45 (Előleg címén kapott összeg a 05-07. sorok összegéből)
  IF v_line45_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '45', v_line45_base, 0, ROUND(v_line45_base/1000)::int, 0, ARRAY['ELOLEG', '4531']);
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
    VALUES (v_return_id, '67', v_line67_base, v_line67_tax, ROUND(v_line67_base/1000)::int, ROUND(v_line67_tax/1000)::int, ARRAY['ATHK', 'EUK', 'KIM_ATHK', 'KIM_EU_SZOLG']);
  END IF;

  -- Line 77 (Tárgyi eszköz beszerzése után levonható adó összege a 76. sor összegéből)
  IF v_line77_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes)
    VALUES (v_return_id, '77', 0, v_line77_tax, 0, ROUND(v_line77_tax/1000)::int, ARRAY['TARGYESZKOZ', '161']);
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
    -- Line 83 / 84: Befizetendő adó
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded)
    VALUES (v_return_id, '83', 0, v_net_tax_balance, 0, ROUND(v_net_tax_balance/1000)::int);

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

  -- 7. Populate M-sheet details (all domestic invoices with VAT > 0, without 100k threshold)
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
  HAVING SUM(ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (CASE WHEN ni.currency IS NULL OR ni.currency = 'HUF' THEN 1.0 ELSE COALESCE(er.rate, 1.0) END), 2)) > 0;

  RETURN v_return_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text) TO authenticated, service_role;
