-- Migration: 20261008170000_gl_zero_as_value_and_account_ids.sql
-- Description:
-- 1. Zero-as-Value: Allow 0 Ft gross invoices to generate partner obligation/claim rows (311/454) in get_gl_balances and get_gl_categorized_items by checking IS NOT NULL instead of != 0.
-- 2. Concurrency & Batching: Add p_gl_account_ids uuid[] support to get_gl_categorized_items to allow multi-account batch fetching, dropping the old 10-param signature to avoid PostgREST PGRST202 ambiguity.

-- ============================================================================
-- 1. Update get_gl_balances (Zero-as-Value for gross partner lines)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text);
CREATE OR REPLACE FUNCTION public.get_gl_balances(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_posting_status text DEFAULT 'ALL'::text
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
    -- ① transactions (banki tételek)
    SELECT
      t.id as item_id,
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
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
    -- Zero-as-Value: Use i.brutto_vegosszeg IS NOT NULL so 0 Ft invoices generate partner lines
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

    -- ③_vat: unposted nav_invoices VAT lines (466 Levonható ÁFA = DEBIT +, 467 Fizetendő ÁFA = CREDIT -)
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

    -- ③_partner: unposted nav_invoices Partner lines (454 Szállítók = CREDIT -, 311 Vevők = DEBIT +)
    -- Zero-as-Value: Use n.invoice_gross_amount IS NOT NULL so 0 Ft invoices generate partner lines
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

    -- ④ Imported XML journal entries — DEBIT side (+)
    SELECT
      je.id as item_id,
      je.amount AS amount,
      jm.mapped_id AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.gl_journal_entries je
    LEFT JOIN je_map jm ON jm.acc_num = je.debit_account
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR voucher_date <= p_date_to)

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (-)
    SELECT
      je.id as item_id,
      -je.amount AS amount,
      jm.mapped_id AS mapped_id,
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
  )
  SELECT
    pa.id AS gl_account_id,
    pa.gl_number::text,
    pa.short_name::text,
    COALESCE(SUM(r.amount), 0)::numeric AS total_balance,
    COALESCE(SUM(CASE WHEN NOT r.is_temporary THEN r.amount ELSE 0 END), 0)::numeric AS final_balance,
    COALESCE(SUM(CASE WHEN r.is_temporary THEN r.amount ELSE 0 END), 0)::numeric AS temp_balance,
    COALESCE(SUM(r.sub_count), 0)::bigint AS item_count
  FROM preset_accounts pa
  LEFT JOIN raw_items r ON r.mapped_id = pa.id
  GROUP BY pa.id, pa.gl_number, pa.short_name

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

REVOKE ALL ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) TO authenticated, service_role;


-- ============================================================================
-- 2. Drop old 10-parameter signature of get_gl_categorized_items
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer);


