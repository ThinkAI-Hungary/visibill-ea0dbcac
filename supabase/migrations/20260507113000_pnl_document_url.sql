-- Drop earlier functions to avoid conflicting signatures
DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid, date, date);
DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid, date, date, jsonb);

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
  document_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH raw_items AS (
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
      NULL::text AS document_url
    FROM public.transactions t
    WHERE t.company_id = p_company_id
      AND t.matched_invoice_id IS NULL -- EXCLUDE MATCHED TRANSACTIONS
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)

    UNION ALL

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
      i.image_url::text AS document_url
    FROM public.invoice_items ii
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE i.company_id = p_company_id
      AND (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from)
      AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)

    UNION ALL

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
      NULL::text AS document_url
    FROM public.nav_invoice_items ni
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE n.company_id = p_company_id
      AND (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
      AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
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
    r.document_url
  FROM raw_items r
  LEFT JOIN public.gl_accounts active_g 
         ON r.mapped_id = active_g.id 
        AND active_g.preset_id = p_preset_id;
END;
$$;
