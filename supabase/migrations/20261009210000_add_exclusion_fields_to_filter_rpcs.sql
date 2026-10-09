-- Migration: 20261009210000_add_exclusion_fields_to_filter_rpcs.sql
-- Description: Add accounting_exclusion_type, deferred_vat_reason, deferred_vat_since,
--              deferred_vat_target_period to get_filtered_nav_invoices and get_filtered_submitted_invoices

DROP FUNCTION IF EXISTS public.get_filtered_nav_invoices(
  uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, uuid, text, text, date, date, text, text
);

CREATE OR REPLACE FUNCTION public.get_filtered_nav_invoices(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text,
  p_search text DEFAULT NULL::text,
  p_currency text DEFAULT NULL::text,
  p_paid text DEFAULT NULL::text,
  p_submitted text DEFAULT NULL::text,
  p_project_id text DEFAULT NULL::text,
  p_category_id text DEFAULT NULL::text,
  p_payment_method text DEFAULT NULL::text,
  p_amount_min numeric DEFAULT NULL::numeric,
  p_amount_max numeric DEFAULT NULL::numeric,
  p_sort_field text DEFAULT 'invoice_issue_date'::text,
  p_sort_dir text DEFAULT 'desc'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_issue_date_from date DEFAULT NULL::date,
  p_issue_date_to date DEFAULT NULL::date,
  p_preset_id uuid DEFAULT NULL::uuid,
  p_continuous text DEFAULT NULL::text,
  p_kpi_filter text DEFAULT 'all'::text,
  p_delivery_date_from date DEFAULT NULL::date,
  p_delivery_date_to date DEFAULT NULL::date,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_vat_rate text DEFAULT 'all'::text
)
RETURNS TABLE(
  id uuid,
  invoice_number text,
  invoice_direction text,
  invoice_issue_date date,
  invoice_delivery_date date,
  supplier_tax_number text,
  supplier_name text,
  supplier_address text,
  customer_tax_number text,
  customer_name text,
  customer_address text,
  invoice_net_amount numeric,
  invoice_gross_amount numeric,
  invoice_vat_amount numeric,
  currency text,
  payment_method text,
  invoice_operation text,
  payment_date date,
  paid boolean,
  submitted boolean,
  details_fetched boolean,
  company_id uuid,
  user_id uuid,
  created_at timestamp with time zone,
  fetched_at timestamp with time zone,
  project_id uuid,
  category_id uuid,
  transaction_id uuid,
  exclude_from_accounting boolean,
  accounting_exclusion_type text,
  deferred_vat_reason text,
  deferred_vat_since date,
  deferred_vat_target_period text,
  is_accountant_reviewed boolean,
  gl_numbers text,
  is_continuous boolean,
  service_period_start date,
  service_period_end date,
  calculated_ti date,
  ti_override date,
  ti_calculation_method text,
  is_manual_payment boolean,
  manual_payment_type text,
  match_status text,
  paid_amount numeric,
  remaining_amount numeric,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_offset integer;
  v_preset_id uuid;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  -- Resolve preset: use p_preset_id, fallback to active custom preset, fallback to generic preset
  IF p_preset_id IS NULL THEN
    SELECT cap.id INTO v_preset_id
    FROM public.chart_of_accounts_presets cap
    WHERE cap.company_id = p_company_id AND cap.is_active = true
    LIMIT 1;

    IF v_preset_id IS NULL THEN
      SELECT cap.id INTO v_preset_id
      FROM public.chart_of_accounts_presets cap
      WHERE cap.company_id = p_company_id
      ORDER BY cap.created_at ASC
      LIMIT 1;
    END IF;
  ELSE
    v_preset_id := p_preset_id;
  END IF;

  RETURN QUERY
  WITH base_filtered AS (
    SELECT
      ni.id, ni.invoice_number, ni.invoice_direction,
      ni.invoice_issue_date, ni.invoice_delivery_date,
      ni.supplier_tax_number, ni.supplier_name, ni.supplier_address,
      ni.customer_tax_number, ni.customer_name, ni.customer_address,
      ni.invoice_net_amount, ni.invoice_gross_amount, ni.invoice_vat_amount,
      ni.currency, ni.payment_method, ni.invoice_operation,
      ni.payment_date, ni.paid, ni.submitted, ni.details_fetched,
      ni.company_id, ni.user_id, ni.created_at, ni.fetched_at,
      ni.project_id, ni.category_id, ni.transaction_id,
      ni.exclude_from_accounting,
      ni.accounting_exclusion_type,
      ni.deferred_vat_reason,
      ni.deferred_vat_since,
      ni.deferred_vat_target_period,
      COALESCE(ni.is_accountant_reviewed, false) AS is_accountant_reviewed,
      ni.is_continuous,
      ni.service_period_start,
      ni.service_period_end,
      ni.calculated_ti,
      ni.ti_override,
      ni.ti_calculation_method,
      ni.is_manual_payment,
      ni.manual_payment_type
    FROM nav_invoices ni
    WHERE ni.company_id = p_company_id
      AND ni.invoice_direction = p_direction
      AND (
        CASE 
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date)::date <= p_date_to)
          ELSE
            (p_date_from IS NULL OR ni.invoice_issue_date >= p_date_from)
            AND (p_date_to IS NULL OR ni.invoice_issue_date <= p_date_to)
        END
      )
      AND (p_issue_date_from IS NULL OR ni.invoice_issue_date >= p_issue_date_from)
      AND (p_issue_date_to IS NULL OR ni.invoice_issue_date <= p_issue_date_to)
      AND (p_delivery_date_from IS NULL OR COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date) >= p_delivery_date_from)
      AND (p_delivery_date_to IS NULL OR COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date) <= p_delivery_date_to)
      AND (p_search IS NULL OR p_search = '' OR (
        ni.invoice_number ILIKE '%' || p_search || '%'
        OR ni.supplier_name ILIKE '%' || p_search || '%'
        OR ni.customer_name ILIKE '%' || p_search || '%'
        OR ni.supplier_tax_number ILIKE '%' || p_search || '%'
        OR ni.customer_tax_number ILIKE '%' || p_search || '%'
        OR ni.invoice_gross_amount::text ILIKE '%' || p_search || '%'
        OR ni.invoice_net_amount::text ILIKE '%' || p_search || '%'
      ))
      AND (p_currency IS NULL OR p_currency = 'all' OR ni.currency = p_currency)
      AND (p_submitted IS NULL OR p_submitted = 'all'
        OR (p_submitted = 'yes' AND ni.submitted = true)
        OR (p_submitted = 'no' AND (ni.submitted IS NULL OR ni.submitted = false)))
      AND (p_project_id IS NULL OR p_project_id = 'all'
        OR (p_project_id = 'none' AND ni.project_id IS NULL)
        OR ni.project_id = p_project_id::uuid)
      AND (p_category_id IS NULL OR p_category_id = 'all'
        OR (p_category_id = 'none' AND ni.category_id IS NULL)
        OR ni.category_id = p_category_id::uuid)
      AND (p_payment_method IS NULL OR p_payment_method = 'all'
        OR (p_payment_method = 'none' AND (ni.payment_method IS NULL OR ni.payment_method = ''))
        OR UPPER(ni.payment_method) = UPPER(p_payment_method)
        OR (p_payment_method = 'CASH' AND (ni.payment_method ILIKE '%cash%' OR ni.payment_method ILIKE '%készpénz%'))
        OR (p_payment_method = 'TRANSFER' AND (ni.payment_method ILIKE '%transfer%' OR ni.payment_method ILIKE '%átutalás%'))
        OR (p_payment_method = 'CARD' AND (ni.payment_method ILIKE '%card%' OR ni.payment_method ILIKE '%bankkártya%')))
      AND (p_amount_min IS NULL OR COALESCE(ni.invoice_gross_amount, 0) >= p_amount_min)
      AND (p_amount_max IS NULL OR COALESCE(ni.invoice_gross_amount, 0) <= p_amount_max)
      AND (p_continuous IS NULL OR p_continuous = 'all'
        OR (p_continuous = 'yes' AND ni.is_continuous = true)
        OR (p_continuous = 'no' AND (ni.is_continuous IS NULL OR ni.is_continuous = false)))
      AND (
        p_vat_rate IS NULL OR p_vat_rate = 'all'
        OR EXISTS (
          SELECT 1 FROM nav_invoice_items nii
          WHERE nii.nav_invoice_id = ni.id
            AND (
              (p_vat_rate = '27%' AND (nii.vat_rate = '0.27' OR nii.vat_rate ILIKE '%27%'))
              OR (p_vat_rate = '18%' AND (nii.vat_rate = '0.18' OR nii.vat_rate ILIKE '%18%'))
              OR (p_vat_rate = '5%' AND (nii.vat_rate = '0.05' OR nii.vat_rate ILIKE '%5%'))
              OR (p_vat_rate = '0%' AND (nii.vat_rate = '0' OR nii.vat_rate = '0.00' OR nii.vat_rate = '0%' OR nii.vat_rate ILIKE '%0%'))
              OR (p_vat_rate = 'AAM' AND (nii.vat_rate ILIKE '%AAM%' OR nii.vat_code ILIKE '%AAM%'))
              OR (p_vat_rate = 'TAM' AND (nii.vat_rate ILIKE '%TAM%' OR nii.vat_code ILIKE '%TAM%'))
              OR (p_vat_rate = 'FAD' AND (nii.vat_rate ILIKE '%FAD%' OR nii.vat_code ILIKE '%FAD%'))
            )
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            CASE 
              WHEN jsonb_typeof(ni.vat_summary->'vatSummaries') = 'array' THEN ni.vat_summary->'vatSummaries'
              WHEN jsonb_typeof(ni.vat_summary) = 'array' THEN ni.vat_summary
              ELSE '[]'::jsonb
            END
          ) elem
          WHERE (
            (p_vat_rate = '27%' AND (elem->>'vatRateLiteral' ILIKE '%27%' OR elem->>'vatPercentage' = '0.27' OR elem->>'vat_rate' ILIKE '%27%'))
            OR (p_vat_rate = '18%' AND (elem->>'vatRateLiteral' ILIKE '%18%' OR elem->>'vatPercentage' = '0.18' OR elem->>'vat_rate' ILIKE '%18%'))
            OR (p_vat_rate = '5%' AND (elem->>'vatRateLiteral' ILIKE '%5%' OR elem->>'vatPercentage' = '0.05' OR elem->>'vat_rate' ILIKE '%5%'))
            OR (p_vat_rate = '0%' AND (elem->>'vatRateLiteral' ILIKE '%0%' OR elem->>'vatPercentage' = '0' OR elem->>'vat_rate' ILIKE '%0%'))
            OR (p_vat_rate = 'AAM' AND (elem->>'vatRateLiteral' ILIKE '%AAM%' OR elem->>'category' ILIKE '%aam%' OR elem->>'vat_rate' ILIKE '%AAM%'))
            OR (p_vat_rate = 'TAM' AND (elem->>'vatRateLiteral' ILIKE '%TAM%' OR elem->>'category' ILIKE '%tam%' OR elem->>'vat_rate' ILIKE '%TAM%'))
            OR (p_vat_rate = 'FAD' AND (elem->>'vatRateLiteral' ILIKE '%FAD%' OR elem->>'category' ILIKE '%fad%' OR elem->>'vat_rate' ILIKE '%FAD%'))
          )
        )
      )
  ),
  all_tx_distinct AS (
    SELECT DISTINCT
      tx.id as transaction_id,
      tx.matched_invoice_id as invoice_id,
      tx.amount,
      tx.fee_amount,
      tx.match_type,
      tx.is_verified,
      tx.confidence_score
    FROM transactions tx
    WHERE tx.company_id = p_company_id AND tx.matched_invoice_id IS NOT NULL
    UNION
    SELECT DISTINCT
      t.id as transaction_id,
      tim.invoice_id,
      t.amount,
      t.fee_amount,
      COALESCE(tim.created_by, t.match_type) as match_type,
      t.is_verified,
      t.confidence_score
    FROM transaction_invoice_matches tim
    JOIN transactions t ON t.company_id = p_company_id AND t.id = tim.transaction_id
  ),
  all_tx_matches AS (
    SELECT 
      m.invoice_id,
      bool_or(m.match_type = 'manual' OR m.is_verified = true OR (m.confidence_score IS NOT NULL AND m.confidence_score >= 0.9)) AS is_matched,
      bool_or(m.match_type != 'manual' AND (m.is_verified IS NOT TRUE) AND (m.confidence_score < 0.9)) AS is_suggested,
      COALESCE(SUM(
        CASE 
          WHEN m.match_type = 'manual' OR m.is_verified = true OR (m.confidence_score IS NOT NULL AND m.confidence_score >= 0.9)
          THEN ABS(m.amount) + COALESCE(ABS(m.fee_amount), 0)
          ELSE 0
        END
      ), 0) AS total_paid_amount
    FROM all_tx_distinct m
    GROUP BY m.invoice_id
  ),
  sub_matches AS (
    SELECT 
      i.bizonylatsorszam,
      bool_or(
        atm.is_matched = true 
        OR i.transaction_id IS NOT NULL
        OR i.is_manual_payment = true
        OR LOWER(COALESCE(i.fizetesi_mod, '')) IN ('készpénz', 'keszpenz', 'cash')
        OR i.fizetesi_mod ILIKE '%készpénz%' 
        OR i.fizetesi_mod ILIKE '%keszpenz%' 
      ) AS is_sub_matched,
      bool_or(atm.is_suggested = true) AS is_sub_suggested,
      COALESCE(MAX(
        CASE 
          WHEN COALESCE(atm.total_paid_amount, 0) > 0
          THEN atm.total_paid_amount
          WHEN i.is_manual_payment = true 
            OR LOWER(COALESCE(i.fizetesi_mod, '')) IN ('készpénz', 'keszpenz', 'cash')
            OR i.fizetesi_mod ILIKE '%készpénz%' 
            OR i.fizetesi_mod ILIKE '%keszpenz%' 
            OR i.fizetve = true
            OR EXISTS (
              SELECT 1 FROM courier_reports cr 
              WHERE cr.company_id = p_company_id 
                AND cr.reference_number = i.bizonylatsorszam 
                AND cr.match_status = 'full'
            )
          THEN ABS(COALESCE(i.brutto_vegosszeg, 0))
          ELSE 0
        END
      ), 0) AS sub_paid_amount
    FROM invoices i
    LEFT JOIN all_tx_matches atm ON atm.invoice_id = i.id
    WHERE i.company_id = p_company_id
    GROUP BY i.bizonylatsorszam
  ),
  with_status AS (
    SELECT 
      bf.*,
      CASE
        -- 1. If there are matched transactions, transaction sum takes precedence over paid flag
        WHEN (COALESCE(atm.total_paid_amount, 0) + COALESCE(sm.sub_paid_amount, 0)) > 0 
        THEN (COALESCE(atm.total_paid_amount, 0) + COALESCE(sm.sub_paid_amount, 0))
        -- 2. Manual payment, CASH, explicit paid flag without bank transactions, or full courier match -> full gross
        WHEN bf.is_manual_payment = true 
          OR UPPER(COALESCE(bf.payment_method, '')) IN ('CASH', 'KÉSZPÉNZ', 'KESZPENZ') 
          OR bf.payment_method ILIKE '%készpénz%' 
          OR bf.payment_method ILIKE '%cash%' 
          OR bf.paid = true
          OR EXISTS (
            SELECT 1 FROM courier_reports cr 
            WHERE cr.company_id = p_company_id 
              AND cr.matched_nav_invoice_id = bf.id 
              AND cr.match_status = 'full'
          )
        THEN ABS(COALESCE(bf.invoice_gross_amount, 0))
        ELSE 0
      END AS computed_paid_raw,
      ABS(COALESCE(bf.invoice_gross_amount, 0)) AS gross_abs
    FROM base_filtered bf
    LEFT JOIN all_tx_matches atm ON atm.invoice_id = bf.id
    LEFT JOIN sub_matches sm ON sm.bizonylatsorszam = bf.invoice_number
  ),
  with_calc AS (
    SELECT
      ws.*,
      LEAST(ws.computed_paid_raw, ws.gross_abs) AS calculated_paid,
      GREATEST(0::numeric, ws.gross_abs - ws.computed_paid_raw) AS calculated_remaining,
      CASE
        WHEN ws.gross_abs > 0 AND ws.computed_paid_raw >= ws.gross_abs - 0.5 THEN 'matched'
        WHEN ws.gross_abs = 0 AND ws.computed_paid_raw >= 0 AND (
          ws.paid = true 
          OR ws.transaction_id IS NOT NULL 
          OR ws.is_manual_payment = true 
          OR UPPER(COALESCE(ws.payment_method, '')) IN ('CASH', 'KÉSZPÉNZ', 'KESZPENZ')
          OR ws.payment_method ILIKE '%készpénz%' 
          OR ws.payment_method ILIKE '%keszpenz%' 
          OR ws.payment_method ILIKE '%cash%' 
          OR EXISTS (
            SELECT 1 FROM courier_reports cr 
            WHERE cr.company_id = p_company_id 
              AND cr.matched_nav_invoice_id = ws.id 
              AND cr.match_status = 'full'
          )
        ) THEN 'matched'
        WHEN (COALESCE(ws.computed_paid_raw, 0) > 0 AND ws.computed_paid_raw < ws.gross_abs - 0.5) THEN 'partially_paid'
        WHEN (tm_sub.is_sub_suggested = true OR atm_tx.is_suggested = true) THEN 'suggested'
        ELSE 'unmatched'
      END AS computed_match_status
    FROM with_status ws
    LEFT JOIN sub_matches tm_sub ON tm_sub.bizonylatsorszam = ws.invoice_number
    LEFT JOIN all_tx_matches atm_tx ON atm_tx.invoice_id = ws.id
  ),
  kpi_filtered AS (
    SELECT *
    FROM with_calc wc
    WHERE p_kpi_filter IS NULL 
      OR p_kpi_filter = 'all'
      OR (p_kpi_filter = 'matched' AND wc.computed_match_status IN ('matched', 'partially_paid'))
      OR (p_kpi_filter = 'suggested' AND wc.computed_match_status = 'suggested')
      OR (p_kpi_filter = 'unmatched' AND wc.computed_match_status = 'unmatched')
  ),
  total_rows AS (
    SELECT COUNT(*)::bigint AS total_count FROM kpi_filtered
  ),
  sorted_slice AS (
    SELECT *
    FROM kpi_filtered kf
    ORDER BY
      CASE WHEN p_sort_field = 'partner_name' AND p_sort_dir = 'asc' THEN (CASE WHEN p_direction = 'INBOUND' THEN kf.supplier_name ELSE kf.customer_name END) END ASC NULLS LAST,
      CASE WHEN p_sort_field = 'partner_name' AND p_sort_dir = 'desc' THEN (CASE WHEN p_direction = 'INBOUND' THEN kf.supplier_name ELSE kf.customer_name END) END DESC NULLS LAST,
      CASE WHEN p_sort_field = 'invoice_issue_date' AND p_sort_dir = 'asc' THEN kf.invoice_issue_date END ASC NULLS LAST,
      CASE WHEN p_sort_field = 'invoice_issue_date' AND p_sort_dir = 'desc' THEN kf.invoice_issue_date END DESC NULLS LAST,
      CASE WHEN p_sort_field = 'invoice_delivery_date' AND p_sort_dir = 'asc' THEN kf.invoice_delivery_date END ASC NULLS LAST,
      CASE WHEN p_sort_field = 'invoice_delivery_date' AND p_sort_dir = 'desc' THEN kf.invoice_delivery_date END DESC NULLS LAST,
      CASE WHEN p_sort_field = 'invoice_gross_amount' AND p_sort_dir = 'asc' THEN kf.invoice_gross_amount END ASC NULLS LAST,
      CASE WHEN p_sort_field = 'invoice_gross_amount' AND p_sort_dir = 'desc' THEN kf.invoice_gross_amount END DESC NULLS LAST,
      CASE WHEN p_sort_field = 'supplier_name' AND p_sort_dir = 'asc' THEN kf.supplier_name END ASC NULLS LAST,
      CASE WHEN p_sort_field = 'supplier_name' AND p_sort_dir = 'desc' THEN kf.supplier_name END DESC NULLS LAST,
      CASE WHEN p_sort_field = 'customer_name' AND p_sort_dir = 'asc' THEN kf.customer_name END ASC NULLS LAST,
      CASE WHEN p_sort_field = 'customer_name' AND p_sort_dir = 'desc' THEN kf.customer_name END DESC NULLS LAST,
      CASE WHEN p_sort_field = 'invoice_number' AND p_sort_dir = 'asc' THEN kf.invoice_number END ASC NULLS LAST,
      CASE WHEN p_sort_field = 'invoice_number' AND p_sort_dir = 'desc' THEN kf.invoice_number END DESC NULLS LAST,
      kf.invoice_issue_date DESC NULLS LAST,
      kf.id ASC
    LIMIT p_page_size
    OFFSET v_offset
  )
  SELECT
    ss.id,
    ss.invoice_number,
    ss.invoice_direction,
    ss.invoice_issue_date,
    ss.invoice_delivery_date,
    ss.supplier_tax_number,
    ss.supplier_name,
    ss.supplier_address,
    ss.customer_tax_number,
    ss.customer_name,
    ss.customer_address,
    ss.invoice_net_amount,
    ss.invoice_gross_amount,
    ss.invoice_vat_amount,
    ss.currency,
    ss.payment_method,
    ss.invoice_operation,
    ss.payment_date,
    CASE 
      WHEN ss.computed_match_status = 'matched' THEN true 
      WHEN ss.computed_match_status = 'partially_paid' THEN false 
      ELSE ss.paid 
    END AS paid,
    ss.submitted,
    ss.details_fetched,
    ss.company_id,
    ss.user_id,
    ss.created_at,
    ss.fetched_at,
    ss.project_id,
    ss.category_id,
    ss.transaction_id,
    ss.exclude_from_accounting,
    ss.accounting_exclusion_type,
    ss.deferred_vat_reason,
    ss.deferred_vat_since,
    ss.deferred_vat_target_period,
    ss.is_accountant_reviewed,
    (
      SELECT string_agg(DISTINCT g.gl_number, ', ')
      FROM public.nav_invoice_items nii
      JOIN public.gl_accounts g ON g.id = (
        CASE WHEN (nii.gl_classifications -> (v_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
        THEN (nii.gl_classifications -> (v_preset_id::text) ->> 'gl_account_id')::uuid 
        ELSE NULL END
      )
      WHERE nii.nav_invoice_id = ss.id
    ) AS gl_numbers,
    ss.is_continuous,
    ss.service_period_start,
    ss.service_period_end,
    ss.calculated_ti,
    ss.ti_override,
    ss.ti_calculation_method,
    ss.is_manual_payment,
    ss.manual_payment_type,
    ss.computed_match_status AS match_status,
    ss.calculated_paid AS paid_amount,
    ss.calculated_remaining AS remaining_amount,
    tr.total_count
  FROM sorted_slice ss
  CROSS JOIN total_rows tr
  ORDER BY
    CASE WHEN p_sort_field = 'partner_name' AND p_sort_dir = 'asc' THEN (CASE WHEN p_direction = 'INBOUND' THEN ss.supplier_name ELSE ss.customer_name END) END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'partner_name' AND p_sort_dir = 'desc' THEN (CASE WHEN p_direction = 'INBOUND' THEN ss.supplier_name ELSE ss.customer_name END) END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_issue_date' AND p_sort_dir = 'asc' THEN ss.invoice_issue_date END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_issue_date' AND p_sort_dir = 'desc' THEN ss.invoice_issue_date END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_delivery_date' AND p_sort_dir = 'asc' THEN ss.invoice_delivery_date END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_delivery_date' AND p_sort_dir = 'desc' THEN ss.invoice_delivery_date END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_gross_amount' AND p_sort_dir = 'asc' THEN ss.invoice_gross_amount END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_gross_amount' AND p_sort_dir = 'desc' THEN ss.invoice_gross_amount END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'supplier_name' AND p_sort_dir = 'asc' THEN ss.supplier_name END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'supplier_name' AND p_sort_dir = 'desc' THEN ss.supplier_name END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'customer_name' AND p_sort_dir = 'asc' THEN ss.customer_name END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'customer_name' AND p_sort_dir = 'desc' THEN ss.customer_name END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_number' AND p_sort_dir = 'asc' THEN ss.invoice_number END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'invoice_number' AND p_sort_dir = 'desc' THEN ss.invoice_number END DESC NULLS LAST,
    ss.invoice_issue_date DESC NULLS LAST,
    ss.id ASC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_filtered_nav_invoices FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_filtered_nav_invoices TO authenticated, service_role;


DROP FUNCTION IF EXISTS public.get_filtered_submitted_invoices(
  uuid, date, date, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, text, text, date, date, text, text
);

CREATE OR REPLACE FUNCTION public.get_filtered_submitted_invoices(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text,
  p_search text DEFAULT NULL::text,
  p_currency text DEFAULT NULL::text,
  p_category_id text DEFAULT NULL::text,
  p_project_id text DEFAULT NULL::text,
  p_payment_method text DEFAULT NULL::text,
  p_amount_min numeric DEFAULT NULL::numeric,
  p_amount_max numeric DEFAULT NULL::numeric,
  p_sort_field text DEFAULT 'kibocsatas_datuma'::text,
  p_sort_dir text DEFAULT 'desc'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_issue_date_from date DEFAULT NULL::date,
  p_issue_date_to date DEFAULT NULL::date,
  p_kpi_filter text DEFAULT 'all'::text,
  p_nav_status text DEFAULT 'all'::text,
  p_delivery_date_from date DEFAULT NULL::date,
  p_delivery_date_to date DEFAULT NULL::date,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_vat_rate text DEFAULT 'all'::text
)
RETURNS TABLE(
  id uuid,
  bizonylatsorszam text,
  kibocsatas_datuma date,
  teljesites_datuma date,
  elado_nev text,
  vevo_nev text,
  adoalap_osszesen numeric,
  brutto_vegosszeg numeric,
  afa_osszeg_osszesen numeric,
  penznem text,
  category_id uuid,
  project_id uuid,
  image_url text,
  melleklet_url text,
  invoice_direction text,
  reference_number text,
  exclude_from_accounting boolean,
  accounting_exclusion_type text,
  deferred_vat_reason text,
  deferred_vat_since date,
  deferred_vat_target_period text,
  is_accountant_reviewed boolean,
  fizetesi_mod text,
  match_status text,
  paid_amount numeric,
  remaining_amount numeric,
  statusz text,
  nav_status text,
  approval_note text,
  approved_at timestamp with time zone,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_offset integer;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  RETURN QUERY
  WITH base_filtered AS (
    SELECT
      i.id,
      i.bizonylatsorszam,
      i.kibocsatas_datuma,
      i.teljesites_datuma,
      i.elado_nev,
      i.vevo_nev,
      i.adoalap_osszesen,
      i.brutto_vegosszeg,
      i.afa_osszeg_osszesen,
      i.penznem,
      i.category_id,
      i.project_id,
      i.image_url,
      i.melleklet_url,
      i.invoice_direction,
      i.reference_number,
      COALESCE(i.exclude_from_accounting, false) AS exclude_from_accounting,
      i.accounting_exclusion_type,
      i.deferred_vat_reason,
      i.deferred_vat_since,
      i.deferred_vat_target_period,
      COALESCE(i.is_accountant_reviewed, false) AS is_accountant_reviewed,
      i.fizetesi_mod,
      i.is_manual_payment,
      i.transaction_id,
      i.fizetve,
      i.statusz,
      i.nav_status,
      i.approval_note,
      i.approved_at
    FROM invoices i
    WHERE i.company_id = p_company_id
      AND i.invoice_direction = p_direction
      AND (
        (p_date_basis = 'teljesites' AND i.teljesites_datuma >= p_date_from AND i.teljesites_datuma <= p_date_to)
        OR (p_date_basis <> 'teljesites' AND i.kibocsatas_datuma >= p_date_from AND i.kibocsatas_datuma <= p_date_to)
      )
      AND (p_delivery_date_from IS NULL OR i.teljesites_datuma >= p_delivery_date_from)
      AND (p_delivery_date_to IS NULL OR i.teljesites_datuma <= p_delivery_date_to)
      AND (p_issue_date_from IS NULL OR i.kibocsatas_datuma >= p_issue_date_from)
      AND (p_issue_date_to IS NULL OR i.kibocsatas_datuma <= p_issue_date_to)
      AND (
        p_search IS NULL OR p_search = ''
        OR i.bizonylatsorszam ILIKE '%' || p_search || '%'
        OR i.elado_nev ILIKE '%' || p_search || '%'
        OR i.vevo_nev ILIKE '%' || p_search || '%'
        OR i.reference_number ILIKE '%' || p_search || '%'
      )
      AND (p_currency IS NULL OR p_currency = 'all' OR i.penznem = p_currency)
      AND (p_category_id IS NULL OR p_category_id = 'all' OR i.category_id = p_category_id::uuid)
      AND (p_project_id IS NULL OR p_project_id = 'all' OR i.project_id = p_project_id::uuid)
      AND (p_payment_method IS NULL OR p_payment_method = 'all' OR i.fizetesi_mod = p_payment_method)
      AND (p_amount_min IS NULL OR ABS(COALESCE(i.brutto_vegosszeg, 0)) >= p_amount_min)
      AND (p_amount_max IS NULL OR ABS(COALESCE(i.brutto_vegosszeg, 0)) <= p_amount_max)
      AND (
        p_nav_status IS NULL OR p_nav_status = 'all'
        OR (p_nav_status = 'verified' AND (i.nav_status = 'verified' OR i.nav_status = 'linked'))
        OR (p_nav_status = 'missing_nav' AND COALESCE(i.nav_status, 'missing_nav') = 'missing_nav')
        OR (p_nav_status = 'not_applicable' AND i.nav_status = 'not_applicable')
        OR (p_nav_status = 'linked' AND (i.nav_status = 'linked' OR i.nav_status = 'verified'))
        OR (p_nav_status = 'unlinked' AND COALESCE(i.nav_status, 'missing_nav') IN ('missing_nav', 'failed', 'not_found', 'not_applicable'))
      )
      AND (
        p_vat_rate IS NULL OR p_vat_rate = 'all'
        OR EXISTS (
          SELECT 1 FROM invoice_items ii
          WHERE ii.invoice_id = i.id
            AND (
              (p_vat_rate = '27%' AND (ii.vat_rate ILIKE '%27%' OR ii.vat_rate = '0.27' OR ii.vat_code ILIKE '%27%'))
              OR (p_vat_rate = '18%' AND (ii.vat_rate ILIKE '%18%' OR ii.vat_rate = '0.18' OR ii.vat_code ILIKE '%18%'))
              OR (p_vat_rate = '5%' AND (ii.vat_rate ILIKE '%5%' OR ii.vat_rate = '0.05' OR ii.vat_code ILIKE '%5%'))
              OR (p_vat_rate = '0%' AND (ii.vat_rate ILIKE '%0%' OR ii.vat_rate = '0' OR ii.vat_rate = '0.00' OR ii.vat_code ILIKE '%0%'))
              OR (p_vat_rate = 'AAM' AND (ii.vat_rate ILIKE '%AAM%' OR ii.vat_code ILIKE '%AAM%'))
              OR (p_vat_rate = 'TAM' AND (ii.vat_rate ILIKE '%TAM%' OR ii.vat_code ILIKE '%TAM%'))
            )
        )
      )
  ),
  all_tx_distinct AS (
    SELECT DISTINCT
      tx.id as transaction_id,
      tx.matched_invoice_id as invoice_id,
      tx.amount,
      tx.fee_amount,
      tx.match_type,
      tx.is_verified,
      tx.confidence_score
    FROM transactions tx
    WHERE tx.company_id = p_company_id AND tx.matched_invoice_id IS NOT NULL
    UNION
    SELECT DISTINCT
      t.id as transaction_id,
      tim.invoice_id,
      t.amount,
      t.fee_amount,
      COALESCE(tim.created_by, t.match_type) as match_type,
      t.is_verified,
      t.confidence_score
    FROM transaction_invoice_matches tim
    JOIN transactions t ON t.company_id = p_company_id AND t.id = tim.transaction_id
  ),
  all_tx_matches AS (
    SELECT 
      m.invoice_id,
      bool_or(m.match_type = 'manual' OR m.is_verified = true OR (m.confidence_score IS NOT NULL AND m.confidence_score >= 0.9)) AS is_matched,
      bool_or(m.match_type != 'manual' AND (m.is_verified IS NOT TRUE) AND (m.confidence_score < 0.9)) AS is_suggested,
      COALESCE(SUM(
        CASE 
          WHEN m.match_type = 'manual' OR m.is_verified = true OR (m.confidence_score IS NOT NULL AND m.confidence_score >= 0.9)
          THEN ABS(m.amount) + COALESCE(ABS(m.fee_amount), 0)
          ELSE 0
        END
      ), 0) AS total_paid_amount
    FROM all_tx_distinct m
    GROUP BY m.invoice_id
  ),
  with_status AS (
    SELECT 
      bf.*,
      CASE
        WHEN COALESCE(atm.total_paid_amount, 0) > 0 THEN COALESCE(atm.total_paid_amount, 0)
        WHEN bf.is_manual_payment = true 
          OR LOWER(COALESCE(bf.fizetesi_mod, '')) IN ('készpénz', 'keszpenz', 'cash')
          OR bf.fizetesi_mod ILIKE '%készpénz%'
          OR bf.fizetesi_mod ILIKE '%keszpenz%'
          OR bf.fizetve = true
          OR EXISTS (
            SELECT 1 FROM courier_reports cr 
            WHERE cr.company_id = p_company_id 
              AND cr.reference_number = bf.bizonylatsorszam 
              AND cr.match_status = 'full'
          )
        THEN ABS(COALESCE(bf.brutto_vegosszeg, 0))
        ELSE 0
      END AS computed_paid_raw,
      ABS(COALESCE(bf.brutto_vegosszeg, 0)) AS gross_abs
    FROM base_filtered bf
    LEFT JOIN all_tx_matches atm ON atm.invoice_id = bf.id
  ),
  with_calc AS (
    SELECT
      ws.*,
      LEAST(ws.computed_paid_raw, ws.gross_abs) AS calculated_paid,
      GREATEST(0::numeric, ws.gross_abs - ws.computed_paid_raw) AS calculated_remaining,
      CASE
        WHEN ws.gross_abs > 0 AND ws.computed_paid_raw >= ws.gross_abs - 0.5 THEN 'matched'
        WHEN ws.gross_abs = 0 AND ws.computed_paid_raw >= 0 AND (
          ws.fizetve = true 
          OR ws.transaction_id IS NOT NULL 
          OR ws.is_manual_payment = true 
          OR LOWER(COALESCE(ws.fizetesi_mod, '')) IN ('készpénz', 'keszpenz', 'cash')
          OR ws.fizetesi_mod ILIKE '%készpénz%'
          OR ws.fizetesi_mod ILIKE '%keszpenz%'
          OR EXISTS (
            SELECT 1 FROM courier_reports cr 
            WHERE cr.company_id = p_company_id 
              AND cr.reference_number = ws.bizonylatsorszam 
              AND cr.match_status = 'full'
          )
        ) THEN 'matched'
        WHEN (COALESCE(ws.computed_paid_raw, 0) > 0 AND ws.computed_paid_raw < ws.gross_abs - 0.5) THEN 'partially_paid'
        WHEN atm_tx.is_suggested = true THEN 'suggested'
        ELSE 'unmatched'
      END AS computed_match_status
    FROM with_status ws
    LEFT JOIN all_tx_matches atm_tx ON atm_tx.invoice_id = ws.id
  ),
  kpi_filtered AS (
    SELECT *
    FROM with_calc wc
    WHERE p_kpi_filter IS NULL 
      OR p_kpi_filter = 'all'
      OR (p_kpi_filter = 'matched' AND wc.computed_match_status IN ('matched', 'partially_paid'))
      OR (p_kpi_filter = 'suggested' AND wc.computed_match_status = 'suggested')
      OR (p_kpi_filter = 'unmatched' AND wc.computed_match_status = 'unmatched')
  ),
  counted AS (
    SELECT COUNT(*)::bigint AS cnt FROM kpi_filtered
  )
  SELECT
    kf.id,
    kf.bizonylatsorszam,
    kf.kibocsatas_datuma,
    kf.teljesites_datuma,
    kf.elado_nev,
    kf.vevo_nev,
    kf.adoalap_osszesen,
    kf.brutto_vegosszeg,
    kf.afa_osszeg_osszesen,
    kf.penznem,
    kf.category_id,
    kf.project_id,
    kf.image_url,
    kf.melleklet_url,
    kf.invoice_direction,
    kf.reference_number,
    kf.exclude_from_accounting,
    kf.accounting_exclusion_type,
    kf.deferred_vat_reason,
    kf.deferred_vat_since,
    kf.deferred_vat_target_period,
    kf.is_accountant_reviewed,
    kf.fizetesi_mod,
    kf.match_status,
    kf.paid_amount,
    kf.remaining_amount,
    kf.statusz,
    kf.nav_status,
    kf.approval_note,
    kf.approved_at,
    counted.cnt AS total_count
  FROM kpi_filtered kf
  CROSS JOIN counted
  ORDER BY
    CASE WHEN p_sort_field = 'kibocsatas_datuma' AND p_sort_dir = 'asc' THEN kf.kibocsatas_datuma END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'kibocsatas_datuma' AND p_sort_dir = 'desc' THEN kf.kibocsatas_datuma END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'teljesites_datuma' AND p_sort_dir = 'asc' THEN kf.teljesites_datuma END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'teljesites_datuma' AND p_sort_dir = 'desc' THEN kf.teljesites_datuma END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'brutto_vegosszeg' AND p_sort_dir = 'asc' THEN kf.brutto_vegosszeg END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'brutto_vegosszeg' AND p_sort_dir = 'desc' THEN kf.brutto_vegosszeg END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'elado_nev' AND p_sort_dir = 'asc' THEN kf.elado_nev END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'elado_nev' AND p_sort_dir = 'desc' THEN kf.elado_nev END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'bizonylatsorszam' AND p_sort_dir = 'asc' THEN kf.bizonylatsorszam END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'bizonylatsorszam' AND p_sort_dir = 'desc' THEN kf.bizonylatsorszam END DESC NULLS LAST,
    kf.kibocsatas_datuma DESC NULLS LAST,
    kf.id ASC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_filtered_submitted_invoices FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_filtered_submitted_invoices TO authenticated, service_role;
