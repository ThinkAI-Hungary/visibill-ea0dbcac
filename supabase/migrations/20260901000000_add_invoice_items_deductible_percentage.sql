-- Migration: 20260901000000_add_invoice_items_deductible_percentage.sql
-- Description: Add deductible_percentage to nav_invoice_items and invoice_items, and update calculate_vat_return RPC to support partial VAT deductibility (70/30 telephone rule, etc.)

-- 1. Add deductible_percentage column to nav_invoice_items and invoice_items
ALTER TABLE nav_invoice_items 
ADD COLUMN IF NOT EXISTS deductible_percentage NUMERIC(5,2) NOT NULL DEFAULT 100.00 
CHECK (deductible_percentage >= 0 AND deductible_percentage <= 100);

ALTER TABLE invoice_items 
ADD COLUMN IF NOT EXISTS deductible_percentage NUMERIC(5,2) NOT NULL DEFAULT 100.00 
CHECK (deductible_percentage >= 0 AND deductible_percentage <= 100);

-- 2. Update calculate_vat_return RPC with deductible_percentage awareness
CREATE OR REPLACE FUNCTION public.calculate_vat_return(p_company_id uuid, p_year integer, p_month integer, p_frequency text DEFAULT 'H'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_processed_fad_cats TEXT[] := '{}';
  v_company_vat_regime TEXT := 'normal';
  v_is_penzforgalmi BOOLEAN := false;
BEGIN
  -- 0. Auto-seed VAT codes if not present for this company
  IF NOT EXISTS (SELECT 1 FROM vat_codes WHERE company_id = p_company_id) THEN
    PERFORM seed_default_vat_codes(p_company_id);
    PERFORM seed_fad_vat_codes(p_company_id);
  END IF;

  -- Look up the company's VAT regime
  SELECT COALESCE(c.vat_regime, 'normal')
  INTO v_company_vat_regime
  FROM companies c
  WHERE c.id = p_company_id;

  v_is_penzforgalmi := (v_company_vat_regime = 'penzforgalmi');

  -- 1. Calculate date range
  IF p_frequency = 'H' THEN
    v_date_from := make_date(p_year, p_month, 1);
    v_date_to := (v_date_from + INTERVAL '1 month' - INTERVAL '1 day')::date;
  ELSIF p_frequency = 'N' THEN
    v_date_from := make_date(p_year, (p_month - 1) * 3 + 1, 1);
    v_date_to := (v_date_from + INTERVAL '3 months' - INTERVAL '1 day')::date;
  ELSE
    -- p_frequency = 'E' (Annual)
    v_date_from := make_date(p_year, 1, 1);
    v_date_to := make_date(p_year, 12, 31);
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
  IF p_frequency = 'E' THEN
    SELECT COALESCE(amount_carryforward, 0) INTO v_prev_carry
    FROM vat_returns
    WHERE company_id = p_company_id
      AND frequency = p_frequency
      AND period_year = p_year - 1
      AND period_month = p_month
      AND id != v_return_id
    LIMIT 1;
  ELSE
    SELECT COALESCE(amount_carryforward, 0) INTO v_prev_carry
    FROM vat_returns
    WHERE company_id = p_company_id
      AND frequency = p_frequency
      AND period_year = CASE WHEN p_month = 1 THEN p_year - 1 ELSE p_year END
      AND period_month = CASE WHEN p_month = 1 THEN (CASE WHEN p_frequency = 'H' THEN 12 ELSE 4 END) ELSE p_month - 1 END
      AND id != v_return_id
    LIMIT 1;
  END IF;
  v_prev_carry := COALESCE(v_prev_carry, 0);

  -- 5. For each VAT code, aggregate from nav_invoice_items
  --    WITH PÉNZFORGALMI LOGIC, ROBUST DATE RESOLUTION & DEDUCTIBLE RATIO
  FOR v_code IN
    SELECT * FROM vat_codes WHERE company_id = p_company_id ORDER BY sort_order
  LOOP
    IF v_code.is_reverse_charge THEN
      -- ═══════════════════════════════════════════════════════
      -- FAD ESET: fordított adózású tételek — KATEGÓRIA SZŰRÉSSEL
      -- ═══════════════════════════════════════════════════════

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
        AND COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date >= v_date_from
        AND COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date <= v_date_to
        AND ni.is_reverse_charge = true
        AND nii.vat_rate IN ('0', '0.0', '0.00', 'DOMESTIC_REVERSE_CHARGE', 'FAD')
        AND (
          v_code.fad_category IS NULL
          OR ni.reverse_charge_category = v_code.fad_category
        )
        -- ═══ PÉNZFORGALMI SZŰRÉS (INBOUND) ═══
        AND (
          (NOT v_is_penzforgalmi AND (ni.is_cash_accounting IS NULL OR ni.is_cash_accounting = false))
          OR ni.transaction_id IS NOT NULL
        );

      IF v_base = 0 THEN
        CONTINUE;
      END IF;

      IF v_code.fad_category IS NOT NULL THEN
        v_processed_fad_cats := v_processed_fad_cats || v_code.fad_category;
      END IF;

      v_tax := ROUND(v_base * v_code.vat_percent / 100, 2);

    ELSE
      -- ═══════════════════════════════════════════════════════
      -- NORMÁL ESET — with deductible_percentage & pénzforgalmi branching
      -- ═══════════════════════════════════════════════════════
      SELECT
        COALESCE(SUM(
          CASE
            WHEN v_code.direction = 'INBOUND'
              THEN ROUND(nii.net_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0), 2)
            ELSE nii.net_amount
          END
        ), 0),
        COALESCE(SUM(
          CASE
            WHEN v_code.direction = 'INBOUND'
              THEN ROUND(nii.vat_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0), 2)
            ELSE nii.vat_amount
          END
        ), 0)
      INTO v_base, v_tax
      FROM nav_invoice_items nii
      JOIN nav_invoices ni ON ni.id = nii.nav_invoice_id
      WHERE ni.company_id = p_company_id
        AND ni.invoice_direction = CASE
          WHEN v_code.direction = 'OUTBOUND' THEN 'OUTBOUND'
          ELSE 'INBOUND'
        END
        AND COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date >= v_date_from
        AND COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date <= v_date_to
        AND (
          (
            (v_code.vat_percent = 27 AND nii.vat_rate IN ('0.27', '27', '27.0', '27.00')) OR
            (v_code.vat_percent = 18 AND nii.vat_rate IN ('0.18', '18', '18.0', '18.00')) OR
            (v_code.vat_percent = 5  AND nii.vat_rate IN ('0.05', '5', '5.0', '5.00')) OR
            (v_code.vat_percent = 0  AND (nii.vat_rate IN ('0', '0.0', '0.00', 'TAM', 'AAM') OR nii.vat_rate IS NULL))
          )
        )
        AND (ni.is_reverse_charge IS NULL OR ni.is_reverse_charge = false)
        AND (nii.vat_rate IS NULL OR nii.vat_rate NOT IN ('DOMESTIC_REVERSE_CHARGE', 'FAD'))
        -- ═══ PÉNZFORGALMI SZŰRÉS ═══
        AND (
          CASE
            -- OUTBOUND + pénzforgalmi cég: csak kifizetett számlák ÁFÁ-ja fizetendő
            WHEN v_code.direction = 'OUTBOUND' AND v_is_penzforgalmi THEN
              ni.transaction_id IS NOT NULL
            -- INBOUND + pénzforgalmi cég: csak kifizetett számlák ÁFÁ-ja levonható
            WHEN v_code.direction = 'INBOUND' AND v_is_penzforgalmi THEN
              ni.transaction_id IS NOT NULL
            -- INBOUND + normál cég, DE a szállító pénzforgalmi: csak kifizetett levonható
            WHEN v_code.direction = 'INBOUND' AND NOT v_is_penzforgalmi
                 AND COALESCE(ni.is_cash_accounting, false) = true THEN
              ni.transaction_id IS NOT NULL
            -- Minden más eset: normál (nincs szűrés)
            ELSE true
          END
        );

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

  -- Summary row 36 (Total payable)
  INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, is_calculated)
  VALUES (v_return_id, '36', v_total_payable_base, v_total_payable_tax, ROUND(v_total_payable_base/1000)::int, ROUND(v_total_payable_tax/1000)::int, true)
  ON CONFLICT (vat_return_id, row_number) DO UPDATE SET
    base_amount = EXCLUDED.base_amount, tax_amount = EXCLUDED.tax_amount,
    base_amount_rounded = EXCLUDED.base_amount_rounded, tax_amount_rounded = EXCLUDED.tax_amount_rounded, is_calculated = true;

  -- Summary row 76 (Total deductible)
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

  -- 7. M-LAP (Belföldi összesítő jelentés a levonható tételekről)
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
    COALESCE(SUM(ROUND(nii.net_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0), 2)), 0),
    COALESCE(SUM(
      CASE
        WHEN ni.is_reverse_charge = true AND (nii.vat_amount IS NULL OR nii.vat_amount = 0)
          THEN ROUND(nii.net_amount * 0.27, 2)
        ELSE ROUND(nii.vat_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0), 2)
      END
    ), 0),
    ROUND(COALESCE(SUM(ROUND(nii.net_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0), 2)), 0) / 1000)::int,
    ROUND(COALESCE(SUM(
      CASE
        WHEN ni.is_reverse_charge = true AND (nii.vat_amount IS NULL OR nii.vat_amount = 0)
          THEN ROUND(nii.net_amount * 0.27, 2)
        ELSE ROUND(nii.vat_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0), 2)
      END
    ), 0) / 1000)::int,
    COALESCE(SUM(CASE WHEN nii.vat_rate IN ('0.05','5','5.0','5.00') THEN ROUND(nii.vat_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN nii.vat_rate IN ('0.18','18','18.0','18.00') THEN ROUND(nii.vat_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0), 2) ELSE 0 END), 0),
    COALESCE(SUM(
      CASE
        WHEN nii.vat_rate IN ('0.27','27','27.0','27.00') THEN ROUND(nii.vat_amount * (COALESCE(nii.deductible_percentage, 100.0) / 100.0), 2)
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
         'delivery_date', COALESCE(ni2.ti_override, ni2.calculated_ti, ni2.invoice_delivery_date, ni2.invoice_issue_date),
         'is_reverse_charge', COALESCE(ni2.is_reverse_charge, false),
         'reverse_charge_category', ni2.reverse_charge_category,
         'net', SUM(ROUND(nii2.net_amount * (COALESCE(nii2.deductible_percentage, 100.0) / 100.0), 2)),
         'vat', SUM(
           CASE
             WHEN ni2.is_reverse_charge = true AND (nii2.vat_amount IS NULL OR nii2.vat_amount = 0)
               THEN ROUND(nii2.net_amount * 0.27, 2)
             ELSE ROUND(nii2.vat_amount * (COALESCE(nii2.deductible_percentage, 100.0) / 100.0), 2)
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
         AND COALESCE(ni2.ti_override, ni2.calculated_ti, ni2.invoice_delivery_date, ni2.invoice_issue_date)::date >= v_date_from
         AND COALESCE(ni2.ti_override, ni2.calculated_ti, ni2.invoice_delivery_date, ni2.invoice_issue_date)::date <= v_date_to
         AND (
           (nii2.vat_rate IS NOT NULL AND nii2.vat_rate NOT IN ('0','0.0','0.00','TAM','AAM'))
           OR ni2.is_reverse_charge = true
         )
         AND ni2.supplier_tax_number = ni.supplier_tax_number
         -- ═══ PÉNZFORGALMI SZŰRÉS (M-lap detail) ═══
         AND (
           (NOT v_is_penzforgalmi AND (ni2.is_cash_accounting IS NULL OR ni2.is_cash_accounting = false))
           OR ni2.transaction_id IS NOT NULL
         )
       GROUP BY ni2.id, ni2.invoice_number, ni2.invoice_delivery_date, ni2.invoice_issue_date, ni2.ti_override, ni2.calculated_ti, ni2.is_reverse_charge, ni2.reverse_charge_category
     ) sub
    )
  FROM nav_invoice_items nii
  JOIN nav_invoices ni ON ni.id = nii.nav_invoice_id
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = 'INBOUND'
    AND COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date >= v_date_from
    AND COALESCE(ni.ti_override, ni.calculated_ti, ni.invoice_delivery_date, ni.invoice_issue_date)::date <= v_date_to
    AND (
      (nii.vat_rate IS NOT NULL AND nii.vat_rate NOT IN ('0','0.0','0.00','TAM','AAM'))
      OR ni.is_reverse_charge = true
    )
    AND ni.supplier_tax_number IS NOT NULL
    AND ni.supplier_tax_number != ''
    -- ═══ PÉNZFORGALMI SZŰRÉS (M-lap) ═══
    AND (
      (NOT v_is_penzforgalmi AND (ni.is_cash_accounting IS NULL OR ni.is_cash_accounting = false))
      OR ni.transaction_id IS NOT NULL
    )
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
$function$;
