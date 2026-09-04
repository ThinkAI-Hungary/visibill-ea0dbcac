-- RPC: Search GL Accounts and Items in Database
CREATE OR REPLACE FUNCTION public.search_gl_entities(
  p_company_id uuid,
  p_preset_id uuid,
  p_query text,
  p_limit integer DEFAULT 12
)
RETURNS TABLE (
  entity_type text,
  entity_id text,
  gl_number text,
  title text,
  subtitle text,
  account_id uuid,
  target_gl_number text,
  amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clean_query text;
BEGIN
  v_clean_query := TRIM(COALESCE(p_query, ''));
  IF LENGTH(v_clean_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH acc_matches AS (
    SELECT 
      'account'::text AS entity_type,
      ga.gl_number::text AS entity_id,
      ga.gl_number::text AS gl_number,
      (ga.gl_number || ' - ' || ga.short_name)::text AS title,
      'Főkönyvi számla'::text AS subtitle,
      ga.id AS account_id,
      ga.gl_number::text AS target_gl_number,
      NULL::numeric AS amount,
      1 AS sort_priority
    FROM public.gl_accounts ga
    WHERE ga.preset_id = p_preset_id
      AND (ga.gl_number ILIKE '%' || v_clean_query || '%' OR ga.short_name ILIKE '%' || v_clean_query || '%')
    ORDER BY 
      CASE WHEN ga.gl_number ILIKE v_clean_query || '%' THEN 0 ELSE 1 END,
      LENGTH(ga.gl_number) ASC
    LIMIT 6
  ),
  item_matches AS (
    SELECT * FROM (
      -- 1. gl_journal_entries
      SELECT
        'item'::text AS entity_type,
        ('item_' || je.id::text)::text AS entity_id,
        COALESCE(je.debit_account, je.credit_account, 'UNCLASSIFIED')::text AS gl_number,
        COALESCE(je.description, je.voucher_number)::text AS title,
        (COALESCE(je.partner_name, '') || ' • ' || to_char(COALESCE(je.amount, 0), 'FM999,999,999') || ' Ft')::text AS subtitle,
        NULL::uuid AS account_id,
        COALESCE(je.debit_account, je.credit_account, 'UNCLASSIFIED')::text AS target_gl_number,
        je.amount AS amount,
        2 AS sort_priority
      FROM public.gl_journal_entries je
      WHERE je.company_id = p_company_id
        AND (
          je.voucher_number ILIKE '%' || v_clean_query || '%' 
          OR je.partner_name ILIKE '%' || v_clean_query || '%' 
          OR je.description ILIKE '%' || v_clean_query || '%'
        )
      LIMIT 6
    ) j
    UNION ALL
    SELECT * FROM (
      -- 2. nav_invoice_items
      SELECT
        'item'::text AS entity_type,
        ('item_' || ni.id::text)::text AS entity_id,
        COALESCE(ni.gl_classifications->(p_preset_id::text)->>'gl_number', 'UNCLASSIFIED')::text AS gl_number,
        COALESCE(ni.line_description, n.invoice_number)::text AS title,
        (COALESCE(n.supplier_name, n.customer_name, '') || ' • ' || to_char(COALESCE(ni.net_amount, 0), 'FM999,999,999') || ' Ft')::text AS subtitle,
        CASE WHEN (ni.gl_classifications->(p_preset_id::text)->>'gl_account_id') ~ '^[0-9a-fA-F-]{36}$'
          THEN (ni.gl_classifications->(p_preset_id::text)->>'gl_account_id')::uuid
          ELSE NULL END AS account_id,
        COALESCE(ni.gl_classifications->(p_preset_id::text)->>'gl_number', 'UNCLASSIFIED')::text AS target_gl_number,
        ni.net_amount AS amount,
        3 AS sort_priority
      FROM public.nav_invoice_items ni
      JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
      WHERE n.company_id = p_company_id
        AND (
          ni.line_description ILIKE '%' || v_clean_query || '%' 
          OR n.supplier_name ILIKE '%' || v_clean_query || '%' 
          OR n.customer_name ILIKE '%' || v_clean_query || '%' 
          OR n.invoice_number ILIKE '%' || v_clean_query || '%'
        )
      LIMIT 6
    ) n
  ),
  all_matches AS (
    SELECT * FROM acc_matches
    UNION ALL
    SELECT * FROM item_matches
  )
  SELECT 
    m.entity_type,
    m.entity_id,
    m.gl_number,
    m.title,
    m.subtitle,
    m.account_id,
    m.target_gl_number,
    m.amount
  FROM all_matches m
  ORDER BY m.sort_priority ASC, m.title ASC
  LIMIT p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_gl_entities(uuid, uuid, text, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_gl_entities(uuid, uuid, text, integer) TO authenticated, service_role;
