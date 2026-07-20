-- ==================================================
-- MERGED FROM: 20260617_fad_vat_return_rpc.sql
-- ==================================================
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


-- ==================================================
-- MERGED FROM: 20260617_fx_rates.sql
-- ==================================================
-- ============================================================
-- FX Rate Differences — Tables + RPC
-- ============================================================
-- Stores daily MNB exchange rates and computes FX differences
-- between invoice delivery date and transaction settlement date.
-- ============================================================

-- ─── 1. daily_exchange_rates ───────────────────────────────
-- Stores historical MNB (and future ECB) daily rates.
-- 1 currency unit = X HUF

CREATE TABLE IF NOT EXISTS public.daily_exchange_rates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date    date NOT NULL,
  currency     text NOT NULL,
  rate         numeric NOT NULL,          -- 1 EUR = 400.50 HUF
  source       text NOT NULL DEFAULT 'MNB',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rate_date, currency, source)
);

CREATE INDEX IF NOT EXISTS idx_der_date_currency
  ON public.daily_exchange_rates(rate_date, currency, source);

-- RLS: any authenticated user can read (rates are public data)
ALTER TABLE public.daily_exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read daily_exchange_rates"
  ON public.daily_exchange_rates FOR SELECT TO authenticated
  USING (true);

-- Only service_role / edge functions can insert/update
CREATE POLICY "Service role can manage daily_exchange_rates"
  ON public.daily_exchange_rates FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ─── 2. company_fx_settings ───────────────────────────────
-- Per-company configuration: which rate source to use

CREATE TABLE IF NOT EXISTS public.company_fx_settings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rate_source  text NOT NULL DEFAULT 'MNB',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.company_fx_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view company_fx_settings"
  ON public.company_fx_settings FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert company_fx_settings"
  ON public.company_fx_settings FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can update company_fx_settings"
  ON public.company_fx_settings FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));


-- ─── 3. get_fx_differences RPC ────────────────────────────
-- Returns FX gain/loss for every foreign-currency invoice
-- that has a matched transaction (settlement).
--
-- Logic:
--   delivery_huf  = foreign_amount × MNB rate on delivery_date
--   settlement_huf = foreign_amount × MNB rate on settlement_date
--                    OR actual bank rate if tx.currency = HUF (tx.amount / foreign_amount)
--   fx_difference = settlement_huf - delivery_huf
--   positive = gain, negative = loss

