-- Insert dummy projects for user balazs@thinkai.hu (skip if they already exist)
INSERT INTO public.projects (user_id, name, description) 
SELECT * FROM (VALUES 
  (
    'e5b822ee-4240-4350-9ebe-a14357d5bd89',
    'Marketing és Reklám',
    'Reklámköltségek, online marketing kampányok, közösségi média hirdetések, promóciós anyagok, PR szolgáltatások'
  ),
  (
    'e5b822ee-4240-4350-9ebe-a14357d5bd89', 
    'Oktatás és Képzés',
    'Képzési szolgáltatások, oktatási anyagok, tanfolyamok, szakmai fejlesztés, képzési programok'
  ),
  (
    'e5b822ee-4240-4350-9ebe-a14357d5bd89',
    'Irodai és Adminisztratív',
    'Irodai kellékek, adminisztrációs költségek, hivatalos ügyek, irodabérlés, telefon és internet'
  ),
  (
    'e5b822ee-4240-4350-9ebe-a14357d5bd89',
    'Építőipar és Szolgáltatások', 
    'Építési munkák, karbantartás, szakipari szolgáltatások, kivitelezés, tervezés'
  ),
  (
    'e5b822ee-4240-4350-9ebe-a14357d5bd89',
    'Személyi Szolgáltatások',
    'Személyi tanácsadás, egyéni szolgáltatások, szakértői díjak, privát oktatás'
  )
) AS t(user_id, name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.projects p 
  WHERE p.user_id = t.user_id AND p.name = t.name
);

-- Now assign the existing invoices to appropriate project categories
UPDATE public.invoices 
SET project_id = CASE 
  -- Assign invoices to different categories based on content/vendor
  WHEN szamlaszam IN ('AAA-2025-15', 'BOSZE-2025-39') THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Oktatás és Képzés' LIMIT 1)
  WHEN szamlaszam IN ('E-TXFYB-2025-11', 'E-TXFYB-2025-21') THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Személyi Szolgáltatások' LIMIT 1)
  WHEN szamlaszam = 'C20253232' THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Építőipar és Szolgáltatások' LIMIT 1)
  WHEN szamlaszam = 'E-VK-2025-220' THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Marketing és Reklám' LIMIT 1)
  WHEN szamlaszam = 'KM-2025-12' THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Irodai és Adminisztratív' LIMIT 1)
  ELSE project_id -- Keep existing assignment if no match
END
WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND project_id IS NULL;