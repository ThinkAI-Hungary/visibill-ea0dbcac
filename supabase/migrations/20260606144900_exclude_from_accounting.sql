-- Add exclude_from_accounting flag to invoices, nav_invoices, and partners

-- 1a. Nav invoices: exclude flag
ALTER TABLE public.nav_invoices 
  ADD COLUMN IF NOT EXISTS exclude_from_accounting BOOLEAN NOT NULL DEFAULT false;

-- 1b. Submitted invoices: exclude flag  
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS exclude_from_accounting BOOLEAN NOT NULL DEFAULT false;

-- 1c. Partners: exclude flag (partner-level auto-exclusion)
ALTER TABLE public.partners 
  ADD COLUMN IF NOT EXISTS exclude_from_accounting BOOLEAN NOT NULL DEFAULT false;

-- 1d. Invoice items (line-item level): exclude flag
ALTER TABLE public.invoice_items 
  ADD COLUMN IF NOT EXISTS exclude_from_accounting BOOLEAN NOT NULL DEFAULT false;

-- 1e. NAV invoice items (line-item level): exclude flag
ALTER TABLE public.nav_invoice_items 
  ADD COLUMN IF NOT EXISTS exclude_from_accounting BOOLEAN NOT NULL DEFAULT false;

-- 1d. Partial indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_nav_invoices_exclude 
  ON public.nav_invoices(company_id) WHERE exclude_from_accounting = true;
CREATE INDEX IF NOT EXISTS idx_invoices_exclude 
  ON public.invoices(company_id) WHERE exclude_from_accounting = true;
CREATE INDEX IF NOT EXISTS idx_partners_exclude 
  ON public.partners(company_id) WHERE exclude_from_accounting = true;

