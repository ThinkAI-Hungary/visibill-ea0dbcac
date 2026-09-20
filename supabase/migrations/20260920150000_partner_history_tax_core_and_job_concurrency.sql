-- Migration: 20260920150000_partner_history_tax_core_and_job_concurrency.sql
-- Description:
-- 1. Extend get_partner_majority_category to support 8-digit Hungarian tax core fallback (handles company name variations)
-- 2. Extend get_company_partner_majority_categories to return both name-based and tax-core based majority rules
-- 3. Update trg_fn_auto_categorize_invoices_on_insert and trg_fn_auto_categorize_nav_invoices_on_insert to pass tax numbers

-- 1. Function: get_partner_majority_category with tax core fallback
CREATE OR REPLACE FUNCTION public.get_partner_majority_category(
  p_company_id uuid,
  p_supplier_name text,
  p_tax_number text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_supplier text;
  v_tax_core text;
  v_top_category_id uuid;
  v_top_count int;
  v_second_count int;
  v_digits text;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_norm_supplier := lower(trim(coalesce(p_supplier_name, '')));
  
  -- Extract 8-digit Hungarian tax core if available
  IF p_tax_number IS NOT NULL THEN
    v_digits := regexp_replace(p_tax_number, '[^0-9]', '', 'g');
    IF length(v_digits) >= 8 THEN
      v_tax_core := substring(v_digits from 1 for 8);
    END IF;
  END IF;

  -- 1. First priority: exact normalized partner name majority match
  IF v_norm_supplier <> '' THEN
    WITH combined_history AS (
      SELECT category_id
      FROM public.invoices
      WHERE company_id = p_company_id
        AND invoice_direction = 'INBOUND'
        AND category_id IS NOT NULL
        AND elado_nev IS NOT NULL
        AND lower(trim(elado_nev)) = v_norm_supplier
      UNION ALL
      SELECT category_id
      FROM public.nav_invoices
      WHERE company_id = p_company_id
        AND invoice_direction = 'INBOUND'
        AND category_id IS NOT NULL
        AND supplier_name IS NOT NULL
        AND lower(trim(supplier_name)) = v_norm_supplier
    ),
    ranked_categories AS (
      SELECT 
        category_id,
        count(*)::int as cnt,
        row_number() OVER (ORDER BY count(*) DESC) as rnk
      FROM combined_history
      GROUP BY category_id
    )
    SELECT 
      (SELECT category_id FROM ranked_categories WHERE rnk = 1),
      COALESCE((SELECT cnt FROM ranked_categories WHERE rnk = 1), 0),
      COALESCE((SELECT cnt FROM ranked_categories WHERE rnk = 2), 0)
    INTO v_top_category_id, v_top_count, v_second_count;

    IF v_top_category_id IS NOT NULL AND v_top_count > v_second_count THEN
      RETURN v_top_category_id;
    END IF;
  END IF;

  -- 2. Second priority: 8-digit tax number core majority match (handles partner name variations)
  IF v_tax_core IS NOT NULL AND length(v_tax_core) = 8 THEN
    WITH tax_history AS (
      SELECT category_id
      FROM public.invoices
      WHERE company_id = p_company_id
        AND invoice_direction = 'INBOUND'
        AND category_id IS NOT NULL
        AND elado_vat_id IS NOT NULL
        AND regexp_replace(elado_vat_id, '[^0-9]', '', 'g') LIKE v_tax_core || '%'
      UNION ALL
      SELECT category_id
      FROM public.nav_invoices
      WHERE company_id = p_company_id
        AND invoice_direction = 'INBOUND'
        AND category_id IS NOT NULL
        AND supplier_tax_number IS NOT NULL
        AND regexp_replace(supplier_tax_number, '[^0-9]', '', 'g') LIKE v_tax_core || '%'
    ),
    ranked_tax_categories AS (
      SELECT 
        category_id,
        count(*)::int as cnt,
        row_number() OVER (ORDER BY count(*) DESC) as rnk
      FROM tax_history
      GROUP BY category_id
    )
    SELECT 
      (SELECT category_id FROM ranked_tax_categories WHERE rnk = 1),
      COALESCE((SELECT cnt FROM ranked_tax_categories WHERE rnk = 1), 0),
      COALESCE((SELECT cnt FROM ranked_tax_categories WHERE rnk = 2), 0)
    INTO v_top_category_id, v_top_count, v_second_count;

    IF v_top_category_id IS NOT NULL AND v_top_count > v_second_count THEN
      RETURN v_top_category_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- 2. Function: get_company_partner_majority_categories with both name and tax core majority
-- Drop previous 2-column signature to allow return table expansion to 3 columns
DROP FUNCTION IF EXISTS public.get_company_partner_majority_categories(uuid);

CREATE OR REPLACE FUNCTION public.get_company_partner_majority_categories(
  p_company_id uuid
)
RETURNS TABLE (
  supplier_name text,
  tax_core text,
  category_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH combined_history AS (
    SELECT 
      lower(trim(i.elado_nev)) AS supp_name, 
      CASE WHEN length(regexp_replace(coalesce(i.elado_vat_id, ''), '[^0-9]', '', 'g')) >= 8 
           THEN substring(regexp_replace(i.elado_vat_id, '[^0-9]', '', 'g') from 1 for 8) 
           ELSE NULL END AS t_core,
      i.category_id AS cat_id
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.invoice_direction = 'INBOUND'
      AND i.category_id IS NOT NULL
    UNION ALL
    SELECT 
      lower(trim(n.supplier_name)) AS supp_name,
      CASE WHEN length(regexp_replace(coalesce(n.supplier_tax_number, ''), '[^0-9]', '', 'g')) >= 8 
           THEN substring(regexp_replace(n.supplier_tax_number, '[^0-9]', '', 'g') from 1 for 8) 
           ELSE NULL END AS t_core,
      n.category_id AS cat_id
    FROM public.nav_invoices n
    WHERE n.company_id = p_company_id
      AND n.invoice_direction = 'INBOUND'
      AND n.category_id IS NOT NULL
  ),
  -- Name based ranking
  counted_names AS (
    SELECT 
      c.supp_name,
      c.cat_id,
      count(*)::int AS cnt,
      row_number() OVER (PARTITION BY c.supp_name ORDER BY count(*) DESC) AS rnk
    FROM combined_history c
    WHERE c.supp_name IS NOT NULL AND c.supp_name <> ''
    GROUP BY c.supp_name, c.cat_id
  ),
  top_names AS (
    SELECT 
      c1.supp_name,
      c1.cat_id,
      c1.cnt AS top_cnt,
      COALESCE(c2.cnt, 0) AS second_cnt
    FROM counted_names c1
    LEFT JOIN counted_names c2 ON c1.supp_name = c2.supp_name AND c2.rnk = 2
    WHERE c1.rnk = 1
  ),
  -- Tax core based ranking
  counted_taxes AS (
    SELECT 
      c.t_core,
      c.cat_id,
      count(*)::int AS cnt,
      row_number() OVER (PARTITION BY c.t_core ORDER BY count(*) DESC) AS rnk
    FROM combined_history c
    WHERE c.t_core IS NOT NULL AND length(c.t_core) = 8
    GROUP BY c.t_core, c.cat_id
  ),
  top_taxes AS (
    SELECT 
      c1.t_core,
      c1.cat_id,
      c1.cnt AS top_cnt,
      COALESCE(c2.cnt, 0) AS second_cnt
    FROM counted_taxes c1
    LEFT JOIN counted_taxes c2 ON c1.t_core = c2.t_core AND c2.rnk = 2
    WHERE c1.rnk = 1
  )
  SELECT 
    tn.supp_name AS supplier_name,
    NULL::text AS tax_core,
    tn.cat_id AS category_id
  FROM top_names tn
  WHERE tn.top_cnt > tn.second_cnt
  UNION ALL
  SELECT 
    NULL::text AS supplier_name,
    tt.t_core AS tax_core,
    tt.cat_id AS category_id
  FROM top_taxes tt
  WHERE tt.top_cnt > tt.second_cnt;
$$;

-- 3. Update Triggers to pass tax numbers
CREATE OR REPLACE FUNCTION public.trg_fn_auto_categorize_invoices_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_majority_category_id uuid;
BEGIN
  -- Csak bejövő (költség) számlákon fut, ha a category_id még üres
  IF (NEW.invoice_direction = 'INBOUND' OR NEW.invoice_direction IS NULL) AND NEW.category_id IS NULL THEN
    v_majority_category_id := public.get_partner_majority_category(NEW.company_id, NEW.elado_nev, NEW.elado_vat_id);
    IF v_majority_category_id IS NOT NULL THEN
      NEW.category_id := v_majority_category_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_auto_categorize_nav_invoices_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_majority_category_id uuid;
BEGIN
  -- Csak bejövő (költség) számlákon fut, ha a category_id még üres
  IF (NEW.invoice_direction = 'INBOUND' OR NEW.invoice_direction IS NULL) AND NEW.category_id IS NULL THEN
    v_majority_category_id := public.get_partner_majority_category(NEW.company_id, NEW.supplier_name, NEW.supplier_tax_number);
    IF v_majority_category_id IS NOT NULL THEN
      NEW.category_id := v_majority_category_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
