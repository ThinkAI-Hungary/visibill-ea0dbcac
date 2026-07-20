-- ==================================================
-- MERGED FROM: 20260626_add_gl_numbers_to_nav_filter.sql
-- ==================================================
-- Drop the existing get_filtered_nav_invoices overload to avoid PG conflicts
DROP FUNCTION IF EXISTS public.get_filtered_nav_invoices(
  uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date
);

CREATE OR REPLACE FUNCTION public.get_filtered_nav_invoices(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text,
  p_search text DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_paid text DEFAULT NULL,
  p_submitted text DEFAULT NULL,
  p_project_id text DEFAULT NULL,
  p_category_id text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_amount_min numeric DEFAULT NULL,
  p_amount_max numeric DEFAULT NULL,
  p_sort_field text DEFAULT 'invoice_issue_date',
  p_sort_dir text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_issue_date_from date DEFAULT NULL,
  p_issue_date_to date DEFAULT NULL,
  p_preset_id uuid DEFAULT NULL
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
  created_at timestamptz,
  fetched_at timestamptz,
  project_id uuid,
  category_id uuid,
  transaction_id uuid,
  exclude_from_accounting boolean,
  gl_numbers text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_preset_id uuid;
BEGIN
  -- Resolve preset: use p_preset_id, fallback to active custom preset, fallback to generic preset
  IF p_preset_id IS NULL THEN
    SELECT cp.id INTO v_preset_id
    FROM public.chart_of_accounts_presets cp
    WHERE cp.company_id = p_company_id AND cp.is_active = true
    LIMIT 1;

    IF v_preset_id IS NULL THEN
      SELECT cp.id INTO v_preset_id
      FROM public.chart_of_accounts_presets cp
      WHERE cp.type = 'generic'
      LIMIT 1;
    END IF;
  ELSE
    v_preset_id := p_preset_id;
  END IF;

  RETURN QUERY
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
    (
      SELECT string_agg(DISTINCT g.gl_number, ', ')
      FROM public.nav_invoice_items nii
      JOIN public.gl_accounts g ON g.id = (
        CASE WHEN (nii.gl_classifications -> (v_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
        THEN (nii.gl_classifications -> (v_preset_id::text) ->> 'gl_account_id')::uuid 
        ELSE NULL END
      )
      WHERE nii.nav_invoice_id = ni.id
    ) AS gl_numbers,
    count(*) OVER()::bigint AS total_count
  FROM nav_invoices ni
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = p_direction
    AND ni.invoice_issue_date >= p_date_from
    AND ni.invoice_issue_date <= p_date_to
    AND (p_issue_date_from IS NULL OR ni.invoice_issue_date >= p_issue_date_from)
    AND (p_issue_date_to IS NULL OR ni.invoice_issue_date <= p_issue_date_to)
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
    AND (p_paid IS NULL OR p_paid = 'all'
      OR (p_paid = 'yes' AND ni.transaction_id IS NOT NULL)
      OR (p_paid = 'no' AND ni.transaction_id IS NULL))
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
      OR (p_payment_method = 'none' AND ni.payment_method IS NULL)
      OR ni.payment_method = p_payment_method)
    AND (p_amount_min IS NULL OR COALESCE(ni.invoice_gross_amount, 0) >= p_amount_min)
    AND (p_amount_max IS NULL OR COALESCE(ni.invoice_gross_amount, 0) <= p_amount_max)
  ORDER BY
    CASE WHEN p_sort_dir = 'asc' THEN
      CASE p_sort_field
        WHEN 'invoice_issue_date' THEN ni.invoice_issue_date::text
        WHEN 'invoice_delivery_date' THEN ni.invoice_delivery_date::text
        WHEN 'invoice_number' THEN ni.invoice_number
        WHEN 'invoice_net_amount' THEN lpad(COALESCE(ni.invoice_net_amount, 0)::text, 20, '0')
        WHEN 'invoice_gross_amount' THEN lpad(COALESCE(ni.invoice_gross_amount, 0)::text, 20, '0')
        WHEN 'invoice_vat_amount' THEN lpad(COALESCE(ni.invoice_vat_amount, 0)::text, 20, '0')
        WHEN 'partner_name' THEN COALESCE(
          CASE WHEN p_direction = 'INBOUND' THEN ni.supplier_name ELSE ni.customer_name END, '')
        ELSE ni.invoice_issue_date::text
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_dir = 'desc' OR p_sort_dir IS NULL THEN
      CASE p_sort_field
        WHEN 'invoice_issue_date' THEN ni.invoice_issue_date::text
        WHEN 'invoice_delivery_date' THEN ni.invoice_delivery_date::text
        WHEN 'invoice_number' THEN ni.invoice_number
        WHEN 'invoice_net_amount' THEN lpad(COALESCE(ni.invoice_net_amount, 0)::text, 20, '0')
        WHEN 'invoice_gross_amount' THEN lpad(COALESCE(ni.invoice_gross_amount, 0)::text, 20, '0')
        WHEN 'invoice_vat_amount' THEN lpad(COALESCE(ni.invoice_vat_amount, 0)::text, 20, '0')
        WHEN 'partner_name' THEN COALESCE(
          CASE WHEN p_direction = 'INBOUND' THEN ni.supplier_name ELSE ni.customer_name END, '')
        ELSE ni.invoice_issue_date::text
      END
    END DESC NULLS LAST
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, uuid) TO authenticated, service_role;


-- ==================================================
-- MERGED FROM: 20260626_fix_null_accounting_firm_id.sql
-- ==================================================
-- ============================================================================
-- FIX: Backfill NULL accounting_firm_id in accounty_assignments
-- ============================================================================
-- When users joined via share code (join-company-as-accountant),
-- accounting_firm_id was not set, causing RLS to block visibility
-- of these records to other firm members.
-- ============================================================================

-- 1. Backfill: set accounting_firm_id = company_id where it's NULL
UPDATE public.accounty_assignments
SET accounting_firm_id = company_id
WHERE accounting_firm_id IS NULL;

-- 2. Update the RLS helper functions to also check by company_id
-- This makes the system more resilient even if accounting_firm_id
-- is somehow NULL in the future.

CREATE OR REPLACE FUNCTION is_iroda_admin_for_firm(p_firm_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounty_assignments
    WHERE accountant_user_id = auth.uid()
      AND (accounting_firm_id = p_firm_id OR company_id = p_firm_id)
      AND role = 'iroda_admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_member_of_firm(p_firm_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounty_assignments
    WHERE accountant_user_id = auth.uid()
      AND (accounting_firm_id = p_firm_id OR company_id = p_firm_id)
  );
$$;


-- ==================================================
-- MERGED FROM: 20260626_temp_and_final_gl_numbers.sql
-- ==================================================
-- Migration to introduce temporary and final ledger numbers
-- 1. Drop existing functions to allow altering the return type signature of get_gl_categorized_items
DROP FUNCTION IF EXISTS public.get_gl_balances(uuid, uuid, date, date, jsonb);
DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid, date, date, jsonb);

