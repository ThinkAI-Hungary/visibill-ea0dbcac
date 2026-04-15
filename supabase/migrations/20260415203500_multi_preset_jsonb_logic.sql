-- 1. Ensure the JSONB columns exist on target tables
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS gl_classifications jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS gl_classifications jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.nav_invoices ADD COLUMN IF NOT EXISTS gl_classifications jsonb DEFAULT '{}'::jsonb;

-- 2. get_gl_balances: aggregate dynamically from the JSONB classifications
CREATE OR REPLACE FUNCTION public.get_gl_balances(p_company_id uuid, p_preset_id uuid)
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
      AND t.gl_classifications IS NOT NULL 
      AND t.gl_classifications::text <> '{}'

    UNION ALL

    -- invoices
    SELECT
      i.id as item_id,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(i.brutto_vegosszeg, 0)) ELSE COALESCE(i.brutto_vegosszeg, 0) END AS amount,
      CASE WHEN (i.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (i.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.gl_classifications IS NOT NULL 
      AND i.gl_classifications::text <> '{}'

    UNION ALL

    -- nav_invoices
    SELECT
      n.id as item_id,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(n.invoice_gross_amount, 0)) ELSE COALESCE(n.invoice_gross_amount, 0) END AS amount,
      CASE WHEN (n.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (n.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
    FROM public.nav_invoices n
    WHERE n.company_id = p_company_id
      AND n.gl_classifications IS NOT NULL 
      AND n.gl_classifications::text <> '{}'
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

  -- Special virtual root bucket for items that don't belong to the new preset
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS gl_account_id,
    'ORPHAN' AS gl_number,
    'Besorolatlan tételek (Eltérő sablonból)' AS short_name,
    COALESCE((SELECT orphan_balance FROM orphan_sum), 0) AS total_balance
  WHERE COALESCE((SELECT orphan_balance FROM orphan_sum), 0) <> 0

  ORDER BY gl_number;
END;
$$;

-- 3. get_gl_categorized_items
CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(p_company_id uuid, p_preset_id uuid)
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
      AND t.gl_classifications IS NOT NULL 
      AND t.gl_classifications::text <> '{}'

    UNION ALL

    SELECT
      i.id AS item_id,
      CASE WHEN (i.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (i.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'invoices'::text AS source_table,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN 'Bejövő (Költség)' ELSE 'Kimenő (Bevétel)' END::text AS item_type,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN i.elado_nev ELSE i.vevo_nev END::text AS partner,
      i.bizonylatsorszam::text AS description,
      CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(i.brutto_vegosszeg, 0))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(i.brutto_vegosszeg, 0)
        ELSE 0
      END::numeric AS amount,
      i.kibocsatas_datuma::text AS item_date
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.gl_classifications IS NOT NULL 
      AND i.gl_classifications::text <> '{}'

    UNION ALL

    SELECT
      n.id AS item_id,
      CASE WHEN (n.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (n.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'nav_invoices'::text AS source_table,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN 'NAV Bejövő' ELSE 'NAV Kimenő' END::text AS item_type,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN n.supplier_name ELSE n.customer_name END::text AS partner,
      n.invoice_number::text AS description,
      CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(n.invoice_gross_amount, 0))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(n.invoice_gross_amount, 0)
        ELSE 0
      END::numeric AS amount,
      COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text AS item_date
    FROM public.nav_invoices n
    WHERE n.company_id = p_company_id
      AND n.gl_classifications IS NOT NULL 
      AND n.gl_classifications::text <> '{}'
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

-- 4. override_gl_classification
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
  -- Insert into the log
  INSERT INTO public.gl_overrides_log (
    item_id,
    source_table,
    original_gl_account_id,
    new_gl_account_id,
    company_id,
    user_id
  ) VALUES (
    p_item_id,
    p_source_table,
    p_original_gl_account_id,
    p_new_gl_account_id,
    p_company_id,
    p_user_id
  );

  -- Update appropriate source table JSONB structure
  IF p_source_table = 'transactions' THEN
    UPDATE public.transactions
    SET gl_classifications = jsonb_set(
      COALESCE(gl_classifications, '{}'::jsonb), 
      array[p_preset_id::text], 
      jsonb_build_object(
        'gl_account_id', p_new_gl_account_id,
        'gl_number', p_new_gl_number,
        'is_manual', true,
        'reasoning', 'Kézi módosítás az admin felületről'
      )
    )
    WHERE id = p_item_id;
  ELSIF p_source_table = 'invoices' THEN
    UPDATE public.invoices
    SET gl_classifications = jsonb_set(
      COALESCE(gl_classifications, '{}'::jsonb), 
      array[p_preset_id::text], 
      jsonb_build_object(
        'gl_account_id', p_new_gl_account_id,
        'gl_number', p_new_gl_number,
        'is_manual', true,
        'reasoning', 'Kézi módosítás az admin felületről'
      )
    )
    WHERE id = p_item_id;
  ELSIF p_source_table = 'nav_invoices' THEN
    UPDATE public.nav_invoices
    SET gl_classifications = jsonb_set(
      COALESCE(gl_classifications, '{}'::jsonb), 
      array[p_preset_id::text], 
      jsonb_build_object(
        'gl_account_id', p_new_gl_account_id,
        'gl_number', p_new_gl_number,
        'is_manual', true,
        'reasoning', 'Kézi módosítás az admin felületről'
      )
    )
    WHERE id = p_item_id;
  END IF;

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;
