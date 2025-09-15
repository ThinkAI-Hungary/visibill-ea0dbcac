-- First, fix the trigger function to work with our Hungarian column name
CREATE OR REPLACE FUNCTION public.update_frissitve_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.frissitve = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop the old trigger and create new one with correct function
DROP TRIGGER IF EXISTS update_invoices_frissitve ON public.invoices;
CREATE TRIGGER update_invoices_frissitve
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_frissitve_column();

-- Insert dummy projects for user balazs@thinkai.hu (with ON CONFLICT to avoid duplicates)
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

-- Insert missing invoices only if they don't exist
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
)
SELECT * FROM (VALUES
  (
    'e5b822ee-4240-4350-9ebe-a14357d5bd89',
    'E-TXFYB-2025-11',
    '2025-07-21'::date,
    'HU56294473',
    'Sédtői Zoltán',
    '1108 Budapest, Lenfonó utca 14. 10.em. 44. ajtó',
    'Business Class EC Kft.',
    '1082 Budapest, Futó utca 16. Fsz.',
    'HU13996828',
    '2025-07-21'::date,
    5280::decimal(12,2),
    '0',
    0::decimal(12,2),
    5280::decimal(12,2),
    false,
    'AAM',
    false,
    false
  ),
  (
    'e5b822ee-4240-4350-9ebe-a14357d5bd89',
    'E-TXFYB-2025-21',
    '2025-08-03'::date,
    'HU46346995',
    'Lajti Ákos',
    '2373 Dabas, Zlinszky köz 12.',
    'Business Class EC Kft.',
    '1082 Budapest, Futó utca 16. Fsz.',
    'HU13996828',
    '2025-08-03'::date,
    9220::decimal(12,2),
    '0',
    0::decimal(12,2),
    9220::decimal(12,2),
    false,
    'AAM',
    false,
    false
  ),
  (
    'e5b822ee-4240-4350-9ebe-a14357d5bd89',
    'KM-2025-12',
    '2025-08-04'::date,
    'HU66060211',
    'Kacskovics Marcel ev.',
    '7625 Pécs, Hegyalja u. 118., Magyarország',
    'Business Class EC Kft.',
    '1082 Budapest, Futó utca 16., Magyarország',
    'HU13996828',
    '2025-08-18'::date,
    572225::decimal(12,2),
    '0',
    0::decimal(12,2),
    572225::decimal(12,2),
    false,
    'AAM',
    false,
    false
  )
) AS v(user_id, szamlaszam, kibocsatas_datuma, elado_vat_id, elado_nev, elado_cim, vevo_nev, vevo_cim, vevo_vat_id, teljesites_datuma, adoalap_osszesen, afa_kulcsok_bontasban, afa_osszeg_osszesen, brutto_vegosszeg, forditott_adozas, adomentesseg_hivatkozas, onszamlazas, penzforgalmi_elszamolas)
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoices 
  WHERE user_id = v.user_id AND szamlaszam = v.szamlaszam
);

-- Now assign all invoices to appropriate project categories
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