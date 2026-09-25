-- ============================================================================
-- MIGRATION: 20260925141000_croatian_vat_return_engine.sql
-- Description: Multi-jurisdiction calculate_vat_return with Obrazac PDV support
-- ============================================================================

-- 1. Create calculate_croatian_vat_return
CREATE OR REPLACE FUNCTION public.calculate_croatian_vat_return(
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
  v_prev_month INTEGER;
  v_prev_year INTEGER;
  v_prev_carry NUMERIC := 0;

  -- Accumulators for Obrazac PDV rows (EUR with 2 decimal places)
  v_rows JSONB := '{}'::jsonb;
  
  -- Iteration variables
  inv_rec RECORD;
  v_item_net NUMERIC;
  v_item_tax NUMERIC;
  v_item_rate TEXT;
  v_fx_rate NUMERIC := 1.0;
  v_is_outbound BOOLEAN;
  v_partner_tax_num TEXT;
  v_partner_country TEXT := 'HR';
  v_is_eu BOOLEAN := false;
  v_is_third_country BOOLEAN := false;
  
  v_target_row TEXT;

  -- Totals
  v_total_i_base NUMERIC := 0;
  v_total_ii_base NUMERIC := 0;
  v_total_ii_tax NUMERIC := 0;
  v_total_iii_base NUMERIC := 0;
  v_total_iii_tax NUMERIC := 0;
  v_net_difference NUMERIC := 0;
  v_amount_to_pay NUMERIC := 0;
  v_amount_reclaimable NUMERIC := 0;
BEGIN
  -- 1. Ensure Croatian VAT codes are seeded
  IF NOT EXISTS (SELECT 1 FROM vat_codes WHERE company_id = p_company_id) THEN
    PERFORM seed_default_vat_codes(p_company_id);
  END IF;

  -- 2. Date ranges
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

  -- 3. Previous period carryforward
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

  SELECT COALESCE(vr.amount_carryforward, vr.amount_reclaimable, 0)
  INTO v_prev_carry
  FROM vat_returns vr
  WHERE vr.company_id = p_company_id
    AND vr.period_year = v_prev_year
    AND vr.period_month = v_prev_month
    AND vr.frequency = p_frequency
  ORDER BY vr.created_at DESC LIMIT 1;
  v_prev_carry := COALESCE(v_prev_carry, 0);

  -- 4. Upsert vat_returns header
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

  -- Clean old lines
  DELETE FROM vat_return_lines WHERE vat_return_id = v_return_id;
  DELETE FROM vat_return_m_lines WHERE vat_return_id = v_return_id;

  -- Create temporary storage for row accumulations
  CREATE TEMP TABLE IF NOT EXISTS temp_pdv_accum (
    row_num TEXT PRIMARY KEY,
    base_amt NUMERIC DEFAULT 0,
    tax_amt NUMERIC DEFAULT 0,
    source_codes TEXT[] DEFAULT '{}'::TEXT[]
  ) ON COMMIT DROP;
  TRUNCATE temp_pdv_accum;

  -- 5. Process Invoices & Items for Croatian company
  FOR inv_rec IN
    SELECT
      i.id AS invoice_id,
      i.bizonylatsorszam,
      i.invoice_direction,
      COALESCE(i.penznem, 'EUR') AS currency,
      COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date AS delivery_date,
      i.elado_nev,
      i.elado_vat_id,
      i.vevo_nev,
      i.vevo_vat_id,
      i.forditott_adozas,
      i.termek_szolgaltatas_tipusa,
      COALESCE(ii.vat_code, i.vat_row_override) AS vat_row_override,
      COALESCE(ii.vat_code_id, i.vat_code_id) AS vat_code_id,
      vc.code AS vat_code_code,
      vc.target_rows AS vat_code_target_rows,
      ii.id AS item_id,
      COALESCE(ii.net_amount, i.adoalap_osszesen, 0) AS net_amount,
      COALESCE(ii.vat_amount, i.afa_osszeg_osszesen, 0) AS vat_amount,
      COALESCE(ii.vat_rate, 
        CASE 
          WHEN COALESCE(i.adoalap_osszesen, 0) > 0 AND COALESCE(i.afa_osszeg_osszesen, 0) > 0
               AND ROUND(i.afa_osszeg_osszesen / i.adoalap_osszesen, 2) = 0.25 THEN '25%'
          WHEN COALESCE(i.adoalap_osszesen, 0) > 0 AND COALESCE(i.afa_osszeg_osszesen, 0) > 0
               AND ROUND(i.afa_osszeg_osszesen / i.adoalap_osszesen, 2) = 0.13 THEN '13%'
          WHEN COALESCE(i.adoalap_osszesen, 0) > 0 AND COALESCE(i.afa_osszeg_osszesen, 0) > 0
               AND ROUND(i.afa_osszeg_osszesen / i.adoalap_osszesen, 2) = 0.05 THEN '5%'
          WHEN COALESCE(i.afa_osszeg_osszesen, 0) > 0 THEN '25%'
          ELSE '0%'
        END
      ) AS vat_rate,
      COALESCE(ii.deductible_percentage, 100.0) AS deductible_pct,
      ii.is_vat_code_manual
    FROM public.invoices i
    LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id
    LEFT JOIN public.vat_codes vc ON vc.id = COALESCE(ii.vat_code_id, i.vat_code_id)
    WHERE i.company_id = p_company_id
      AND COALESCE(i.exclude_from_accounting, false) = false
      AND COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date BETWEEN v_date_from AND v_date_to
  LOOP
    -- Exchange rate conversion to EUR
    IF inv_rec.currency = 'EUR' THEN
      v_fx_rate := 1.0;
    ELSE
      SELECT 
        COALESCE(
          r_cur.rate / NULLIF(r_eur.rate, 0),
          1.0
        ) INTO v_fx_rate
      FROM (
        SELECT rate FROM daily_exchange_rates 
        WHERE currency = inv_rec.currency AND rate_date <= inv_rec.delivery_date 
        ORDER BY rate_date DESC LIMIT 1
      ) r_cur
      CROSS JOIN (
        SELECT rate FROM daily_exchange_rates 
        WHERE currency = 'EUR' AND rate_date <= inv_rec.delivery_date 
        ORDER BY rate_date DESC LIMIT 1
      ) r_eur;
      v_fx_rate := COALESCE(v_fx_rate, 1.0);
    END IF;

    v_item_net := ROUND(inv_rec.net_amount * (COALESCE(inv_rec.deductible_pct, 100.0) / 100.0) * v_fx_rate, 2);
    v_item_tax := ROUND(inv_rec.vat_amount * (COALESCE(inv_rec.deductible_pct, 100.0) / 100.0) * v_fx_rate, 2);
    v_item_rate := inv_rec.vat_rate;
    v_is_outbound := (UPPER(COALESCE(inv_rec.invoice_direction, 'INBOUND')) = 'OUTBOUND');

    -- Determine partner tax identifier
    IF v_is_outbound THEN
      v_partner_tax_num := COALESCE(inv_rec.vevo_vat_id, '');
    ELSE
      v_partner_tax_num := COALESCE(inv_rec.elado_vat_id, '');
    END IF;
    v_partner_tax_num := UPPER(TRIM(v_partner_tax_num));

    -- Detect EU / 3rd country partner
    v_is_eu := false;
    v_is_third_country := false;
    IF v_partner_tax_num ~ '^(AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)[0-9A-Z]+$' THEN
      v_is_eu := true;
    ELSIF v_partner_tax_num <> '' AND NOT v_partner_tax_num ~ '^(HR)?[0-9]{11}$' THEN
      v_is_third_country := true;
    END IF;

    -- A. If invoice has explicit target_rows in vat_code
    IF inv_rec.vat_code_target_rows IS NOT NULL AND jsonb_array_length(inv_rec.vat_code_target_rows) > 0 THEN
      DECLARE
        elem JSONB;
        r_num TEXT;
        r_col TEXT;
      BEGIN
        FOR elem IN SELECT * FROM jsonb_array_elements(inv_rec.vat_code_target_rows) LOOP
          r_num := elem->>'row';
          r_col := elem->>'col';

          INSERT INTO temp_pdv_accum (row_num, base_amt, tax_amt, source_codes)
          VALUES (
            r_num,
            CASE WHEN r_col = 'base' THEN v_item_net ELSE 0 END,
            CASE WHEN r_col = 'tax' THEN v_item_tax ELSE 0 END,
            ARRAY[inv_rec.vat_code_code]
          )
          ON CONFLICT (row_num) DO UPDATE SET
            base_amt = temp_pdv_accum.base_amt + CASE WHEN r_col = 'base' THEN v_item_net ELSE 0 END,
            tax_amt = temp_pdv_accum.tax_amt + CASE WHEN r_col = 'tax' THEN v_item_tax ELSE 0 END,
            source_codes = array_append(temp_pdv_accum.source_codes, inv_rec.vat_code_code);
        END LOOP;
      END;

    -- B. Otherwise, automated determination according to Obrazac PDV rules
    ELSIF v_is_outbound THEN
      -- OUTBOUND (KIM / Izlazni račun)
      IF v_item_tax > 0 OR v_item_rate IN ('25%', '13%', '5%') THEN
        IF v_item_rate = '13%' THEN
          v_target_row := 'II.2';
        ELSIF v_item_rate = '5%' THEN
          v_target_row := 'II.1';
        ELSE
          v_target_row := 'II.3'; -- Standard 25%
        END IF;

        INSERT INTO temp_pdv_accum (row_num, base_amt, tax_amt, source_codes)
        VALUES (v_target_row, v_item_net, v_item_tax, ARRAY['HR_IZL_AUTO'])
        ON CONFLICT (row_num) DO UPDATE SET
          base_amt = temp_pdv_accum.base_amt + v_item_net,
          tax_amt = temp_pdv_accum.tax_amt + v_item_tax;

      ELSE
        -- Tax-free / exempt / reverse charge
        IF COALESCE(inv_rec.forditott_adozas, false) THEN
          v_target_row := 'I.1'; -- Tuzemni prijenos
        ELSIF v_is_eu THEN
          v_target_row := 'I.4'; -- EU isporuke / usluge
        ELSIF v_is_third_country THEN
          v_target_row := 'I.5'; -- Usluge osobama bez sjedišta u RH
        ELSE
          v_target_row := 'I.8'; -- Tuzemne oslobođene isporuke
        END IF;

        INSERT INTO temp_pdv_accum (row_num, base_amt, tax_amt, source_codes)
        VALUES (v_target_row, v_item_net, 0, ARRAY['HR_IZL_EXEMPT'])
        ON CONFLICT (row_num) DO UPDATE SET
          base_amt = temp_pdv_accum.base_amt + v_item_net;
      END IF;

    ELSE
      -- INBOUND (BE / Ulazni račun)
      IF COALESCE(inv_rec.forditott_adozas, false) THEN
        -- Domestic reverse charge (II.4 payable + III.4 deductible)
        INSERT INTO temp_pdv_accum (row_num, base_amt, tax_amt, source_codes)
        VALUES ('II.4', v_item_net, v_item_tax, ARRAY['HR_UL_TUZ_PRIJ'])
        ON CONFLICT (row_num) DO UPDATE SET
          base_amt = temp_pdv_accum.base_amt + v_item_net,
          tax_amt = temp_pdv_accum.tax_amt + v_item_tax;

        INSERT INTO temp_pdv_accum (row_num, base_amt, tax_amt, source_codes)
        VALUES ('III.4', v_item_net, v_item_tax, ARRAY['HR_UL_TUZ_PRIJ'])
        ON CONFLICT (row_num) DO UPDATE SET
          base_amt = temp_pdv_accum.base_amt + v_item_net,
          tax_amt = temp_pdv_accum.tax_amt + v_item_tax;

      ELSIF v_is_eu THEN
        -- EU acquisition (II.10 services / II.7 goods + III.10 / III.7)
        INSERT INTO temp_pdv_accum (row_num, base_amt, tax_amt, source_codes)
        VALUES ('II.10', v_item_net, v_item_tax, ARRAY['HR_UL_EU_USL'])
        ON CONFLICT (row_num) DO UPDATE SET
          base_amt = temp_pdv_accum.base_amt + v_item_net,
          tax_amt = temp_pdv_accum.tax_amt + v_item_tax;

        INSERT INTO temp_pdv_accum (row_num, base_amt, tax_amt, source_codes)
        VALUES ('III.10', v_item_net, v_item_tax, ARRAY['HR_UL_EU_USL'])
        ON CONFLICT (row_num) DO UPDATE SET
          base_amt = temp_pdv_accum.base_amt + v_item_net,
          tax_amt = temp_pdv_accum.tax_amt + v_item_tax;

      ELSE
        -- Domestic input VAT
        IF v_item_rate = '13%' THEN
          v_target_row := 'III.2';
        ELSIF v_item_rate = '5%' THEN
          v_target_row := 'III.1';
        ELSE
          v_target_row := 'III.3'; -- Standard 25% pretporez
        END IF;

        INSERT INTO temp_pdv_accum (row_num, base_amt, tax_amt, source_codes)
        VALUES (v_target_row, v_item_net, v_item_tax, ARRAY['HR_UL_AUTO'])
        ON CONFLICT (row_num) DO UPDATE SET
          base_amt = temp_pdv_accum.base_amt + v_item_net,
          tax_amt = temp_pdv_accum.tax_amt + v_item_tax;
      END IF;

    END IF;
  END LOOP;

  -- 6. Calculate Section Summaries
  -- Section I: Total exempt / non-taxable bases
  SELECT COALESCE(SUM(base_amt), 0) INTO v_total_i_base
  FROM temp_pdv_accum WHERE row_num LIKE 'I.%';

  -- Section II: Total taxable base and tax
  SELECT COALESCE(SUM(base_amt), 0), COALESCE(SUM(tax_amt), 0)
  INTO v_total_ii_base, v_total_ii_tax
  FROM temp_pdv_accum WHERE row_num LIKE 'II.%';

  -- Section III: Total deductible pretporez base and tax
  SELECT COALESCE(SUM(base_amt), 0), COALESCE(SUM(tax_amt), 0)
  INTO v_total_iii_base, v_total_iii_tax
  FROM temp_pdv_accum WHERE row_num LIKE 'III.%';

  -- Insert Summary Rows
  INSERT INTO temp_pdv_accum (row_num, base_amt, tax_amt)
  VALUES ('I', v_total_i_base, 0)
  ON CONFLICT (row_num) DO UPDATE SET base_amt = EXCLUDED.base_amt;

  INSERT INTO temp_pdv_accum (row_num, base_amt, tax_amt)
  VALUES ('II', v_total_ii_base, v_total_ii_tax)
  ON CONFLICT (row_num) DO UPDATE SET base_amt = EXCLUDED.base_amt, tax_amt = EXCLUDED.tax_amt;

  INSERT INTO temp_pdv_accum (row_num, base_amt, tax_amt)
  VALUES ('III', v_total_iii_base, v_total_iii_tax)
  ON CONFLICT (row_num) DO UPDATE SET base_amt = EXCLUDED.base_amt, tax_amt = EXCLUDED.tax_amt;

  -- Section IV: Period tax balance (II.tax - III.tax)
  v_net_difference := v_total_ii_tax - v_total_iii_tax;
  IF v_net_difference >= 0 THEN
    v_amount_to_pay := v_net_difference;
    v_amount_reclaimable := 0;
  ELSE
    v_amount_to_pay := 0;
    v_amount_reclaimable := ABS(v_net_difference);
  END IF;

  INSERT INTO temp_pdv_accum (row_num, base_amt, tax_amt)
  VALUES ('IV', 0, v_net_difference)
  ON CONFLICT (row_num) DO UPDATE SET tax_amt = EXCLUDED.tax_amt;

  -- 7. Insert all accumulated lines into vat_return_lines
  INSERT INTO vat_return_lines (
    vat_return_id, row_number, base_amount, tax_amount,
    base_amount_rounded, tax_amount_rounded, is_calculated, source_vat_codes
  )
  SELECT
    v_return_id,
    row_num,
    base_amt,
    tax_amt,
    ROUND(base_amt),
    ROUND(tax_amt),
    true,
    source_codes
  FROM temp_pdv_accum;

  -- Build row_data JSONB object
  SELECT jsonb_object_agg(
    row_num,
    jsonb_build_object('base', base_amt, 'tax', tax_amt)
  )
  INTO v_rows
  FROM temp_pdv_accum;

  -- 8. Update vat_returns header with totals
  UPDATE vat_returns SET
    total_payable_base = v_total_ii_base,
    total_payable_tax = v_total_ii_tax,
    total_deductible_base = v_total_iii_base,
    total_deductible_tax = v_total_iii_tax,
    net_result = v_net_difference,
    amount_to_pay = v_amount_to_pay,
    amount_reclaimable = v_amount_reclaimable,
    amount_carryforward = v_amount_reclaimable,
    row_data = v_rows,
    updated_at = now()
  WHERE id = v_return_id;

  RETURN jsonb_build_object(
    'success', true,
    'return_id', v_return_id,
    'country_code', 'HR',
    'total_exempt_base', v_total_i_base,
    'total_payable_base', v_total_ii_base,
    'total_payable_tax', v_total_ii_tax,
    'total_deductible_base', v_total_iii_base,
    'total_deductible_tax', v_total_iii_tax,
    'amount_to_pay', v_amount_to_pay,
    'amount_reclaimable', v_amount_reclaimable,
    'net_result', v_net_difference
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.calculate_croatian_vat_return(uuid, integer, integer, text) TO authenticated, service_role;


-- 2. Preserve Hungarian engine as calculate_hungarian_vat_return
-- (Copies current calculate_vat_return implementation)
CREATE OR REPLACE FUNCTION public.calculate_hungarian_vat_return(
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
    IF inv_rec.is_drs = true THEN
      CONTINUE;
    END IF;

    IF inv_rec.currency = 'HUF' THEN
      v_rate := 1.0;
    ELSE
      SELECT rate INTO v_rate
      FROM daily_exchange_rates
      WHERE currency = inv_rec.currency AND rate_date <= inv_rec.delivery_date
      ORDER BY rate_date DESC LIMIT 1;
      v_rate := COALESCE(v_rate, 1.0);
    END IF;

    v_net_huf := ROUND(inv_rec.net_amount * (inv_rec.deductible_pct / 100.0) * v_rate, 2);
    v_tax_huf := ROUND(inv_rec.vat_amount * (inv_rec.deductible_pct / 100.0) * v_rate, 2);

    v_is_paid := (inv_rec.transaction_id IS NOT NULL OR inv_rec.tx_id IS NOT NULL OR inv_rec.manual_payment_date IS NOT NULL);
    v_effective_tax_date := CASE
      WHEN (v_is_penzforgalmi OR COALESCE(inv_rec.is_cash_accounting, false) = true) AND COALESCE(inv_rec.payment_method, '') <> 'CASH'
        THEN COALESCE(inv_rec.manual_payment_date, inv_rec.transaction_date, inv_rec.delivery_date)
      ELSE inv_rec.delivery_date
    END;

    IF v_effective_tax_date BETWEEN v_date_from AND v_date_to THEN

      v_supplier_tax_num := TRIM(COALESCE(inv_rec.supplier_tax_number, ''));
      v_is_eu_supplier := (v_supplier_tax_num ~ '^[A-Z]{2}') AND (NOT v_supplier_tax_num ILIKE 'HU%');
      v_is_foreign_supplier := v_is_eu_supplier OR (inv_rec.currency <> 'HUF' AND NOT (v_supplier_tax_num ~ '^[0-9]{8}'));

      v_is_fad := (
        NOT v_is_foreign_supplier
        AND (
          inv_rec.vat_code_code ILIKE '%FAD%'
          OR inv_rec.vat_rate ILIKE '%FAD%'
          OR inv_rec.vat_rate ILIKE '%DOMESTIC_REVERSE_CHARGE%'
          OR inv_rec.vat_rate ILIKE '%ACEL%'
          OR inv_rec.vat_rate ILIKE '%HULL%'
          OR COALESCE(inv_rec.vat_row_override, '') = '29'
          OR (inv_rec.is_reverse_charge = true AND COALESCE(inv_rec.vat_amount, 0) = 0)
          OR (
            COALESCE(inv_rec.vat_amount, 0) = 0
            AND COALESCE(inv_rec.net_amount, 0) > 0
            AND (
              COALESCE(inv_rec.product_code, '') ~ '^(72|73)'
              OR COALESCE(inv_rec.line_description, '') ~* '^(72|73)[0-9]{2}'
              OR COALESCE(inv_rec.line_description, '') ~* '(acél|betonacél|zártszelvény|idomacél|gerenda|lemez|háló|fémhulladék)'
              OR COALESCE(inv_rec.net_weight_kg, 0) > 0
            )
          )
        )
      );

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
            v_calculated_fad_tax := COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
            v_line29_base := v_line29_base + v_net_huf;
            v_line29_tax  := v_line29_tax  + v_calculated_fad_tax;
            v_line66_base := v_line66_base + v_net_huf;
            v_line66_tax  := v_line66_tax  + ROUND(v_calculated_fad_tax * (inv_rec.deductible_pct / 100.0), 2);
            v_line66_fad_base := v_line66_fad_base + v_net_huf;
            v_line66_fad_tax  := v_line66_fad_tax  + ROUND(v_calculated_fad_tax * (inv_rec.deductible_pct / 100.0), 2);
          ELSIF v_override_row = '63' THEN v_line63_base := v_line63_base + v_net_huf;
          ELSIF v_override_row = '64' THEN v_line64_base := v_line64_base + v_net_huf; v_line64_tax := v_line64_tax + v_tax_huf;
          ELSIF v_override_row = '65' THEN v_line65_base := v_line65_base + v_net_huf; v_line65_tax := v_line65_tax + v_tax_huf;
          ELSIF v_override_row = '66' THEN v_line66_base := v_line66_base + v_net_huf; v_line66_tax := v_line66_tax + v_tax_huf;
          ELSIF v_override_row = '67' THEN v_line67_base := v_line67_base + v_net_huf; v_line67_tax := v_line67_tax + v_tax_huf;
          END IF;
        END LOOP;
      ELSE
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
            v_calculated_fad_tax := COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
            v_line29_base := v_line29_base + v_net_huf;
            v_line29_tax  := v_line29_tax  + v_calculated_fad_tax;
            v_line66_base := v_line66_base + v_net_huf;
            v_line66_tax  := v_line66_tax  + ROUND(v_calculated_fad_tax * (inv_rec.deductible_pct / 100.0), 2);
            v_line66_fad_base := v_line66_fad_base + v_net_huf;
            v_line66_fad_tax  := v_line66_fad_tax  + ROUND(v_calculated_fad_tax * (inv_rec.deductible_pct / 100.0), 2);
          ELSIF v_override_row = '63' THEN v_line63_base := v_line63_base + v_net_huf;
          ELSIF v_override_row = '64' THEN v_line64_base := v_line64_base + v_net_huf; v_line64_tax := v_line64_tax + v_tax_huf;
          ELSIF v_override_row = '65' THEN v_line65_base := v_line65_base + v_net_huf; v_line65_tax := v_line65_tax + v_tax_huf;
          ELSIF v_override_row = '66' THEN v_line66_base := v_line66_base + v_net_huf; v_line66_tax := v_line66_tax + v_tax_huf;
          ELSIF v_override_row = '67' THEN v_line67_base := v_line67_base + v_net_huf; v_line67_tax := v_line67_tax + v_tax_huf;
          END IF;
        ELSE
          IF inv_rec.invoice_direction = 'OUTBOUND' THEN
            IF v_is_fad THEN
              v_line04_base := v_line04_base + v_net_huf;
            ELSIF inv_rec.vat_rate IN ('27%', '0.27', '27') THEN
              v_line07_base := v_line07_base + v_net_huf;
              v_line07_tax  := v_line07_tax  + v_tax_huf;
            ELSIF inv_rec.vat_rate IN ('18%', '0.18', '18') THEN
              v_line06_base := v_line06_base + v_net_huf;
              v_line06_tax  := v_line06_tax  + v_tax_huf;
            ELSIF inv_rec.vat_rate IN ('5%', '0.05', '5') THEN
              v_line05_base := v_line05_base + v_net_huf;
              v_line05_tax  := v_line05_tax  + v_tax_huf;
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
            IF v_is_fad THEN
              v_calculated_fad_tax := COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
              v_line29_base := v_line29_base + v_net_huf;
              v_line29_tax  := v_line29_tax  + v_calculated_fad_tax;
              v_line66_base := v_line66_base + v_net_huf;
              v_line66_tax  := v_line66_tax  + ROUND(v_calculated_fad_tax * (inv_rec.deductible_pct / 100.0), 2);
              v_line66_fad_base := v_line66_fad_base + v_net_huf;
              v_line66_fad_tax  := v_line66_fad_tax  + ROUND(v_calculated_fad_tax * (inv_rec.deductible_pct / 100.0), 2);
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
    VALUES (v_return_id, '29', v_line29_base, v_line29_tax, ROUND(v_line29_base/1000)::int, ROUND(v_line29_tax/1000)::int, ARRAY['BE_FORD'], true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE
    SET base_amount = EXCLUDED.base_amount,
        tax_amount = EXCLUDED.tax_amount,
        base_amount_rounded = EXCLUDED.base_amount_rounded,
        tax_amount_rounded = EXCLUDED.tax_amount_rounded,
        source_vat_codes = EXCLUDED.source_vat_codes,
        is_calculated = EXCLUDED.is_calculated;
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

  IF v_line77_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '77', 0, v_line77_tax, 0, ROUND(v_line77_tax/1000)::int, ARRAY['TARGYI_ESZKOZ'], true);
  END IF;

  v_total_payable_base := v_line01_base + v_line02_base + v_line04_base + v_line05_base + v_line06_base + v_line07_base + v_line08_base + v_line18_base + v_line27_base + v_line29_base + v_line91_base + v_line92_base;
  v_total_payable_tax  := v_line05_tax + v_line06_tax + v_line07_tax + v_line18_tax + v_line27_tax + v_line29_tax;

  v_total_deductible_base := v_line63_base + v_line64_base + v_line65_base + v_line66_base + v_line67_base;
  v_total_deductible_tax  := v_line64_tax + v_line65_tax + v_line66_tax + v_line67_tax;

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

  WITH all_inbounds AS (
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

GRANT EXECUTE ON FUNCTION public.calculate_hungarian_vat_return(uuid, integer, integer, text) TO authenticated, service_role;


-- 3. Top-level router: calculate_vat_return
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
  v_country_code TEXT := 'HU';
BEGIN
  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hiányzó company_id');
  END IF;

  SELECT COALESCE(country_code, 'HU') INTO v_country_code
  FROM public.companies WHERE id = p_company_id;

  IF v_country_code = 'HR' THEN
    RETURN public.calculate_croatian_vat_return(p_company_id, p_year, p_month, p_frequency);
  ELSE
    RETURN public.calculate_hungarian_vat_return(p_company_id, p_year, p_month, p_frequency);
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text) TO authenticated, service_role;
