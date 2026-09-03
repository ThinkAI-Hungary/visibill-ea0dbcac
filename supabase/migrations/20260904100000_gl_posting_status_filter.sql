-- ==============================================================================
-- Migration: 20260904100000_gl_posting_status_filter.sql
-- Description: Add p_posting_status filter to get_gl_balances and get_gl_categorized_items
--              Allows switching between ALL (operational + posted) and POSTED_ONLY (closed double-entry journals).
-- Author: Visibill Agentic Team
-- ==============================================================================

-- ─── 1. DROP OLD 6-PARAMETER SIGNATURES ───────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_gl_balances(uuid, uuid, date, date, jsonb, text);
DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text);

-- ─── 2. RECREATE GET_GL_BALANCES WITH P_POSTING_STATUS ────────────────────────

CREATE OR REPLACE FUNCTION public.get_gl_balances(
  p_company_id uuid, 
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_posting_status text DEFAULT 'ALL'::text
)
RETURNS TABLE (
  gl_account_id uuid,
  gl_number text,
  short_name text,
  total_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH raw_items AS (
    -- ① transactions (banki tételek) — kizárva, ha csak lekönyvelt szűrés van, vagy ha már lekönyvelt naplóban
    SELECT
      t.id as item_id,
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
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

    -- ② invoice_items (számla tételek) — kizárva, ha csak lekönyvelt szűrés van, vagy ha már lekönyvelt naplóban
    SELECT
      ii.id as item_id,
      (CASE WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0)) ELSE COALESCE(ii.net_amount, 0) END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
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

    -- ③ nav_invoice_items — kizárva, ha csak lekönyvelt szűrés van, vagy ha már lekönyvelt naplóban
    SELECT
      ni.id as item_id,
      (CASE WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0)) ELSE COALESCE(ni.net_amount, 0) END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
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

    -- ④ Imported XML journal entries — DEBIT side (Tartozik = positive)
    SELECT
      je.id AS item_id,
      je.amount AS amount,
      best_debit.id AS mapped_id
    FROM public.gl_journal_entries je
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.debit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_debit
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (Követel = negative)
    SELECT
      je.id AS item_id,
      -je.amount AS amount,
      best_credit.id AS mapped_id
    FROM public.gl_journal_entries je
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.credit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_credit
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)

    UNION ALL

    -- ⑥ FX differences (Árfolyamkülönbözet)
    SELECT
      fd.invoice_id AS item_id,
      fd.fx_difference AS amount,
      best_fx.id AS mapped_id
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
      ) AS mapped_id
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
    SELECT r.mapped_id, SUM(r.amount) AS total_balance
    FROM raw_items r
    GROUP BY r.mapped_id
  ),
  mapped_to_active AS (
    SELECT
      g.id AS gl_account_id,
      g.gl_number::text,
      g.short_name::text,
      COALESCE(a.total_balance, 0)::numeric AS total_balance
    FROM public.gl_accounts g
    LEFT JOIN aggregated_by_mapped_id a ON g.id = a.mapped_id
    WHERE g.preset_id = p_preset_id
  ),
  orphan_sum AS (
    SELECT SUM(a.total_balance) AS orphan_balance
    FROM aggregated_by_mapped_id a
    LEFT JOIN public.gl_accounts check_g 
           ON a.mapped_id = check_g.id 
          AND check_g.preset_id = p_preset_id
    WHERE check_g.id IS NULL OR a.mapped_id IS NULL
  )
  SELECT m.gl_account_id, m.gl_number, m.short_name, m.total_balance 
  FROM mapped_to_active m

  UNION ALL

  SELECT
    NULL::uuid AS gl_account_id,
    'UNCLASSIFIED'::text AS gl_number,
    'Besorolatlan tételek'::text AS short_name,
    COALESCE((SELECT orphan_balance FROM orphan_sum), 0)::numeric AS total_balance
  WHERE COALESCE((SELECT orphan_balance FROM orphan_sum), 0) != 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) TO authenticated, service_role;


-- ─── 3. RECREATE GET_GL_CATEGORIZED_ITEMS WITH P_POSTING_STATUS ──────────────────

CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(
  p_company_id uuid, 
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_posting_status text DEFAULT 'ALL'::text
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
  WITH raw_items AS (
    -- ① transactions (banki tételek) — kizárva, ha csak lekönyvelt szűrés van, vagy ha már lekönyvelt naplóban
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
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = t.company_id
          AND h.import_key = t.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ② invoice_items (számla tételek) — kizárva, ha csak lekönyvelt szűrés van, vagy ha már lekönyvelt naplóban
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
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = i.company_id
          AND h.import_key = ii.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ③ nav_invoice_items — kizárva, ha csak lekönyvelt szűrés van, vagy ha már lekönyvelt naplóban
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

    -- ④ Imported XML journal entries — DEBIT side
    SELECT
      je.id AS item_id,
      best_debit.id AS mapped_id,
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
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.debit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_debit
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
      AND je.debit_account IS NOT NULL
      AND je.amount > 0

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side
    SELECT
      je.id AS item_id,
      best_credit.id AS mapped_id,
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
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.credit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_credit
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
  FROM raw_items r;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text) TO authenticated, service_role;
