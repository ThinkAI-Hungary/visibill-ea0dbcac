-- ============================================================================
-- OVERHEAD COST CATEGORIES G/L ACCOUNT MAPPING MIGRATION
-- ============================================================================

-- 1. Add gl_accounts column to public.categories if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'gl_accounts'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN gl_accounts TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- 2. Function to ensure standard 10 overhead cost categories exist for a company
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

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END IF;

  -- Insert default overhead categories if not already existing by name
  INSERT INTO public.categories (id, user_id, company_id, name, description, icon, color, gl_accounts, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_user_id, p_company_id, 'Közüzemi díjak', 'Víz, gáz, villany, távhő díjak', 'Zap', '#F59E0B', ARRAY['521', '522'], NOW(), NOW()),
    (gen_random_uuid(), v_user_id, p_company_id, 'Irodaszer', 'Irodai kellékek, papír, toner, üzemanyag', 'FileText', '#3B82F6', ARRAY['511', '512', '513'], NOW(), NOW()),
    (gen_random_uuid(), v_user_id, p_company_id, 'Bankköltség', 'Banki díjak, tranzakciós költségek', 'Building2', '#10B981', ARRAY['532', '538'], NOW(), NOW()),
    (gen_random_uuid(), v_user_id, p_company_id, 'Szállítás', 'Futárszolgálat, fuvardíj, szállítás', 'Truck', '#6366F1', ARRAY['524', '529'], NOW(), NOW()),
    (gen_random_uuid(), v_user_id, p_company_id, 'IT és szoftver', 'Szoftver licenszek, hosting, bérleti díj', 'Laptop', '#8B5CF6', ARRAY['523'], NOW(), NOW()),
    (gen_random_uuid(), v_user_id, p_company_id, 'Bérek és juttatások', 'Bruttó bérek, cafeteria, személyi költségek', 'Users', '#EC4899', ARRAY['541', '542', '551'], NOW(), NOW()),
    (gen_random_uuid(), v_user_id, p_company_id, 'Adók és járulékok', 'Szocho, kiva, cégautóadó, egyéb adók', 'Receipt', '#EF4444', ARRAY['561', '562', '563'], NOW(), NOW()),
    (gen_random_uuid(), v_user_id, p_company_id, 'Marketing', 'Reklám, online marketing, PR, hirdetés', 'Megaphone', '#F97316', ARRAY['525', '526'], NOW(), NOW()),
    (gen_random_uuid(), v_user_id, p_company_id, 'Könyvelés', 'Könyvelési, jogi és szakértői díjak', 'Calculator', '#14B8A6', ARRAY['527'], NOW(), NOW()),
    (gen_random_uuid(), v_user_id, p_company_id, 'Egyéb működési költség', 'Egyéb igénybe vett szolgáltatások & egyéb költségek', 'FolderOpen', '#64748B', ARRAY['531', '539', '559', '579'], NOW(), NOW())
  ON CONFLICT DO NOTHING;

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

-- 3. Execute for existing companies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.ensure_default_categories(r.id);
  END LOOP;
END $$;
