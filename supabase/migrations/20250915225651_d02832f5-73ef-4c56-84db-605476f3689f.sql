-- Insert dummy projects for user balazs@thinkai.hu
-- Check first if they exist, if not insert them
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Marketing és Reklám') THEN
    INSERT INTO public.projects (user_id, name, description) VALUES 
    ('e5b822ee-4240-4350-9ebe-a14357d5bd89', 'Marketing és Reklám', 'Reklámköltségek, online marketing kampányok, közösségi média hirdetések, promóciós anyagok, PR szolgáltatások');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Oktatás és Képzés') THEN
    INSERT INTO public.projects (user_id, name, description) VALUES 
    ('e5b822ee-4240-4350-9ebe-a14357d5bd89', 'Oktatás és Képzés', 'Képzési szolgáltatások, oktatási anyagok, tanfolyamok, szakmai fejlesztés, képzési programok');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Irodai és Adminisztratív') THEN
    INSERT INTO public.projects (user_id, name, description) VALUES 
    ('e5b822ee-4240-4350-9ebe-a14357d5bd89', 'Irodai és Adminisztratív', 'Irodai kellékek, adminisztrációs költségek, hivatalos ügyek, irodabérlés, telefon és internet');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Építőipar és Szolgáltatások') THEN
    INSERT INTO public.projects (user_id, name, description) VALUES 
    ('e5b822ee-4240-4350-9ebe-a14357d5bd89', 'Építőipar és Szolgáltatások', 'Építési munkák, karbantartás, szakipari szolgáltatások, kivitelezés, tervezés');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Személyi Szolgáltatások') THEN
    INSERT INTO public.projects (user_id, name, description) VALUES 
    ('e5b822ee-4240-4350-9ebe-a14357d5bd89', 'Személyi Szolgáltatások', 'Személyi tanácsadás, egyéni szolgáltatások, szakértői díjak, privát oktatás');
  END IF;
END $$;

-- Now assign the existing invoices to appropriate project categories  
UPDATE public.invoices 
SET project_id = CASE 
  -- Education & Training invoices
  WHEN szamlaszam IN ('AAA-2025-15', 'BOSZE-2025-39') THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Oktatás és Képzés' LIMIT 1)
  -- Personal Services invoices  
  WHEN szamlaszam IN ('E-TXFYB-2025-11', 'E-TXFYB-2025-21') THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Személyi Szolgáltatások' LIMIT 1)
  -- Construction & Services invoice
  WHEN szamlaszam = 'C20253232' THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Építőipar és Szolgáltatások' LIMIT 1)
  -- Marketing invoice
  WHEN szamlaszam = 'E-VK-2025-220' THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Marketing és Reklám' LIMIT 1)
  -- Office & Administrative invoice
  WHEN szamlaszam = 'KM-2025-12' THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Irodai és Adminisztratív' LIMIT 1)
  ELSE project_id
END
WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89';