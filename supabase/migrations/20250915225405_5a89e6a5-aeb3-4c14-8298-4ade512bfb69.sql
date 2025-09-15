-- First, let's fix the trigger function to work with our Hungarian column names
CREATE OR REPLACE FUNCTION public.update_frissitve_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.frissitve = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Update the trigger to use the correct function
DROP TRIGGER IF EXISTS update_invoices_frissitve ON public.invoices;
CREATE TRIGGER update_invoices_frissitve
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_frissitve_column();

-- Now insert dummy projects for user balazs@thinkai.hu
INSERT INTO public.projects (user_id, name, description) VALUES 
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
);

-- Add the remaining sample invoices with Hungarian column names
INSERT INTO public.invoices (
  user_id,
  szamlaszam,
  kibocsatas_datuma,
  elado_vat_id,
  elado_nev,
  elado_cim,
  vevo_nev,
  vevo_cim,
  vevo_vat_id,
  teljesites_datuma,
  adoalap_osszesen,
  afa_kulcsok_bontasban,
  afa_osszeg_osszesen,
  brutto_vegosszeg,
  forditott_adozas,
  adomentesseg_hivatkozas,
  onszamlazas,
  penzforgalmi_elszamolas
) VALUES 
(
  'e5b822ee-4240-4350-9ebe-a14357d5bd89',
  'E-TXFYB-2025-11',
  '2025-07-21',
  'HU56294473',
  'Sédtői Zoltán',
  '1108 Budapest, Lenfonó utca 14. 10.em. 44. ajtó',
  'Business Class EC Kft.',
  '1082 Budapest, Futó utca 16. Fsz.',
  'HU13996828',
  '2025-07-21',
  5280,
  '0',
  0,
  5280,
  false,
  'AAM',
  false,
  false
),
(
  'e5b822ee-4240-4350-9ebe-a14357d5bd89',
  'E-TXFYB-2025-21',
  '2025-08-03',
  'HU46346995',
  'Lajti Ákos',
  '2373 Dabas, Zlinszky köz 12.',
  'Business Class EC Kft.',
  '1082 Budapest, Futó utca 16. Fsz.',
  'HU13996828',
  '2025-08-03',
  9220,
  '0',
  0,
  9220,
  false,
  'AAM',
  false,
  false
),
(
  'e5b822ee-4240-4350-9ebe-a14357d5bd89',
  'E-VK-2025-220',
  '2025-08-07',
  'HU13996828',
  'Business Class EC Kft.',
  '1082 Budapest, Futó utca 16. FSZ. 1. üzlet',
  'Wärtsilä Hungary Kft.',
  '2040 Budaörs, Gyár u. 2.',
  '14539334',
  '2025-08-07',
  712350,
  '0',
  192335,
  904685,
  false,
  '',
  false,
  false
),
(
  'e5b822ee-4240-4350-9ebe-a14357d5bd89',
  'KM-2025-12',
  '2025-08-04',
  'HU66060211',
  'Kacskovics Marcel ev.',
  '7625 Pécs, Hegyalja u. 118., Magyarország',
  'Business Class EC Kft.',
  '1082 Budapest, Futó utca 16., Magyarország',
  'HU13996828',
  '2025-08-18',
  572225,
  '0',
  0,
  572225,
  false,
  'AAM',
  false,
  false
);

-- Now let's assign these invoices to appropriate project categories
UPDATE public.invoices 
SET project_id = CASE 
  -- Assign invoices to different categories based on content/vendor
  WHEN szamlaszam IN ('AAA-2025-15', 'BOSZE-2025-39') THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Oktatás és Képzés')
  WHEN szamlaszam IN ('E-TXFYB-2025-11', 'E-TXFYB-2025-21') THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Személyi Szolgáltatások')
  WHEN szamlaszam = 'C20253232' THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Építőipar és Szolgáltatások')
  WHEN szamlaszam = 'E-VK-2025-220' THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Marketing és Reklám')
  WHEN szamlaszam = 'KM-2025-12' THEN 
    (SELECT id FROM public.projects WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89' AND name = 'Irodai és Adminisztratív')
  ELSE NULL
END
WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89';