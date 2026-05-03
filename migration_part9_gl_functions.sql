-- ============================================================
-- VISIBILL MIGRATION - PART 9: GL (General Ledger) functions
-- Run this in the SQL Editor after Part 8
-- ============================================================

-- get_gl_balances
CREATE OR REPLACE FUNCTION public.get_gl_balances(p_company_id uuid, p_preset_id uuid, p_date_from date DEFAULT NULL, p_date_to date DEFAULT NULL, p_exchange_rates jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(gl_account_id uuid, gl_number text, short_name text, total_balance numeric)
 LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH raw_items AS (
    SELECT t.id as item_id,
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
    FROM public.transactions t
    WHERE t.company_id = p_company_id AND t.matched_invoice_id IS NULL
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)
    UNION ALL
    SELECT ii.id as item_id,
      (CASE WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0)) ELSE COALESCE(ii.net_amount, 0) END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
    FROM public.invoice_items ii JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE i.company_id = p_company_id
      AND (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from)
      AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)
    UNION ALL
    SELECT ni.id as item_id,
      (CASE WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0)) ELSE COALESCE(ni.net_amount, 0) END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
    FROM public.nav_invoice_items ni JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE n.company_id = p_company_id
      AND (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
      AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
  ),
  aggregated_by_mapped_id AS (
    SELECT r.mapped_id, SUM(r.amount) AS total_balance FROM raw_items r GROUP BY r.mapped_id
  ),
  mapped_to_active AS (
    SELECT g.id AS gl_account_id, g.gl_number::text, g.short_name::text, COALESCE(a.total_balance, 0)::numeric AS total_balance
    FROM public.gl_accounts g LEFT JOIN aggregated_by_mapped_id a ON g.id = a.mapped_id
    WHERE g.preset_id = p_preset_id
  ),
  orphan_sum AS (
    SELECT SUM(a.total_balance) AS orphan_balance
    FROM aggregated_by_mapped_id a
    LEFT JOIN public.gl_accounts check_g ON a.mapped_id = check_g.id AND check_g.preset_id = p_preset_id
    WHERE check_g.id IS NULL OR a.mapped_id IS NULL
  )
  SELECT m.gl_account_id, m.gl_number, m.short_name, m.total_balance FROM mapped_to_active m
  UNION ALL
  SELECT '00000000-0000-0000-0000-000000000000'::uuid AS gl_account_id,
    'ORPHAN' AS gl_number, 'Besorolatlan tételek (Eltérő sablonból)' AS short_name,
    COALESCE((SELECT orphan_balance FROM orphan_sum), 0) AS total_balance
  WHERE COALESCE((SELECT orphan_balance FROM orphan_sum), 0) <> 0
  ORDER BY gl_number;
END;
$$;

-- get_gl_categorized_items (simple version - 1 param)
CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(p_company_id uuid)
 RETURNS TABLE(item_id uuid, gl_account_id uuid, source_table text, item_type text, partner text, description text, amount numeric, item_date text)
 LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT t.id, t.gl_account_id, 'transactions'::text, 'Banki tranzakció'::text, NULL::text, t.description::text, t.amount::numeric, t.transaction_date::text
    FROM public.transactions t WHERE t.company_id = p_company_id AND t.gl_account_id IS NOT NULL
    UNION ALL
    SELECT i.id, i.gl_account_id, 'invoices'::text,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN 'Bejövő (Költség)' ELSE 'Kimenő (Bevétel)' END::text,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN i.elado_nev ELSE i.vevo_nev END::text,
      i.bizonylatsorszam::text,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(i.brutto_vegosszeg, 0)) ELSE COALESCE(i.brutto_vegosszeg, 0) END::numeric,
      i.kibocsatas_datuma::text
    FROM public.invoices i WHERE i.company_id = p_company_id AND i.gl_account_id IS NOT NULL
    UNION ALL
    SELECT n.id, n.gl_account_id, 'nav_invoices'::text,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN 'NAV Bejövő' ELSE 'NAV Kimenő' END::text,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN n.supplier_name ELSE n.customer_name END::text,
      n.invoice_number::text,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(n.invoice_gross_amount, 0)) ELSE COALESCE(n.invoice_gross_amount, 0) END::numeric,
      COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text
    FROM public.nav_invoices n WHERE n.company_id = p_company_id AND n.gl_account_id IS NOT NULL;
END;
$$;

-- get_gl_categorized_items (advanced version - with preset, dates, exchange rates)
CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(p_company_id uuid, p_preset_id uuid, p_date_from date DEFAULT NULL, p_date_to date DEFAULT NULL, p_exchange_rates jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(item_id uuid, gl_account_id uuid, source_table text, item_type text, partner text, description text, amount numeric, original_amount numeric, original_currency text, item_date text)
 LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH raw_items AS (
    SELECT t.id AS item_id,
      CASE WHEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'transactions'::text AS source_table, 'Banki tranzakció'::text AS item_type, NULL::text AS partner,
      t.description::text AS description,
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1) AS amount,
      t.amount::numeric AS original_amount, COALESCE(t.currency, 'HUF')::text AS original_currency,
      t.transaction_date::text AS item_date
    FROM public.transactions t
    WHERE t.company_id = p_company_id AND t.matched_invoice_id IS NULL
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)
    UNION ALL
    SELECT ii.id AS item_id,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'invoice_items'::text, CASE WHEN i.invoice_direction = 'INBOUND' THEN 'Bejövő (Költség)' ELSE 'Kimenő (Bevétel)' END::text,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN i.elado_nev ELSE i.vevo_nev END::text,
      COALESCE(ii.line_description, i.bizonylatsorszam)::text,
      (CASE WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0)) ELSE COALESCE(ii.net_amount, 0) END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1),
      (CASE WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0)) ELSE COALESCE(ii.net_amount, 0) END)::numeric,
      COALESCE(i.penznem, 'HUF')::text, i.kibocsatas_datuma::text
    FROM public.invoice_items ii JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE i.company_id = p_company_id
      AND (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from) AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)
    UNION ALL
    SELECT ni.id AS item_id,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'nav_invoice_items'::text, CASE WHEN n.invoice_direction = 'INBOUND' THEN 'NAV Bejövő tétel' ELSE 'NAV Kimenő tétel' END::text,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN n.supplier_name ELSE n.customer_name END::text,
      COALESCE(ni.line_description, n.invoice_number)::text,
      (CASE WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0)) ELSE COALESCE(ni.net_amount, 0) END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1),
      (CASE WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0)) ELSE COALESCE(ni.net_amount, 0) END)::numeric,
      COALESCE(n.currency, 'HUF')::text,
      COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text
    FROM public.nav_invoice_items ni JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE n.company_id = p_company_id
      AND (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
      AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
  )
  SELECT r.item_id,
    COALESCE(active_g.id, '00000000-0000-0000-0000-000000000000'::uuid) AS gl_account_id,
    r.source_table, r.item_type, r.partner, r.description, r.amount, r.original_amount, r.original_currency, r.item_date
  FROM raw_items r
  LEFT JOIN public.gl_accounts active_g ON r.mapped_id = active_g.id AND active_g.preset_id = p_preset_id;
END;
$$;
