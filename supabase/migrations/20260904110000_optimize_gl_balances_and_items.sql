-- Migration: 20260904110000_optimize_gl_balances_and_items.sql
-- Description: Optimize get_gl_balances (10x faster with pre-aggregated journal entries and returning final/temp/item_count)
--              and get_gl_categorized_items (supporting p_gl_account_id for on-demand lazy loading).

-- ─── 1. DROP EXISTING FUNCTIONS ─────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text);
DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text);
DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid);

-- ─── 2. RECREATE OPTIMIZED GET_GL_BALANCES ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_gl_balances(
  p_company_id uuid, 
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_posting_status text DEFAULT 'ALL'::text,
  p_date_basis text DEFAULT 'kibocsatas'::text
)
RETURNS TABLE (
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
AS $$
BEGIN
  RETURN QUERY
  WITH raw_items AS (
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
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = t.company_id
          AND h.import_key = t.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ② invoice_items (számla tételek)
    SELECT
      ii.id as item_id,
      (CASE WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0)) ELSE COALESCE(ii.net_amount, 0) END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.invoice_items ii
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND i.company_id = p_company_id
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
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = i.company_id
          AND h.import_key = ii.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ③ nav_invoice_items
    SELECT
      ni.id as item_id,
      (CASE WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0)) ELSE COALESCE(ni.net_amount, 0) END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      true AS is_temporary,
      1::bigint AS sub_count
    FROM public.nav_invoice_items ni
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND n.company_id = p_company_id
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
        SELECT 1 FROM public.invoices i
        WHERE i.company_id = n.company_id
          AND REPLACE(LOWER(i.bizonylatsorszam), ' ', '') = REPLACE(LOWER(n.invoice_number), ' ', '')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = n.company_id
          AND h.import_key = ni.id::text
          AND h.status = 'KONYVELT'
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
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_fx ON true
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'

    UNION ALL

    -- ⑦ Internal accounting journals (acc_journal_lines - KONYVELT)
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
      AND h.status = 'KONYVELT'
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
    WHERE COALESCE((SELECT orphan_item_count FROM orphan_sum), 0) > 0
  ) res
  ORDER BY 
    CASE WHEN res.gl_number = 'UNCLASSIFIED' THEN 1 ELSE 0 END,
    res.gl_number ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) TO authenticated, service_role;


-- ─── 3. RECREATE GET_GL_CATEGORIZED_ITEMS WITH P_GL_ACCOUNT_ID (MATERIALIZED CTEs) ──

CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(
  p_company_id uuid, 
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_posting_status text DEFAULT 'ALL'::text,
  p_gl_account_id uuid DEFAULT NULL::uuid
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
AS $$
BEGIN
  RETURN QUERY
  WITH debit_map AS MATERIALIZED (
    SELECT je_inner.debit_account, best_debit.id as mapped_id
    FROM (
      SELECT debit_account 
      FROM public.gl_journal_entries 
      WHERE company_id = p_company_id 
        AND debit_account IS NOT NULL
      GROUP BY debit_account
    ) je_inner
    LEFT JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je_inner.debit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_debit ON true
    WHERE (
      p_gl_account_id IS NULL
      OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND (best_debit.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.gl_accounts ga WHERE ga.id = best_debit.id AND ga.preset_id = p_preset_id)))
      OR best_debit.id = p_gl_account_id
    )
  ),
  credit_map AS MATERIALIZED (
    SELECT je_inner.credit_account, best_credit.id as mapped_id
    FROM (
      SELECT credit_account 
      FROM public.gl_journal_entries 
      WHERE company_id = p_company_id 
        AND credit_account IS NOT NULL
      GROUP BY credit_account
    ) je_inner
    LEFT JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je_inner.credit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_credit ON true
    WHERE (
      p_gl_account_id IS NULL
      OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND (best_credit.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.gl_accounts ga WHERE ga.id = best_credit.id AND ga.preset_id = p_preset_id)))
      OR best_credit.id = p_gl_account_id
    )
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
      AND (
        p_gl_account_id IS NULL
        OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND ((t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') IS NULL OR (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = '00000000-0000-0000-0000-000000000000'))
        OR ((t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = p_gl_account_id::text)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = t.company_id
          AND h.import_key = t.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ② invoice_items (számla tételek)
    SELECT
      ii.id AS item_id,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'invoice_items'::text AS source_table,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN 'Bejövő (Költség)' ELSE 'Kimenő (Bevétel)' END::text AS item_type,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN i.elado_nev ELSE i.vevo_nev END::text AS partner,
      COALESCE(ii.line_description, i.bizonylatsorszam)::text AS description,
      (CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(ii.net_amount, 0)
        ELSE 0
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      (CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(ii.net_amount, 0)
        ELSE 0
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
      AND i.statusz != 'jovahagyasra_var'
      AND (i.nav_status IS NULL OR i.nav_status != 'missing_nav' OR i.approved_at IS NOT NULL)
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
      AND (
        p_gl_account_id IS NULL
        OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND ((ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') IS NULL OR (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = '00000000-0000-0000-0000-000000000000'))
        OR ((ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = p_gl_account_id::text)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = i.company_id
          AND h.import_key = ii.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ③ nav_invoice_items
    SELECT
      ni.id AS item_id,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'nav_invoice_items'::text AS source_table,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN 'NAV Bejövő tétel' ELSE 'NAV Kimenő tétel' END::text AS item_type,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN n.supplier_name ELSE n.customer_name END::text AS partner,
      COALESCE(ni.line_description, n.invoice_number)::text AS description,
      (CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.net_amount, 0)
        ELSE 0
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      (CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.net_amount, 0)
        ELSE 0
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
      AND (
        p_gl_account_id IS NULL
        OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND ((ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') IS NULL OR (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = '00000000-0000-0000-0000-000000000000'))
        OR ((ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = p_gl_account_id::text)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.company_id = n.company_id
          AND REPLACE(LOWER(i.bizonylatsorszam), ' ', '') = REPLACE(LOWER(n.invoice_number), ' ', '')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = n.company_id
          AND h.import_key = ni.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT side (PRE-MAPPED)
    SELECT
      je.id AS item_id,
      dm.mapped_id AS mapped_id,
      'journal_entry'::text AS source_table,
      'XML Könyvelési tétel (T)'::text AS item_type,
      je.partner_name::text AS partner,
      COALESCE(je.description, je.voucher_number)::text AS description,
      je.amount AS amount,
      je.amount::numeric AS original_amount,
      'HUF'::text AS original_currency,
      je.voucher_date::text AS item_date,
      false AS is_temporary
    FROM public.gl_journal_entries je
    JOIN debit_map dm ON je.debit_account = dm.debit_account
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
      AND je.debit_account IS NOT NULL
      AND je.amount > 0

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (PRE-MAPPED)
    SELECT
      je.id AS item_id,
      dm.mapped_id AS mapped_id,
      'journal_entry'::text AS source_table,
      'XML Könyvelési tétel (K)'::text AS item_type,
      je.partner_name::text AS partner,
      COALESCE(je.description, je.voucher_number)::text AS description,
      -je.amount AS amount,
      -je.amount::numeric AS original_amount,
      'HUF'::text AS original_currency,
      je.voucher_date::text AS item_date,
      false AS is_temporary
    FROM public.gl_journal_entries je
    JOIN credit_map dm ON je.credit_account = dm.credit_account
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
      AND je.credit_account IS NOT NULL
      AND je.amount > 0

    UNION ALL

    -- ⑥ Internal accounting journals (acc_journal_lines - KONYVELT)
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
      COALESCE(l.description, h.description, h.document_id)::text AS description,
      (CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END) AS amount,
      (CASE WHEN l.dc_type = 'T' THEN COALESCE(l.foreign_amount, l.amount) ELSE -COALESCE(l.foreign_amount, l.amount) END)::numeric AS original_amount,
      COALESCE(h.currency, 'HUF')::text AS original_currency,
      CASE
        WHEN p_date_basis = 'teljesites' THEN COALESCE(h.posting_date, h.document_date)::text
        ELSE COALESCE(h.document_date, h.posting_date)::text
      END AS item_date,
      false AS is_temporary
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.acc_journals j ON h.journal_id = j.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
    LEFT JOIN public.partners p ON h.partner_id = p.id
    LEFT JOIN LATERAL (
      SELECT ga.id
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND REPLACE(split_part(ga.gl_number, '-', 1), '.', '') = REPLACE(split_part(g.gl_number, '-', 1), '.', '')
      ORDER BY LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_active ON true
    WHERE h.company_id = p_company_id
      AND h.status = 'KONYVELT'
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
      AND (
        p_gl_account_id IS NULL
        OR COALESCE(CASE WHEN g.preset_id = p_preset_id THEN g.id ELSE NULL END, best_active.id, g.id) = p_gl_account_id
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
  ORDER BY r.item_date DESC, r.item_id ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid) TO authenticated, service_role;