CREATE OR REPLACE FUNCTION public.get_fx_differences(
  p_company_id uuid,
  p_date_from  date DEFAULT NULL,
  p_date_to    date DEFAULT NULL
)
RETURNS TABLE (
  invoice_id        uuid,
  invoice_source    text,
  invoice_number    text,
  partner_name      text,
  invoice_direction text,
  currency          text,
  foreign_amount    numeric,
  delivery_date     date,
  delivery_rate     numeric,
  delivery_huf      numeric,
  settlement_date   date,
  settlement_rate   numeric,
  settlement_huf    numeric,
  fx_difference     numeric,
  settlement_month  text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rate_source text;
BEGIN
  -- Get company rate source preference (default MNB)
  SELECT COALESCE(fs.rate_source, 'MNB') INTO v_rate_source
  FROM company_fx_settings fs
  WHERE fs.company_id = p_company_id;

  IF v_rate_source IS NULL THEN
    v_rate_source := 'MNB';
  END IF;

  RETURN QUERY

  -- ── NAV invoices matched to transactions ──
  WITH nav_matched AS (
    SELECT
      ni.id AS inv_id,
      'nav_invoices'::text AS inv_source,
      ni.invoice_number AS inv_number,
      CASE
        WHEN ni.invoice_direction = 'OUTBOUND' THEN ni.customer_name
        ELSE ni.supplier_name
      END AS inv_partner,
      ni.invoice_direction AS inv_direction,
      ni.currency AS inv_currency,
      ni.invoice_gross_amount AS inv_amount,
      COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date)::date AS inv_delivery_date,
      t.transaction_date::date AS inv_settlement_date,
      t.amount AS tx_amount,
      t.currency AS tx_currency
    FROM nav_invoices ni
    JOIN transactions t ON (
      t.matched_invoice_id = ni.id
      OR t.id IN (
        SELECT tim.transaction_id FROM transaction_invoice_matches tim
        WHERE tim.invoice_id = ni.id AND tim.invoice_source = 'nav_invoices'
      )
    )
    WHERE ni.company_id = p_company_id
      AND ni.currency IS NOT NULL
      AND ni.currency != 'HUF'
      AND ni.invoice_gross_amount IS NOT NULL
      AND ni.invoice_gross_amount != 0
      AND (ni.exclude_from_accounting IS NULL OR ni.exclude_from_accounting = false)
  ),

  -- ── Submitted invoices matched to transactions ──
  submitted_matched AS (
    SELECT
      i.id AS inv_id,
      'invoices'::text AS inv_source,
      COALESCE(i.bizonylatsorszam, 'N/A') AS inv_number,
      CASE
        WHEN i.invoice_direction = 'OUTBOUND' THEN i.vevo_nev
        ELSE i.elado_nev
      END AS inv_partner,
      i.invoice_direction AS inv_direction,
      i.penznem AS inv_currency,
      i.brutto_vegosszeg AS inv_amount,
      COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date AS inv_delivery_date,
      t.transaction_date::date AS inv_settlement_date,
      t.amount AS tx_amount,
      t.currency AS tx_currency
    FROM invoices i
    JOIN transactions t ON (
      t.matched_invoice_id = i.id
      OR t.id IN (
        SELECT tim.transaction_id FROM transaction_invoice_matches tim
        WHERE tim.invoice_id = i.id AND tim.invoice_source = 'invoices'
      )
    )
    WHERE i.company_id = p_company_id
      AND i.penznem IS NOT NULL
      AND i.penznem != 'HUF'
      AND i.brutto_vegosszeg IS NOT NULL
      AND i.brutto_vegosszeg != 0
      AND (i.exclude_from_accounting IS NULL OR i.exclude_from_accounting = false)
  ),

  -- ── Combine both sources ──
  all_matched AS (
    SELECT * FROM nav_matched
    UNION ALL
    SELECT * FROM submitted_matched
  ),

  -- ── Join with daily rates ──
  with_rates AS (
    SELECT
      am.*,
      -- Delivery rate from MNB
      dr_del.rate AS del_rate,
      -- Settlement rate: if tx is HUF (bank converted), use actual rate
      CASE
        WHEN am.tx_currency = 'HUF' AND am.inv_amount != 0
          THEN ABS(am.tx_amount) / ABS(am.inv_amount)
        ELSE dr_set.rate
      END AS set_rate
    FROM all_matched am
    -- Delivery rate: find the rate on delivery_date or the last available rate before it
    LEFT JOIN LATERAL (
      SELECT der.rate
      FROM daily_exchange_rates der
      WHERE der.currency = am.inv_currency
        AND der.source = v_rate_source
        AND der.rate_date <= am.inv_delivery_date
      ORDER BY der.rate_date DESC
      LIMIT 1
    ) dr_del ON true
    -- Settlement rate (only if tx is NOT HUF — otherwise we use actual bank rate)
    LEFT JOIN LATERAL (
      SELECT der.rate
      FROM daily_exchange_rates der
      WHERE der.currency = am.inv_currency
        AND der.source = v_rate_source
        AND der.rate_date <= am.inv_settlement_date
      ORDER BY der.rate_date DESC
      LIMIT 1
    ) dr_set ON am.tx_currency IS DISTINCT FROM 'HUF'
  )

  SELECT
    wr.inv_id,
    wr.inv_source,
    wr.inv_number,
    wr.inv_partner,
    wr.inv_direction,
    wr.inv_currency,
    wr.inv_amount,
    wr.inv_delivery_date,
    COALESCE(wr.del_rate, 0),
    COALESCE(wr.del_rate, 0) * ABS(wr.inv_amount),
    wr.inv_settlement_date,
    COALESCE(wr.set_rate, 0),
    COALESCE(wr.set_rate, 0) * ABS(wr.inv_amount),
    CASE 
      WHEN wr.inv_direction = 'OUTBOUND' THEN (COALESCE(wr.set_rate, 0) - COALESCE(wr.del_rate, 0)) * ABS(wr.inv_amount)
      ELSE (COALESCE(wr.del_rate, 0) - COALESCE(wr.set_rate, 0)) * ABS(wr.inv_amount)
    END,
    TO_CHAR(wr.inv_settlement_date, 'YYYY-MM')
  FROM with_rates wr
  WHERE (p_date_from IS NULL OR wr.inv_settlement_date >= p_date_from)
    AND (p_date_to IS NULL OR wr.inv_settlement_date <= p_date_to)
    AND wr.del_rate IS NOT NULL  -- skip if no rate data available
  ORDER BY wr.inv_settlement_date DESC, wr.inv_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_fx_differences(uuid, date, date) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fx_differences(uuid, date, date) TO authenticated;


