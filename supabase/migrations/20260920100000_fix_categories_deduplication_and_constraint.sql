-- ============================================================================
-- FIX CATEGORIES DEDUPLICATION, UNIQUE CONSTRAINT & IDEMPOTENT AUTO-PROVISIONING
-- ============================================================================

-- 1. Deduplicate existing categories safely:
-- Identify canonical category (oldest created_at per company_id & lower(trim(name)))
DO $$
DECLARE
  v_reassigned_invoices INT := 0;
  v_reassigned_nav INT := 0;
  v_deleted_categories INT := 0;
BEGIN
  -- Create temporary mapping of duplicate category IDs to their canonical ID
  CREATE TEMP TABLE temp_category_mapping ON COMMIT DROP AS
  WITH ranked AS (
    SELECT 
      id,
      company_id,
      name,
      FIRST_VALUE(id) OVER (
        PARTITION BY company_id, LOWER(TRIM(name))
        ORDER BY created_at ASC, id ASC
      ) AS canonical_id
    FROM public.categories
  )
  SELECT id AS duplicate_id, canonical_id
  FROM ranked
  WHERE id <> canonical_id;

  -- Re-point any invoices referencing duplicate categories to the canonical ID
  UPDATE public.invoices i
  SET category_id = m.canonical_id
  FROM temp_category_mapping m
  WHERE i.category_id = m.duplicate_id;

  GET DIAGNOSTICS v_reassigned_invoices = ROW_COUNT;

  -- Re-point any nav_invoices referencing duplicate categories to the canonical ID
  UPDATE public.nav_invoices ni
  SET category_id = m.canonical_id
  FROM temp_category_mapping m
  WHERE ni.category_id = m.duplicate_id;

  GET DIAGNOSTICS v_reassigned_nav = ROW_COUNT;

  -- Delete all non-canonical duplicate category records
  DELETE FROM public.categories c
  USING temp_category_mapping m
  WHERE c.id = m.duplicate_id;

  GET DIAGNOSTICS v_deleted_categories = ROW_COUNT;

  RAISE NOTICE 'Categories deduplication complete: Reassigned invoices: %, Reassigned nav invoices: %, Deleted duplicate categories: %',
    v_reassigned_invoices, v_reassigned_nav, v_deleted_categories;
END $$;

-- 2. Create UNIQUE index to permanently prevent duplicates per company and normalized name
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_company_id_lower_name 
ON public.categories (company_id, LOWER(TRIM(name)));

