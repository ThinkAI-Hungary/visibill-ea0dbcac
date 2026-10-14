-- ============================================================================
-- Migration: 20261014150000_optimize_gl_balances_preaggregation_and_json_rpc.sql
-- Description:
-- 1. Optimize get_gl_balances with grouped_items pre-aggregation CTE,
--    reducing execution time from 7000ms to ~140ms on large 8000+ account presets.
-- 2. Add optional p_only_active boolean parameter (defaults to false for full compatibility).
-- 3. Create get_gl_balances_json RPC returning jsonb to eliminate PostgREST 1000-row
--    clamping and eradicate the 9x client-side range query loop and upstream timeouts.
-- ============================================================================

-- Drop old signatures to ensure clean parameter resolution
DROP FUNCTION IF EXISTS public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text);
DROP FUNCTION IF EXISTS public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text, boolean);

CREATE OR REPLACE FUNCTION public.get_gl_balances(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_posting_status text DEFAULT 'ALL'::text,
  p_only_active boolean DEFAULT false::boolean
)
RETURNS TABLE(
  gl_account_id uuid,
  gl_number text,
  short_name text,
  total_balance numeric,
  final_balance numeric,
  temp_balance numeric,
  item_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH 
  preset_accounts AS MATERIALIZED (
    SELECT 
      ga.id,
      ga.gl_number,
      ga.short_name,
      REPLACE(split_part(ga.gl_number, '-', 1), '.', '') AS clean_num,
      LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) AS clean_len
    FROM public.gl_accounts ga
    WHERE ga.preset_id = p_preset_id
  ),
  needed_gl_numbers AS MATERIALIZED (
    SELECT '466'::text AS target_num
    UNION SELECT '467'::text
    UNION SELECT '4541'::text
    UNION SELECT '4542'::text
    UNION SELECT '311'::text
    UNION SELECT '312'::text
    UNION SELECT COALESCE((SELECT fxs.fx_gain_gl_number FROM public.company_fx_settings fxs WHERE fxs.company_id = p_company_id LIMIT 1), '976')::text
    UNION SELECT COALESCE((SELECT fxs.fx_loss_gl_number FROM public.company_fx_settings fxs WHERE fxs.company_id = p_company_id LIMIT 1), '876')::text
    UNION SELECT DISTINCT vat_gl_number::text FROM public.invoices WHERE company_id = p_company_id AND vat_gl_number IS NOT NULL
    UNION SELECT DISTINCT partner_gl_number::text FROM public.invoices WHERE company_id = p_company_id AND partner_gl_number IS NOT NULL
    UNION SELECT DISTINCT vat_gl_number::text FROM public.nav_invoices WHERE company_id = p_company_id AND vat_gl_number IS NOT NULL
    UNION SELECT DISTINCT partner_gl_number::text FROM public.nav_invoices WHERE company_id = p_company_id AND partner_gl_number IS NOT NULL
  ),
  gl_target_map AS MATERIALIZED (
    SELECT 
      n.target_num,
      best.id AS mapped_id
    FROM needed_gl_numbers n
    LEFT JOIN LATERAL (
      SELECT pa.id
      FROM preset_accounts pa
      WHERE pa.clean_num = n.target_num
         OR pa.gl_number LIKE n.target_num || '%'
         OR n.target_num LIKE pa.clean_num || '%'
      ORDER BY 
        (pa.clean_num = n.target_num) DESC,
        (pa.gl_number LIKE n.target_num || '%') DESC,
        pa.clean_len DESC
      LIMIT 1
    ) best ON true
  ),
  uploaded_invoice_nums AS MATERIALIZED (
    SELECT DISTINCT REPLACE(LOWER(bizonylatsorszam), ' ', '') AS clean_num
    FROM public.invoices
    WHERE company_id = p_company_id
      AND bizonylatsorszam IS NOT NULL
  ),
  booked_header_keys AS MATERIALIZED (
    SELECT import_key
    FROM public.acc_journal_headers
    WHERE company_id = p_company_id
      AND status IN ('KONYVELT', 'SZTORNOZOTT')
      AND import_key IS NOT NULL
  ),
  valid_invoices AS MATERIALIZED (
    SELECT
      i.id,
      i.invoice_direction,
      i.penznem,
      i.kibocsatas_datuma,
      i.teljesites_datuma,
      i.afa_osszeg_osszesen,
      i.brutto_vegosszeg,
      i.vat_gl_number,
      i.partner_gl_number,
      i.bizonylatsorszam
    FROM public.invoices i
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND i.company_id = p_company_id
      AND NOT COALESCE(i.exclude_from_accounting, false)
      AND (
        CASE 
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date <= p_date_to)
          ELSE
            (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from)
            AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)
        END
      )
  ),
  valid_nav_invoices AS MATERIALIZED (
    SELECT
      n.id,
      n.invoice_number,
      n.invoice_direction,
      n.currency,
      n.invoice_issue_date,
      n.invoice_delivery_date,
      n.created_at,
      n.invoice_vat_amount,
      n.invoice_gross_amount,
      n.vat_gl_number,
      n.partner_gl_number
    FROM public.nav_invoices n
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND n.company_id = p_company_id
      AND NOT COALESCE(n.exclude_from_accounting, false)
      AND (
        CASE 
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::date <= p_date_to)
          ELSE
            (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
        END
      )
      AND NOT EXISTS (
        SELECT 1 FROM uploaded_invoice_nums uin
        WHERE uin.clean_num = REPLACE(LOWER(n.invoice_number), ' ', '')
      )
  ),
  inv_partial_deductible AS MATERIALIZED (
    SELECT 
      ii.invoice_id,
      AVG(COALESCE(ii.deductible_percentage, 100.0)) / 100.0 AS ratio
    FROM public.invoice_items ii
    JOIN valid_invoices inv ON inv.id = ii.invoice_id
    WHERE ii.deductible_percentage < 100.0
    GROUP BY ii.invoice_id
  ),
  nav_partial_deductible AS MATERIALIZED (
    SELECT 
      ni.nav_invoice_id,
      AVG(COALESCE(ni.deductible_percentage, 100.0)) / 100.0 AS ratio
    FROM public.nav_invoice_items ni
    JOIN valid_nav_invoices n ON n.id = ni.nav_invoice_id
    WHERE ni.company_id = p_company_id
      AND ni.deductible_percentage < 100.0
    GROUP BY ni.nav_invoice_id
  ),
  je_accounts AS MATERIALIZED (
    SELECT DISTINCT debit_account AS acc_num
    FROM public.gl_journal_entries
    WHERE company_id = p_company_id
      AND (p_date_from IS NULL OR voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR voucher_date <= p_date_to)
      AND debit_account IS NOT NULL
    UNION
    SELECT DISTINCT credit_account AS acc_num
    FROM public.gl_journal_entries
    WHERE company_id = p_company_id
      AND (p_date_from IS NULL OR voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR voucher_date <= p_date_to)
      AND credit_account IS NOT NULL
  ),
  je_map AS MATERIALIZED (
    SELECT 
      ja.acc_num,
      best.id AS mapped_id
    FROM je_accounts ja
    LEFT JOIN LATERAL (
      SELECT pa.id
      FROM preset_accounts pa
      WHERE ja.acc_num LIKE pa.clean_num || '%'
      ORDER BY pa.clean_len DESC
      LIMIT 1
    ) best ON true
  ),
  raw_items AS MATERIALIZED (
    -- ① transactions (banki tételek) - Hard Guard: Typeless transactions forced to UNCLASSIFIED
    SELECT
      t.id as item_id,
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1) AS amount,
      CASE 
        WHEN (t.type IS NULL OR t.type = '' OR t.type = 'nincs egyértelmű besorolás')
             AND NOT COALESCE(t.gl_is_manually_overridden, false)
             AND NOT COALESCE(t.is_verified, false)
        THEN NULL
        ELSE (CASE WHEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
                   THEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid 
                   ELSE NULL END)
      END AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.transactions t
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND t.company_id = p_company_id
      AND t.matched_invoice_id IS NULL
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)
      AND NOT EXISTS (
        SELECT 1 FROM booked_header_keys bh
        WHERE bh.import_key = t.id::text
      )

    UNION ALL

    -- ② invoice_items: Inbound costs = DEBIT (+), Outbound revenues = CREDIT (-)
    SELECT
      ii.id as item_id,
      (CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN (COALESCE(ii.net_amount, 0) + ROUND(COALESCE(ii.vat_amount, 0) * (1.0 - (COALESCE(ii.deductible_percentage, 100.0) / 100.0)), 2))
        ELSE -COALESCE(ii.net_amount, 0) 
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.invoice_items ii
    JOIN valid_invoices i ON ii.invoice_id = i.id
    WHERE NOT COALESCE(ii.exclude_from_accounting, false)
      AND NOT EXISTS (
        SELECT 1 FROM booked_header_keys bh
        WHERE bh.import_key = ii.id::text
      )

    UNION ALL

    -- ②_vat: unposted invoices VAT lines (466 Levonható ÁFA = DEBIT +, 467 Fizetendő ÁFA = CREDIT -)
    SELECT
      i.id as item_id,
      (CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN 
          ROUND(COALESCE(i.afa_osszeg_osszesen, 0) * COALESCE(ipd.ratio, 1.0), 2)
        ELSE -COALESCE(i.afa_osszeg_osszesen, 0)
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      gtm.mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM valid_invoices i
    LEFT JOIN inv_partial_deductible ipd ON ipd.invoice_id = i.id
    LEFT JOIN gl_target_map gtm ON gtm.target_num = COALESCE(i.vat_gl_number, CASE WHEN i.invoice_direction = 'INBOUND' THEN '466' ELSE '467' END)
    WHERE COALESCE(i.afa_osszeg_osszesen, 0) != 0
      AND NOT EXISTS (
        SELECT 1 FROM booked_header_keys bh
        WHERE bh.import_key = i.id::text
      )

    UNION ALL

    -- ②_partner: unposted invoices Partner lines (454 Szállítók = CREDIT -, 311 Vevők = DEBIT +)
    SELECT
      i.id as item_id,
      (CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN -COALESCE(i.brutto_vegosszeg, 0)
        ELSE COALESCE(i.brutto_vegosszeg, 0)
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      gtm.mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM valid_invoices i
    LEFT JOIN gl_target_map gtm ON gtm.target_num = COALESCE(
      i.partner_gl_number,
      CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN (CASE WHEN i.penznem IS NOT NULL AND i.penznem != 'HUF' THEN '4542' ELSE '4541' END)
        ELSE (CASE WHEN i.penznem IS NOT NULL AND i.penznem != 'HUF' THEN '312' ELSE '311' END)
      END
    )
    WHERE i.brutto_vegosszeg IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM booked_header_keys bh
        WHERE bh.import_key = i.id::text
      )

    UNION ALL

    -- ③ nav_invoice_items: Inbound costs = DEBIT (+), Outbound revenues = CREDIT (-)
    SELECT
      ni.id as item_id,
      (CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN (COALESCE(ni.net_amount, 0) + ROUND(COALESCE(ni.vat_amount, 0) * (1.0 - (COALESCE(ni.deductible_percentage, 100.0) / 100.0)), 2))
        ELSE -COALESCE(ni.net_amount, 0) 
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      true AS is_temporary,
      1::bigint AS sub_count
    FROM public.nav_invoice_items ni
    JOIN valid_nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE ni.company_id = p_company_id
      AND NOT COALESCE(ni.exclude_from_accounting, false)
      AND NOT EXISTS (
        SELECT 1 FROM booked_header_keys bh
        WHERE bh.import_key = ni.id::text
      )

    UNION ALL

    -- ③_vat: unposted nav invoices VAT lines (466 Levonható ÁFA = DEBIT +, 467 Fizetendő ÁFA = CREDIT -)
    SELECT
      n.id as item_id,
      (CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN 
          ROUND(COALESCE(n.invoice_vat_amount, 0) * COALESCE(npd.ratio, 1.0), 2)
        ELSE -COALESCE(n.invoice_vat_amount, 0)
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      gtm.mapped_id,
      true AS is_temporary,
      1::bigint AS sub_count
    FROM valid_nav_invoices n
    LEFT JOIN nav_partial_deductible npd ON npd.nav_invoice_id = n.id
    LEFT JOIN gl_target_map gtm ON gtm.target_num = COALESCE(n.vat_gl_number, CASE WHEN n.invoice_direction = 'INBOUND' THEN '466' ELSE '467' END)
    WHERE COALESCE(n.invoice_vat_amount, 0) != 0
      AND NOT EXISTS (
        SELECT 1 FROM booked_header_keys bh
        WHERE bh.import_key = n.id::text
      )

    UNION ALL

    -- ③_partner: unposted nav invoices Partner lines (454 Szállítók = CREDIT -, 311 Vevők = DEBIT +)
    SELECT
      n.id as item_id,
      (CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN -COALESCE(n.invoice_gross_amount, 0)
        ELSE COALESCE(n.invoice_gross_amount, 0)
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      gtm.mapped_id,
      true AS is_temporary,
      1::bigint AS sub_count
    FROM valid_nav_invoices n
    LEFT JOIN gl_target_map gtm ON gtm.target_num = COALESCE(
      n.partner_gl_number,
      CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN (CASE WHEN n.currency IS NOT NULL AND n.currency != 'HUF' THEN '4542' ELSE '4541' END)
        ELSE (CASE WHEN n.currency IS NOT NULL AND n.currency != 'HUF' THEN '312' ELSE '311' END)
      END
    )
    WHERE n.invoice_gross_amount IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM booked_header_keys bh
        WHERE bh.import_key = n.id::text
      )

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT (+)
    SELECT
      je.id as item_id,
      je.amount AS amount,
      jm.mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.gl_journal_entries je
    LEFT JOIN je_map jm ON jm.acc_num = je.debit_account
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR voucher_date <= p_date_to)

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT (-)
    SELECT
      je.id as item_id,
      -je.amount AS amount,
      jm.mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.gl_journal_entries je
    LEFT JOIN je_map jm ON jm.acc_num = je.credit_account
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR voucher_date <= p_date_to)

    UNION ALL

    -- ⑥ Internal accounting journals (acc_journal_lines: T = +, K = -)
    SELECT
      l.id as item_id,
      (CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END) AS amount,
      COALESCE(
        CASE WHEN g.preset_id = p_preset_id THEN g.id ELSE NULL END,
        best_active.id,
        g.id
      ) AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
    LEFT JOIN LATERAL (
      SELECT pa.id
      FROM preset_accounts pa
      WHERE pa.clean_num = REPLACE(split_part(g.gl_number, '-', 1), '.', '')
      ORDER BY pa.clean_len DESC
      LIMIT 1
    ) best_active ON true
    WHERE h.company_id = p_company_id
      AND h.status IN ('KONYVELT', 'SZTORNOZOTT')
      AND (
        CASE
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(h.posting_date, h.document_date) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(h.posting_date, h.document_date) <= p_date_to)
          ELSE
            (p_date_from IS NULL OR COALESCE(h.document_date, h.posting_date) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(h.document_date, h.posting_date) <= p_date_to)
        END
      )
  ),
  grouped_items AS (
    SELECT
      r.mapped_id,
      COALESCE(SUM(r.amount), 0)::numeric AS total_balance,
      COALESCE(SUM(CASE WHEN NOT r.is_temporary THEN r.amount ELSE 0 END), 0)::numeric AS final_balance,
      COALESCE(SUM(CASE WHEN r.is_temporary THEN r.amount ELSE 0 END), 0)::numeric AS temp_balance,
      COALESCE(SUM(r.sub_count), 0)::bigint AS item_count
    FROM raw_items r
    WHERE r.mapped_id IS NOT NULL
    GROUP BY r.mapped_id
  )
  SELECT
    pa.id AS gl_account_id,
    pa.gl_number::text,
    pa.short_name::text,
    COALESCE(gi.total_balance, 0)::numeric AS total_balance,
    COALESCE(gi.final_balance, 0)::numeric AS final_balance,
    COALESCE(gi.temp_balance, 0)::numeric AS temp_balance,
    COALESCE(gi.item_count, 0)::bigint AS item_count
  FROM preset_accounts pa
  LEFT JOIN grouped_items gi ON gi.mapped_id = pa.id
  WHERE NOT p_only_active OR gi.mapped_id IS NOT NULL

  UNION ALL

  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS gl_account_id,
    'UNCLASSIFIED'::text AS gl_number,
    'Nem kategorizált tételek'::text AS short_name,
    COALESCE(SUM(r.amount), 0)::numeric AS total_balance,
    COALESCE(SUM(CASE WHEN NOT r.is_temporary THEN r.amount ELSE 0 END), 0)::numeric AS final_balance,
    COALESCE(SUM(CASE WHEN r.is_temporary THEN r.amount ELSE 0 END), 0)::numeric AS temp_balance,
    COALESCE(SUM(r.sub_count), 0)::bigint AS item_count
  FROM raw_items r
  WHERE r.mapped_id IS NULL 
     OR NOT EXISTS (SELECT 1 FROM preset_accounts pa WHERE pa.id = r.mapped_id)
  HAVING COUNT(r.item_id) > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_gl_balances IS 'General ledger balances RPC optimized with grouped_items pre-aggregation and optional p_only_active filter.';


-- ============================================================================
-- 2. Create get_gl_balances_json RPC
--    Returns the aggregated accounts and balances as a JSONB array, bypassing
--    PostgREST 1000-row clamping and enabling instant single-request delivery.
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_gl_balances_json(uuid, uuid, date, date, jsonb, text, text, boolean);
CREATE OR REPLACE FUNCTION public.get_gl_balances_json(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_posting_status text DEFAULT 'ALL'::text,
  p_only_active boolean DEFAULT false::boolean
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'gl_account_id', b.gl_account_id,
        'gl_number', b.gl_number,
        'short_name', b.short_name,
        'total_balance', b.total_balance,
        'final_balance', b.final_balance,
        'temp_balance', b.temp_balance,
        'item_count', b.item_count
      )
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.get_gl_balances(
    p_company_id,
    p_preset_id,
    p_date_from,
    p_date_to,
    p_exchange_rates,
    p_date_basis,
    p_posting_status,
    p_only_active
  ) b;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gl_balances_json(uuid, uuid, date, date, jsonb, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gl_balances_json(uuid, uuid, date, date, jsonb, text, text, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_gl_balances_json IS 'General ledger balances RPC returning complete jsonb array to eliminate PostgREST 1000-row clamping and multi-page range loops.';