-- ==================================================
-- MERGED FROM: 20260617_permission_system_phase1.sql
-- ==================================================
-- ============================================================================
-- PERMISSION SYSTEM PHASE 1
-- ============================================================================
-- 1. accounty_assignments.role bővítés (senior/junior → iroda_admin/senior_könyvelő/könyvelő/asszisztens)
-- 2. source oszlop hozzáadása az accounty_assignments-hoz
-- 3. accounty_module_permissions tábla
-- 4. user_company_access_cache tábla + trigger függvények
-- 5. Szinkronizációs trigger: company_members DELETE → accounty_assignments törlés
-- 6. RLS policy frissítések az invoices/nav_invoices táblákon
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  1. accounty_assignments.role CHECK constraint bővítés             ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Drop old constraint FIRST (so the UPDATE below won't violate it)
ALTER TABLE public.accounty_assignments DROP CONSTRAINT IF EXISTS accounty_assignments_role_check;

-- Migrate existing data
UPDATE public.accounty_assignments SET role = 'iroda_admin' WHERE role = 'senior';
UPDATE public.accounty_assignments SET role = 'könyvelő' WHERE role = 'junior';

-- Add new constraint
ALTER TABLE public.accounty_assignments ADD CONSTRAINT accounty_assignments_role_check
  CHECK (role IN ('iroda_admin', 'senior_könyvelő', 'könyvelő', 'asszisztens'));

-- Update default
ALTER TABLE public.accounty_assignments ALTER COLUMN role SET DEFAULT 'könyvelő';

-- Update comments
COMMENT ON COLUMN public.accounty_assignments.role IS 'iroda_admin = irodavezető teljes rálátás, senior_könyvelő = saját + junior cégek, könyvelő = csak kiszignált cégek, asszisztens = korlátozott adatrögzítés';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  2. source oszlop hozzáadása                                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.accounty_assignments
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'sync'));

COMMENT ON COLUMN public.accounty_assignments.source IS 'manual = az iroda admin manuálisan rendelte hozzá, sync = eaisybill company_members-ből automatikusan szinkronizálva';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  3. accounty_module_permissions tábla                              ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_firm_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL CHECK (module_name IN (
    'dashboard', 'invoices', 'transactions', 'salaries', 'payroll',
    'general_ledger', 'vat_return', 'profit_loss', 'balance_sheet',
    'fixed_assets', 'petty_cash', 'partners', 'projects', 'categories',
    'hr', 'working_time', 'documents', 'integrations', 'settings',
    'tao_kiva', 'filings', 'declarations', 'reports'
  )),
  can_read BOOLEAN DEFAULT true,
  can_write BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (accounting_firm_id, user_id, module_name)
);

ALTER TABLE public.accounty_module_permissions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.accounty_module_permissions IS 'Modulonkénti testreszabható jogosultságok. Az iroda admin állítja be, hogy melyik könyvelő/asszisztens melyik modulhoz fér hozzá.';

-- RLS: Only iroda_admin of the accounting firm can manage, anyone in the firm can read own
CREATE POLICY "module_perms_select" ON public.accounty_module_permissions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "module_perms_manage" ON public.accounty_module_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM accounty_assignments aa
      WHERE aa.accounting_firm_id = accounty_module_permissions.accounting_firm_id
        AND aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'iroda_admin'
    )
  );

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  4. user_company_access_cache tábla                                ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.user_company_access_cache (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  access_source TEXT NOT NULL CHECK (access_source IN ('eaisybill', 'accounty')),
  role TEXT NOT NULL,
  can_read_invoices BOOLEAN DEFAULT true,
  can_write_invoices BOOLEAN DEFAULT false,
  can_read_transactions BOOLEAN DEFAULT true,
  can_read_salaries BOOLEAN DEFAULT false,
  can_read_hr BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, company_id, access_source)
);

CREATE INDEX IF NOT EXISTS idx_access_cache_user ON user_company_access_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_access_cache_company ON user_company_access_cache(company_id);
CREATE INDEX IF NOT EXISTS idx_access_cache_user_company ON user_company_access_cache(user_id, company_id);

