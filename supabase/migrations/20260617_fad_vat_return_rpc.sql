-- ============================================================
-- FAD FIX: Kategória-alapú szűrés a calculate_vat_return-ben
-- ============================================================
-- Probléma: Minden FAD vat_code az ÖSSZES is_reverse_charge=true
-- tételt megtalálja, nem csak a saját kategóriáját.
-- Fix: fad_category oszlop + szűrés a query-ben.
-- ============================================================

-- 1. vat_codes bővítés: fad_category oszlop
ALTER TABLE public.vat_codes
  ADD COLUMN IF NOT EXISTS fad_category TEXT;

COMMENT ON COLUMN public.vat_codes.fad_category IS
  'FAD kategória: construction, scrap_metal, agriculture, steel, natural_gas, labor_hire, emission_quota, grain_oilseed. NULL ha nem FAD kód.';

-- 2. Meglévő FAD kódok frissítése
UPDATE public.vat_codes SET fad_category = 'construction'     WHERE code LIKE 'FAD_EPIT_%';
UPDATE public.vat_codes SET fad_category = 'scrap_metal'      WHERE code LIKE 'FAD_HULL_%';
UPDATE public.vat_codes SET fad_category = 'agriculture'      WHERE code LIKE 'FAD_MEZO_%';
UPDATE public.vat_codes SET fad_category = 'steel'            WHERE code LIKE 'FAD_ACEL_%';
UPDATE public.vat_codes SET fad_category = 'natural_gas'      WHERE code LIKE 'FAD_GAZ_%';
UPDATE public.vat_codes SET fad_category = 'labor_hire'       WHERE code LIKE 'FAD_MUNKA_%';
UPDATE public.vat_codes SET fad_category = 'emission_quota'   WHERE code LIKE 'FAD_KVOTA_%';

