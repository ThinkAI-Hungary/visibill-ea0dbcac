-- Migration to add RPC for fetching detailed categorized items for General Ledger
CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(p_company_id uuid)
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
    -- Get transaction details
    SELECT
      t.id AS item_id,
      t.gl_account_id,
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
      i.gl_account_id,
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
      n.gl_account_id,
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
  ;
END;
$$;
