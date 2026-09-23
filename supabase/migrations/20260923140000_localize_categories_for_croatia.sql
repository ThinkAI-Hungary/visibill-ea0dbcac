-- ============================================================================
-- LOCALIZE DEFAULT CATEGORIES & GL ACCOUNTS FOR CROATIA (HR)
-- ============================================================================

-- 1. Update existing categories for D-INVOICE D.O.O (eb1d61df-3f85-45e2-b4d2-a93719ff4a4d)
UPDATE public.categories
SET
  name = 'Režije i komunalije',
  description = 'Struja, plin, voda, komunalne usluge',
  gl_accounts = ARRAY['4070', '4071', '4172'],
  updated_at = NOW()
WHERE id = 'a62a934e-7ab4-42e9-b582-f1fa933840de';

UPDATE public.categories
SET
  name = 'Uredski materijal',
  description = 'Uredski pribor, papir, toneri, sitni inventar',
  gl_accounts = ARRAY['4010', '4011', '4040'],
  updated_at = NOW()
WHERE id = '5a66380c-b804-4916-bfbe-86f8621ae388';

UPDATE public.categories
SET
  name = 'Bankovni troškovi',
  description = 'Bankovne naknade, platni promet, FINA',
  gl_accounts = ARRAY['4650', '4652', '4658'],
  updated_at = NOW()
WHERE id = '67183ea6-ab23-4197-b549-546ce6319029';

UPDATE public.categories
SET
  name = 'Prijevoz i dostava',
  description = 'Dostava, kurirske usluge, prijevoz tereta',
  gl_accounts = ARRAY['4101', '4102', '4108'],
  updated_at = NOW()
WHERE id = '006277ff-ef75-4c0c-82c1-0df0eb609c2b';

UPDATE public.categories
SET
  name = 'IT i softver',
  description = 'Softverske licence, hosting, održavanje',
  gl_accounts = ARRAY['4100', '4123', '4149'],
  updated_at = NOW()
WHERE id = '0757bb9b-e9fb-4649-ad02-5cd4182784ab';

UPDATE public.categories
SET
  name = 'Plaće i naknade',
  description = 'Bruto plaće, prijevoz na posao, nagrade zaposlenicima',
  gl_accounts = ARRAY['4200', '4240', '4610'],
  updated_at = NOW()
WHERE id = '34409d53-073d-460f-bb34-183eedbb1075';

UPDATE public.categories
SET
  name = 'Porezi i pristojbe',
  description = 'Porez na tvrtku, komorski doprinosi, pristojbe',
  gl_accounts = ARRAY['4660', '4670', '4679'],
  updated_at = NOW()
WHERE id = '5ea995bf-3a61-4469-976e-d085be1aad51';

UPDATE public.categories
SET
  name = 'Marketing i oglašavanje',
  description = 'Promidžba, oglašavanje, agencijske usluge, web reklame',
  gl_accounts = ARRAY['4150', '4151', '4158'],
  updated_at = NOW()
WHERE id = '4d0af3d3-a9eb-4c59-994a-fc97236e8e06';

UPDATE public.categories
SET
  name = 'Računovodstvo i pravne usluge',
  description = 'Knjigovodstvo, porezno savjetovanje, odvjetničke usluge',
  gl_accounts = ARRAY['4164', '4165', '4167'],
  updated_at = NOW()
WHERE id = 'f8969441-c756-447a-8472-a1941f4e1d43';

UPDATE public.categories
SET
  name = 'Ostali troškovi poslovanja',
  description = 'Najam prostora, osiguranje, ostale poslovne usluge',
  gl_accounts = ARRAY['4140', '4199', '4640'],
  updated_at = NOW()
WHERE id = '43d8a665-26cd-4480-89a7-8163f91dd1c8';


-- 2. Update ensure_default_categories to be country_code aware
CREATE OR REPLACE FUNCTION public.ensure_default_categories(p_company_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := p_user_id;
  v_country_code TEXT := 'HU';
BEGIN
  IF p_company_id IS NULL THEN
    RETURN;
  END IF;

  -- Determine company jurisdiction
  SELECT COALESCE(country_code, 'HU') INTO v_country_code
  FROM public.companies
  WHERE id = p_company_id;

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

  IF v_country_code = 'HR' THEN
    -- Seed Croatian (HR) categories and Class 4 accounts
    INSERT INTO public.categories (id, user_id, company_id, name, description, icon, color, gl_accounts, created_at, updated_at)
    SELECT
      gen_random_uuid(), v_user_id, p_company_id, d.name, d.description, d.icon, d.color, d.gl_accounts, NOW(), NOW()
    FROM (
      VALUES
        ('Režije i komunalije', 'Struja, plin, voda, komunalne usluge', 'Zap', '#F59E0B', ARRAY['4070', '4071', '4172']),
        ('Uredski materijal', 'Uredski pribor, papir, toneri, sitni inventar', 'FileText', '#3B82F6', ARRAY['4010', '4011', '4040']),
        ('Bankovni troškovi', 'Bankovne naknade, platni promet, FINA', 'Building2', '#10B981', ARRAY['4650', '4652', '4658']),
        ('Prijevoz i dostava', 'Dostava, kurirske usluge, prijevoz tereta', 'Truck', '#6366F1', ARRAY['4101', '4102', '4108']),
        ('IT i softver', 'Softverske licence, hosting, održavanje', 'Laptop', '#8B5CF6', ARRAY['4100', '4123', '4149']),
        ('Plaće i naknade', 'Bruto plaće, prijevoz na posao, nagrade zaposlenicima', 'Users', '#EC4899', ARRAY['4200', '4240', '4610']),
        ('Porezi i pristojbe', 'Porez na tvrtku, komorski doprinosi, pristojbe', 'Receipt', '#EF4444', ARRAY['4660', '4670', '4679']),
        ('Marketing i oglašavanje', 'Promidžba, oglašavanje, agencijske usluge, web reklame', 'Megaphone', '#F97316', ARRAY['4150', '4151', '4158']),
        ('Računovodstvo i pravne usluge', 'Knjigovodstvo, porezno savjetovanje, odvjetničke usluge', 'Calculator', '#14B8A6', ARRAY['4164', '4165', '4167']),
        ('Ostali troškovi poslovanja', 'Najam prostora, osiguranje, ostale poslovne usluge', 'FolderOpen', '#64748B', ARRAY['4140', '4199', '4640'])
    ) AS d(name, description, icon, color, gl_accounts)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.company_id = p_company_id
        AND LOWER(TRIM(c.name)) = LOWER(TRIM(d.name))
    );
  ELSE
    -- Seed Hungarian (HU) categories and Class 5 accounts
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
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.ensure_default_categories(UUID, UUID) TO authenticated, service_role;
