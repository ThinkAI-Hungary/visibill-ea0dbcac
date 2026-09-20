-- Migration: 20260920180000_restructure_vat_codes_and_nav65_rows.sql
-- Description: Restructure NAV 2665 VAT return row mapping, clean redundant vat_codes, add steel weight (kg) columns, and update calculate_vat_return

-- 1. Acélipari termékek (6/B. melléklet) és fordított adózás súly (kg) oszlopok
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS net_weight_kg NUMERIC;
ALTER TABLE public.nav_invoice_items ADD COLUMN IF NOT EXISTS net_weight_kg NUMERIC;

COMMENT ON COLUMN public.invoice_items.net_weight_kg IS 'Termék nettó tömege kilogrammban (pl. fordított adózású 6/B acéltermékek vagy 6/A mezőgazdasági termékek esetén)';
COMMENT ON COLUMN public.nav_invoice_items.net_weight_kg IS 'Termék nettó tömege kilogrammban (pl. fordított adózású 6/B acéltermékek vagy 6/A mezőgazdasági termékek esetén)';

-- 2. seed_default_vat_codes() frissítése a hivatalos NAV 2665 sorkiosztás szerint
CREATE OR REPLACE FUNCTION public.seed_default_vat_codes(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert default VAT codes with exact NAV 65 target_rows mappings:
  -- Sor 07: Belföldi 27%
  -- Sor 06: Belföldi 18%
  -- Sor 05: Belföldi 5%
  -- Sor 04: Belföldi fordított értékesítés (mentes)
  -- Sor 01: Közösség területén kívülre történő termékértékesítés (3. országos export)
  -- Sor 02: Közösségen belüli adómentes termékértékesítés
  -- Sor 08: Közérdekű vagy speciális jellegére tekintettel adómentes (TAM - egészségügy, oktatás, fogorvos, bérbeadás)
  -- Sor 91: ÁFA területi hatályán kívüli SZOLGÁLTATÁSOK (3. ország)
  -- Sor 92: ÁFA területi hatályán kívüli EU SZOLGÁLTATÁSOK (Áfa tv. 37. §)
  -- Sor 66: Levonható 27% ÁFA
  -- Sor 65: Levonható 18% ÁFA
  -- Sor 64: Levonható 5% ÁFA
  -- Sor 63: Belföldi adómentes beszerzés
  INSERT INTO vat_codes (company_id, code, label, vat_percent, direction, is_deductible, is_reverse_charge, is_eu, sort_order, target_rows)
  VALUES
    (p_company_id, 'KIM_27',       'Belföldi 27% ÁFA', 27, 'OUTBOUND', false, false, false, 10,
     '[{"row": "07", "col": "tax"}, {"row": "07", "col": "base"}]'::jsonb),
    (p_company_id, 'KIM_18',       'Belföldi 18% ÁFA', 18, 'OUTBOUND', false, false, false, 20,
     '[{"row": "06", "col": "tax"}, {"row": "06", "col": "base"}]'::jsonb),
    (p_company_id, 'KIM_5',        'Belföldi 5% ÁFA', 5, 'OUTBOUND', false, false, false, 30,
     '[{"row": "05", "col": "tax"}, {"row": "05", "col": "base"}]'::jsonb),
    (p_company_id, 'KIM_FORD',     'Belföldi fordított értékesítés (mentes)', 0, 'OUTBOUND', false, true, false, 35,
     '[{"row": "04", "col": "base"}]'::jsonb),
    (p_company_id, 'KIM_EXPORT',   'Termékexport 3. országba (mentes)', 0, 'OUTBOUND', false, false, false, 40,
     '[{"row": "01", "col": "base"}]'::jsonb),
    (p_company_id, 'KIM_EU',       'Közösségen belüli adómentes termékértékesítés', 0, 'OUTBOUND', false, false, true, 42,
     '[{"row": "02", "col": "base"}]'::jsonb),
    (p_company_id, 'KIM_TAM',      'Közérdekű vagy speciális adómentes (TAM)', 0, 'OUTBOUND', false, false, false, 44,
     '[{"row": "08", "col": "base"}]'::jsonb),
    (p_company_id, 'KIM_ATHK',     'ÁFA területi hatályán kívüli SZOLGÁLTATÁSOK (3. ország)', 0, 'OUTBOUND', false, false, false, 48,
     '[{"row": "91", "col": "base"}]'::jsonb),
    (p_company_id, 'KIM_EU_SZOLG', 'ÁFA területi hatályán kívüli EU SZOLGÁLTATÁSOK (Áfa tv. 37.§)', 0, 'OUTBOUND', false, false, true, 50,
     '[{"row": "92", "col": "base"}]'::jsonb),
    (p_company_id, 'BE_27_LEV',    'Levonható 27% ÁFA', 27, 'INBOUND', true, false, false, 100,
     '[{"row": "66", "col": "tax"}, {"row": "66", "col": "base"}]'::jsonb),
    (p_company_id, 'BE_18_LEV',    'Levonható 18% ÁFA', 18, 'INBOUND', true, false, false, 110,
     '[{"row": "65", "col": "tax"}, {"row": "65", "col": "base"}]'::jsonb),
    (p_company_id, 'BE_5_LEV',     'Levonható 5% ÁFA', 5, 'INBOUND', true, false, false, 120,
     '[{"row": "64", "col": "tax"}, {"row": "64", "col": "base"}]'::jsonb),
    (p_company_id, 'BE_0_LEV',     'Adómentes belföldi beszerzés (mentes)', 0, 'INBOUND', true, false, false, 130,
     '[{"row": "63", "col": "base"}]'::jsonb),
    (p_company_id, 'BE_FORD_27',   'FAD Építőipari / fordított adózás 27%', 27, 'INBOUND', true, true, false, 200,
     '[{"row": "29", "col": "base"}, {"row": "29", "col": "tax"}, {"row": "66", "col": "base"}, {"row": "66", "col": "tax"}]'::jsonb),
    (p_company_id, 'EU_SZOLG_BE',  'EU szolgáltatás igénybevétel 27%', 27, 'INBOUND', true, false, true, 300,
     '[{"row": "18", "col": "base"}, {"row": "18", "col": "tax"}, {"row": "67", "col": "base"}, {"row": "67", "col": "tax"}]'::jsonb),
    (p_company_id, 'EU_TERM_27',   'EU termékbeszerzés 27%', 27, 'INBOUND', true, false, true, 310,
     '[{"row": "14", "col": "base"}, {"row": "14", "col": "tax"}, {"row": "69", "col": "base"}, {"row": "69", "col": "tax"}]'::jsonb),
    (p_company_id, 'EU_TERM_18',   'EU termékbeszerzés 18%', 18, 'INBOUND', true, false, true, 320,
     '[{"row": "13", "col": "base"}, {"row": "13", "col": "tax"}, {"row": "69", "col": "base"}, {"row": "69", "col": "tax"}]'::jsonb),
    (p_company_id, 'EU_TERM_5',    'EU termékbeszerzés 5%', 5, 'INBOUND', true, false, true, 330,
     '[{"row": "12", "col": "base"}, {"row": "12", "col": "tax"}, {"row": "69", "col": "base"}, {"row": "69", "col": "tax"}]'::jsonb),
    (p_company_id, 'HARM_SZOLG',   '3. ország szolgáltatás igénybevétel 27%', 27, 'INBOUND', true, false, false, 400,
     '[{"row": "27", "col": "base"}, {"row": "27", "col": "tax"}, {"row": "67", "col": "base"}, {"row": "67", "col": "tax"}]'::jsonb)
  ON CONFLICT (company_id, code) DO UPDATE SET
    label = EXCLUDED.label,
    target_rows = EXCLUDED.target_rows,
    vat_percent = EXCLUDED.vat_percent,
    direction = EXCLUDED.direction,
    is_deductible = EXCLUDED.is_deductible,
    is_reverse_charge = EXCLUDED.is_reverse_charge,
    is_eu = EXCLUDED.is_eu,
    sort_order = EXCLUDED.sort_order;
END;
$function$;

-- 3. seed_fad_vat_codes() frissítése — 29 és 66 sorok, FAD_EPIT_5 törölve
CREATE OR REPLACE FUNCTION public.seed_fad_vat_codes(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO vat_codes (company_id, code, label, vat_percent, direction, is_deductible, is_reverse_charge, is_eu, target_rows, sort_order, fad_category)
  VALUES
    -- Építőipari FAD (142.§ (1) a-b) -> 29 és 66 sorok
    (p_company_id, 'FAD_EPIT_27', 'FAD Építőipari 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"66","col":"base"},{"row":"66","col":"tax"}]'::jsonb, 201, 'construction'),

    -- Hulladék FAD (6. melléklet) -> 29 és 66 sorok
    (p_company_id, 'FAD_HULL_27', 'FAD Hulladék 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"66","col":"base"},{"row":"66","col":"tax"}]'::jsonb, 211, 'scrap_metal'),

    -- Mezőgazdasági FAD (6/A melléklet) -> 29 és 66 sorok
    (p_company_id, 'FAD_MEZO_27', 'FAD Mezőgazdaság 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"66","col":"base"},{"row":"66","col":"tax"}]'::jsonb, 221, 'agriculture'),

    -- Acélipari FAD (6/B melléklet) -> 29 és 66 sorok
    (p_company_id, 'FAD_ACEL_27', 'FAD Acélipari 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"66","col":"base"},{"row":"66","col":"tax"}]'::jsonb, 231, 'steel'),

    -- Földgáz FAD -> 29 és 66 sorok
    (p_company_id, 'FAD_GAZ_27',  'FAD Földgáz 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"66","col":"base"},{"row":"66","col":"tax"}]'::jsonb, 241, 'natural_gas'),

    -- Munkaerő-kölcsönzés (építőipari) -> 29 és 66 sorok
    (p_company_id, 'FAD_MUNKA_27','FAD Munkaerő-kölcsönzés 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"66","col":"base"},{"row":"66","col":"tax"}]'::jsonb, 251, 'labor_hire')
  ON CONFLICT (company_id, code) DO UPDATE SET
    label = EXCLUDED.label,
    target_rows = EXCLUDED.target_rows,
    vat_percent = EXCLUDED.vat_percent,
    direction = EXCLUDED.direction,
    is_deductible = EXCLUDED.is_deductible,
    is_reverse_charge = EXCLUDED.is_reverse_charge,
    is_eu = EXCLUDED.is_eu,
    sort_order = EXCLUDED.sort_order,
    fad_category = EXCLUDED.fad_category;
END;
$function$;

-- 4. Meglévő adatok konszolidációja és tisztítása
-- A) BE_18, BE_5, BE_27 migrációja BE_18_LEV, BE_5_LEV, BE_27_LEV-re ha volt rá hivatkozás
DO $$
DECLARE
  r RECORD;
  v_target_id UUID;
BEGIN
  -- 1. Konszolidáljuk az esetleges számla-hivatkozásokat
  FOR r IN SELECT id, company_id, code FROM vat_codes WHERE code IN ('BE_18', 'BE_5', 'BE_27') LOOP
    SELECT id INTO v_target_id FROM vat_codes WHERE company_id = r.company_id AND code = r.code || '_LEV' LIMIT 1;
    IF v_target_id IS NOT NULL THEN
      UPDATE nav_invoices SET vat_code_id = v_target_id WHERE vat_code_id = r.id;
      UPDATE invoices SET vat_code_id = v_target_id WHERE vat_code_id = r.id;
    END IF;
  END LOOP;

  -- 2. Töröljük a redundáns és hibás kódokat
  DELETE FROM vat_codes WHERE code IN ('BE_18', 'BE_5', 'BE_27', 'BE_0_NEM', 'FAD_EPIT_5', 'BE_FORD_5', 'KIM_0', 'BE_0');

  -- 3. Futtassuk le az új seedelést minden cégre
  FOR r IN SELECT id FROM companies LOOP
    PERFORM seed_default_vat_codes(r.id);
    PERFORM seed_fad_vat_codes(r.id);
  END LOOP;
END $$;

-- 5. calculate_vat_return frissítése a hivatalos sorok (05, 06, 08, 01, 04, 29, 66) pontos kalkulációjához
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
  v_total_payable_base NUMERIC := 0;
  v_total_payable_tax NUMERIC := 0;
  v_total_deductible_base NUMERIC := 0;
  v_total_deductible_tax NUMERIC := 0;
  v_prev_carry NUMERIC := 0;
  v_net_tax_balance NUMERIC := 0;
  v_company_vat_regime TEXT := 'normal';
  v_is_penzforgalmi BOOLEAN := false;

  -- Detail row accumulators
  v_line01_base NUMERIC := 0; -- 3. ország export (mentes)
  v_line02_base NUMERIC := 0; -- EU mentes értékesítés
  v_line04_base NUMERIC := 0; -- Fordított értékesítés (mentes)
  v_line05_base NUMERIC := 0; v_line05_tax NUMERIC := 0; -- 5% értékesítés
  v_line06_base NUMERIC := 0; v_line06_tax NUMERIC := 0; -- 18% értékesítés
  v_line07_base NUMERIC := 0; v_line07_tax NUMERIC := 0; -- 27% értékesítés
  v_line08_base NUMERIC := 0; -- TAM mentes (egészségügy, oktatás, fogorvos, bérbeadás)
  v_line45_base NUMERIC := 0; -- Előleg
  v_line91_base NUMERIC := 0; -- ÁFA hatályon kívüli szolgáltatások (3. ország)
  v_line92_base NUMERIC := 0; -- ÁFA hatályon kívüli EU szolgáltatások (Áfa tv. 37.§)
  v_line18_base NUMERIC := 0; v_line18_tax NUMERIC := 0; -- EU szolgáltatás igénybevétel
  v_line27_base NUMERIC := 0; v_line27_tax NUMERIC := 0; -- 3. ország szolgáltatás igénybevétel
  v_line29_base NUMERIC := 0; v_line29_tax NUMERIC := 0; -- Fordított adózású beszerzés fizetendő

  v_line63_base NUMERIC := 0; -- Adómentes beszerzés
  v_line64_base NUMERIC := 0; v_line64_tax NUMERIC := 0; -- 5% levonható
  v_line65_base NUMERIC := 0; v_line65_tax NUMERIC := 0; -- 18% levonható
  v_line66_base NUMERIC := 0; v_line66_tax NUMERIC := 0; -- 27% levonható (+ belföldi fordított levonható)
  v_line67_base NUMERIC := 0; v_line67_tax NUMERIC := 0; -- Külföldi szolgáltatás / egyéb fordított levonható
  v_line77_tax  NUMERIC := 0; -- Tárgyi eszköz levonható
  v_line85_tax  NUMERIC := 0;
  v_line86_tax  NUMERIC := 0;

  inv_rec RECORD;
  v_effective_tax_date DATE;
  v_is_paid BOOLEAN;
  v_is_settled BOOLEAN;
  v_rate NUMERIC;
  v_net_huf NUMERIC;
  v_tax_huf NUMERIC;
  v_supplier_tax_num TEXT;
  v_customer_tax_num TEXT;
  v_is_eu_partner BOOLEAN;
  v_is_eu_supplier BOOLEAN;
  v_is_foreign_supplier BOOLEAN;
  v_override_row TEXT;
  v_prev_month INT;
  v_prev_year INT;
BEGIN
  -- 1. Auto-seed VAT codes if not yet seeded
  IF NOT EXISTS (SELECT 1 FROM vat_codes WHERE company_id = p_company_id LIMIT 1) THEN
    PERFORM seed_default_vat_codes(p_company_id);
    PERFORM seed_fad_vat_codes(p_company_id);
  END IF;

  -- 2. Determine company regime
  SELECT COALESCE(vat_regime, 'normal') INTO v_company_vat_regime
  FROM companies WHERE id = p_company_id;
  v_is_penzforgalmi := (v_company_vat_regime = 'penzforgalmi');

  -- 3. Calculate date bounds
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
      vc.target_rows AS vat_code_target_rows
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

    IF v_effective_tax_date BETWEEN v_date_from AND v_date_to THEN
      IF (v_is_penzforgalmi OR COALESCE(inv_rec.is_cash_accounting, false) = true) AND COALESCE(inv_rec.payment_method, '') <> 'CASH' THEN
        v_is_settled := v_is_paid;
      ELSE
        v_is_settled := true;
      END IF;

      IF v_is_settled THEN
        v_override_row := TRIM(COALESCE(inv_rec.vat_row_override, ''));

        -- PRIORITY 1: Explicit target_rows from assigned vat_code or override
        IF v_override_row = '01' THEN
          v_line01_base := v_line01_base + v_net_huf;
        ELSIF v_override_row = '02' THEN
          v_line02_base := v_line02_base + v_net_huf;
        ELSIF v_override_row = '04' THEN
          v_line04_base := v_line04_base + v_net_huf;
        ELSIF v_override_row = '05' THEN
          v_line05_base := v_line05_base + v_net_huf;
          v_line05_tax  := v_line05_tax  + v_tax_huf;
        ELSIF v_override_row = '06' THEN
          v_line06_base := v_line06_base + v_net_huf;
          v_line06_tax  := v_line06_tax  + v_tax_huf;
        ELSIF v_override_row = '07' THEN
          v_line07_base := v_line07_base + v_net_huf;
          v_line07_tax  := v_line07_tax  + v_tax_huf;
        ELSIF v_override_row = '08' THEN
          v_line08_base := v_line08_base + v_net_huf;
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
          v_line67_base := v_line67_base + v_net_huf;
          v_line67_tax  := v_line67_tax  + v_tax_huf;
        ELSIF v_override_row = '27' THEN
          v_line27_base := v_line27_base + v_net_huf;
          v_line27_tax  := v_line27_tax  + v_tax_huf;
          v_line67_base := v_line67_base + v_net_huf;
          v_line67_tax  := v_line67_tax  + v_tax_huf;
        ELSIF v_override_row = '29' THEN
          v_line29_base := v_line29_base + v_net_huf;
          v_line29_tax  := v_line29_tax  + COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
          v_line66_base := v_line66_base + v_net_huf;
          v_line66_tax  := v_line66_tax  + COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
        ELSIF v_override_row = '63' THEN
          v_line63_base := v_line63_base + v_net_huf;
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
          -- PRIORITY 2: Fallback logic based on invoice direction and rate
          IF inv_rec.invoice_direction = 'OUTBOUND' THEN
            v_customer_tax_num := TRIM(COALESCE(inv_rec.customer_tax_number, ''));
            v_is_eu_partner := v_customer_tax_num ~ '^[A-Z]{2}' AND NOT v_customer_tax_num LIKE 'HU%';

            IF v_is_eu_partner AND (v_tax_huf = 0 OR inv_rec.vat_rate IN ('0%','EU','EUK')) THEN
              v_line92_base := v_line92_base + v_net_huf;
            ELSIF inv_rec.vat_rate IN ('FAD','FORD','FORDITOTT') OR inv_rec.is_reverse_charge THEN
              v_line04_base := v_line04_base + v_net_huf;
            ELSIF inv_rec.vat_rate IN ('TAM','MENTES_EGYEB') THEN
              v_line08_base := v_line08_base + v_net_huf;
            ELSIF inv_rec.vat_rate IN ('AAM','0%','MENTES','EXP','EXPORT') OR v_tax_huf = 0 THEN
              -- Default 0% outbound to TAM or Export depending on partner
              IF v_customer_tax_num = '' OR v_customer_tax_num LIKE 'HU%' THEN
                v_line08_base := v_line08_base + v_net_huf;
              ELSE
                v_line01_base := v_line01_base + v_net_huf;
              END IF;
            ELSIF inv_rec.vat_rate IN ('0.05','5','5.0','5.00','5%') THEN
              v_line05_base := v_line05_base + v_net_huf;
              v_line05_tax  := v_line05_tax  + v_tax_huf;
            ELSIF inv_rec.vat_rate IN ('0.18','18','18.0','18.00','18%') THEN
              v_line06_base := v_line06_base + v_net_huf;
              v_line06_tax  := v_line06_tax  + v_tax_huf;
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

            IF inv_rec.is_reverse_charge OR inv_rec.vat_rate IN ('DOMESTIC_REVERSE_CHARGE','FAD','BE_FORD_27') THEN
              -- Domestic reverse charge: row 29 payable AND row 66 deductible
              v_line29_base := v_line29_base + v_net_huf;
              v_line29_tax  := v_line29_tax  + COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
              v_line66_base := v_line66_base + v_net_huf;
              v_line66_tax  := v_line66_tax  + COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
            ELSIF v_is_eu_supplier THEN
              v_line18_base := v_line18_base + v_net_huf;
              v_line18_tax  := v_line18_tax  + COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
              v_line67_base := v_line67_base + v_net_huf;
              v_line67_tax  := v_line67_tax  + COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
            ELSIF v_is_foreign_supplier THEN
              v_line27_base := v_line27_base + v_net_huf;
              v_line27_tax  := v_line27_tax  + COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
              v_line67_base := v_line67_base + v_net_huf;
              v_line67_tax  := v_line67_tax  + COALESCE(NULLIF(v_tax_huf, 0), ROUND(v_net_huf * 0.27, 2));
            ELSIF inv_rec.vat_rate IN ('0.05','5','5.0','5.00','5%') THEN
              v_line64_base := v_line64_base + v_net_huf;
              v_line64_tax  := v_line64_tax  + v_tax_huf;
            ELSIF inv_rec.vat_rate IN ('0.18','18','18.0','18.00','18%') THEN
              v_line65_base := v_line65_base + v_net_huf;
              v_line65_tax  := v_line65_tax  + v_tax_huf;
            ELSIF inv_rec.vat_rate IN ('0%','AAM','TAM','MENTES') OR v_tax_huf = 0 THEN
              v_line63_base := v_line63_base + v_net_huf;
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

  -- 7. Insert Calculated Rows into vat_return_lines
  -- Page 1: Payable VAT
  IF v_line01_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '01', v_line01_base, 0, ROUND(v_line01_base/1000)::int, 0, ARRAY['EXP'], true);
  END IF;

  IF v_line02_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '02', v_line02_base, 0, ROUND(v_line02_base/1000)::int, 0, ARRAY['EU'], true);
  END IF;

  IF v_line04_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '04', v_line04_base, 0, ROUND(v_line04_base/1000)::int, 0, ARRAY['FAD_KIM'], true);
  END IF;

  IF v_line05_base > 0 OR v_line05_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '05', v_line05_base, v_line05_tax, ROUND(v_line05_base/1000)::int, ROUND(v_line05_tax/1000)::int, ARRAY['5%'], true);
  END IF;

  IF v_line06_base > 0 OR v_line06_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '06', v_line06_base, v_line06_tax, ROUND(v_line06_base/1000)::int, ROUND(v_line06_tax/1000)::int, ARRAY['18%'], true);
  END IF;

  IF v_line07_base > 0 OR v_line07_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '07', v_line07_base, v_line07_tax, ROUND(v_line07_base/1000)::int, ROUND(v_line07_tax/1000)::int, ARRAY['27%'], true);
  END IF;

  IF v_line08_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '08', v_line08_base, 0, ROUND(v_line08_base/1000)::int, 0, ARRAY['TAM'], true);
  END IF;

  IF v_line18_base > 0 OR v_line18_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '18', v_line18_base, v_line18_tax, ROUND(v_line18_base/1000)::int, ROUND(v_line18_tax/1000)::int, ARRAY['EU_SZOLG'], true);
  END IF;

  IF v_line27_base > 0 OR v_line27_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '27', v_line27_base, v_line27_tax, ROUND(v_line27_base/1000)::int, ROUND(v_line27_tax/1000)::int, ARRAY['HARM_SZOLG'], true);
  END IF;

  IF v_line29_base > 0 OR v_line29_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '29', v_line29_base, v_line29_tax, ROUND(v_line29_base/1000)::int, ROUND(v_line29_tax/1000)::int, ARRAY['FAD_BE'], true);
  END IF;

  IF v_line45_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '45', v_line45_base, 0, ROUND(v_line45_base/1000)::int, 0, ARRAY['ELOLEG'], true);
  END IF;

  IF v_line91_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '91', v_line91_base, 0, ROUND(v_line91_base/1000)::int, 0, ARRAY['ATHK'], true);
  END IF;

  IF v_line92_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '92', v_line92_base, 0, ROUND(v_line92_base/1000)::int, 0, ARRAY['EU_SZOLG_EXP'], true);
  END IF;

  -- Page 2: Deductible VAT
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

  IF v_line67_base > 0 OR v_line67_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '67', v_line67_base, v_line67_tax, ROUND(v_line67_base/1000)::int, ROUND(v_line67_tax/1000)::int, ARRAY['KULF_SZOLG'], true);
  END IF;

  IF v_line77_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '77', 0, v_line77_tax, 0, ROUND(v_line77_tax/1000)::int, ARRAY['TARGYESZKOZ'], true);
  END IF;

  IF v_prev_carry > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '82', 0, v_prev_carry, 0, ROUND(v_prev_carry/1000)::int, ARRAY['GONGYOLT'], true);
  END IF;

  -- Calculate Totals
  v_total_payable_base := v_line01_base + v_line02_base + v_line04_base + v_line05_base + v_line06_base + v_line07_base + v_line08_base + v_line18_base + v_line27_base + v_line29_base;
  v_total_payable_tax  := v_line05_tax + v_line06_tax + v_line07_tax + v_line18_tax + v_line27_tax + v_line29_tax;

  v_total_deductible_base := v_line63_base + v_line64_base + v_line65_base + v_line66_base + v_line67_base;
  v_total_deductible_tax  := v_line64_tax + v_line65_tax + v_line66_tax + v_line67_tax;

  -- Line 36 (Összes fizetendő adó)
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '36', v_total_payable_base, v_total_payable_tax, ROUND(v_total_payable_base/1000)::int, ROUND(v_total_payable_tax/1000)::int, true);

  -- Line 76 (Összes levonható adó)
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '76', v_total_deductible_base, v_total_deductible_tax, ROUND(v_total_deductible_base/1000)::int, ROUND(v_total_deductible_tax/1000)::int, true);

  -- Balance Calculation
  v_net_tax_balance := v_total_payable_tax - v_total_deductible_tax;

  -- Line 83 (Különbözet / nettó egyenleg)
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

  -- Populate 65M Domestic Partner Summary lines (vat_return_m_lines)
  INSERT INTO vat_return_m_lines (
    vat_return_id, partner_name, partner_tax_number,
    invoice_count, base_amount, tax_amount,
    base_amount_rounded, tax_amount_rounded,
    tax_27_amount, tax_18_amount, tax_5_amount,
    invoice_details
  )
  SELECT
    v_return_id,
    COALESCE(ni.supplier_name, 'Ismeretlen partner'),
    SUBSTRING(TRIM(ni.supplier_tax_number) FROM 1 FOR 8),
    COUNT(DISTINCT ni.id),
    SUM(ROUND(COALESCE(nii.net_amount, ni.invoice_net_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2)),
    SUM(ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2)),
    ROUND(SUM(ROUND(COALESCE(nii.net_amount, ni.invoice_net_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2)) / 1000)::int,
    ROUND(SUM(ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2)) / 1000)::int,
    SUM(CASE WHEN COALESCE(nii.vat_rate, '') IN ('27%','0.27','27') THEN ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2) ELSE 0 END),
    SUM(CASE WHEN COALESCE(nii.vat_rate, '') IN ('18%','0.18','18') THEN ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2) ELSE 0 END),
    SUM(CASE WHEN COALESCE(nii.vat_rate, '') IN ('5%','0.05','5') THEN ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2) ELSE 0 END),
    jsonb_agg(
      jsonb_build_object(
        'invoice_number', ni.invoice_number,
        'delivery_date', ni.invoice_delivery_date,
        'issue_date', ni.invoice_issue_date,
        'net', ROUND(COALESCE(nii.net_amount, ni.invoice_net_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2),
        'vat', ROUND(COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0) * (COALESCE(nii.deductible_percentage, 100.0) / 100.0) * COALESCE(er.rate, 1.0), 2),
        'gross', ROUND((COALESCE(nii.net_amount, ni.invoice_net_amount, 0) + COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0)) * COALESCE(er.rate, 1.0), 2),
        'amount_unit', 'HUF',
        'is_e_ft', false
      )
    )
  FROM nav_invoices ni
  LEFT JOIN nav_invoice_items nii ON nii.nav_invoice_id = ni.id
  LEFT JOIN LATERAL (
    SELECT rate FROM daily_exchange_rates
    WHERE currency = ni.currency AND rate_date <= COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date)
    ORDER BY rate_date DESC LIMIT 1
  ) er ON true
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = 'INBOUND'
    AND COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date) BETWEEN v_date_from AND v_date_to
    AND TRIM(COALESCE(ni.supplier_tax_number, '')) ~ '^[0-9]{8}'
    AND COALESCE(ni.invoice_vat_amount, 0) > 0
  GROUP BY ni.supplier_name, SUBSTRING(TRIM(ni.supplier_tax_number) FROM 1 FOR 8);

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
