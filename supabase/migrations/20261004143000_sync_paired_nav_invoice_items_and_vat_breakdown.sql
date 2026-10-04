-- Migration: 20261004143000_sync_paired_nav_invoice_items_and_vat_breakdown.sql
-- Description: 
-- 1. Sync line items from invoice_items to nav_invoice_items when linking / approving submitted invoices
--    (in link_and_verify_submitted_invoice and mark_nav_invoice_as_submitted trigger).
-- 2. Add fallback in calculate_hungarian_vat_return to inspect matched invoice_items if nav_invoice_items
--    is empty, ensuring mixed VAT rate items (e.g. Magyar Telekom 5% internet + 27% phone with 70/30 deductibility)
--    are never collapsed into a single lump sum.
-- Legal Basis: Act CXXVII of 2007 on VAT (Áfa tv.) § 120 (tax deduction) and § 124 (restrictions on telephone/internet services).
--              5% internet service VAT is 100% deductible (Row 64), while 27% telephone service VAT is 70% deductible (Row 66).

-- ============================================================================
-- 1. Update link_and_verify_submitted_invoice to sync line items
-- ============================================================================

CREATE OR REPLACE FUNCTION public.link_and_verify_submitted_invoice(
  p_submitted_invoice_id uuid,
  p_nav_invoice_id uuid,
  p_approval_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub_inv record;
  v_nav_inv record;
  v_user_id uuid;
  v_company_id uuid;
  v_note text;
BEGIN
  v_user_id := auth.uid();

  -- 1. Fetch submitted invoice
  SELECT id, company_id, bizonylatsorszam, statusz, nav_status, invoice_type, fizetesi_mod
  INTO v_sub_inv
  FROM public.invoices
  WHERE id = p_submitted_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A beküldött számla nem található (id: %)', p_submitted_invoice_id;
  END IF;

  v_company_id := v_sub_inv.company_id;

  -- 2. Fetch NAV invoice
  SELECT id, company_id, invoice_number, invoice_direction, submitted
  INTO v_nav_inv
  FROM public.nav_invoices
  WHERE id = p_nav_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A NAV számla nem található (id: %)', p_nav_invoice_id;
  END IF;

  -- Multi-tenancy guard: both must belong to the same company
  IF v_sub_inv.company_id IS DISTINCT FROM v_nav_inv.company_id THEN
    RAISE EXCEPTION 'A beküldött számla és a NAV számla különböző cégekhez tartozik! Művelet megtagadva.';
  END IF;

  -- Security check: user must be company member, assigned accountant in Accounty, or superadmin
  IF v_user_id IS NOT NULL AND NOT (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = v_company_id AND user_id = v_user_id
    )
    OR public.has_accounty_company_access(v_company_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = v_user_id AND role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég számláinak összerendeléséhez és jóváhagyásához';
  END IF;

  -- Duplicate check: ensure no other submitted invoice has this exact sorszam in this company
  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE company_id = v_company_id
      AND REPLACE(LOWER(bizonylatsorszam), ' ', '') = REPLACE(LOWER(v_nav_inv.invoice_number), ' ', '')
      AND id != p_submitted_invoice_id
  ) THEN
    RAISE EXCEPTION 'Már létezik számla ezzel a bizonylatsorszámmal (%) a cégnél!', v_nav_inv.invoice_number;
  END IF;

  v_note := COALESCE(
    NULLIF(TRIM(p_approval_note), ''),
    'Kézi / Javasolt összerendelés és jóváhagyás NAV számlával (' || v_nav_inv.invoice_number || ')'
  );

  -- 3. Update submitted invoice
  UPDATE public.invoices
  SET
    bizonylatsorszam = v_nav_inv.invoice_number,
    nav_status = 'verified',
    statusz = 'feldolgozott',
    approved_at = NOW(),
    approved_by = v_user_id,
    approval_note = v_note,
    frissitve = NOW()
  WHERE id = p_submitted_invoice_id;

  -- 4. Update NAV invoice submitted flag
  UPDATE public.nav_invoices
  SET
    submitted = true
  WHERE id = p_nav_invoice_id;

  -- 4b. Sync line items from invoice_items to nav_invoice_items if nav_invoice_items has no items
  IF NOT EXISTS (SELECT 1 FROM public.nav_invoice_items WHERE nav_invoice_id = p_nav_invoice_id) THEN
    INSERT INTO public.nav_invoice_items (
      nav_invoice_id,
      company_id,
      line_number,
      line_description,
      quantity,
      unit_of_measure,
      unit_price,
      net_amount,
      vat_amount,
      vat_rate,
      gross_amount,
      deductible_percentage,
      gl_classifications,
      vat_code,
      vat_code_id,
      product_code,
      net_weight_kg
    )
    SELECT
      p_nav_invoice_id,
      v_company_id,
      COALESCE(ii.line_number, ROW_NUMBER() OVER ()),
      ii.line_description,
      COALESCE(ii.quantity, 1),
      ii.unit_of_measure,
      COALESCE(ii.unit_price, ii.net_amount),
      COALESCE(ii.net_amount, 0),
      COALESCE(ii.vat_amount, 0),
      COALESCE(ii.vat_rate, '27%'),
      COALESCE(ii.gross_amount, COALESCE(ii.net_amount, 0) + COALESCE(ii.vat_amount, 0)),
      COALESCE(ii.deductible_percentage, 100),
      ii.gl_classifications,
      ii.vat_code,
      ii.vat_code_id,
      ii.product_code,
      ii.net_weight_kg
    FROM public.invoice_items ii
    WHERE ii.invoice_id = p_submitted_invoice_id;
  END IF;

  -- 5. If petty cash invoice, trigger petty cash sync
  IF v_sub_inv.invoice_type = 'penztarbizonylat' OR (v_sub_inv.fizetesi_mod IS NOT NULL AND v_sub_inv.fizetesi_mod ILIKE '%készpénz%') THEN
    PERFORM public.sync_petty_cash_entries(v_company_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'submitted_invoice_id', p_submitted_invoice_id,
    'nav_invoice_id', p_nav_invoice_id,
    'invoice_number', v_nav_inv.invoice_number,
    'statusz', 'feldolgozott',
    'nav_status', 'verified',
    'approved_at', NOW(),
    'approved_by', v_user_id,
    'approval_note', v_note
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_and_verify_submitted_invoice FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_and_verify_submitted_invoice TO authenticated, service_role;

-- ============================================================================
-- 2. Update mark_nav_invoice_as_submitted trigger to auto-copy items
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_nav_invoice_as_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Mark target NAV invoice as submitted
  IF NEW.bizonylatsorszam IS NOT NULL THEN
    UPDATE public.nav_invoices
    SET submitted = true
    WHERE REPLACE(LOWER(invoice_number), ' ', '') = REPLACE(LOWER(NEW.bizonylatsorszam), ' ', '')
      AND (
        (company_id = NEW.company_id) 
        OR (company_id IS NULL AND NEW.company_id IS NULL)
      )
      AND (submitted IS NULL OR submitted = false);

    -- 1b. Also sync invoice_items into nav_invoice_items if nav_invoice_items has 0 items
    INSERT INTO public.nav_invoice_items (
      nav_invoice_id,
      company_id,
      line_number,
      line_description,
      quantity,
      unit_of_measure,
      unit_price,
      net_amount,
      vat_amount,
      vat_rate,
      gross_amount,
      deductible_percentage,
      gl_classifications,
      vat_code,
      vat_code_id,
      product_code,
      net_weight_kg
    )
    SELECT
      ni.id,
      NEW.company_id,
      COALESCE(ii.line_number, ROW_NUMBER() OVER ()),
      ii.line_description,
      COALESCE(ii.quantity, 1),
      ii.unit_of_measure,
      COALESCE(ii.unit_price, ii.net_amount),
      COALESCE(ii.net_amount, 0),
      COALESCE(ii.vat_amount, 0),
      COALESCE(ii.vat_rate, '27%'),
      COALESCE(ii.gross_amount, COALESCE(ii.net_amount, 0) + COALESCE(ii.vat_amount, 0)),
      COALESCE(ii.deductible_percentage, 100),
      ii.gl_classifications,
      ii.vat_code,
      ii.vat_code_id,
      ii.product_code,
      ii.net_weight_kg
    FROM public.nav_invoices ni
    JOIN public.invoice_items ii ON ii.invoice_id = NEW.id
    WHERE REPLACE(LOWER(ni.invoice_number), ' ', '') = REPLACE(LOWER(NEW.bizonylatsorszam), ' ', '')
      AND (ni.company_id = NEW.company_id OR (ni.company_id IS NULL AND NEW.company_id IS NULL))
      AND NOT EXISTS (SELECT 1 FROM public.nav_invoice_items nii WHERE nii.nav_invoice_id = ni.id);
  END IF;

  -- 2. If bizonylatsorszam changed on UPDATE, reset previous NAV invoice submitted flag if no other invoice uses it
  IF TG_OP = 'UPDATE' AND OLD.bizonylatsorszam IS NOT NULL AND (NEW.bizonylatsorszam IS NULL OR OLD.bizonylatsorszam != NEW.bizonylatsorszam) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices
      WHERE id != NEW.id
        AND company_id = OLD.company_id
        AND REPLACE(LOWER(bizonylatsorszam), ' ', '') = REPLACE(LOWER(OLD.bizonylatsorszam), ' ', '')
    ) THEN
      UPDATE public.nav_invoices
      SET submitted = false
      WHERE REPLACE(LOWER(invoice_number), ' ', '') = REPLACE(LOWER(OLD.bizonylatsorszam), ' ', '')
        AND (
          (company_id = OLD.company_id)
          OR (company_id IS NULL AND OLD.company_id IS NULL)
        )
        AND submitted = true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 3. Update calculate_hungarian_vat_return with LATERAL fallback to invoice_items
-- ============================================================================

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
  v_line11_base NUMERIC := 0;
  v_line12_base NUMERIC := 0; v_line12_tax NUMERIC := 0;
  v_line13_base NUMERIC := 0; v_line13_tax NUMERIC := 0;
  v_line14_base NUMERIC := 0; v_line14_tax NUMERIC := 0;
  v_line15_base NUMERIC := 0; v_line15_tax NUMERIC := 0;
  v_line16_base NUMERIC := 0; v_line16_tax NUMERIC := 0;
  v_line69_base NUMERIC := 0; v_line69_tax NUMERIC := 0;
  v_line43_base NUMERIC := 0;
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
  v_is_service BOOLEAN;
  v_calculated_eu_tax NUMERIC;
  v_effective_tax_date DATE;
  v_is_paid BOOLEAN;
  v_is_fad BOOLEAN;
  v_calculated_fad_tax NUMERIC;

  v_prev_month INTEGER;
  v_prev_year INTEGER;

  v_override_row TEXT;
  v_target_row_obj JSONB;
  v_target_col TEXT;
  v_target_row TEXT;
  v_calculated_tax NUMERIC;
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
    -- Source A: nav_invoices
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
      COALESCE(vc.is_reverse_charge, CASE WHEN vc.id IS NOT NULL THEN false ELSE ni.is_reverse_charge END, false) AS is_reverse_charge,
      nii.product_code,
      nii.line_description,
      nii.net_weight_kg,
      COALESCE(nii.net_amount, ni.invoice_net_amount, 0)::numeric AS net_amount,
      COALESCE(nii.vat_amount, ni.invoice_vat_amount, 0)::numeric AS vat_amount,
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
      COALESCE(nii.deductible_percentage, 100.0)::numeric AS deductible_pct,
      COALESCE(app_inv.is_advance, nii.line_description ILIKE '%előleg%', false) AS is_advance,
      COALESCE(app_inv.is_tangible_asset, false) AS is_tangible_asset,
      COALESCE(ni.vat_row_override, app_inv.vat_row_override, vc.target_rows->0->>'row') AS vat_row_override,
      COALESCE(vc.code, nii.vat_code, '') AS vat_code_code,
      vc.target_rows AS vat_code_target_rows,
      COALESCE(vc.vat_percent, 27) AS vat_percent,
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
    LEFT JOIN LATERAL (
      SELECT 
        nii_inner.id,
        nii_inner.nav_invoice_id,
        nii_inner.line_number,
        nii_inner.line_description,
        nii_inner.quantity,
        nii_inner.unit_price,
        nii_inner.net_amount,
        nii_inner.vat_amount,
        nii_inner.vat_rate,
        nii_inner.gross_amount,
        nii_inner.deductible_percentage,
        nii_inner.gl_classifications,
        nii_inner.vat_code,
        nii_inner.vat_code_id,
        nii_inner.product_code,
        nii_inner.net_weight_kg
      FROM public.nav_invoice_items nii_inner
      WHERE nii_inner.nav_invoice_id = ni.id

      UNION ALL

      SELECT 
        ii_inner.id,
        ni.id AS nav_invoice_id,
        ii_inner.line_number,
        ii_inner.line_description,
        ii_inner.quantity,
        ii_inner.unit_price,
        ii_inner.net_amount,
        ii_inner.vat_amount,
        ii_inner.vat_rate,
        (COALESCE(ii_inner.net_amount, 0) + COALESCE(ii_inner.vat_amount, 0)) AS gross_amount,
        ii_inner.deductible_percentage,
        ii_inner.gl_classifications,
        ii_inner.vat_code,
        ii_inner.vat_code_id,
        ii_inner.product_code,
        ii_inner.net_weight_kg
      FROM public.invoices inv_inner
      JOIN public.invoice_items ii_inner ON ii_inner.invoice_id = inv_inner.id
      WHERE inv_inner.company_id = p_company_id
        AND REPLACE(LOWER(inv_inner.bizonylatsorszam), ' ', '') = REPLACE(LOWER(ni.invoice_number), ' ', '')
        AND NOT EXISTS (SELECT 1 FROM public.nav_invoice_items n2 WHERE n2.nav_invoice_id = ni.id)
    ) nii ON true
    LEFT JOIN vat_codes vc ON (
      vc.id = COALESCE(nii.vat_code_id, ni.vat_code_id)
      OR (COALESCE(nii.vat_code_id, ni.vat_code_id) IS NULL AND vc.company_id = ni.company_id AND vc.code = COALESCE(nii.vat_code, ''))
    )
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
        WHERE t2.matched_invoice_id = ni.id
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

    UNION ALL

    -- Source B: uploaded / manual invoices not in nav_invoices (e.g. foreign invoices like Google Ireland, Hetzner, Adobe, Digital Charging)
    SELECT
      inv.id,
      inv.bizonylatsorszam AS invoice_number,
      inv.invoice_direction,
      COALESCE(inv.penznem, 'HUF') AS currency,
      COALESCE(inv.teljesites_datuma, inv.kibocsatas_datuma)::date AS delivery_date,
      COALESCE(inv.fizetesi_mod, 'TRANSFER') AS payment_method,
      COALESCE(inv.elado_nev, 'Ismeretlen eladó') AS supplier_name,
      COALESCE(inv.elado_vat_id, '') AS supplier_tax_number,
      COALESCE(inv.vevo_nev, 'Ismeretlen vevő') AS customer_name,
      COALESCE(inv.vevo_vat_id, '') AS customer_tax_number,
      COALESCE(inv.penzforgalmi_elszamolas, false) AS is_cash_accounting,
      inv.transaction_id,
      inv.manual_payment_date::date AS manual_payment_date,
      t_inv.tx_id,
      t_inv.transaction_date,
      COALESCE(vc.is_reverse_charge, CASE WHEN vc.id IS NOT NULL THEN false ELSE inv.forditott_adozas END, false) AS is_reverse_charge,
      COALESCE(ii.product_code, '') AS product_code,
      COALESCE(ii.line_description, inv.termek_szolgaltatas_tipusa, '') AS line_description,
      COALESCE(ii.net_weight_kg, 0)::numeric AS net_weight_kg,
      COALESCE(ii.net_amount, inv.adoalap_osszesen, 0)::numeric AS net_amount,
      COALESCE(ii.vat_amount, inv.afa_osszeg_osszesen, 0)::numeric AS vat_amount,
      COALESCE(
        ii.vat_rate,
        CASE 
          WHEN COALESCE(inv.adoalap_osszesen, 0) > 0 AND COALESCE(inv.afa_osszeg_osszesen, 0) > 0 
               AND ROUND(inv.afa_osszeg_osszesen / inv.adoalap_osszesen, 2) = 0.27 THEN '27%'
          WHEN COALESCE(inv.adoalap_osszesen, 0) > 0 AND COALESCE(inv.afa_osszeg_osszesen, 0) > 0 
               AND ROUND(inv.afa_osszeg_osszesen / inv.adoalap_osszesen, 2) = 0.18 THEN '18%'
          WHEN COALESCE(inv.adoalap_osszesen, 0) > 0 AND COALESCE(inv.afa_osszeg_osszesen, 0) > 0 
               AND ROUND(inv.afa_osszeg_osszesen / inv.adoalap_osszesen, 2) = 0.05 THEN '5%'
          WHEN COALESCE(inv.afa_osszeg_osszesen, 0) > 0 THEN '27%'
          ELSE '0%'
        END
      ) AS vat_rate,
      COALESCE(ii.deductible_percentage, 100.0)::numeric AS deductible_pct,
      (COALESCE(inv.invoice_type, '') = 'elolegszamla' OR COALESCE(ii.line_description, '') ILIKE '%előleg%') AS is_advance,
      (COALESCE(inv.vat_row_override, '') IN ('43', '77')) AS is_tangible_asset,
      inv.vat_row_override,
      COALESCE(vc.code, ii.vat_code, '') AS vat_code_code,
      vc.target_rows AS vat_code_target_rows,
      COALESCE(vc.vat_percent, 27) AS vat_percent,
      false AS is_drs
    FROM invoices inv
    LEFT JOIN invoice_items ii ON ii.invoice_id = inv.id
    LEFT JOIN vat_codes vc ON (
      vc.id = COALESCE(ii.vat_code_id, inv.vat_code_id)
      OR (COALESCE(ii.vat_code_id, inv.vat_code_id) IS NULL AND vc.company_id = inv.company_id AND vc.code = COALESCE(ii.vat_code, ''))
    )
    LEFT JOIN LATERAL (
      SELECT tx_id, transaction_date FROM (
        SELECT t1.id AS tx_id, t1.transaction_date
        FROM public.transactions t1
        WHERE inv.transaction_id IS NOT NULL AND t1.id = inv.transaction_id
        UNION ALL
        SELECT t2.id AS tx_id, t2.transaction_date
        FROM public.transactions t2
        WHERE t2.matched_invoice_id = inv.id
        UNION ALL
        SELECT t3.id AS tx_id, t3.transaction_date
        FROM public.transaction_invoice_matches tim
        JOIN public.transactions t3 ON t3.id = tim.transaction_id
        WHERE tim.invoice_id = inv.id
      ) candidate_tx
      ORDER BY transaction_date DESC NULLS LAST
      LIMIT 1
    ) t_inv ON true
    WHERE inv.company_id = p_company_id
      AND COALESCE(inv.invoice_type, '') NOT IN ('dijbekero_proforma', 'dijbekero', 'proforma', 'garanciajegy')
      AND inv.bizonylatsorszam NOT ILIKE 'D-%'
      AND inv.bizonylatsorszam NOT ILIKE 'DÍJ%'
      AND inv.bizonylatsorszam NOT ILIKE 'DIJ%'
      AND inv.bizonylatsorszam NOT ILIKE 'PROFORMA%'
      AND inv.bizonylatsorszam NOT ILIKE 'PRO-%'
      AND inv.bizonylatsorszam NOT ILIKE 'PRO_%'
      AND inv.bizonylatsorszam NOT ILIKE 'PRO/%'
      AND inv.bizonylatsorszam NOT ILIKE '%PREDRACUN%'
      AND inv.bizonylatsorszam NOT ILIKE '%PREDRAČUN%'
      AND NOT EXISTS (
        SELECT 1 FROM nav_invoices ni_chk
        WHERE ni_chk.company_id = p_company_id
          AND (
            REGEXP_REPLACE(UPPER(ni_chk.invoice_number), '[^A-Z0-9]', '', 'g') = REGEXP_REPLACE(UPPER(inv.bizonylatsorszam), '[^A-Z0-9]', '', 'g')
            OR (
              LENGTH(REGEXP_REPLACE(UPPER(inv.bizonylatsorszam), '[^A-Z0-9]', '', 'g')) >= 6
              AND (
                REGEXP_REPLACE(UPPER(ni_chk.invoice_number), '[^A-Z0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(UPPER(inv.bizonylatsorszam), '[^A-Z0-9]', '', 'g')
                OR REGEXP_REPLACE(UPPER(inv.bizonylatsorszam), '[^A-Z0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(UPPER(ni_chk.invoice_number), '[^A-Z0-9]', '', 'g')
              )
            )
            -- Partner + date + amount fuzzy deduplication (catches OCR typos like 831500377134 vs 831500073714)
            OR (
              (
                (ni_chk.supplier_tax_number IS NOT NULL AND inv.elado_vat_id IS NOT NULL AND SPLIT_PART(ni_chk.supplier_tax_number, '-', 1) = SPLIT_PART(inv.elado_vat_id, '-', 1) AND LENGTH(SPLIT_PART(ni_chk.supplier_tax_number, '-', 1)) >= 8)
                OR (REGEXP_REPLACE(UPPER(ni_chk.supplier_name), '[^A-Z0-9]', '', 'g') = REGEXP_REPLACE(UPPER(inv.elado_nev), '[^A-Z0-9]', '', 'g') AND LENGTH(REGEXP_REPLACE(UPPER(ni_chk.supplier_name), '[^A-Z0-9]', '', 'g')) >= 5)
              )
              AND COALESCE(ni_chk.ti_override, ni_chk.calculated_ti, ni_chk.invoice_delivery_date, ni_chk.invoice_issue_date)::date = COALESCE(inv.teljesites_datuma, inv.kibocsatas_datuma)::date
              AND ABS(COALESCE(ni_chk.invoice_net_amount, 0) - COALESCE(inv.adoalap_osszesen, 0)) < 1.0
              AND ABS(COALESCE(ni_chk.invoice_vat_amount, 0) - COALESCE(inv.afa_osszeg_osszesen, 0)) < 1.0
            )
          )
      )
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
      IF NOT v_is_eu_supplier AND inv_rec.supplier_name ~* '(google|meta|facebook|hetzner|adobe|microsoft ireland|aws|amazon web|linkedin ireland|apple distribution)' THEN
        v_is_eu_supplier := true;
      END IF;
      v_is_foreign_supplier := v_is_eu_supplier OR (inv_rec.currency <> 'HUF' AND NOT (v_supplier_tax_num ~ '^[0-9]{8}'));

      v_is_service := (
        inv_rec.vat_rate IN ('ATHK', 'EUK', 'EUF', 'EUT', 'HO', 'EU_SZOLG_BE', 'KIM_EU_SZOLG')
        OR COALESCE(inv_rec.line_description, '') ~* '(szolgáltatás|szolg|tanácsadás|tanacsadas|consulting|fejlesztés|fejlesztes|szoftver|software|licenc|license|bérlet|berlet|hosting|cloud|szerver|server|díj|alapdíj|karbantartás|oktatás|ügyvitel|marketing|hirdetés|ads|api|token|support)'
        OR COALESCE(inv_rec.product_code, '') ~ '^[5-9][0-9]'
        OR COALESCE(inv_rec.supplier_name, '') ~* '(hetzner|google|meta|facebook|adobe|microsoft|aws|amazon web|github|zoom|linkedin|apple|openai|anthropic|digitalocean|ovh|cloudflare|stripe|atlassian|slack|canva|figma|notion|mailchimp|hubspot)'
        OR (COALESCE(inv_rec.net_weight_kg, 0) = 0 AND NOT (COALESCE(inv_rec.product_code, '') ~ '^[0-4][0-9]'))
      );

      v_is_fad := (
        NOT v_is_foreign_supplier
        AND NOT (inv_rec.vat_code_code ILIKE 'EU_%' OR inv_rec.vat_code_code ILIKE 'KIM_EU%')
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
          v_target_col := v_target_row_obj->>'col';
          v_target_row := v_target_row_obj->>'row';

          IF v_target_col = 'base' THEN
            IF v_target_row = '01' THEN v_line01_base := v_line01_base + v_net_huf;
            ELSIF v_target_row = '02' THEN v_line02_base := v_line02_base + v_net_huf;
            ELSIF v_target_row = '04' THEN v_line04_base := v_line04_base + v_net_huf;
            ELSIF v_target_row = '05' THEN v_line05_base := v_line05_base + v_net_huf;
            ELSIF v_target_row = '06' THEN v_line06_base := v_line06_base + v_net_huf;
            ELSIF v_target_row = '07' THEN v_line07_base := v_line07_base + v_net_huf;
            ELSIF v_target_row = '08' THEN v_line08_base := v_line08_base + v_net_huf;
            ELSIF v_target_row = '11' THEN v_line11_base := v_line11_base + v_net_huf;
            ELSIF v_target_row = '12' THEN v_line12_base := v_line12_base + v_net_huf;
            ELSIF v_target_row = '13' THEN v_line13_base := v_line13_base + v_net_huf;
            ELSIF v_target_row = '14' THEN v_line14_base := v_line14_base + v_net_huf;
            ELSIF v_target_row = '15' THEN v_line15_base := v_line15_base + v_net_huf;
            ELSIF v_target_row = '16' THEN v_line16_base := v_line16_base + v_net_huf;
            ELSIF v_target_row = '18' THEN v_line18_base := v_line18_base + v_net_huf;
            ELSIF v_target_row = '27' THEN v_line27_base := v_line27_base + v_net_huf;
            ELSIF v_target_row = '29' THEN v_line29_base := v_line29_base + v_net_huf;
            ELSIF v_target_row = '43' THEN v_line43_base := v_line43_base + v_net_huf;
            ELSIF v_target_row = '45' THEN v_line45_base := v_line45_base + v_net_huf;
            ELSIF v_target_row = '63' THEN v_line63_base := v_line63_base + v_net_huf;
            ELSIF v_target_row = '64' THEN v_line64_base := v_line64_base + v_net_huf;
            ELSIF v_target_row = '65' THEN v_line65_base := v_line65_base + v_net_huf;
            ELSIF v_target_row = '66' THEN
              v_line66_base := v_line66_base + v_net_huf;
              IF inv_rec.vat_code_code ILIKE '%FAD%' THEN
                v_line66_fad_base := v_line66_fad_base + v_net_huf;
              END IF;
            ELSIF v_target_row = '67' THEN v_line67_base := v_line67_base + v_net_huf;
            ELSIF v_target_row = '69' THEN v_line69_base := v_line69_base + v_net_huf;
            ELSIF v_target_row = '91' THEN v_line91_base := v_line91_base + v_net_huf;
            ELSIF v_target_row = '92' THEN v_line92_base := v_line92_base + v_net_huf;
            END IF;

          ELSIF v_target_col = 'tax' THEN
            v_calculated_tax := COALESCE(
              NULLIF(v_tax_huf, 0),
              ROUND(v_net_huf * (COALESCE(inv_rec.vat_percent, 27) / 100.0), 2)
            );

            IF v_target_row = '05' THEN v_line05_tax := v_line05_tax + v_calculated_tax;
            ELSIF v_target_row = '06' THEN v_line06_tax := v_line06_tax + v_calculated_tax;
            ELSIF v_target_row = '07' THEN v_line07_tax := v_line07_tax + v_calculated_tax;
            ELSIF v_target_row = '12' THEN v_line12_tax := v_line12_tax + v_calculated_tax;
            ELSIF v_target_row = '13' THEN v_line13_tax := v_line13_tax + v_calculated_tax;
            ELSIF v_target_row = '14' THEN v_line14_tax := v_line14_tax + v_calculated_tax;
            ELSIF v_target_row = '15' THEN v_line15_tax := v_line15_tax + v_calculated_tax;
            ELSIF v_target_row = '16' THEN v_line16_tax := v_line16_tax + v_calculated_tax;
            ELSIF v_target_row = '18' THEN v_line18_tax := v_line18_tax + v_calculated_tax;
            ELSIF v_target_row = '27' THEN v_line27_tax := v_line27_tax + v_calculated_tax;
            ELSIF v_target_row = '29' THEN v_line29_tax := v_line29_tax + v_calculated_tax;
            ELSIF v_target_row = '64' THEN v_line64_tax := v_line64_tax + ROUND(v_calculated_tax * (inv_rec.deductible_pct / 100.0), 2);
            ELSIF v_target_row = '65' THEN v_line65_tax := v_line65_tax + ROUND(v_calculated_tax * (inv_rec.deductible_pct / 100.0), 2);
            ELSIF v_target_row = '66' THEN
              v_line66_tax := v_line66_tax + ROUND(v_calculated_tax * (inv_rec.deductible_pct / 100.0), 2);
              IF inv_rec.vat_code_code ILIKE '%FAD%' THEN
                v_line66_fad_tax := v_line66_fad_tax + ROUND(v_calculated_tax * (inv_rec.deductible_pct / 100.0), 2);
              END IF;
            ELSIF v_target_row = '67' THEN v_line67_tax := v_line67_tax + ROUND(v_calculated_tax * (inv_rec.deductible_pct / 100.0), 2);
            ELSIF v_target_row = '69' THEN v_line69_tax := v_line69_tax + ROUND(v_calculated_tax * (inv_rec.deductible_pct / 100.0), 2);
            ELSIF v_target_row = '77' THEN v_line77_tax := v_line77_tax + v_calculated_tax;
            END IF;
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
          ELSIF v_override_row = '11' THEN v_line11_base := v_line11_base + v_net_huf;
          ELSIF v_override_row = '12' THEN v_line12_base := v_line12_base + v_net_huf; v_line12_tax := v_line12_tax + v_tax_huf;
          ELSIF v_override_row = '13' THEN v_line13_base := v_line13_base + v_net_huf; v_line13_tax := v_line13_tax + v_tax_huf;
          ELSIF v_override_row = '14' THEN v_line14_base := v_line14_base + v_net_huf; v_line14_tax := v_line14_tax + v_tax_huf;
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
          ELSIF v_override_row = '43' THEN
            v_line07_base := v_line07_base + v_net_huf;
            v_line07_tax  := v_line07_tax  + v_tax_huf;
            v_line43_base := v_line43_base + v_net_huf;
          ELSIF v_override_row = '45' THEN
            v_line07_base := v_line07_base + v_net_huf;
            v_line07_tax  := v_line07_tax  + v_tax_huf;
            v_line45_base := v_line45_base + v_net_huf;
          ELSIF v_override_row = '91' THEN v_line91_base := v_line91_base + v_net_huf;
          ELSIF v_override_row = '92' THEN v_line92_base := v_line92_base + v_net_huf;
          ELSIF v_override_row = '63' THEN v_line63_base := v_line63_base + v_net_huf;
          ELSIF v_override_row = '64' THEN v_line64_base := v_line64_base + v_net_huf; v_line64_tax := v_line64_tax + v_tax_huf;
          ELSIF v_override_row = '65' THEN v_line65_base := v_line65_base + v_net_huf; v_line65_tax := v_line65_tax + v_tax_huf;
          ELSIF v_override_row = '66' THEN v_line66_base := v_line66_base + v_net_huf; v_line66_tax := v_line66_tax + v_tax_huf;
          ELSIF v_override_row = '67' THEN v_line67_base := v_line67_base + v_net_huf; v_line67_tax := v_line67_tax + v_tax_huf;
          ELSIF v_override_row = '69' THEN v_line69_base := v_line69_base + v_net_huf; v_line69_tax := v_line69_tax + v_tax_huf;
          ELSIF v_override_row = '77' THEN
            v_line66_base := v_line66_base + v_net_huf;
            v_line66_tax  := v_line66_tax  + v_tax_huf;
            v_line77_tax  := v_line77_tax  + v_tax_huf;
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
                IF v_is_service THEN
                  v_line91_base := v_line91_base + v_net_huf;
                  v_line92_base := v_line92_base + v_net_huf;
                ELSE
                  v_line02_base := v_line02_base + v_net_huf;
                END IF;
              ELSE
                v_line08_base := v_line08_base + v_net_huf;
              END IF;
            END IF;

            IF inv_rec.is_advance THEN
              v_line45_base := v_line45_base + v_net_huf;
            END IF;

            IF inv_rec.is_tangible_asset THEN
              v_line43_base := v_line43_base + v_net_huf;
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
            ELSIF v_is_eu_supplier OR inv_rec.vat_code_code ILIKE 'EU_%' THEN
              v_calculated_eu_tax := ROUND(v_net_huf * 0.27, 2);
              IF v_is_service OR inv_rec.vat_code_code ILIKE 'EU_SZOLG%' THEN
                v_line18_base := v_line18_base + v_net_huf;
                v_line18_tax  := v_line18_tax  + v_calculated_eu_tax;
                v_line67_base := v_line67_base + v_net_huf;
                v_line67_tax  := v_line67_tax  + ROUND(v_calculated_eu_tax * (inv_rec.deductible_pct / 100.0), 2);
              ELSE
                IF inv_rec.vat_rate IN ('5%', '0.05', '5') OR inv_rec.vat_code_code ILIKE '%_5' THEN
                  v_line12_base := v_line12_base + v_net_huf;
                  v_line12_tax  := v_line12_tax  + ROUND(v_net_huf * 0.05, 2);
                  v_line69_base := v_line69_base + v_net_huf;
                  v_line69_tax  := v_line69_tax  + ROUND(ROUND(v_net_huf * 0.05, 2) * (inv_rec.deductible_pct / 100.0), 2);
                ELSIF inv_rec.vat_rate IN ('18%', '0.18', '18') OR inv_rec.vat_code_code ILIKE '%_18' THEN
                  v_line13_base := v_line13_base + v_net_huf;
                  v_line13_tax  := v_line13_tax  + ROUND(v_net_huf * 0.18, 2);
                  v_line69_base := v_line69_base + v_net_huf;
                  v_line69_tax  := v_line69_tax  + ROUND(ROUND(v_net_huf * 0.18, 2) * (inv_rec.deductible_pct / 100.0), 2);
                ELSE
                  v_line14_base := v_line14_base + v_net_huf;
                  v_line14_tax  := v_line14_tax  + v_calculated_eu_tax;
                  v_line69_base := v_line69_base + v_net_huf;
                  v_line69_tax  := v_line69_tax  + ROUND(v_calculated_eu_tax * (inv_rec.deductible_pct / 100.0), 2);
                END IF;
              END IF;
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

  -- POPULATE OUTPUT VAT RETURN LINES
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

  IF v_line11_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '11', v_line11_base, 0, ROUND(v_line11_base/1000)::int, 0, ARRAY['EU_TERM_0'], true);
  END IF;

  IF v_line12_base > 0 OR v_line12_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '12', v_line12_base, v_line12_tax, ROUND(v_line12_base/1000)::int, ROUND(v_line12_tax/1000)::int, ARRAY['EU_TERM_5'], true);
  END IF;

  IF v_line13_base > 0 OR v_line13_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '13', v_line13_base, v_line13_tax, ROUND(v_line13_base/1000)::int, ROUND(v_line13_tax/1000)::int, ARRAY['EU_TERM_18'], true);
  END IF;

  IF v_line14_base > 0 OR v_line14_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '14', v_line14_base, v_line14_tax, ROUND(v_line14_base/1000)::int, ROUND(v_line14_tax/1000)::int, ARRAY['EU_TERM_27'], true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE
    SET base_amount = EXCLUDED.base_amount,
        tax_amount = EXCLUDED.tax_amount,
        base_amount_rounded = EXCLUDED.base_amount_rounded,
        tax_amount_rounded = EXCLUDED.tax_amount_rounded,
        source_vat_codes = EXCLUDED.source_vat_codes,
        is_calculated = EXCLUDED.is_calculated;
  END IF;

  IF v_line15_base > 0 OR v_line15_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '15', v_line15_base, v_line15_tax, ROUND(v_line15_base/1000)::int, ROUND(v_line15_tax/1000)::int, ARRAY['EU_UJ_KOZL'], true);
  END IF;

  IF v_line16_base > 0 OR v_line16_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '16', v_line16_base, v_line16_tax, ROUND(v_line16_base/1000)::int, ROUND(v_line16_tax/1000)::int, ARRAY['EU_ASVANYOLAJ'], true);
  END IF;

  IF v_line43_base > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '43', v_line43_base, 0, ROUND(v_line43_base/1000)::int, 0, ARRAY['KIM_TE_ERT'], true);
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
    VALUES (v_return_id, '67', v_line67_base, v_line67_tax, ROUND(v_line67_base/1000)::int, ROUND(v_line67_tax/1000)::int, ARRAY['BE_IMPORT', 'BE_EU_SZOLG'], true);
  END IF;

  IF v_line69_base > 0 OR v_line69_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '69', v_line69_base, v_line69_tax, ROUND(v_line69_base/1000)::int, ROUND(v_line69_tax/1000)::int, ARRAY['BE_EU_TERM'], true)
    ON CONFLICT (vat_return_id, row_number) DO UPDATE
    SET base_amount = EXCLUDED.base_amount,
        tax_amount = EXCLUDED.tax_amount,
        base_amount_rounded = EXCLUDED.base_amount_rounded,
        tax_amount_rounded = EXCLUDED.tax_amount_rounded,
        source_vat_codes = EXCLUDED.source_vat_codes,
        is_calculated = EXCLUDED.is_calculated;
  END IF;

  IF v_line77_tax > 0 THEN
    INSERT INTO vat_return_lines (vat_return_id, row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded, source_vat_codes, is_calculated)
    VALUES (v_return_id, '77', 0, v_line77_tax, 0, ROUND(v_line77_tax/1000)::int, ARRAY['TARGYI_ESZKOZ'], true);
  END IF;

  v_total_payable_base := v_line01_base + v_line02_base + v_line04_base + v_line05_base + v_line06_base + v_line07_base + v_line08_base + v_line11_base + v_line12_base + v_line13_base + v_line14_base + v_line15_base + v_line16_base + v_line18_base + v_line27_base + v_line29_base + v_line91_base + v_line92_base;
  v_total_payable_tax  := v_line05_tax + v_line06_tax + v_line07_tax + v_line12_tax + v_line13_tax + v_line14_tax + v_line15_tax + v_line16_tax + v_line18_tax + v_line27_tax + v_line29_tax;

  v_total_deductible_base := v_line63_base + v_line64_base + v_line65_base + v_line66_base + v_line67_base + v_line69_base;
  v_total_deductible_tax  := v_line64_tax + v_line65_tax + v_line66_tax + v_line67_tax + v_line69_tax;

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

  -- Populate 65M domestic summary lines
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
    LEFT JOIN LATERAL (
      SELECT 
        nii_inner.vat_rate,
        nii_inner.net_amount,
        nii_inner.vat_amount,
        nii_inner.gross_amount,
        nii_inner.deductible_percentage,
        nii_inner.line_description
      FROM public.nav_invoice_items nii_inner
      WHERE nii_inner.nav_invoice_id = ni.id

      UNION ALL

      SELECT 
        ii_inner.vat_rate,
        ii_inner.net_amount,
        ii_inner.vat_amount,
        ii_inner.gross_amount,
        ii_inner.deductible_percentage,
        ii_inner.line_description
      FROM public.invoices inv_inner
      JOIN public.invoice_items ii_inner ON ii_inner.invoice_id = inv_inner.id
      WHERE inv_inner.company_id = p_company_id
        AND REPLACE(LOWER(inv_inner.bizonylatsorszam), ' ', '') = REPLACE(LOWER(ni.invoice_number), ' ', '')
        AND NOT EXISTS (SELECT 1 FROM public.nav_invoice_items n2 WHERE n2.nav_invoice_id = ni.id)
    ) nii ON true
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
      AND ni.invoice_number NOT ILIKE 'D-%'
      AND ni.invoice_number NOT ILIKE 'DÍJ%'
      AND ni.invoice_number NOT ILIKE 'DIJ%'
      AND ni.invoice_number NOT ILIKE 'PROFORMA%'
      AND ni.invoice_number NOT ILIKE 'PRO-%'
      AND ni.invoice_number NOT ILIKE 'PRO_%'
      AND ni.invoice_number NOT ILIKE 'PRO/%'
      AND ni.invoice_number NOT ILIKE '%PREDRACUN%'
      AND ni.invoice_number NOT ILIKE '%PREDRAČUN%'
      AND NOT (
        LENGTH(REGEXP_REPLACE(COALESCE(ni.supplier_tax_number, ''), '[^0-9]', '', 'g')) >= 9
        AND SUBSTRING(REGEXP_REPLACE(COALESCE(ni.supplier_tax_number, ''), '[^0-9]', '', 'g') FROM 9 FOR 1) = '1'
      )
      AND NOT (
        COALESCE(ni.supplier_name, '') ILIKE '%alanyi adómentes%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%alanyi mentes%'
        OR COALESCE(ni.supplier_name, '') ILIKE '%(aam)%'
      )
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
      COALESCE(inv.brutto_vegosszeg, (COALESCE(inv.adoalap_osszesen, 0) + COALESCE(inv.afa_osszeg_osszesen, 0))) AS gross_amount,
      CASE 
        WHEN COALESCE(inv.afa_osszeg_osszesen, 0) > 0 AND COALESCE(inv.adoalap_osszesen, 0) > 0 
             AND ROUND(inv.afa_osszeg_osszesen / inv.adoalap_osszesen, 2) = 0.27 THEN COALESCE(inv.afa_osszeg_osszesen, 0)
        ELSE 0 
      END AS tax_27,
      CASE 
        WHEN COALESCE(inv.afa_osszeg_osszesen, 0) > 0 AND COALESCE(inv.adoalap_osszesen, 0) > 0 
             AND ROUND(inv.afa_osszeg_osszesen / inv.adoalap_osszesen, 2) = 0.18 THEN COALESCE(inv.afa_osszeg_osszesen, 0)
        ELSE 0 
      END AS tax_18,
      CASE 
        WHEN COALESCE(inv.afa_osszeg_osszesen, 0) > 0 AND COALESCE(inv.adoalap_osszesen, 0) > 0 
             AND ROUND(inv.afa_osszeg_osszesen / inv.adoalap_osszesen, 2) = 0.05 THEN COALESCE(inv.afa_osszeg_osszesen, 0)
        ELSE 0 
      END AS tax_5
    FROM invoices inv
    WHERE inv.company_id = p_company_id
      AND inv.invoice_direction = 'INBOUND'
      AND COALESCE(inv.teljesites_datuma, inv.kibocsatas_datuma)::date BETWEEN v_date_from AND v_date_to
      AND COALESCE(inv.invoice_type, '') NOT IN ('dijbekero_proforma', 'dijbekero', 'proforma', 'garanciajegy')
      AND inv.bizonylatsorszam NOT ILIKE 'D-%'
      AND inv.bizonylatsorszam NOT ILIKE 'DÍJ%'
      AND inv.bizonylatsorszam NOT ILIKE 'DIJ%'
      AND inv.bizonylatsorszam NOT ILIKE 'PROFORMA%'
      AND inv.bizonylatsorszam NOT ILIKE 'PRO-%'
      AND inv.bizonylatsorszam NOT ILIKE 'PRO_%'
      AND inv.bizonylatsorszam NOT ILIKE 'PRO/%'
      AND inv.bizonylatsorszam NOT ILIKE '%PREDRACUN%'
      AND inv.bizonylatsorszam NOT ILIKE '%PREDRAČUN%'
      AND NOT EXISTS (
        SELECT 1 FROM nav_invoices ni_sub
        WHERE ni_sub.company_id = p_company_id
          AND (
            REGEXP_REPLACE(UPPER(ni_sub.invoice_number), '[^A-Z0-9]', '', 'g') = REGEXP_REPLACE(UPPER(inv.bizonylatsorszam), '[^A-Z0-9]', '', 'g')
            OR (
              LENGTH(REGEXP_REPLACE(UPPER(inv.bizonylatsorszam), '[^A-Z0-9]', '', 'g')) >= 6
              AND (
                REGEXP_REPLACE(UPPER(ni_sub.invoice_number), '[^A-Z0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(UPPER(inv.bizonylatsorszam), '[^A-Z0-9]', '', 'g')
                OR REGEXP_REPLACE(UPPER(inv.bizonylatsorszam), '[^A-Z0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(UPPER(ni_sub.invoice_number), '[^A-Z0-9]', '', 'g')
              )
            )
          )
      )
      AND inv.bizonylatsorszam NOT ILIKE 'DIJ%'
      AND inv.bizonylatsorszam NOT ILIKE 'PROFORMA%'
      AND inv.bizonylatsorszam NOT ILIKE 'PRO-%'
      AND inv.bizonylatsorszam NOT ILIKE 'PRO_%'
      AND inv.bizonylatsorszam NOT ILIKE 'PRO/%'
      AND inv.bizonylatsorszam NOT ILIKE '%PREDRACUN%'
      AND inv.bizonylatsorszam NOT ILIKE '%PREDRAČUN%'
      AND NOT (
        LENGTH(REGEXP_REPLACE(COALESCE(inv.elado_vat_id, ''), '[^0-9]', '', 'g')) >= 9
        AND SUBSTRING(REGEXP_REPLACE(COALESCE(inv.elado_vat_id, ''), '[^0-9]', '', 'g') FROM 9 FOR 1) = '1'
      )
      AND NOT (
        COALESCE(inv.elado_nev, '') ILIKE '%alanyi adómentes%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%alanyi mentes%'
        OR COALESCE(inv.elado_nev, '') ILIKE '%(aam)%'
      )
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
    MAX(ai.partner_name) AS partner_name,
    ai.partner_tax_number,
    COUNT(DISTINCT ai.invoice_number) AS invoice_count,
    ROUND(SUM(ai.net_amount), 2) AS base_amount,
    ROUND(SUM(ai.vat_amount), 2) AS tax_amount,
    ROUND(SUM(ai.net_amount) / 1000)::integer AS base_amount_rounded,
    ROUND(SUM(ai.vat_amount) / 1000)::integer AS tax_amount_rounded,
    ROUND(SUM(ai.tax_27), 2) AS tax_27_amount,
    ROUND(SUM(ai.tax_18), 2) AS tax_18_amount,
    ROUND(SUM(ai.tax_5), 2) AS tax_5_amount,
    jsonb_agg(
      jsonb_build_object(
        'invoice_id', ai.invoice_id,
        'invoice_number', ai.invoice_number,
        'delivery_date', ai.delivery_date,
        'issue_date', ai.issue_date,
        'net_amount', ai.net_amount,
        'vat_amount', ai.vat_amount,
        'gross_amount', ai.gross_amount
      )
    ) AS invoice_details
  FROM all_inbounds ai
  WHERE ai.vat_amount > 0 OR ai.tax_27 > 0 OR ai.tax_18 > 0 OR ai.tax_5 > 0
  GROUP BY ai.partner_tax_number
  HAVING SUM(ai.vat_amount) > 0 OR SUM(ai.tax_27) > 0 OR SUM(ai.tax_18) > 0 OR SUM(ai.tax_5) > 0
  ON CONFLICT (vat_return_id, partner_tax_number) DO UPDATE
  SET base_amount = EXCLUDED.base_amount,
      tax_amount = EXCLUDED.tax_amount,
      base_amount_rounded = EXCLUDED.base_amount_rounded,
      tax_amount_rounded = EXCLUDED.tax_amount_rounded,
      tax_27_amount = EXCLUDED.tax_27_amount,
      tax_18_amount = EXCLUDED.tax_18_amount,
      tax_5_amount = EXCLUDED.tax_5_amount,
      invoice_count = EXCLUDED.invoice_count,
      invoice_details = EXCLUDED.invoice_details;

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

-- Recalculate VAT return for Taxology Kft. July 2026
DO $$
BEGIN
  PERFORM public.calculate_hungarian_vat_return(
    'acc22ca9-e9ff-4f9f-9495-ca7612b2e5e2'::uuid,
    2026,
    7,
    'H'
  );
END;
$$;

NOTIFY pgrst, 'reload schema';


-- Clean up known duplicate OCR artifact 831500377134 if present
DELETE FROM public.invoice_items WHERE invoice_id = '511c2f9f-22b5-4ae3-ab45-41f9edfff42f';
DELETE FROM public.invoices WHERE id = '511c2f9f-22b5-4ae3-ab45-41f9edfff42f';