ALTER TABLE public.user_company_access_cache ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.user_company_access_cache IS 'Unified access cache: combines company_members and accounty_assignments into one fast-lookup table for RLS policies.';

-- RLS: Users can only see their own cache entries
CREATE POLICY "access_cache_select" ON public.user_company_access_cache
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  4b. Trigger functions to keep cache in sync                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Function: sync company_members → access cache
CREATE OR REPLACE FUNCTION sync_company_member_to_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM user_company_access_cache
    WHERE user_id = OLD.user_id
      AND company_id = OLD.company_id
      AND access_source = 'eaisybill';
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE
  INSERT INTO user_company_access_cache (
    user_id, company_id, access_source, role,
    can_read_invoices, can_write_invoices, can_read_transactions,
    can_read_salaries, can_read_hr, updated_at
  ) VALUES (
    NEW.user_id, NEW.company_id, 'eaisybill', NEW.role,
    true, -- all eaisybill members can read invoices
    NEW.role IN ('owner', 'admin'), -- only owner/admin can write
    true, -- all can read transactions
    NEW.role IN ('owner', 'admin'), -- salaries: owner/admin only
    NEW.role IN ('owner', 'admin'), -- HR: owner/admin only
    now()
  )
  ON CONFLICT (user_id, company_id, access_source) DO UPDATE SET
    role = EXCLUDED.role,
    can_read_invoices = EXCLUDED.can_read_invoices,
    can_write_invoices = EXCLUDED.can_write_invoices,
    can_read_transactions = EXCLUDED.can_read_transactions,
    can_read_salaries = EXCLUDED.can_read_salaries,
    can_read_hr = EXCLUDED.can_read_hr,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Function: sync accounty_assignments → access cache
CREATE OR REPLACE FUNCTION sync_accounty_assignment_to_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM user_company_access_cache
    WHERE user_id = OLD.accountant_user_id
      AND company_id = OLD.company_id
      AND access_source = 'accounty';
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE: accounty users get full read access to accounting modules
  INSERT INTO user_company_access_cache (
    user_id, company_id, access_source, role,
    can_read_invoices, can_write_invoices, can_read_transactions,
    can_read_salaries, can_read_hr, updated_at
  ) VALUES (
    NEW.accountant_user_id, NEW.company_id, 'accounty', NEW.role,
    true, -- accountants can read invoices
    true, -- accountants can write (manage) invoices
    true, -- accountants can read transactions
    true, -- accountants have full accounting access
    true, -- accountants have full HR access (for payroll)
    now()
  )
  ON CONFLICT (user_id, company_id, access_source) DO UPDATE SET
    role = EXCLUDED.role,
    can_read_invoices = EXCLUDED.can_read_invoices,
    can_write_invoices = EXCLUDED.can_write_invoices,
    can_read_transactions = EXCLUDED.can_read_transactions,
    can_read_salaries = EXCLUDED.can_read_salaries,
    can_read_hr = EXCLUDED.can_read_hr,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Attach triggers
DROP TRIGGER IF EXISTS trg_company_members_cache_sync ON public.company_members;
CREATE TRIGGER trg_company_members_cache_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION sync_company_member_to_cache();

DROP TRIGGER IF EXISTS trg_accounty_assignments_cache_sync ON public.accounty_assignments;
CREATE TRIGGER trg_accounty_assignments_cache_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.accounty_assignments
  FOR EACH ROW EXECUTE FUNCTION sync_accounty_assignment_to_cache();

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  4c. Backfill: populate cache from existing data                   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Backfill from company_members
INSERT INTO user_company_access_cache (user_id, company_id, access_source, role,
  can_read_invoices, can_write_invoices, can_read_transactions, can_read_salaries, can_read_hr)
SELECT
  cm.user_id, cm.company_id, 'eaisybill', cm.role,
  true,
  cm.role IN ('owner', 'admin'),
  true,
  cm.role IN ('owner', 'admin'),
  cm.role IN ('owner', 'admin')
FROM company_members cm
ON CONFLICT (user_id, company_id, access_source) DO NOTHING;

-- Backfill from accounty_assignments
INSERT INTO user_company_access_cache (user_id, company_id, access_source, role,
  can_read_invoices, can_write_invoices, can_read_transactions, can_read_salaries, can_read_hr)
SELECT
  aa.accountant_user_id, aa.company_id, 'accounty', aa.role,
  true, true, true, true, true
