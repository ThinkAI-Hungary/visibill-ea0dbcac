-- Migration: 20260914110000_fix_courier_report_rematch_and_backfill.sql
-- Description: Fix courier report matching for aggregated COD payments (GLS, MPL, Mixpack),
--              propagate matched_transaction_id from total row to child item rows,
--              preserve existing compensation row handling,
--              add rematch_courier_reports_for_company batch RPC,
--              add auto_rematch_courier_on_transaction_insert trigger,
--              and backfill orphaned courier_reports item rows.

-- 1. Enhanced public.rematch_courier_report
CREATE OR REPLACE FUNCTION public.rematch_courier_report(p_report_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_report courier_reports%ROWTYPE;
  v_nav_id uuid;
  v_trx_id uuid;
  v_status text;
  v_reason text := '';
  v_confidence numeric := 0;
  v_cod numeric;
  v_ref text;
  v_delivery date;
  v_company uuid;
  v_row_type text;
  v_upload_id uuid;
  v_report_type text;
  v_existing_nav_id uuid;
  v_existing_trx_id uuid;
  v_existing_status text;
  v_existing_reason text;
  v_existing_confidence numeric;
  v_total_row courier_reports%ROWTYPE;
  v_comp_res jsonb;
  v_items_updated integer := 0;
BEGIN
  SELECT * INTO v_report FROM courier_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Report not found');
  END IF;

  v_cod := abs(COALESCE(v_report.cod_amount, 0));
  v_ref := v_report.reference_number;
  v_delivery := v_report.delivery_date;
  v_company := v_report.company_id;
  v_row_type := v_report.row_type;
  v_upload_id := v_report.upload_id;
  v_report_type := COALESCE(v_report.report_type, 'gls');

  v_existing_nav_id := v_report.matched_nav_invoice_id;
  v_existing_trx_id := v_report.matched_transaction_id;
  v_existing_status := v_report.match_status;
  v_existing_reason := v_report.match_reason;
  v_existing_confidence := COALESCE(v_report.match_confidence, 0);

  -- ═══ COMPENSATION rows: auto-settle referenced INBOUND invoices ═══
  IF v_row_type = 'compensation' THEN
    v_comp_res := settle_compensation_for_courier_report(
      p_report_id,
      v_company,
      v_report.package_number,
      v_ref,
      v_delivery,
      v_report.report_type
    );
    RETURN v_comp_res;
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- ═══ TOTAL/SUMMARY rows ═══
  -- ═══════════════════════════════════════════════════════════════
  IF v_row_type = 'total' THEN
    IF v_delivery IS NULL THEN
      SELECT MAX(delivery_date) INTO v_delivery
      FROM courier_reports
      WHERE upload_id = v_upload_id AND row_type = 'item' AND delivery_date IS NOT NULL;
    END IF;

    -- Match aggregated transaction
    SELECT id INTO v_trx_id
    FROM transactions
    WHERE company_id = v_company
      AND amount > 0
      AND (
        (v_report_type = 'gls' AND description ILIKE '%GLS%')
        OR (v_report_type = 'mpl' AND (description ILIKE '%POSTA%' OR description ILIKE '%MPL%' OR description ILIKE '%MAGYAR POSTA%'))
        OR (v_report_type = 'mixpack' AND (description ILIKE '%MIXPACK%' OR description ILIKE '%MIXPAKK%' OR description ILIKE '%MIX PACK%'))
      )
      AND abs(amount) >= v_cod * 0.70
      AND abs(amount) <= v_cod * 1.02
      AND (v_delivery IS NULL OR (
        transaction_date >= v_delivery
        AND transaction_date <= (v_delivery + interval '21 days')::date
      ))
    ORDER BY abs(abs(amount) - v_cod) ASC
    LIMIT 1;

    IF v_trx_id IS NOT NULL THEN
      v_status := 'partial_trx';
      v_confidence := 0.88;
      v_reason := upper(v_report_type) || ' aggregált COD átutalás';

      -- Update the total row itself
      UPDATE courier_reports
      SET match_status = v_status,
          matched_transaction_id = v_trx_id,
          match_reason = v_reason,
          match_confidence = v_confidence
      WHERE id = p_report_id;

      -- Propagate transaction to all item rows of this upload
      UPDATE courier_reports
      SET matched_transaction_id = v_trx_id,
          match_status = CASE 
            WHEN matched_nav_invoice_id IS NOT NULL THEN 'full'
            ELSE 'partial_trx'
          END,
          match_confidence = CASE
            WHEN matched_nav_invoice_id IS NOT NULL THEN GREATEST(COALESCE(match_confidence, 0.8), 0.90)
            ELSE 0.80
          END,
          match_reason = CASE
            WHEN match_reason IS NOT NULL AND match_reason != '' AND match_reason NOT ILIKE '%aggregált%' 
              THEN match_reason || ' | ' || upper(v_report_type) || ' aggregált COD átutalás (összesítőből)'
            ELSE upper(v_report_type) || ' aggregált COD átutalás (összesítőből)'
          END
      WHERE upload_id = v_upload_id
        AND row_type = 'item'
        AND (matched_transaction_id IS NULL OR matched_transaction_id != v_trx_id);

      GET DIAGNOSTICS v_items_updated = ROW_COUNT;

    ELSE
      IF v_existing_trx_id IS NOT NULL THEN
        v_status := v_existing_status;
        v_reason := v_existing_reason;
        v_confidence := v_existing_confidence;
        v_trx_id := v_existing_trx_id;
      ELSE
        v_status := 'total';
        v_confidence := 0;
        v_reason := 'Összesítő sor — nincs tranzakció egyezés';
        UPDATE courier_reports
        SET match_status = v_status, matched_transaction_id = null,
            match_reason = v_reason, match_confidence = v_confidence
        WHERE id = p_report_id;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'status', v_status,
      'reason', v_reason,
      'confidence', v_confidence,
      'transaction_id', v_trx_id,
      'items_updated', v_items_updated
    );
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- ═══ ITEM rows ═══
  -- ═══════════════════════════════════════════════════════════════

  -- Strategy 1: Reference number match with NAV outbound invoices
  SELECT id INTO v_nav_id
  FROM nav_invoices
  WHERE company_id = v_company
    AND invoice_direction = 'OUTBOUND'
    AND invoice_number = v_ref
  LIMIT 1;

  IF v_nav_id IS NOT NULL THEN
    v_reason := 'NAV Számlaszám egyezés';
    v_confidence := 0.95;
  ELSE
    -- Strategy 2: Amount + 14-day lookback, 5-day forward (with ±5 HUF cash rounding tolerance)
    SELECT id INTO v_nav_id
    FROM nav_invoices
    WHERE company_id = v_company
      AND invoice_direction = 'OUTBOUND'
      AND abs(invoice_gross_amount - v_cod) <= 5.0
      AND v_delivery IS NOT NULL
      AND invoice_issue_date BETWEEN (v_delivery - interval '14 days')::date 
                                 AND (v_delivery + interval '5 days')::date
    ORDER BY abs(invoice_gross_amount - v_cod) ASC, abs(invoice_issue_date - v_delivery) ASC
    LIMIT 1;

    IF v_nav_id IS NOT NULL THEN
      v_reason := 'NAV Összeg + Dátum egyezés (kerekítés kezelve)';
      v_confidence := 0.85;
    END IF;
  END IF;

  -- Preserve existing NAV match if no new one found
  IF v_nav_id IS NULL AND v_existing_nav_id IS NOT NULL THEN
    v_nav_id := v_existing_nav_id;
    IF v_reason = '' THEN
      v_reason := COALESCE(v_existing_reason, 'Meglévő NAV számla párosítás');
      v_confidence := v_existing_confidence;
    END IF;
  END IF;

  -- Transaction matching for items:
  -- 1. Check if the sibling 'total' row already has a matched transaction
  SELECT * INTO v_total_row
  FROM courier_reports
  WHERE upload_id = v_upload_id AND row_type = 'total'
  LIMIT 1;

  IF FOUND AND v_total_row.matched_transaction_id IS NOT NULL THEN
    v_trx_id := v_total_row.matched_transaction_id;
    v_reason := v_reason || CASE WHEN v_reason != '' THEN ' | ' ELSE '' END || upper(v_report_type) || ' aggregált COD átutalás (összesítőből)';
    v_confidence := GREATEST(v_confidence, 0.85);
  ELSIF FOUND AND v_total_row.matched_transaction_id IS NULL THEN
    -- Try to match the total row first!
    PERFORM public.rematch_courier_report(v_total_row.id);
    -- Check if total row is now matched
    SELECT matched_transaction_id INTO v_trx_id
    FROM courier_reports
    WHERE id = v_total_row.id;

    IF v_trx_id IS NOT NULL THEN
      v_reason := v_reason || CASE WHEN v_reason != '' THEN ' | ' ELSE '' END || upper(v_report_type) || ' aggregált COD átutalás (összesítőből)';
      v_confidence := GREATEST(v_confidence, 0.85);
    END IF;
  END IF;

  -- 2. If still no transaction, try direct reference/package_number lookup
  IF v_trx_id IS NULL AND v_ref IS NOT NULL AND v_ref != '' THEN
    SELECT id INTO v_trx_id
    FROM transactions
    WHERE company_id = v_company
      AND (description ILIKE '%' || v_ref || '%'
           OR (v_report.package_number IS NOT NULL AND v_report.package_number != '' AND description ILIKE '%' || v_report.package_number || '%'))
    ORDER BY transaction_date DESC
    LIMIT 1;

    IF v_trx_id IS NOT NULL THEN
      v_reason := v_reason || CASE WHEN v_reason != '' THEN ' | ' ELSE '' END || 'Tranzakció hivatkozás egyezés';
      v_confidence := GREATEST(v_confidence, 0.80);
    END IF;
  END IF;

  -- Preserve existing transaction match if no new match found
  IF v_trx_id IS NULL AND v_existing_trx_id IS NOT NULL THEN
    v_trx_id := v_existing_trx_id;
  END IF;

  -- Determine match status
  IF v_nav_id IS NOT NULL AND v_trx_id IS NOT NULL THEN
    v_status := 'full';
  ELSIF v_nav_id IS NOT NULL THEN
    v_status := 'partial_nav';
  ELSIF v_trx_id IS NOT NULL THEN
    v_status := 'partial_trx';
  ELSE
    v_status := 'unmatched';
    v_reason := 'Nincs egyezés (auto rematch)';
    v_confidence := 0;
  END IF;

  IF v_reason = '' AND (v_nav_id IS NOT NULL OR v_trx_id IS NOT NULL) THEN
    v_reason := COALESCE(v_existing_reason, 'Meglévő párosítás megtartva');
    v_confidence := GREATEST(v_confidence, v_existing_confidence);
  END IF;

  UPDATE courier_reports
  SET match_status = v_status,
      matched_nav_invoice_id = v_nav_id,
      matched_transaction_id = v_trx_id,
      match_reason = v_reason,
      match_confidence = v_confidence
  WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'status', v_status,
    'reason', v_reason,
    'confidence', v_confidence,
    'nav_invoice_id', v_nav_id,
    'transaction_id', v_trx_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rematch_courier_report(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rematch_courier_report(uuid) TO authenticated;

-- 2. Batch rematch function for company / report type
CREATE OR REPLACE FUNCTION public.rematch_courier_reports_for_company(
  p_company_id uuid,
  p_report_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r_total RECORD;
  r_item RECORD;
  v_total_processed integer := 0;
  v_items_processed integer := 0;
  v_full_matched integer := 0;
BEGIN
  -- Phase 1: Rematch all total rows that are not yet matched to a transaction
  FOR r_total IN
    SELECT id
    FROM courier_reports
    WHERE company_id = p_company_id
      AND row_type = 'total'
      AND matched_transaction_id IS NULL
      AND (p_report_type IS NULL OR report_type = p_report_type)
  LOOP
    PERFORM public.rematch_courier_report(r_total.id);
    v_total_processed := v_total_processed + 1;
  END LOOP;

  -- Phase 2: For any total rows that ARE matched to a transaction,
  -- ensure all their child items inherit the transaction
  UPDATE courier_reports cr_item
  SET matched_transaction_id = cr_total.matched_transaction_id,
      match_status = CASE 
        WHEN cr_item.matched_nav_invoice_id IS NOT NULL THEN 'full'
        ELSE 'partial_trx'
      END,
      match_confidence = CASE
        WHEN cr_item.matched_nav_invoice_id IS NOT NULL THEN GREATEST(COALESCE(cr_item.match_confidence, 0.8), 0.90)
        ELSE 0.80
      END,
      match_reason = CASE
        WHEN cr_item.match_reason IS NOT NULL AND cr_item.match_reason != '' AND cr_item.match_reason NOT ILIKE '%aggregált%'
          THEN cr_item.match_reason || ' | ' || upper(cr_item.report_type) || ' aggregált COD átutalás (összesítőből)'
        ELSE upper(cr_item.report_type) || ' aggregált COD átutalás (összesítőből)'
      END
  FROM courier_reports cr_total
  WHERE cr_item.upload_id = cr_total.upload_id
    AND cr_total.row_type = 'total'
    AND cr_total.matched_transaction_id IS NOT NULL
    AND cr_item.row_type = 'item'
    AND cr_item.company_id = p_company_id
    AND (p_report_type IS NULL OR cr_item.report_type = p_report_type)
    AND (cr_item.matched_transaction_id IS NULL OR cr_item.matched_transaction_id != cr_total.matched_transaction_id);

  -- Phase 3: Rematch any items that still don't have full match (try NAV matching)
  FOR r_item IN
    SELECT id
    FROM courier_reports
    WHERE company_id = p_company_id
      AND row_type = 'item'
      AND match_status <> 'full'
      AND (p_report_type IS NULL OR report_type = p_report_type)
  LOOP
    PERFORM public.rematch_courier_report(r_item.id);
    v_items_processed := v_items_processed + 1;
  END LOOP;

  -- Get total full matched count for return
  SELECT count(*) INTO v_full_matched
  FROM courier_reports
  WHERE company_id = p_company_id
    AND row_type = 'item'
    AND match_status = 'full'
    AND (p_report_type IS NULL OR report_type = p_report_type);

  RETURN jsonb_build_object(
    'company_id', p_company_id,
    'report_type', p_report_type,
    'total_rows_rematched', v_total_processed,
    'item_rows_rematched', v_items_processed,
    'total_full_matched', v_full_matched
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rematch_courier_reports_for_company(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rematch_courier_reports_for_company(uuid, text) TO authenticated;

-- 3. Automatic trigger on transaction insert
CREATE OR REPLACE FUNCTION public.auto_rematch_courier_on_transaction_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r_id uuid;
BEGIN
  IF NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  FOR r_id IN
    SELECT cr.id
    FROM courier_reports cr
    WHERE cr.company_id = NEW.company_id
      AND cr.row_type = 'total'
      AND cr.match_status IN ('total', 'unmatched')
      AND cr.matched_transaction_id IS NULL
      AND cr.cod_amount IS NOT NULL
      AND (
        (cr.report_type = 'gls' AND NEW.description ILIKE '%GLS%')
        OR (cr.report_type = 'mpl' AND (NEW.description ILIKE '%POSTA%' OR NEW.description ILIKE '%MPL%' OR NEW.description ILIKE '%MAGYAR POSTA%'))
        OR (cr.report_type = 'mixpack' AND (NEW.description ILIKE '%MIXPACK%' OR NEW.description ILIKE '%MIXPAKK%' OR NEW.description ILIKE '%MIX PACK%'))
      )
      AND abs(NEW.amount) >= abs(cr.cod_amount) * 0.70
      AND abs(NEW.amount) <= abs(cr.cod_amount) * 1.02
  LOOP
    PERFORM public.rematch_courier_report(r_id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_rematch_courier_on_transaction_insert ON public.transactions;
CREATE TRIGGER trigger_auto_rematch_courier_on_transaction_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_rematch_courier_on_transaction_insert();

-- 4. One-time idempotent backfill:
-- Propagate matched_transaction_id from already-matched total rows to all stranded child items
UPDATE courier_reports cr_item
SET matched_transaction_id = cr_total.matched_transaction_id,
    match_status = CASE 
      WHEN cr_item.matched_nav_invoice_id IS NOT NULL THEN 'full'
      ELSE 'partial_trx'
    END,
    match_confidence = CASE
      WHEN cr_item.matched_nav_invoice_id IS NOT NULL THEN GREATEST(COALESCE(cr_item.match_confidence, 0.8), 0.90)
      ELSE 0.80
    END,
    match_reason = CASE
      WHEN cr_item.match_reason IS NOT NULL AND cr_item.match_reason != '' AND cr_item.match_reason NOT ILIKE '%aggregált%'
        THEN cr_item.match_reason || ' | ' || upper(cr_item.report_type) || ' aggregált COD átutalás (összesítőből)'
      ELSE upper(cr_item.report_type) || ' aggregált COD átutalás (összesítőből)'
    END
FROM courier_reports cr_total
WHERE cr_item.upload_id = cr_total.upload_id
  AND cr_total.row_type = 'total'
  AND cr_total.matched_transaction_id IS NOT NULL
  AND cr_item.row_type = 'item'
  AND cr_item.matched_transaction_id IS NULL;
