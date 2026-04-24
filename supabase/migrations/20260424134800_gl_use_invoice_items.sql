-- Drop earlier functions to avoid conflicting signatures
DROP FUNCTION IF EXISTS public.get_gl_balances(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_gl_balances(
  p_company_id uuid, 
  p_preset_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
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
    -- transactions
    SELECT
      t.id as item_id,
      t.amount AS amount,
      CASE WHEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
    FROM public.transactions t
    WHERE t.company_id = p_company_id
      AND t.matched_invoice_id IS NULL -- EXCLUDE MATCHED TRANSACTIONS
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)

    UNION ALL

    -- invoice_items (számla tételek)
    SELECT
      ii.id as item_id,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0)) ELSE COALESCE(ii.net_amount, 0) END AS amount,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
    FROM public.invoice_items ii
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE i.company_id = p_company_id
      AND (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from)
      AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)

    UNION ALL

    -- nav_invoice_items
    SELECT
      ni.id as item_id,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0)) ELSE COALESCE(ni.net_amount, 0) END AS amount,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
    FROM public.nav_invoice_items ni
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE n.company_id = p_company_id
      AND (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
      AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
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


CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(
  p_company_id uuid, 
  p_preset_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  item_id uuid,
  gl_account_id uuid,
  source_table text,
  item_type text,
  partner text,
  description text,
  amount numeric,
  item_date text
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
      t.amount::numeric AS amount,
      t.transaction_date::text AS item_date
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
      CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(ii.net_amount, 0)
        ELSE 0
      END::numeric AS amount,
      i.kibocsatas_datuma::text AS item_date
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
      CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.net_amount, 0)
        ELSE 0
      END::numeric AS amount,
      COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text AS item_date
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
    r.item_date
  FROM raw_items r
  LEFT JOIN public.gl_accounts active_g 
         ON r.mapped_id = active_g.id 
        AND active_g.preset_id = p_preset_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.override_gl_classification(
  p_item_id uuid,
  p_source_table text,
  p_new_gl_account_id uuid,
  p_original_gl_account_id uuid,
  p_company_id uuid,
  p_user_id uuid,
  p_preset_id uuid,
  p_new_gl_number text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_new_gl_account_id IS NULL THEN
    -- A felhasználó eltávolította a kategóriát (Besorolatlan tétel)
    -- 1. Töröljük a logból
    DELETE FROM public.gl_overrides_log WHERE item_id = p_item_id;

    -- 2. Töröljük a JSON objektumból az aktuális preset kulcsot a megfelelő forrástáblában
    IF p_source_table = 'transactions' THEN
      UPDATE public.transactions 
      SET gl_classifications = gl_classifications - p_preset_id::text 
      WHERE id = p_item_id;
    ELSIF p_source_table = 'invoices' THEN
      UPDATE public.invoices 
      SET gl_classifications = gl_classifications - p_preset_id::text 
      WHERE id = p_item_id;
    ELSIF p_source_table = 'invoice_items' THEN
      UPDATE public.invoice_items 
      SET gl_classifications = gl_classifications - p_preset_id::text 
      WHERE id = p_item_id;
    ELSIF p_source_table = 'nav_invoice_items' THEN
      UPDATE public.nav_invoice_items 
      SET gl_classifications = gl_classifications - p_preset_id::text 
      WHERE id = p_item_id;
    END IF;

  ELSE
    -- Normál kézi módosítás
    -- 1. Naplózás a log táblába
    INSERT INTO public.gl_overrides_log (
      item_id,
      source_table,
      original_gl_account_id,
      new_gl_account_id,
      company_id,
      user_id,
      created_at
    ) VALUES (
      p_item_id,
      p_source_table,
      p_original_gl_account_id,
      p_new_gl_account_id,
      p_company_id,
      p_user_id,
      now()
    );

    -- 2. A forrástábla JSONB mezőjének frissítése
    IF p_source_table = 'transactions' THEN
      UPDATE public.transactions
      SET gl_classifications = jsonb_set(
        COALESCE(gl_classifications, '{}'::jsonb), 
        array[p_preset_id::text], 
        jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')
      )
      WHERE id = p_item_id;
    ELSIF p_source_table = 'invoices' THEN
      UPDATE public.invoices
      SET gl_classifications = jsonb_set(
        COALESCE(gl_classifications, '{}'::jsonb), 
        array[p_preset_id::text], 
        jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')
      )
      WHERE id = p_item_id;
    ELSIF p_source_table = 'invoice_items' THEN
      UPDATE public.invoice_items
      SET gl_classifications = jsonb_set(
        COALESCE(gl_classifications, '{}'::jsonb), 
        array[p_preset_id::text], 
        jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')
      )
      WHERE id = p_item_id;
    ELSIF p_source_table = 'nav_invoice_items' THEN
      UPDATE public.nav_invoice_items
      SET gl_classifications = jsonb_set(
        COALESCE(gl_classifications, '{}'::jsonb), 
        array[p_preset_id::text], 
        jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')
      )
      WHERE id = p_item_id;
    END IF;
  END IF;

  RETURN true;
END;
$$;