FROM accounty_assignments aa
ON CONFLICT (user_id, company_id, access_source) DO NOTHING;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  5. Szinkronizációs trigger: kirúgás eaisybill → accounty törlés   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION sync_eaisybill_accountant_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a company_member with role 'accountant' is deleted,
  -- also delete the corresponding accounty_assignment if it was auto-synced
  IF OLD.role = 'accountant' THEN
    DELETE FROM accounty_assignments
    WHERE accountant_user_id = OLD.user_id
      AND company_id = OLD.company_id
      AND source = 'sync';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_eaisybill_accountant_removal ON public.company_members;
CREATE TRIGGER trg_eaisybill_accountant_removal
  AFTER DELETE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION sync_eaisybill_accountant_removal();

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  6. RLS policy frissítés: invoices & nav_invoices                  ║
-- ║  Régi: közvetlen JOIN accounty_assignments-ra                      ║
-- ║  Új: user_company_access_cache-ből olvas (gyorsabb, egységes)      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  6a. SECURITY DEFINER helper function                              ║
-- ║  Needed because user_company_access_cache has its own RLS.         ║
-- ║  Without this, subqueries inside other table policies can't read   ║
-- ║  the cache table (RLS recursion).                                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION has_company_access_via_cache(p_company_id UUID, p_source TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_company_access_cache
    WHERE user_id = auth.uid()
      AND company_id = p_company_id
      AND (p_source IS NULL OR access_source = p_source)
  );
$$;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  6b. RLS policy frissítés: invoices, nav_invoices, companies       ║
-- ║  Uses the SECURITY DEFINER helper to avoid RLS recursion           ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- invoices
DROP POLICY IF EXISTS "Accountants can view assigned company invoices" ON public.invoices;
CREATE POLICY "Accountants can view assigned company invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (has_company_access_via_cache(company_id, 'accounty'));

-- nav_invoices
DROP POLICY IF EXISTS "Accountants can view assigned NAV invoices" ON public.nav_invoices;
CREATE POLICY "Accountants can view assigned NAV invoices" ON public.nav_invoices
  FOR SELECT TO authenticated
  USING (has_company_access_via_cache(company_id, 'accounty'));

-- companies
DROP POLICY IF EXISTS "Accountants can view assigned companies" ON public.companies;
CREATE POLICY "Accountants can view assigned companies" ON public.companies
  FOR SELECT TO authenticated
  USING (has_company_access_via_cache(id, 'accounty'));

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Update RLS on accounty_assignments for iroda_admin visibility     ║
-- ║  Uses SECURITY DEFINER to avoid infinite recursion                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION is_iroda_admin_for_firm(p_firm_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounty_assignments
    WHERE accountant_user_id = auth.uid()
      AND accounting_firm_id = p_firm_id
      AND role = 'iroda_admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_member_of_firm(p_firm_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounty_assignments
    WHERE accountant_user_id = auth.uid()
      AND accounting_firm_id = p_firm_id
  );
$$;

DROP POLICY IF EXISTS "assignments_select" ON public.accounty_assignments;
CREATE POLICY "assignments_select" ON public.accounty_assignments
  FOR SELECT TO authenticated
  USING (
    accountant_user_id = (SELECT auth.uid())
    OR is_iroda_admin_for_firm(accounting_firm_id)
    OR is_member_of_firm(accounting_firm_id)
  );


-- ==================================================
-- MERGED FROM: 20260617_reverse_charge_module.sql
-- ==================================================
-- ============================================================
-- FORDÍTOTT ADÓZÁS (FAD / Reverse Charge) MODUL — DB Séma
-- ============================================================
-- Áfa tv. 142.§ szerinti belföldi fordított adózás kezelése.
-- - nav_invoices + invoices bővítés (kategória, confidence, 60.§ dátum)
-- - reverse_charge_entries tábla (kettős könyvelési tételek)
-- - vat_codes seed bővítés (ügylettípus-specifikus FAD kódok)
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. nav_invoices BŐVÍTÉS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS is_reverse_charge BOOLEAN DEFAULT false;

ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS reverse_charge_category TEXT;

-- Constraint külön, mert ADD COLUMN IF NOT EXISTS + CHECK egy utasításban
-- nem idempotens ha az oszlop már létezik de constraint nem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nav_invoices_rc_category_check'
  ) THEN
    ALTER TABLE public.nav_invoices
      ADD CONSTRAINT nav_invoices_rc_category_check
      CHECK (reverse_charge_category IS NULL OR reverse_charge_category IN (
        'construction',
        'scrap_metal',
        'agriculture',
        'steel',
        'emission_quota',
        'natural_gas',
        'labor_hire',
        'eu_service_import',
        'third_country'
      ));
  END IF;