-- 3. Replace ensure_default_categories with an IDEMPOTENT implementation
CREATE OR REPLACE FUNCTION public.ensure_default_categories(p_company_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := p_user_id;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN;
  END IF;

  -- Fallback user ID from company_members if not provided
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id FROM public.company_members WHERE company_id = p_company_id LIMIT 1;
  END IF;

  -- Fallback owner ID from companies if still NULL
  IF v_user_id IS NULL THEN
    SELECT owner_id INTO v_user_id FROM public.companies WHERE id = p_company_id LIMIT 1;
  END IF;

  -- Ultimate fallback from auth.users
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END IF;

  -- Insert only categories that DO NOT yet exist for this company (case-insensitive)
  INSERT INTO public.categories (id, user_id, company_id, name, description, icon, color, gl_accounts, created_at, updated_at)
  SELECT
    gen_random_uuid(), v_user_id, p_company_id, d.name, d.description, d.icon, d.color, d.gl_accounts, NOW(), NOW()
  FROM (
    VALUES
      ('Közüzemi díjak', 'Víz, gáz, villany, távhő díjak', 'Zap', '#F59E0B', ARRAY['521', '522']),
      ('Irodaszer', 'Irodai kellékek, papír, toner, üzemanyag', 'FileText', '#3B82F6', ARRAY['511', '512', '513']),
      ('Bankköltség', 'Banki díjak, tranzakciós költségek', 'Building2', '#10B981', ARRAY['532', '538']),
      ('Szállítás', 'Futárszolgálat, fuvardíj, szállítás', 'Truck', '#6366F1', ARRAY['524', '529']),
      ('IT és szoftver', 'Szoftver licenszek, hosting, bérleti díj', 'Laptop', '#8B5CF6', ARRAY['523']),
      ('Bérek és juttatások', 'Bruttó bérek, cafeteria, személyi költségek', 'Users', '#EC4899', ARRAY['541', '542', '551']),
      ('Adók és járulékok', 'Szocho, kiva, cégautóadó, egyéb adók', 'Receipt', '#EF4444', ARRAY['561', '562', '563']),
      ('Marketing', 'Reklám, online marketing, PR, hirdetés', 'Megaphone', '#F97316', ARRAY['525', '526']),
      ('Könyvelés', 'Könyvelési, jogi és szakértői díjak', 'Calculator', '#14B8A6', ARRAY['527']),
      ('Egyéb működési költség', 'Egyéb igénybe vett szolgáltatások & egyéb költségek', 'FolderOpen', '#64748B', ARRAY['531', '539', '559', '579'])
  ) AS d(name, description, icon, color, gl_accounts)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.company_id = p_company_id
      AND LOWER(TRIM(c.name)) = LOWER(TRIM(d.name))
  );

  -- Backfill gl_accounts for existing category names if empty
  UPDATE public.categories SET gl_accounts = ARRAY['521', '522'] WHERE company_id = p_company_id AND lower(name) LIKE '%közüzem%' AND (gl_accounts IS NULL OR array_length(gl_accounts, 1) IS NULL);
  UPDATE public.categories SET gl_accounts = ARRAY['511', '512', '513'] WHERE company_id = p_company_id AND lower(name) LIKE '%irodaszer%' AND (gl_accounts IS NULL OR array_length(gl_accounts, 1) IS NULL);
  UPDATE public.categories SET gl_accounts = ARRAY['532', '538'] WHERE company_id = p_company_id AND lower(name) LIKE '%bank%' AND (gl_accounts IS NULL OR array_length(gl_accounts, 1) IS NULL);
  UPDATE public.categories SET gl_accounts = ARRAY['524', '529'] WHERE company_id = p_company_id AND lower(name) LIKE '%szállítás%' AND (gl_accounts IS NULL OR array_length(gl_accounts, 1) IS NULL);
  UPDATE public.categories SET gl_accounts = ARRAY['523'] WHERE company_id = p_company_id AND (lower(name) LIKE '%it%' OR lower(name) LIKE '%szoftver%') AND (gl_accounts IS NULL OR array_length(gl_accounts, 1) IS NULL);
  UPDATE public.categories SET gl_accounts = ARRAY['541', '542', '551'] WHERE company_id = p_company_id AND lower(name) LIKE '%bér%' AND (gl_accounts IS NULL OR array_length(gl_accounts, 1) IS NULL);
  UPDATE public.categories SET gl_accounts = ARRAY['561', '562', '563'] WHERE company_id = p_company_id AND lower(name) LIKE '%adó%' AND (gl_accounts IS NULL OR array_length(gl_accounts, 1) IS NULL);
  UPDATE public.categories SET gl_accounts = ARRAY['525', '526'] WHERE company_id = p_company_id AND lower(name) LIKE '%marketing%' AND (gl_accounts IS NULL OR array_length(gl_accounts, 1) IS NULL);
  UPDATE public.categories SET gl_accounts = ARRAY['527'] WHERE company_id = p_company_id AND (lower(name) LIKE '%könyvelé%' OR lower(name) LIKE '%tanácsadás%') AND (gl_accounts IS NULL OR array_length(gl_accounts, 1) IS NULL);
  UPDATE public.categories SET gl_accounts = ARRAY['531', '539', '559', '579'] WHERE company_id = p_company_id AND lower(name) LIKE '%egyéb%' AND (gl_accounts IS NULL OR array_length(gl_accounts, 1) IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.ensure_default_categories(UUID, UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.ensure_default_categories(UUID, UUID) FROM anon;

-- 4. Extend RLS SELECT policy on categories to include accountants & owners
DROP POLICY IF EXISTS "Members can view categories" ON public.categories;
DROP POLICY IF EXISTS "Members and accountants can view categories" ON public.categories;

CREATE POLICY "Members and accountants can view categories"
ON public.categories FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = categories.company_id
      AND cm.user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.accounty_assignments aa
    WHERE aa.company_id = categories.company_id
      AND aa.accountant_user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = categories.company_id
      AND c.owner_id = (SELECT auth.uid())
  )
);
