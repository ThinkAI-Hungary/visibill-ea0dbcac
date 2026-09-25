-- Migration: Optimize get_gl_balances performance
-- Replaces unindexed per-row CROSS JOIN LATERAL lookups with pre-materialized lookup CTEs
-- and replaces correlated subqueries with materialized set lookups, fixing statement timeouts on large datasets (e.g. Ván Iroda Kft.)

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

    -- ② invoice_items (számla tételek with non-deductible VAT in cost)
    SELECT
      ii.id as item_id,
      (CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0) + ROUND(COALESCE(ii.vat_amount, 0) * (1.0 - (COALESCE(ii.deductible_percentage, 100.0) / 100.0)), 2))
        ELSE COALESCE(ii.net_amount, 0) 
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

    -- ②_vat: unposted invoices VAT lines (466 Levonható ÁFA / 467 Fizetendő ÁFA)
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

    -- ②_partner: unposted invoices Partner lines (454 Szállítók / 311 Vevők)
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

    -- ③ nav_invoice_items (NAV számla tételek with non-deductible VAT in cost)
    SELECT
      ni.id as item_id,
      (CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0) + ROUND(COALESCE(ni.vat_amount, 0) * (1.0 - (COALESCE(ni.deductible_percentage, 100.0) / 100.0)), 2))
        ELSE COALESCE(ni.net_amount, 0) 
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

    -- ③_vat: unposted nav_invoices VAT lines (466 Levonható ÁFA / 467 Fizetendő ÁFA)
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

    -- ③_partner: unposted nav_invoices Partner lines (454 Szállítók / 311 Vevők)
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

    -- ④ Imported XML journal entries — DEBIT side (PRE-AGGREGATED)
    SELECT
      NULL::uuid AS item_id,
      SUM(je.amount) AS amount,
      best_debit.id AS mapped_id,
      false AS is_temporary,
      COUNT(*)::bigint AS sub_count
    FROM (
      SELECT je_inner.debit_account, SUM(je_inner.amount) as amount, COUNT(*) as cnt
      FROM public.gl_journal_entries je_inner
      WHERE je_inner.company_id = p_company_id
        AND (p_date_from IS NULL OR je_inner.voucher_date >= p_date_from)
        AND (p_date_to IS NULL OR je_inner.voucher_date <= p_date_to)
        AND je_inner.debit_account IS NOT NULL
        AND je_inner.amount > 0
      GROUP BY je_inner.debit_account
    ) je
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.debit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_debit
    GROUP BY best_debit.id

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (PRE-AGGREGATED)
    SELECT
      NULL::uuid AS item_id,
      -SUM(je.amount) AS amount,
      best_credit.id AS mapped_id,
      false AS is_temporary,
      COUNT(*)::bigint AS sub_count
    FROM (
      SELECT je_inner.credit_account, SUM(je_inner.amount) as amount, COUNT(*) as cnt
      FROM public.gl_journal_entries je_inner
      WHERE je_inner.company_id = p_company_id
        AND (p_date_from IS NULL OR je_inner.voucher_date >= p_date_from)
        AND (p_date_to IS NULL OR je_inner.voucher_date <= p_date_to)
        AND je_inner.credit_account IS NOT NULL
        AND je_inner.amount > 0
      GROUP BY je_inner.credit_account
    ) je
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.credit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_credit
    GROUP BY best_credit.id

    UNION ALL

    -- ⑥ FX differences (Árfolyamkülönbözet)
    SELECT
      fd.invoice_id AS item_id,
      fd.fx_difference AS amount,
      gtm.mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.get_fx_differences(p_company_id, p_date_from, p_date_to) fd
    LEFT JOIN gl_target_map gtm ON gtm.target_num = (
      CASE WHEN fd.fx_difference >= 0
        THEN COALESCE((SELECT fxs.fx_gain_gl_number FROM public.company_fx_settings fxs WHERE fxs.company_id = p_company_id LIMIT 1), '976')
        ELSE COALESCE((SELECT fxs.fx_loss_gl_number FROM public.company_fx_settings fxs WHERE fxs.company_id = p_company_id LIMIT 1), '876')
      END
    )
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'

    UNION ALL

    -- ⑦ Internal accounting journals (acc_journal_lines - KONYVELT & SZTORNOZOTT properly net out)
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

REVOKE EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) TO authenticated, service_role;