END $$;

ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS rc_confidence TEXT DEFAULT 'auto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nav_invoices_rc_confidence_check'
  ) THEN
    ALTER TABLE public.nav_invoices
      ADD CONSTRAINT nav_invoices_rc_confidence_check
      CHECK (rc_confidence IN ('auto', 'confirmed', 'uncertain', 'override'));
  END IF;
END $$;

-- 60.§ szerinti fizetendő adó keletkezésének dátuma
ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS rc_vat_date DATE;

-- Index a FAD-os számlák gyors szűréséhez
CREATE INDEX IF NOT EXISTS idx_nav_invoices_reverse_charge
  ON public.nav_invoices(company_id, is_reverse_charge)
  WHERE is_reverse_charge = true;


-- ──────────────────────────────────────────────────────────────
-- 2. invoices BŐVÍTÉS (feltöltött / OCR-ezett számlák)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reverse_charge_category TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_rc_category_check'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_rc_category_check
      CHECK (reverse_charge_category IS NULL OR reverse_charge_category IN (
        'construction',
        'scrap_metal',
        'agriculture',
        'steel',
        'emission_quota',
        'natural_gas',
        'labor_hire',
        'eu_service_import',
        'third_country'
      ));
  END IF;
END $$;


-- ──────────────────────────────────────────────────────────────
-- 3. reverse_charge_entries TÁBLA
-- Kettős könyvelési tételek: fizetendő + levonható ÁFA
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reverse_charge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Számla hivatkozás (pontosan az egyiket kell kitölteni)
  nav_invoice_id UUID REFERENCES public.nav_invoices(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,

  -- FAD tétel adatai
  category TEXT NOT NULL CHECK (category IN (
    'construction', 'scrap_metal', 'agriculture', 'steel',
    'emission_quota', 'natural_gas', 'labor_hire',
    'eu_service_import', 'third_country'
  )),
  net_amount NUMERIC NOT NULL,
  vat_rate NUMERIC NOT NULL DEFAULT 0.27,
  vat_amount NUMERIC NOT NULL,

  -- Könyvelési dátumok (Áfa tv. 60.§)
  invoice_received_date DATE,
  payment_date DATE,
  deadline_date DATE,              -- teljesítés + 1 hó 15.
  effective_vat_date DATE NOT NULL, -- a legkorábbi a 3-ból

  -- Bevallási időszak (ebből számítja a rendszer, melyik 2665-be kerül)
  vat_period_year INT NOT NULL,
  vat_period_month INT NOT NULL,

  -- Könyvelési státusz
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'booked', 'submitted', 'error'
  )),

  -- Tételes adatszolgáltatás (mezőgazdaság / acél / hulladék)
  -- Pl.: {"vtsz": "1001", "weight_kg": 5000, "partner_tax_number": "12345678-2-42"}
  detail_data JSONB DEFAULT '{}'::jsonb,

  -- Levonási jog
  is_deductible BOOLEAN NOT NULL DEFAULT true,
  deduction_ratio NUMERIC NOT NULL DEFAULT 1.0
    CHECK (deduction_ratio >= 0 AND deduction_ratio <= 1),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Legalább az egyik számla-hivatkozás kötelező
  CONSTRAINT rce_invoice_ref_check CHECK (
    nav_invoice_id IS NOT NULL OR invoice_id IS NOT NULL
  )
);

-- RLS
ALTER TABLE public.reverse_charge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rce_company_policy" ON public.reverse_charge_entries
  USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid()));

-- Indexek
CREATE INDEX IF NOT EXISTS idx_rce_company
  ON public.reverse_charge_entries(company_id);

