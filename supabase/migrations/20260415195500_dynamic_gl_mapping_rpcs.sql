-- 1. Rewrite get_gl_balances to dynamically map items to active preset GL numbers
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
    -- Get transaction amounts
    SELECT
      t.gl_account_id,
      t.amount AS amount
    FROM public.transactions t
    WHERE t.company_id = p_company_id
      AND t.gl_account_id IS NOT NULL

    UNION ALL

    -- Get invoice amounts
    SELECT
      i.gl_account_id,
      CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(i.brutto_vegosszeg, 0))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(i.brutto_vegosszeg, 0)
        ELSE 0
      END AS amount
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.gl_account_id IS NOT NULL

    UNION ALL

    -- Get NAV invoice amounts
    SELECT
      n.gl_account_id,
      CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(n.invoice_gross_amount, 0))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(n.invoice_gross_amount, 0)
        ELSE 0
      END AS amount
    FROM public.nav_invoices n
    WHERE n.company_id = p_company_id
      AND n.gl_account_id IS NOT NULL
  ),
  items_with_numbers AS (
    SELECT r.amount, orig_gl.gl_number
    FROM raw_items r
    JOIN public.gl_accounts orig_gl ON r.gl_account_id = orig_gl.id
  ),
  aggregated_by_number AS (
    SELECT iwn.gl_number, SUM(iwn.amount) AS total_balance
    FROM items_with_numbers iwn
    GROUP BY iwn.gl_number
  ),
  mapped_to_active AS (
    SELECT
      g.id AS gl_account_id,
      g.gl_number::text,
      g.short_name::text,
      COALESCE(a.total_balance, 0)::numeric AS total_balance
    FROM public.gl_accounts g
    LEFT JOIN aggregated_by_number a ON g.gl_number = a.gl_number
    WHERE g.preset_id = p_preset_id
  ),
  orphan_sum AS (
    SELECT SUM(a.total_balance) AS orphan_balance
    FROM aggregated_by_number a
    LEFT JOIN public.gl_accounts check_g 
           ON a.gl_number = check_g.gl_number 
          AND check_g.preset_id = p_preset_id
    WHERE check_g.id IS NULL
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


-- 2. Rewrite get_gl_categorized_items to dynamically map IDs to the active preset
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
    -- Get transaction details
    SELECT
      t.id AS item_id,
      t.gl_account_id AS original_gl_account_id,
      'transactions'::text AS source_table,
      'Banki tranzakció'::text AS item_type,
      NULL::text AS partner,
      t.description::text AS description,
      t.amount::numeric AS amount,
      t.transaction_date::text AS item_date
    FROM public.transactions t
    WHERE t.company_id = p_company_id
      AND t.gl_account_id IS NOT NULL

    UNION ALL

    -- Get invoice details
    SELECT
      i.id AS item_id,
      i.gl_account_id AS original_gl_account_id,
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
      AND i.gl_account_id IS NOT NULL

    UNION ALL

    -- Get NAV invoice details
    SELECT
      n.id AS item_id,
      n.gl_account_id AS original_gl_account_id,
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
      AND n.gl_account_id IS NOT NULL
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
  JOIN public.gl_accounts orig_g ON r.original_gl_account_id = orig_g.id
  LEFT JOIN public.gl_accounts active_g 
         ON orig_g.gl_number = active_g.gl_number 
        AND active_g.preset_id = p_preset_id;
END;
$$;