-- 2. Re-create get_gl_balances with matched NAV invoices filtered out
CREATE OR REPLACE FUNCTION public.get_gl_balances(
  p_company_id uuid, 
  p_preset_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  gl_account_id uuid,
  gl_number text,
  short_name text,
  total_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH raw_items AS (
    -- ① transactions (banki tételek)
    SELECT
      t.id as item_id,
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
    FROM public.transactions t
    WHERE t.company_id = p_company_id
      AND t.matched_invoice_id IS NULL
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)

    UNION ALL

    -- ② invoice_items (számla tételek)
    SELECT
      ii.id as item_id,
      (CASE WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0)) ELSE COALESCE(ii.net_amount, 0) END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
    FROM public.invoice_items ii
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE i.company_id = p_company_id
      AND (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from)
      AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)

    UNION ALL

    -- ③ nav_invoice_items
    SELECT
      ni.id as item_id,
      (CASE WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0)) ELSE COALESCE(ni.net_amount, 0) END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
    FROM public.nav_invoice_items ni
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE n.company_id = p_company_id
      AND (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
      AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
      AND NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.company_id = n.company_id
          AND REPLACE(LOWER(i.bizonylatsorszam), ' ', '') = REPLACE(LOWER(n.invoice_number), ' ', '')
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
    '00000000-0000-0000-0000-000000000000'::uuid AS gl_account_id,
    'ORPHAN' AS gl_number,
    'Besorolatlan tételek (Eltérő sablonból)' AS short_name,
    COALESCE((SELECT orphan_balance FROM orphan_sum), 0) AS total_balance
  WHERE COALESCE((SELECT orphan_balance FROM orphan_sum), 0) <> 0

  ORDER BY gl_number;
END;
$$;

-- 3. Re-create get_gl_categorized_items returning is_temporary
CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(
  p_company_id uuid, 
  p_preset_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb
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
AS $$
BEGIN
  RETURN QUERY
  WITH raw_items AS (
    -- ① transactions
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
    WHERE t.company_id = p_company_id
      AND t.matched_invoice_id IS NULL
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)

    UNION ALL

    -- ② invoice_items
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
      i.kibocsatas_datuma::text AS item_date,
      false AS is_temporary
    FROM public.invoice_items ii
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE i.company_id = p_company_id
      AND (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from)
      AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)

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
      COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text AS item_date,
      true AS is_temporary
    FROM public.nav_invoice_items ni
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE n.company_id = p_company_id
      AND (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
      AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
      AND NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.company_id = n.company_id
          AND REPLACE(LOWER(i.bizonylatsorszam), ' ', '') = REPLACE(LOWER(n.invoice_number), ' ', '')
      )

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT side (Tartozik = positive)
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

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (Követel = negative)
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
  )
  SELECT
    r.item_id,
    COALESCE(active_g.id, '00000000-0000-0000-0000-000000000000'::uuid) AS gl_account_id,
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
  LEFT JOIN public.gl_accounts active_g 
         ON r.mapped_id = active_g.id 
        AND active_g.preset_id = p_preset_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb) TO authenticated;