CREATE INDEX IF NOT EXISTS idx_rce_nav_invoice
  ON public.reverse_charge_entries(nav_invoice_id)
  WHERE nav_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rce_invoice
  ON public.reverse_charge_entries(invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rce_period
  ON public.reverse_charge_entries(company_id, vat_period_year, vat_period_month);

CREATE INDEX IF NOT EXISTS idx_rce_status
  ON public.reverse_charge_entries(status)
  WHERE status = 'pending';

-- Updated_at trigger
CREATE TRIGGER trg_rce_updated
  BEFORE UPDATE ON public.reverse_charge_entries
  FOR EACH ROW EXECUTE FUNCTION update_vat_updated_at();


-- ──────────────────────────────────────────────────────────────
-- 4. vat_codes SEED BŐVÍTÉS
-- Ügylettípus-specifikus FAD kódok hozzáadása
-- ──────────────────────────────────────────────────────────────
-- A meglévő seed_default_vat_codes() függvényt bővítjük.
-- ON CONFLICT DO NOTHING → idempotens, nem duplikálja a meglévőket.

CREATE OR REPLACE FUNCTION seed_fad_vat_codes(p_company_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO vat_codes (company_id, code, label, vat_percent, direction, is_deductible, is_reverse_charge, is_eu, target_rows, sort_order)
  VALUES
    -- Építőipari FAD (142.§ (1) a-b)
    (p_company_id, 'FAD_EPIT_27', 'FAD Építőipari 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 201),
    (p_company_id, 'FAD_EPIT_5',  'FAD Építőipari 5%',   5.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 202),

    -- Hulladék FAD (6. melléklet)
    (p_company_id, 'FAD_HULL_27', 'FAD Hulladék 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"30","col":"base"},{"row":"30","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 211),

    -- Mezőgazdasági FAD (6/A melléklet) — tételes adatszolgáltatás kötelező
    (p_company_id, 'FAD_MEZO_27', 'FAD Mezőgazdaság 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"31","col":"base"},{"row":"31","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 221),
    (p_company_id, 'FAD_MEZO_5',  'FAD Mezőgazdaság 5%',   5.00, 'INBOUND', true, true, false,
     '[{"row":"31","col":"base"},{"row":"31","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 222),

    -- Acélipari FAD (6/B melléklet) — tételes adatszolgáltatás kötelező
    (p_company_id, 'FAD_ACEL_27', 'FAD Acélipari 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"32","col":"base"},{"row":"32","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 231),

    -- Földgáz FAD (átmeneti szabály)
    (p_company_id, 'FAD_GAZ_27',  'FAD Földgáz 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"33","col":"base"},{"row":"33","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 241),

    -- Munkaerő-kölcsönzés (építőipari)
    (p_company_id, 'FAD_MUNKA_27','FAD Munkaerő-kölcsönzés 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 251),

    -- Üvegházhatású gáz kvóta
    (p_company_id, 'FAD_KVOTA_27','FAD Kibocsátási kvóta 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 261)

  ON CONFLICT (company_id, code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Jogosultság: csak authenticated user hívhatja
REVOKE EXECUTE ON FUNCTION public.seed_fad_vat_codes FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_fad_vat_codes TO authenticated;


-- ──────────────────────────────────────────────────────────────
-- 5. AUTO-DETECT: nav_invoices trigger
-- Ha nav_invoice_items-ben van DOMESTIC_REVERSE_CHARGE vat_rate,
-- automatikusan beállítja az is_reverse_charge = true mezőt.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_detect_reverse_charge()
RETURNS TRIGGER AS $$
BEGIN
  -- Ha a beszúrt tétel vat_rate-je DOMESTIC_REVERSE_CHARGE,
  -- jelöljük a szülő nav_invoices rekordot
  IF NEW.vat_rate = 'DOMESTIC_REVERSE_CHARGE' THEN
    UPDATE public.nav_invoices
    SET is_reverse_charge = true,
        rc_confidence = COALESCE(rc_confidence, 'auto')
    WHERE id = NEW.nav_invoice_id
      AND is_reverse_charge = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: nav_invoice_items INSERT-re
DROP TRIGGER IF EXISTS trg_auto_detect_rc ON public.nav_invoice_items;

CREATE TRIGGER trg_auto_detect_rc
  AFTER INSERT ON public.nav_invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_detect_reverse_charge();


-- ──────────────────────────────────────────────────────────────
-- 6. Backfill: meglévő nav_invoice_items alapján jelölés
-- Egyszeri futtatás a meglévő adatokra
-- ──────────────────────────────────────────────────────────────

UPDATE public.nav_invoices ni
SET is_reverse_charge = true,
    rc_confidence = 'auto'
WHERE is_reverse_charge = false
  AND EXISTS (
    SELECT 1 FROM public.nav_invoice_items nii
    WHERE nii.nav_invoice_id = ni.id
      AND nii.vat_rate = 'DOMESTIC_REVERSE_CHARGE'
  );