-- ══════════════════════════════════════════════════════════════════
-- 2. Update get_filtered_nav_invoices to return exclude_from_accounting
-- ══════════════════════════════════════════════════════════════════
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
  p_page_size integer DEFAULT 50
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
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
    count(*) OVER()::bigint AS total_count
  FROM nav_invoices ni
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = p_direction
    AND ni.invoice_issue_date >= p_date_from
    AND ni.invoice_issue_date <= p_date_to
    AND (p_search IS NULL OR p_search = '' OR (
      ni.invoice_number ILIKE '%' || p_search || '%'
      OR ni.supplier_name ILIKE '%' || p_search || '%'
      OR ni.customer_name ILIKE '%' || p_search || '%'
      OR ni.supplier_tax_number ILIKE '%' || p_search || '%'
      OR ni.customer_tax_number ILIKE '%' || p_search || '%'
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

-- ══════════════════════════════════════════════════════════════════
-- 3. Update get_filtered_submitted_invoices to return exclude_from_accounting
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_filtered_submitted_invoices(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text,
  p_search text DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_category_id text DEFAULT NULL,
  p_project_id text DEFAULT NULL,
  p_amount_min numeric DEFAULT NULL,
  p_amount_max numeric DEFAULT NULL,
  p_sort_field text DEFAULT 'kibocsatas_datuma',
  p_sort_dir text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  bizonylatsorszam text,
  kibocsatas_datuma date,
  teljesites_datuma date,
  elado_nev text,
  vevo_nev text,
  adoalap_osszesen numeric,
  brutto_vegosszeg numeric,
  afa_osszeg_osszesen numeric,
  penznem text,
  category_id uuid,
  project_id uuid,
  image_url text,
  melleklet_url text,
  invoice_direction text,
  reference_number text,
  exclude_from_accounting boolean,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id, i.bizonylatsorszam, i.kibocsatas_datuma, i.teljesites_datuma,
    i.elado_nev, i.vevo_nev, i.adoalap_osszesen, i.brutto_vegosszeg,
    i.afa_osszeg_osszesen, i.penznem, i.category_id, i.project_id,
    i.image_url, i.melleklet_url, i.invoice_direction, i.reference_number,
    i.exclude_from_accounting,
    count(*) OVER()::bigint AS total_count
  FROM invoices i
  WHERE i.company_id = p_company_id
    AND i.invoice_direction = p_direction
    AND i.kibocsatas_datuma >= p_date_from
    AND i.kibocsatas_datuma <= p_date_to
    AND (p_search IS NULL OR p_search = '' OR (
      i.elado_nev ILIKE '%' || p_search || '%'
      OR i.vevo_nev ILIKE '%' || p_search || '%'
      OR i.bizonylatsorszam ILIKE '%' || p_search || '%'
    ))
    AND (p_currency IS NULL OR p_currency = 'all' OR i.penznem = p_currency)
    AND (p_category_id IS NULL OR p_category_id = 'all'
      OR (p_category_id = 'none' AND i.category_id IS NULL)
      OR i.category_id = p_category_id::uuid)
    AND (p_project_id IS NULL OR p_project_id = 'all'
      OR (p_project_id = 'none' AND i.project_id IS NULL)
      OR i.project_id = p_project_id::uuid)
    AND (p_amount_min IS NULL OR COALESCE(i.brutto_vegosszeg, 0) >= p_amount_min)
    AND (p_amount_max IS NULL OR COALESCE(i.brutto_vegosszeg, 0) <= p_amount_max)
  ORDER BY
    CASE WHEN p_sort_dir = 'asc' THEN
      CASE p_sort_field
        WHEN 'kibocsatas_datuma' THEN i.kibocsatas_datuma::text
        WHEN 'invoice_issue_date' THEN i.kibocsatas_datuma::text
        WHEN 'teljesites_datuma' THEN i.teljesites_datuma::text
        WHEN 'invoice_delivery_date' THEN i.teljesites_datuma::text
        WHEN 'bizonylatsorszam' THEN i.bizonylatsorszam
        WHEN 'invoice_number' THEN i.bizonylatsorszam
        WHEN 'elado_nev' THEN i.elado_nev
        WHEN 'partner_name' THEN i.elado_nev
        WHEN 'vevo_nev' THEN i.vevo_nev
        WHEN 'adoalap_osszesen' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0')
        WHEN 'invoice_net_amount' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0')
        WHEN 'brutto_vegosszeg' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0')
        WHEN 'invoice_gross_amount' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0')
        WHEN 'afa_osszeg_osszesen' THEN lpad(COALESCE(i.afa_osszeg_osszesen, 0)::text, 20, '0')
        WHEN 'invoice_vat_amount' THEN lpad(COALESCE(i.afa_osszeg_osszesen, 0)::text, 20, '0')
        ELSE i.kibocsatas_datuma::text
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_dir = 'desc' OR p_sort_dir IS NULL THEN
      CASE p_sort_field
        WHEN 'kibocsatas_datuma' THEN i.kibocsatas_datuma::text
        WHEN 'invoice_issue_date' THEN i.kibocsatas_datuma::text
        WHEN 'teljesites_datuma' THEN i.teljesites_datuma::text
        WHEN 'invoice_delivery_date' THEN i.teljesites_datuma::text
        WHEN 'bizonylatsorszam' THEN i.bizonylatsorszam
        WHEN 'invoice_number' THEN i.bizonylatsorszam
        WHEN 'elado_nev' THEN i.elado_nev
        WHEN 'partner_name' THEN i.elado_nev
        WHEN 'vevo_nev' THEN i.vevo_nev
        WHEN 'adoalap_osszesen' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0')
        WHEN 'invoice_net_amount' THEN lpad(COALESCE(i.adoalap_osszesen, 0)::text, 20, '0')
        WHEN 'brutto_vegosszeg' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0')
        WHEN 'invoice_gross_amount' THEN lpad(COALESCE(i.brutto_vegosszeg, 0)::text, 20, '0')
        WHEN 'afa_osszeg_osszesen' THEN lpad(COALESCE(i.afa_osszeg_osszesen, 0)::text, 20, '0')
        WHEN 'invoice_vat_amount' THEN lpad(COALESCE(i.afa_osszeg_osszesen, 0)::text, 20, '0')
        ELSE i.kibocsatas_datuma::text
      END
    END DESC NULLS LAST
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- 4. Update GL RPC: filter out excluded invoices + add separate excluded flag
-- ══════════════════════════════════════════════════════════════════
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
  document_url text,
  is_excluded boolean
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
      NULL::text AS document_url,
      false AS is_excluded
    FROM public.transactions t
    WHERE t.company_id = p_company_id
      AND t.matched_invoice_id IS NULL
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
      i.image_url::text AS document_url,
      COALESCE(i.exclude_from_accounting, false) OR COALESCE(ii.exclude_from_accounting, false) AS is_excluded
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
      NULL::text AS document_url,
      COALESCE(n.exclude_from_accounting, false) OR COALESCE(ni.exclude_from_accounting, false) AS is_excluded
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
    r.document_url,
    r.is_excluded
  FROM raw_items r
  LEFT JOIN public.gl_accounts active_g 
         ON r.mapped_id = active_g.id 
        AND active_g.preset_id = p_preset_id;
END;
$$;
