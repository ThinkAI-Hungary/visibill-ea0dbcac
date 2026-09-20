-- Migration: Partner history auto-categorization with majority vote
-- Description:
-- 1. Creates `public.get_partner_majority_category(p_company_id, p_supplier_name)`
--    Returns the category with strict majority of past invoices for this partner at this company.
--    Returns NULL if no history or in case of a tie (allowing AI to decide).
-- 2. Creates `public.get_company_partner_majority_categories(p_company_id)`
--    Returns a table of all partners and their strict majority category for bulk pre-processing.
-- 3. BEFORE INSERT triggers on `invoices` and `nav_invoices` to automatically categorize new invoices upon arrival.
-- 4. High-performance functional indexes for fast partner category lookups.

CREATE OR REPLACE FUNCTION public.get_partner_majority_category(
  p_company_id uuid,
  p_supplier_name text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_supplier text;
  v_top_category_id uuid;
  v_top_count int;
  v_second_count int;
BEGIN
  IF p_company_id IS NULL OR p_supplier_name IS NULL OR trim(p_supplier_name) = '' THEN
    RETURN NULL;
  END IF;

  v_norm_supplier := lower(trim(p_supplier_name));

  -- Partner kategória eloszlás összesítése az invoices és nav_invoices táblákból
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

  -- Ha nincs korábbi számla, vagy döntetlen állás van (top count = second count), NULL-t adunk vissza -> AI dönt
  IF v_top_category_id IS NULL OR v_top_count = 0 OR v_top_count = v_second_count THEN
    RETURN NULL;
  END IF;

  RETURN v_top_category_id;
END;
$$;

-- Összesített partner többségi kategória függvény a batch/Edge Function feldolgozáshoz
CREATE OR REPLACE FUNCTION public.get_company_partner_majority_categories(
  p_company_id uuid
)
RETURNS TABLE (
  supplier_name text,
  category_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH combined_history AS (
    SELECT lower(trim(i.elado_nev)) AS supp_name, i.category_id AS cat_id
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.invoice_direction = 'INBOUND'
      AND i.category_id IS NOT NULL
      AND i.elado_nev IS NOT NULL
      AND trim(i.elado_nev) <> ''
    UNION ALL
    SELECT lower(trim(n.supplier_name)) AS supp_name, n.category_id AS cat_id
    FROM public.nav_invoices n
    WHERE n.company_id = p_company_id
      AND n.invoice_direction = 'INBOUND'
      AND n.category_id IS NOT NULL
      AND n.supplier_name IS NOT NULL
      AND trim(n.supplier_name) <> ''
  ),
  counted AS (
    SELECT 
      c.supp_name,
      c.cat_id,
      count(*)::int AS cnt,
      row_number() OVER (PARTITION BY c.supp_name ORDER BY count(*) DESC) AS rnk
    FROM combined_history c
    GROUP BY c.supp_name, c.cat_id
  ),
  top_and_second AS (
    SELECT 
      c1.supp_name,
      c1.cat_id,
      c1.cnt AS top_cnt,
      COALESCE(c2.cnt, 0) AS second_cnt
    FROM counted c1
    LEFT JOIN counted c2 ON c1.supp_name = c2.supp_name AND c2.rnk = 2
    WHERE c1.rnk = 1
  )
  SELECT 
    t.supp_name AS supplier_name,
    t.cat_id AS category_id
  FROM top_and_second t
  WHERE t.top_cnt > t.second_cnt;
$$;

-- Trigger funkció az `invoices` táblához
CREATE OR REPLACE FUNCTION public.trg_fn_auto_categorize_invoices_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat_id uuid;
BEGIN
  IF NEW.category_id IS NULL AND NEW.invoice_direction = 'INBOUND' AND NEW.elado_nev IS NOT NULL AND trim(NEW.elado_nev) <> '' THEN
    v_cat_id := public.get_partner_majority_category(NEW.company_id, NEW.elado_nev);
    IF v_cat_id IS NOT NULL THEN
      NEW.category_id := v_cat_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_categorize_invoices_on_insert ON public.invoices;
CREATE TRIGGER trg_auto_categorize_invoices_on_insert
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_auto_categorize_invoices_on_insert();

-- Trigger funkció a `nav_invoices` táblához
CREATE OR REPLACE FUNCTION public.trg_fn_auto_categorize_nav_invoices_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat_id uuid;
BEGIN
  IF NEW.category_id IS NULL AND NEW.invoice_direction = 'INBOUND' AND NEW.supplier_name IS NOT NULL AND trim(NEW.supplier_name) <> '' THEN
    v_cat_id := public.get_partner_majority_category(NEW.company_id, NEW.supplier_name);
    IF v_cat_id IS NOT NULL THEN
      NEW.category_id := v_cat_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_categorize_nav_invoices_on_insert ON public.nav_invoices;
CREATE TRIGGER trg_auto_categorize_nav_invoices_on_insert
BEFORE INSERT ON public.nav_invoices
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_auto_categorize_nav_invoices_on_insert();

-- Funkcionális indexek a mikroszekundumos keresési sebességhez
CREATE INDEX IF NOT EXISTS idx_invoices_partner_category_lookup
ON public.invoices (company_id, lower(trim(elado_nev)), category_id)
WHERE invoice_direction = 'INBOUND' AND category_id IS NOT NULL AND elado_nev IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nav_invoices_partner_category_lookup
ON public.nav_invoices (company_id, lower(trim(supplier_name)), category_id)
WHERE invoice_direction = 'INBOUND' AND category_id IS NOT NULL AND supplier_name IS NOT NULL;