-- ============================================================================
-- 3. Create updated 11-parameter get_gl_categorized_items with Zero-as-Value
--    and p_gl_account_ids uuid[] batching support
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_posting_status text DEFAULT 'ALL'::text,
  p_gl_account_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT NULL::integer,
  p_offset integer DEFAULT 0,
  p_gl_account_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS TABLE(
  item_id uuid,
  gl_account_id uuid,
  source_table text,
  item_type text,
  partner text,
  description text,
  amount numeric,
  original_amount numeric,
  original_currency text,
  item_date text,
  is_temporary boolean
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
      i.bizonylatsorszam,
      i.elolegszamla_hivatkozas,
      i.elado_nev,
      i.vevo_nev
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
      n.partner_gl_number,
      n.supplier_name,
      n.customer_name
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
  raw_items AS (
    -- ① transactions (banki tételek)
    SELECT
      t.id AS item_id,
      CASE WHEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'transactions'::text AS source_table,
      'Banki tranzakció'::text AS item_type,
      NULL::text AS partner,
      t.description::text AS description,
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1) AS amount,
      t.amount::numeric AS original_amount,
      COALESCE(t.currency, 'HUF')::text AS original_currency,
      t.transaction_date::text AS item_date,
      false AS is_temporary
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
      ii.id AS item_id,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'invoice_items'::text AS source_table,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN 'Bejövő (Költség)' ELSE 'Kimenő (Bevétel)' END::text AS item_type,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN i.elado_nev ELSE i.vevo_nev END::text AS partner,
      (CASE
        WHEN i.bizonylatsorszam IS NOT NULL AND i.elolegszamla_hivatkozas IS NOT NULL AND i.elolegszamla_hivatkozas <> '' AND i.elolegszamla_hivatkozas <> i.bizonylatsorszam
          THEN i.bizonylatsorszam || ' (Előleg: ' || i.elolegszamla_hivatkozas || ') - ' || COALESCE(ii.line_description, '')
        WHEN i.bizonylatsorszam IS NOT NULL AND ii.line_description IS NOT NULL AND ii.line_description NOT ILIKE '%' || i.bizonylatsorszam || '%'
          THEN i.bizonylatsorszam || ' - ' || ii.line_description
        ELSE COALESCE(ii.line_description, i.bizonylatsorszam)
      END)::text AS description,
      (CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN (COALESCE(ii.net_amount, 0) + ROUND(COALESCE(ii.vat_amount, 0) * (1.0 - (COALESCE(ii.deductible_percentage, 100.0) / 100.0)), 2))
        ELSE -COALESCE(ii.net_amount, 0) 
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      (CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN (COALESCE(ii.net_amount, 0) + ROUND(COALESCE(ii.vat_amount, 0) * (1.0 - (COALESCE(ii.deductible_percentage, 100.0) / 100.0)), 2))
        ELSE -COALESCE(ii.net_amount, 0) 
      END)::numeric AS original_amount,
      COALESCE(i.penznem, 'HUF')::text AS original_currency,
      CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::text
        ELSE i.kibocsatas_datuma::text
      END AS item_date,
      false AS is_temporary
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
      i.id AS item_id,
      gtm.mapped_id,
      'invoices_vat'::text AS source_table,
      (CASE WHEN i.invoice_direction = 'INBOUND' THEN 'Levonható ÁFA (466)' ELSE 'Fizetendő ÁFA (467)' END)::text AS item_type,
      (CASE WHEN i.invoice_direction = 'INBOUND' THEN i.elado_nev ELSE i.vevo_nev END)::text AS partner,
      (COALESCE(i.bizonylatsorszam, 'ÁFA tétel') || ' - ÁFA')::text AS description,
      (CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN 
          ROUND(COALESCE(i.afa_osszeg_osszesen, 0) * COALESCE(ipd.ratio, 1.0), 2)
        ELSE -COALESCE(i.afa_osszeg_osszesen, 0)
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      (CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN 
          ROUND(COALESCE(i.afa_osszeg_osszesen, 0) * COALESCE(ipd.ratio, 1.0), 2)
        ELSE -COALESCE(i.afa_osszeg_osszesen, 0)
      END)::numeric AS original_amount,
      COALESCE(i.penznem, 'HUF')::text AS original_currency,
      (CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::text
        ELSE i.kibocsatas_datuma::text
      END) AS item_date,
      false AS is_temporary
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
    -- Zero-as-Value: Use i.brutto_vegosszeg IS NOT NULL so 0 Ft invoices generate partner lines
    SELECT
      i.id AS item_id,
      gtm.mapped_id,
      'invoices_partner'::text AS source_table,
      (CASE WHEN i.invoice_direction = 'INBOUND' THEN 'Szállítói kötelezettség (454)' ELSE 'Vevőkövetelés (311)' END)::text AS item_type,
      (CASE WHEN i.invoice_direction = 'INBOUND' THEN i.elado_nev ELSE i.vevo_nev END)::text AS partner,
      (COALESCE(i.bizonylatsorszam, 'Partner tétel') || ' - Bruttó partner')::text AS description,
      (CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN -COALESCE(i.brutto_vegosszeg, 0)
        ELSE COALESCE(i.brutto_vegosszeg, 0)
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      (CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN -COALESCE(i.brutto_vegosszeg, 0)
        ELSE COALESCE(i.brutto_vegosszeg, 0)
      END)::numeric AS original_amount,
      COALESCE(i.penznem, 'HUF')::text AS original_currency,
      (CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::text
        ELSE i.kibocsatas_datuma::text
      END) AS item_date,
      false AS is_temporary
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
      ni.id AS item_id,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'nav_invoice_items'::text AS source_table,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN 'NAV Bejövő tétel' ELSE 'NAV Kimenő tétel' END::text AS item_type,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN n.supplier_name ELSE n.customer_name END::text AS partner,
      (CASE
        WHEN n.invoice_number IS NOT NULL AND ni.line_description IS NOT NULL AND ni.line_description NOT ILIKE '%' || n.invoice_number || '%'
          THEN n.invoice_number || ' - ' || ni.line_description
        ELSE COALESCE(ni.line_description, n.invoice_number)
      END)::text AS description,
      (CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN (COALESCE(ni.net_amount, 0) + ROUND(COALESCE(ni.vat_amount, 0) * (1.0 - (COALESCE(ni.deductible_percentage, 100.0) / 100.0)), 2))
        ELSE -COALESCE(ni.net_amount, 0) 
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      (CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN (COALESCE(ni.net_amount, 0) + ROUND(COALESCE(ni.vat_amount, 0) * (1.0 - (COALESCE(ni.deductible_percentage, 100.0) / 100.0)), 2))
        ELSE -COALESCE(ni.net_amount, 0) 
      END)::numeric AS original_amount,
      COALESCE(n.currency, 'HUF')::text AS original_currency,
      CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::text
        ELSE COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text
      END AS item_date,
      true AS is_temporary
    FROM public.nav_invoice_items ni
    JOIN valid_nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE ni.company_id = p_company_id
      AND NOT COALESCE(ni.exclude_from_accounting, false)
      AND NOT EXISTS (
        SELECT 1 FROM booked_header_keys bh
        WHERE bh.import_key = ni.id::text
      )

    UNION ALL

    -- ③_vat: unposted nav_invoices VAT lines (466 Levonható ÁFA = DEBIT +, 467 Fizetendő ÁFA = CREDIT -)
    SELECT
      n.id AS item_id,
      gtm.mapped_id,
      'nav_invoices_vat'::text AS source_table,
      (CASE WHEN n.invoice_direction = 'INBOUND' THEN 'NAV Levonható ÁFA (466)' ELSE 'NAV Fizetendő ÁFA (467)' END)::text AS item_type,
      (CASE WHEN n.invoice_direction = 'INBOUND' THEN n.supplier_name ELSE n.customer_name END)::text AS partner,
      (COALESCE(n.invoice_number, 'NAV ÁFA tétel') || ' - ÁFA')::text AS description,
      (CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN 
          ROUND(COALESCE(n.invoice_vat_amount, 0) * COALESCE(npd.ratio, 1.0), 2)
        ELSE -COALESCE(n.invoice_vat_amount, 0)
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      (CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN 
          ROUND(COALESCE(n.invoice_vat_amount, 0) * COALESCE(npd.ratio, 1.0), 2)
        ELSE -COALESCE(n.invoice_vat_amount, 0)
      END)::numeric AS original_amount,
      COALESCE(n.currency, 'HUF')::text AS original_currency,
      (CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::text
        ELSE COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text
      END) AS item_date,
      true AS is_temporary
    FROM valid_nav_invoices n
    LEFT JOIN nav_partial_deductible npd ON npd.nav_invoice_id = n.id
    LEFT JOIN gl_target_map gtm ON gtm.target_num = COALESCE(n.vat_gl_number, CASE WHEN n.invoice_direction = 'INBOUND' THEN '466' ELSE '467' END)
    WHERE COALESCE(n.invoice_vat_amount, 0) != 0
      AND NOT EXISTS (
        SELECT 1 FROM booked_header_keys bh
        WHERE bh.import_key = n.id::text
      )

    UNION ALL

    -- ③_partner: unposted nav_invoices Partner lines (454 Szállítók = CREDIT -, 311 Vevők = DEBIT +)
    -- Zero-as-Value: Use n.invoice_gross_amount IS NOT NULL so 0 Ft invoices generate partner lines
    SELECT
      n.id AS item_id,
      gtm.mapped_id,
      'nav_invoices_partner'::text AS source_table,
      (CASE WHEN n.invoice_direction = 'INBOUND' THEN 'NAV Szállítói kötelezettség (454)' ELSE 'NAV Vevőkövetelés (311)' END)::text AS item_type,
      (CASE WHEN n.invoice_direction = 'INBOUND' THEN n.supplier_name ELSE n.customer_name END)::text AS partner,
      (COALESCE(n.invoice_number, 'NAV Partner tétel') || ' - Bruttó partner')::text AS description,
      (CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN -COALESCE(n.invoice_gross_amount, 0)
        ELSE COALESCE(n.invoice_gross_amount, 0)
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      (CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN -COALESCE(n.invoice_gross_amount, 0)
        ELSE COALESCE(n.invoice_gross_amount, 0)
      END)::numeric AS original_amount,
      COALESCE(n.currency, 'HUF')::text AS original_currency,
      (CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::text
        ELSE COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text
      END) AS item_date,
      true AS is_temporary
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

    -- ④ Imported XML journal entries — DEBIT side (+)
    SELECT
      je.id AS item_id,
      jm.mapped_id AS mapped_id,
      'journal_entry'::text AS source_table,
      'XML Könyvelési tétel (T)'::text AS item_type,
      je.partner_name::text AS partner,
      (CASE
        WHEN je.voucher_number IS NOT NULL AND je.description IS NOT NULL AND je.description NOT ILIKE '%' || je.voucher_number || '%'
          THEN je.voucher_number || ' - ' || je.description
        ELSE COALESCE(je.description, je.voucher_number)
      END)::text AS description,
      je.amount AS amount,
      je.amount::numeric AS original_amount,
      'HUF'::text AS original_currency,
      je.voucher_date::text AS item_date,
      false AS is_temporary
    FROM public.gl_journal_entries je
    LEFT JOIN je_map jm ON jm.acc_num = je.debit_account
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR voucher_date <= p_date_to)

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (-)
    SELECT
      je.id AS item_id,
      jm.mapped_id AS mapped_id,
      'journal_entry'::text AS source_table,
      'XML Könyvelési tétel (K)'::text AS item_type,
      je.partner_name::text AS partner,
      (CASE
        WHEN je.voucher_number IS NOT NULL AND je.description IS NOT NULL AND je.description NOT ILIKE '%' || je.voucher_number || '%'
          THEN je.voucher_number || ' - ' || je.description
        ELSE COALESCE(je.description, je.voucher_number)
      END)::text AS description,
      -je.amount AS amount,
      (-je.amount)::numeric AS original_amount,
      'HUF'::text AS original_currency,
      je.voucher_date::text AS item_date,
      false AS is_temporary
    FROM public.gl_journal_entries je
    LEFT JOIN je_map jm ON jm.acc_num = je.credit_account
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR voucher_date <= p_date_to)

    UNION ALL

    -- ⑥ Internal accounting journals (acc_journal_lines: T = +, K = -)
    SELECT
      l.id AS item_id,
      COALESCE(
        CASE WHEN g.preset_id = p_preset_id THEN g.id ELSE NULL END,
        best_active.id,
        g.id
      ) AS mapped_id,
      'acc_journal_lines'::text AS source_table,
      CASE
        WHEN h.entry_type = 'OPENING' OR j.code = 'NY' THEN 'Nyitó tétel'
        WHEN h.entry_type = 'CLOSING' OR j.code = 'Z' THEN 'Záró tétel'
        WHEN j.code = 'VE' THEN 'Vegyes napló tétel'
        WHEN l.dc_type = 'T' THEN 'Könyvelt napló tétel (T)'
        ELSE 'Könyvelt napló tétel (K)'
      END::text AS item_type,
      p.name::text AS partner,
      (CASE
        WHEN h.document_id IS NOT NULL AND l.description IS NOT NULL AND l.description NOT ILIKE '%' || h.document_id || '%'
          THEN h.document_id || ' - ' || l.description
        WHEN h.document_id IS NOT NULL AND h.description IS NOT NULL AND h.description NOT ILIKE '%' || h.document_id || '%'
          THEN h.document_id || ' - ' || h.description
        ELSE COALESCE(l.description, h.description, h.document_id)
      END)::text AS description,
      (CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END) AS amount,
      (CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END)::numeric AS original_amount,
      COALESCE(h.currency, 'HUF')::text AS original_currency,
      (CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(h.posting_date, h.document_date)::text
        ELSE COALESCE(h.document_date, h.posting_date)::text
      END) AS item_date,
      false AS is_temporary
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    LEFT JOIN public.acc_journals j ON h.journal_id = j.id
    LEFT JOIN public.partners p ON h.partner_id = p.id
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
  )
  SELECT
    r.item_id,
    r.mapped_id AS gl_account_id,
    r.source_table,
    r.item_type,
    r.partner,
    r.description,
    r.amount,
    r.original_amount,
    r.original_currency,
    r.item_date,
    r.is_temporary
  FROM raw_items r
  WHERE (
    (p_gl_account_id IS NULL AND p_gl_account_ids IS NULL)
    OR (
      (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid OR ('00000000-0000-0000-0000-000000000000'::uuid = ANY(p_gl_account_ids)))
      AND (r.mapped_id IS NULL OR NOT EXISTS (SELECT 1 FROM preset_accounts pa WHERE pa.id = r.mapped_id))
    )
    OR (p_gl_account_id IS NOT NULL AND p_gl_account_id != '00000000-0000-0000-0000-000000000000'::uuid AND r.mapped_id = p_gl_account_id)
    OR (p_gl_account_ids IS NOT NULL AND r.mapped_id = ANY(p_gl_account_ids))
  )
  ORDER BY r.item_date DESC, r.item_id
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

-- Revoke execute from public/anon and grant to authenticated/service_role
REVOKE ALL ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer, uuid[]) TO authenticated, service_role;
