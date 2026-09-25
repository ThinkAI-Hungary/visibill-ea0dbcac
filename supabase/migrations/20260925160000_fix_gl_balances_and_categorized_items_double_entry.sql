-- Migration: 20260925160000_fix_gl_balances_and_categorized_items_double_entry.sql
-- Description:
-- 1. In get_gl_balances:
--    - Fix sign for invoice_items and nav_invoice_items:
--      INBOUND costs (Class 5, 8, etc.) are DEBIT (Tartozik) = positive (+)
--      OUTBOUND revenues (Class 9) are CREDIT (Követel) = negative (-)
--    - Keep high performance CTE pre-lookups.
-- 2. In get_gl_categorized_items:
--    - Add missing unions: invoices_vat, invoices_partner, nav_invoices_vat, nav_invoices_partner.
--    - Ensure invoice serial numbers (bizonylatsorszam / invoice_number) are clearly included in item descriptions.
--    - Align signs so double-entry accounting holds: Tartozik = (+), Követel = (-).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. GET_GL_BALANCES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_gl_balances(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_posting_status text DEFAULT 'ALL'::text,
  p_date_basis text DEFAULT 'kibocsatas'::text
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
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH 
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
      SELECT ga.id
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND (
          REPLACE(split_part(ga.gl_number, '-', 1), '.', '') = n.target_num
          OR ga.gl_number LIKE n.target_num || '%'
          OR n.target_num LIKE REPLACE(split_part(ga.gl_number, '-', 1), '.', '') || '%'
        )
      ORDER BY 
        (REPLACE(split_part(ga.gl_number, '-', 1), '.', '') = n.target_num) DESC,
        (ga.gl_number LIKE n.target_num || '%') DESC,
        LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
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
  raw_items AS (
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
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND i.company_id = p_company_id
      AND NOT COALESCE(i.exclude_from_accounting, false)
      AND NOT COALESCE(ii.exclude_from_accounting, false)
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
          ROUND(COALESCE(i.afa_osszeg_osszesen, 0) * (
            SELECT COALESCE(AVG(ii_sub.deductible_percentage), 100.0) / 100.0 
            FROM public.invoice_items ii_sub 
            WHERE ii_sub.invoice_id = i.id
          ), 2)
        ELSE -COALESCE(i.afa_osszeg_osszesen, 0)
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      gtm.mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.invoices i
    LEFT JOIN gl_target_map gtm ON gtm.target_num = COALESCE(i.vat_gl_number, CASE WHEN i.invoice_direction = 'INBOUND' THEN '466' ELSE '467' END)
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND i.company_id = p_company_id
      AND NOT COALESCE(i.exclude_from_accounting, false)
      AND COALESCE(i.afa_osszeg_osszesen, 0) != 0
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
    FROM public.invoices i
    LEFT JOIN gl_target_map gtm ON gtm.target_num = COALESCE(
      i.partner_gl_number,
      CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN (CASE WHEN i.penznem IS NOT NULL AND i.penznem != 'HUF' THEN '4542' ELSE '4541' END)
        ELSE (CASE WHEN i.penznem IS NOT NULL AND i.penznem != 'HUF' THEN '312' ELSE '311' END)
      END
    )
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND i.company_id = p_company_id
      AND NOT COALESCE(i.exclude_from_accounting, false)
      AND COALESCE(i.brutto_vegosszeg, 0) != 0
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
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND n.company_id = p_company_id
      AND NOT COALESCE(n.exclude_from_accounting, false)
      AND NOT COALESCE(ni.exclude_from_accounting, false)
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
          ROUND(COALESCE(n.invoice_vat_amount, 0) * (
            SELECT COALESCE(AVG(ni_sub.deductible_percentage), 100.0) / 100.0 
            FROM public.nav_invoice_items ni_sub 
            WHERE ni_sub.nav_invoice_id = n.id
          ), 2)
        ELSE -COALESCE(n.invoice_vat_amount, 0)
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      gtm.mapped_id,
      true AS is_temporary,
      1::bigint AS sub_count
    FROM public.nav_invoices n
    LEFT JOIN gl_target_map gtm ON gtm.target_num = COALESCE(n.vat_gl_number, CASE WHEN n.invoice_direction = 'INBOUND' THEN '466' ELSE '467' END)
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND n.company_id = p_company_id
      AND NOT COALESCE(n.exclude_from_accounting, false)
      AND COALESCE(n.invoice_vat_amount, 0) != 0
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
      AND NOT EXISTS (
        SELECT 1 FROM booked_header_keys bh
        WHERE bh.import_key = n.id::text
      )

    UNION ALL

    -- ③_partner: unposted nav_invoices Partner lines (454 Szállítók = CREDIT -, 311 Vevők = DEBIT +)
    SELECT
      n.id as item_id,
      (CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN -COALESCE(n.invoice_gross_amount, 0)
        ELSE COALESCE(n.invoice_gross_amount, 0)
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      gtm.mapped_id,
      true AS is_temporary,
      1::bigint AS sub_count
    FROM public.nav_invoices n
    LEFT JOIN gl_target_map gtm ON gtm.target_num = COALESCE(
      n.partner_gl_number,
      CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN (CASE WHEN n.currency IS NOT NULL AND n.currency != 'HUF' THEN '4542' ELSE '4541' END)
        ELSE (CASE WHEN n.currency IS NOT NULL AND n.currency != 'HUF' THEN '312' ELSE '311' END)
      END
    )
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND n.company_id = p_company_id
      AND NOT COALESCE(n.exclude_from_accounting, false)
      AND COALESCE(n.invoice_gross_amount, 0) != 0
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
      AND NOT EXISTS (
        SELECT 1 FROM booked_header_keys bh
        WHERE bh.import_key = n.id::text
      )

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT side (+)
    SELECT
      je.id as item_id,
      je.amount AS amount,
      dm.mapped_id AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.gl_journal_entries je
    LEFT JOIN LATERAL (
      SELECT ga.id AS mapped_id
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND je.debit_account LIKE REPLACE(split_part(ga.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) dm ON true
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (-)
    SELECT
      je.id as item_id,
      -je.amount AS amount,
      cm.mapped_id AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.gl_journal_entries je
    LEFT JOIN LATERAL (
      SELECT ga.id AS mapped_id
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND je.credit_account LIKE REPLACE(split_part(ga.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) cm ON true
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)

    UNION ALL

    -- ⑥ FX differences
    SELECT
      fd.invoice_id AS item_id,
      fd.fx_difference AS amount,
      best_fx.id AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.get_fx_differences(p_company_id, p_date_from, p_date_to) fd
    LEFT JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND REPLACE(split_part(g.gl_number, '-', 1), '.', '') LIKE
            (CASE WHEN fd.fx_difference >= 0
              THEN COALESCE((SELECT fxs.fx_gain_gl_number FROM public.company_fx_settings fxs WHERE fxs.company_id = p_company_id LIMIT 1), '976')
              ELSE COALESCE((SELECT fxs.fx_loss_gl_number FROM public.company_fx_settings fxs WHERE fxs.company_id = p_company_id LIMIT 1), '876')
            END) || '%'
      ORDER BY LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_fx ON true
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'

    UNION ALL

    -- ⑦ Internal accounting journals (acc_journal_lines: T = +, K = -)
    SELECT
      l.id AS item_id,
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
      SELECT ga.id
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND REPLACE(split_part(ga.gl_number, '-', 1), '.', '') = REPLACE(split_part(g.gl_number, '-', 1), '.', '')
      ORDER BY LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
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
  aggregated_by_mapped_id AS (
    SELECT 
      r.mapped_id, 
      SUM(r.amount) AS total_balance,
      SUM(CASE WHEN NOT r.is_temporary THEN r.amount ELSE 0 END) AS final_balance,
      SUM(CASE WHEN r.is_temporary THEN r.amount ELSE 0 END) AS temp_balance,
      SUM(r.sub_count)::bigint AS item_count
    FROM raw_items r
    GROUP BY r.mapped_id
  ),
  mapped_to_active AS (
    SELECT
      g.id AS gl_account_id,
      g.gl_number::text,
      g.short_name::text,
      COALESCE(a.total_balance, 0)::numeric AS total_balance,
      COALESCE(a.final_balance, 0)::numeric AS final_balance,
      COALESCE(a.temp_balance, 0)::numeric AS temp_balance,
      COALESCE(a.item_count, 0)::bigint AS item_count
    FROM public.gl_accounts g
    LEFT JOIN aggregated_by_mapped_id a ON g.id = a.mapped_id
    WHERE g.preset_id = p_preset_id
  ),
  orphan_sum AS (
    SELECT 
      SUM(a.total_balance) AS orphan_balance,
      SUM(a.final_balance) AS orphan_final_balance,
      SUM(a.temp_balance) AS orphan_temp_balance,
      SUM(a.item_count) AS orphan_item_count
    FROM aggregated_by_mapped_id a
    LEFT JOIN public.gl_accounts check_g 
           ON a.mapped_id = check_g.id 
          AND check_g.preset_id = p_preset_id
    WHERE check_g.id IS NULL OR a.mapped_id IS NULL
  )
  SELECT 
    res.gl_account_id, 
    res.gl_number, 
    res.short_name, 
    res.total_balance,
    res.final_balance,
    res.temp_balance,
    res.item_count
  FROM (
    SELECT 
      m.gl_account_id, 
      m.gl_number, 
      m.short_name, 
      m.total_balance,
      m.final_balance,
      m.temp_balance,
      m.item_count
    FROM mapped_to_active m

    UNION ALL

    SELECT
      NULL::uuid AS gl_account_id,
      'UNCLASSIFIED'::text AS gl_number,
      'Besorolatlan tételek'::text AS short_name,
      COALESCE((SELECT orphan_balance FROM orphan_sum), 0)::numeric AS total_balance,
      COALESCE((SELECT orphan_final_balance FROM orphan_sum), 0)::numeric AS final_balance,
      COALESCE((SELECT orphan_temp_balance FROM orphan_sum), 0)::numeric AS temp_balance,
      COALESCE((SELECT orphan_item_count FROM orphan_sum), 0)::bigint AS item_count
    WHERE EXISTS (SELECT 1 FROM orphan_sum WHERE orphan_item_count > 0)
  ) res
  ORDER BY 
    CASE WHEN res.gl_number = 'UNCLASSIFIED' THEN 1 ELSE 0 END,
    res.gl_number;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. GET_GL_CATEGORIZED_ITEMS
-- ─────────────────────────────────────────────────────────────────────────────
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
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
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
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH 
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
      SELECT ga.id
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND (
          REPLACE(split_part(ga.gl_number, '-', 1), '.', '') = n.target_num
          OR ga.gl_number LIKE n.target_num || '%'
          OR n.target_num LIKE REPLACE(split_part(ga.gl_number, '-', 1), '.', '') || '%'
        )
      ORDER BY 
        (REPLACE(split_part(ga.gl_number, '-', 1), '.', '') = n.target_num) DESC,
        (ga.gl_number LIKE n.target_num || '%') DESC,
        LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
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
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND i.company_id = p_company_id
      AND NOT COALESCE(i.exclude_from_accounting, false)
      AND NOT COALESCE(ii.exclude_from_accounting, false)
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
          ROUND(COALESCE(i.afa_osszeg_osszesen, 0) * (
            SELECT COALESCE(AVG(ii_sub.deductible_percentage), 100.0) / 100.0 
            FROM public.invoice_items ii_sub 
            WHERE ii_sub.invoice_id = i.id
          ), 2)
        ELSE -COALESCE(i.afa_osszeg_osszesen, 0)
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      (CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN 
          ROUND(COALESCE(i.afa_osszeg_osszesen, 0) * (
            SELECT COALESCE(AVG(ii_sub.deductible_percentage), 100.0) / 100.0 
            FROM public.invoice_items ii_sub 
            WHERE ii_sub.invoice_id = i.id
          ), 2)
        ELSE -COALESCE(i.afa_osszeg_osszesen, 0)
      END)::numeric AS original_amount,
      COALESCE(i.penznem, 'HUF')::text AS original_currency,
      (CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::text
        ELSE i.kibocsatas_datuma::text
      END) AS item_date,
      false AS is_temporary
    FROM public.invoices i
    LEFT JOIN gl_target_map gtm ON gtm.target_num = COALESCE(i.vat_gl_number, CASE WHEN i.invoice_direction = 'INBOUND' THEN '466' ELSE '467' END)
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND i.company_id = p_company_id
      AND NOT COALESCE(i.exclude_from_accounting, false)
      AND COALESCE(i.afa_osszeg_osszesen, 0) != 0
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
      AND NOT EXISTS (
        SELECT 1 FROM booked_header_keys bh
        WHERE bh.import_key = i.id::text
      )

    UNION ALL

    -- ②_partner: unposted invoices Partner lines (454 Szállítók = CREDIT -, 311 Vevők = DEBIT +)
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
    FROM public.invoices i
    LEFT JOIN gl_target_map gtm ON gtm.target_num = COALESCE(
      i.partner_gl_number,
      CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN (CASE WHEN i.penznem IS NOT NULL AND i.penznem != 'HUF' THEN '4542' ELSE '4541' END)
        ELSE (CASE WHEN i.penznem IS NOT NULL AND i.penznem != 'HUF' THEN '312' ELSE '311' END)
      END
    )
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND i.company_id = p_company_id
      AND NOT COALESCE(i.exclude_from_accounting, false)
      AND COALESCE(i.brutto_vegosszeg, 0) != 0
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
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND n.company_id = p_company_id
      AND NOT COALESCE(n.exclude_from_accounting, false)
      AND NOT COALESCE(ni.exclude_from_accounting, false)
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
          ROUND(COALESCE(n.invoice_vat_amount, 0) * (
            SELECT COALESCE(AVG(ni_sub.deductible_percentage), 100.0) / 100.0 
            FROM public.nav_invoice_items ni_sub 
            WHERE ni_sub.nav_invoice_id = n.id
          ), 2)
        ELSE -COALESCE(n.invoice_vat_amount, 0)
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      (CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN 
          ROUND(COALESCE(n.invoice_vat_amount, 0) * (
            SELECT COALESCE(AVG(ni_sub.deductible_percentage), 100.0) / 100.0 
            FROM public.nav_invoice_items ni_sub 
            WHERE ni_sub.nav_invoice_id = n.id
          ), 2)
        ELSE -COALESCE(n.invoice_vat_amount, 0)
      END)::numeric AS original_amount,
      COALESCE(n.currency, 'HUF')::text AS original_currency,
      (CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::text
        ELSE COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text
      END) AS item_date,
      true AS is_temporary
    FROM public.nav_invoices n
    LEFT JOIN gl_target_map gtm ON gtm.target_num = COALESCE(n.vat_gl_number, CASE WHEN n.invoice_direction = 'INBOUND' THEN '466' ELSE '467' END)
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND n.company_id = p_company_id
      AND NOT COALESCE(n.exclude_from_accounting, false)
      AND COALESCE(n.invoice_vat_amount, 0) != 0
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
      AND NOT EXISTS (
        SELECT 1 FROM booked_header_keys bh
        WHERE bh.import_key = n.id::text
      )

    UNION ALL

    -- ③_partner: unposted nav_invoices Partner lines (454 Szállítók = CREDIT -, 311 Vevők = DEBIT +)
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
    FROM public.nav_invoices n
    LEFT JOIN gl_target_map gtm ON gtm.target_num = COALESCE(
      n.partner_gl_number,
      CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN (CASE WHEN n.currency IS NOT NULL AND n.currency != 'HUF' THEN '4542' ELSE '4541' END)
        ELSE (CASE WHEN n.currency IS NOT NULL AND n.currency != 'HUF' THEN '312' ELSE '311' END)
      END
    )
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND n.company_id = p_company_id
      AND NOT COALESCE(n.exclude_from_accounting, false)
      AND COALESCE(n.invoice_gross_amount, 0) != 0
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
      AND NOT EXISTS (
        SELECT 1 FROM booked_header_keys bh
        WHERE bh.import_key = n.id::text
      )

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT side (+)
    SELECT
      je.id AS item_id,
      dm.mapped_id AS mapped_id,
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
    LEFT JOIN LATERAL (
      SELECT ga.id AS mapped_id
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND je.debit_account LIKE REPLACE(split_part(ga.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) dm ON true
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (-)
    SELECT
      je.id AS item_id,
      cm.mapped_id AS mapped_id,
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
    LEFT JOIN LATERAL (
      SELECT ga.id AS mapped_id
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND je.credit_account LIKE REPLACE(split_part(ga.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) cm ON true
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)

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
      SELECT ga.id
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND REPLACE(split_part(ga.gl_number, '-', 1), '.', '') = REPLACE(split_part(g.gl_number, '-', 1), '.', '')
      ORDER BY LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
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
    p_gl_account_id IS NULL
    OR (
      p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid 
      AND (r.mapped_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.gl_accounts ga WHERE ga.id = r.mapped_id AND ga.preset_id = p_preset_id))
    )
    OR r.mapped_id = p_gl_account_id
  )
  ORDER BY r.item_date DESC, r.item_id
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer) TO authenticated, service_role;