-- 3. seed_fad_vat_codes() frissítése — mostantól fad_category-val
CREATE OR REPLACE FUNCTION seed_fad_vat_codes(p_company_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO vat_codes (company_id, code, label, vat_percent, direction, is_deductible, is_reverse_charge, is_eu, target_rows, sort_order, fad_category)
  VALUES
    -- Építőipari FAD (142.§ (1) a-b)
    (p_company_id, 'FAD_EPIT_27', 'FAD Építőipari 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 201, 'construction'),
    (p_company_id, 'FAD_EPIT_5',  'FAD Építőipari 5%',   5.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 202, 'construction'),

    -- Hulladék FAD (6. melléklet)
    (p_company_id, 'FAD_HULL_27', 'FAD Hulladék 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"30","col":"base"},{"row":"30","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 211, 'scrap_metal'),

    -- Mezőgazdasági FAD (6/A melléklet)
    (p_company_id, 'FAD_MEZO_27', 'FAD Mezőgazdaság 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"31","col":"base"},{"row":"31","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 221, 'agriculture'),
    (p_company_id, 'FAD_MEZO_5',  'FAD Mezőgazdaság 5%',   5.00, 'INBOUND', true, true, false,
     '[{"row":"31","col":"base"},{"row":"31","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 222, 'agriculture'),

    -- Acélipari FAD (6/B melléklet)
    (p_company_id, 'FAD_ACEL_27', 'FAD Acélipari 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"32","col":"base"},{"row":"32","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 231, 'steel'),

    -- Földgáz FAD
    (p_company_id, 'FAD_GAZ_27',  'FAD Földgáz 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"33","col":"base"},{"row":"33","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 241, 'natural_gas'),

    -- Munkaerő-kölcsönzés (építőipari)
    (p_company_id, 'FAD_MUNKA_27','FAD Munkaerő-kölcsönzés 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 251, 'labor_hire'),

    -- Üvegházhatású gáz kvóta
    (p_company_id, 'FAD_KVOTA_27','FAD Kibocsátási kvóta 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 261, 'emission_quota')

  ON CONFLICT (company_id, code) DO UPDATE SET
    fad_category = EXCLUDED.fad_category;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.seed_fad_vat_codes FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_fad_vat_codes TO authenticated;


-- 4. calculate_vat_return JAVÍTOTT verzió — kategória szűréssel
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
  v_processed_fad_cats TEXT[] := '{}';  -- Track processed FAD categories
BEGIN
  -- 1. Calculate date range
  IF p_frequency = 'H' THEN
    v_date_from := make_date(p_year, p_month, 1);
    v_date_to := (v_date_from + INTERVAL '1 month' - INTERVAL '1 day')::date;
  ELSE
    v_date_from := make_date(p_year, (p_month - 1) * 3 + 1, 1);
    v_date_to := (v_date_from + INTERVAL '3 months' - INTERVAL '1 day')::date;
  END IF;

  -- 2. Upsert vat_returns header
  SELECT id INTO v_return_id
  FROM vat_returns
  WHERE company_id = p_company_id
    AND period_year = p_year
    AND period_month = p_month
    AND frequency = p_frequency;

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

  -- 4. Get previous period carryforward
  SELECT COALESCE(amount_carryforward, 0) INTO v_prev_carry
  FROM vat_returns
  WHERE company_id = p_company_id
    AND frequency = p_frequency
    AND period_year = CASE WHEN p_month = 1 THEN p_year - 1 ELSE p_year END
    AND period_month = CASE WHEN p_month = 1 THEN (CASE WHEN p_frequency = 'H' THEN 12 ELSE 4 END) ELSE p_month - 1 END
    AND id != v_return_id
  LIMIT 1;

  -- 5. For each VAT code, aggregate from nav_invoice_items
  FOR v_code IN
    SELECT * FROM vat_codes WHERE company_id = p_company_id ORDER BY sort_order
  LOOP
    IF v_code.is_reverse_charge THEN
      -- ═══════════════════════════════════════════════════════
      -- FAD ESET: fordított adózású tételek — KATEGÓRIA SZŰRÉSSEL
      -- Egy kategóriát csak EGYSZER dolgozunk fel (az első kód,
      -- ami sort_order szerint a 27%-os default).
      -- ═══════════════════════════════════════════════════════

      -- Skip ha ezt a kategóriát már feldolgoztuk
      IF v_code.fad_category IS NOT NULL AND v_code.fad_category = ANY(v_processed_fad_cats) THEN
        CONTINUE;
      END IF;

      SELECT
        COALESCE(SUM(nii.net_amount), 0),
        0
      INTO v_base, v_tax
      FROM nav_invoice_items nii
      JOIN nav_invoices ni ON ni.id = nii.nav_invoice_id
      WHERE ni.company_id = p_company_id
        AND ni.invoice_direction = 'INBOUND'
        AND ni.invoice_delivery_date::date >= v_date_from
        AND ni.invoice_delivery_date::date <= v_date_to
        AND ni.is_reverse_charge = true
        AND nii.vat_rate IN ('0', '0.0', '0.00', 'DOMESTIC_REVERSE_CHARGE', 'FAD')
        AND (
          v_code.fad_category IS NULL
          OR ni.reverse_charge_category = v_code.fad_category
        );

      IF v_base = 0 THEN
        CONTINUE;
      END IF;

      -- Kategória feldolgozottnak jelölése
      IF v_code.fad_category IS NOT NULL THEN
        v_processed_fad_cats := v_processed_fad_cats || v_code.fad_category;
      END IF;

      -- FAD: recalculate tax from base
      v_tax := ROUND(v_base * v_code.vat_percent / 100, 2);

    ELSE
      -- ═══════════════════════════════════════════════════════
      -- NORMÁL ESET
      -- ═══════════════════════════════════════════════════════
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
          (nii.vat_rate IS NOT NULL AND (
            (v_code.vat_percent = 27 AND nii.vat_rate IN ('0.27', '27', '27.0', '27.00')) OR
            (v_code.vat_percent = 18 AND nii.vat_rate IN ('0.18', '18', '18.0', '18.00')) OR
            (v_code.vat_percent = 5  AND nii.vat_rate IN ('0.05', '5', '5.0', '5.00')) OR
            (v_code.vat_percent = 0  AND nii.vat_rate IN ('0', '0.0', '0.00', 'TAM', 'AAM'))
          ))
        )
        -- Kizárjuk a FAD tételeket a normál kódokból
        AND (ni.is_reverse_charge IS NULL OR ni.is_reverse_charge = false)
        AND nii.vat_rate NOT IN ('DOMESTIC_REVERSE_CHARGE', 'FAD');

      IF v_base = 0 AND v_tax = 0 THEN
        CONTINUE;
      END IF;
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

  -- Summary row 36
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '36', v_total_payable_base, v_total_payable_tax, ROUND(v_total_payable_base/1000)::int, ROUND(v_total_payable_tax/1000)::int, true)
  ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
    base_amount = EXCLUDED.base_amount, tax_amount = EXCLUDED.tax_amount,
    base_amount_rounded = EXCLUDED.base_amount_rounded, tax_amount_rounded = EXCLUDED.tax_amount_rounded, is_calculated = true;

  -- Summary row 76
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

  -- Row 83: net
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
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
    VALUES (v_return_id, '86', 0, ABS(v_net), 0, ROUND(ABS(v_net)/1000)::int, true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
      tax_amount = EXCLUDED.tax_amount, tax_amount_rounded = EXCLUDED.tax_amount_rounded;
  END IF;

  -- 7. M-LAP
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
    COALESCE(SUM(
      CASE
        WHEN ni.is_reverse_charge = true AND (nii.vat_amount IS NULL OR nii.vat_amount = 0)
          THEN ROUND(nii.net_amount * 0.27, 2)
        ELSE nii.vat_amount
      END
    ), 0),
    ROUND(COALESCE(SUM(nii.net_amount), 0) / 1000)::int,
    ROUND(COALESCE(SUM(
      CASE
        WHEN ni.is_reverse_charge = true AND (nii.vat_amount IS NULL OR nii.vat_amount = 0)
          THEN ROUND(nii.net_amount * 0.27, 2)
        ELSE nii.vat_amount
      END
    ), 0) / 1000)::int,
    COALESCE(SUM(CASE WHEN nii.vat_rate IN ('0.05','5','5.0','5.00') THEN nii.vat_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN nii.vat_rate IN ('0.18','18','18.0','18.00') THEN nii.vat_amount ELSE 0 END), 0),
    COALESCE(SUM(
      CASE
        WHEN nii.vat_rate IN ('0.27','27','27.0','27.00') THEN nii.vat_amount
        WHEN ni.is_reverse_charge = true AND nii.vat_rate IN ('DOMESTIC_REVERSE_CHARGE','FAD','0','0.0','0.00')
          THEN ROUND(nii.net_amount * 0.27, 2)
        ELSE 0
      END
    ), 0),
    (SELECT jsonb_agg(inv_summary ORDER BY inv_summary->>'delivery_date')
     FROM (
       SELECT jsonb_build_object(
         'invoice_number', ni2.invoice_number,
         'invoice_id', ni2.id,
         'delivery_date', ni2.invoice_delivery_date,
         'is_reverse_charge', COALESCE(ni2.is_reverse_charge, false),
         'reverse_charge_category', ni2.reverse_charge_category,
         'net', SUM(nii2.net_amount),
         'vat', SUM(
           CASE
             WHEN ni2.is_reverse_charge = true AND (nii2.vat_amount IS NULL OR nii2.vat_amount = 0)
               THEN ROUND(nii2.net_amount * 0.27, 2)
             ELSE nii2.vat_amount
           END
         ),
         'vat_rate', CASE
           WHEN COUNT(DISTINCT nii2.vat_rate) = 1 THEN MAX(nii2.vat_rate)
           ELSE 'vegyes'
         END
       ) AS inv_summary
       FROM nav_invoice_items nii2
       JOIN nav_invoices ni2 ON ni2.id = nii2.nav_invoice_id
       WHERE ni2.company_id = p_company_id
         AND ni2.invoice_direction = 'INBOUND'
         AND ni2.invoice_delivery_date::date >= v_date_from
         AND ni2.invoice_delivery_date::date <= v_date_to
         AND (
           nii2.vat_rate NOT IN ('0','0.0','0.00','TAM','AAM')
           OR ni2.is_reverse_charge = true
         )
         AND ni2.supplier_tax_number = ni.supplier_tax_number
       GROUP BY ni2.id, ni2.invoice_number, ni2.invoice_delivery_date, ni2.is_reverse_charge, ni2.reverse_charge_category
     ) sub
    )
  FROM nav_invoice_items nii
  JOIN nav_invoices ni ON ni.id = nii.nav_invoice_id
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = 'INBOUND'
    AND ni.invoice_delivery_date::date >= v_date_from
    AND ni.invoice_delivery_date::date <= v_date_to
    AND (
      nii.vat_rate NOT IN ('0','0.0','0.00','TAM','AAM')
      OR ni.is_reverse_charge = true
    )
    AND ni.supplier_tax_number IS NOT NULL
    AND ni.supplier_tax_number != ''
  GROUP BY ni.supplier_name, ni.supplier_tax_number;

  -- M-lap summary rows
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

    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
    VALUES (v_return_id, '105', v_m_base, v_m_tax, ROUND(v_m_base/1000)::int, ROUND(v_m_tax/1000)::int, true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
      base_amount = EXCLUDED.base_amount, tax_amount = EXCLUDED.tax_amount,
      base_amount_rounded = EXCLUDED.base_amount_rounded, tax_amount_rounded = EXCLUDED.tax_amount_rounded;

    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
    VALUES (v_return_id, '108', v_m_base, v_m_tax, ROUND(v_m_base/1000)::int, ROUND(v_m_tax/1000)::int, true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
      base_amount = EXCLUDED.base_amount, tax_amount = EXCLUDED.tax_amount,
      base_amount_rounded = EXCLUDED.base_amount_rounded, tax_amount_rounded = EXCLUDED.tax_amount_rounded;

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

REVOKE EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text) TO authenticated;
ALTER FUNCTION public.calculate_vat_return SET search_path TO 'public';
