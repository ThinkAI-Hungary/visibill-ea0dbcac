-- ============================================================================
-- MIGRATION: 20260925140000_add_croatian_vat_form_rows_and_seed_codes.sql
-- Description: Multi-jurisdiction VAT form rows and Croatian Obrazac PDV codes
-- ============================================================================

-- 1. Extend vat_form_rows with country_code ('HU' vs 'HR')
ALTER TABLE public.vat_form_rows 
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) NOT NULL DEFAULT 'HU';

-- Update primary key on vat_form_rows to composite (country_code, row_number)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.vat_form_rows'::regclass 
      AND conname = 'vat_form_rows_pkey'
  ) THEN
    ALTER TABLE public.vat_form_rows DROP CONSTRAINT vat_form_rows_pkey;
  END IF;
END $$;

ALTER TABLE public.vat_form_rows 
ADD CONSTRAINT vat_form_rows_pkey PRIMARY KEY (country_code, row_number);

CREATE INDEX IF NOT EXISTS idx_vat_form_rows_country 
ON public.vat_form_rows (country_code, sort_order);

-- 2. Seed Croatian Obrazac PDV form rows (Porezna uprava)
INSERT INTO public.vat_form_rows (country_code, row_number, section, page, label, has_base, has_tax, is_summary, sort_order)
VALUES
  -- I. Transakcije koje ne podliježu oporezivanju i oslobođene
  ('HR', 'I', 'exempt', 'PDV-1', 'I. TRANSAKCIJE KOJE NE PODLIJEŽU OPOREZIVANJU I OSLOBOĐENE – UKUPNO', true, false, true, 100),
  ('HR', 'I.1', 'exempt', 'PDV-1', '1. Isporuke u RH za koje PDV obračunava primatelj (tuzemni prijenos porezne obveze)', true, false, false, 101),
  ('HR', 'I.2', 'exempt', 'PDV-1', '2. Isporuke dobara obavljene u drugim državama članicama', true, false, false, 102),
  ('HR', 'I.3', 'exempt', 'PDV-1', '3. Isporuke dobara unutar EU', true, false, false, 103),
  ('HR', 'I.4', 'exempt', 'PDV-1', '4. Obavljene usluge unutar EU', true, false, false, 104),
  ('HR', 'I.5', 'exempt', 'PDV-1', '5. Obavljene usluge osobama bez sjedišta u RH', true, false, false, 105),
  ('HR', 'I.6', 'exempt', 'PDV-1', '6. Sastavljanje i postavljanje dobara u drugoj državi članici EU', true, false, false, 106),
  ('HR', 'I.7', 'exempt', 'PDV-1', '7. Isporuke novih prijevoznih sredstava u EU', true, false, false, 107),
  ('HR', 'I.8', 'exempt', 'PDV-1', '8. Tuzemne isporuke', true, false, false, 108),
  ('HR', 'I.9', 'exempt', 'PDV-1', '9. Izvozne isporuke', true, false, false, 109),
  ('HR', 'I.10', 'exempt', 'PDV-1', '10. Ostala oslobođenja', true, false, false, 110),
  ('HR', 'I.11', 'exempt', 'PDV-1', '11. Isporuke po stopi 0%', true, false, false, 111),

  -- II. Oporezive transakcije (Fizetendő PDV)
  ('HR', 'II', 'payable', 'PDV-1', 'II. OPOREZIVE TRANSAKCIJE - UKUPNO', true, true, true, 200),
  ('HR', 'II.1', 'payable', 'PDV-1', '1. Isporuke dobara i usluga po stopi 5%', true, true, false, 201),
  ('HR', 'II.2', 'payable', 'PDV-1', '2. Isporuke dobara i usluga po stopi 13%', true, true, false, 202),
  ('HR', 'II.3', 'payable', 'PDV-1', '3. Isporuke dobara i usluga po stopi 25%', true, true, false, 203),
  ('HR', 'II.4', 'payable', 'PDV-1', '4. Primljene isporuke u RH za koje PDV obračunava primatelj (tuzemni prijenos)', true, true, false, 204),
  ('HR', 'II.5', 'payable', 'PDV-1', '5. Stjecanje dobara unutar EU po stopi 5%', true, true, false, 205),
  ('HR', 'II.6', 'payable', 'PDV-1', '6. Stjecanje dobara unutar EU po stopi 13%', true, true, false, 206),
  ('HR', 'II.7', 'payable', 'PDV-1', '7. Stjecanje dobara unutar EU po stopi 25%', true, true, false, 207),
  ('HR', 'II.8', 'payable', 'PDV-1', '8. Primljene usluge iz EU po stopi 5%', true, true, false, 208),
  ('HR', 'II.9', 'payable', 'PDV-1', '9. Primljene usluge iz EU po stopi 13%', true, true, false, 209),
  ('HR', 'II.10', 'payable', 'PDV-1', '10. Primljene usluge iz EU po stopi 25%', true, true, false, 210),
  ('HR', 'II.11', 'payable', 'PDV-1', '11. Primljene isporuke dobara i usluga od poreznih obveznika bez sjedišta u RH po stopi 0% i 5%', true, true, false, 211),
  ('HR', 'II.12', 'payable', 'PDV-1', '12. Primljene isporuke dobara i usluga od poreznih obveznika bez sjedišta u RH po stopi 13%', true, true, false, 212),
  ('HR', 'II.13', 'payable', 'PDV-1', '13. Primljene isporuke dobara i usluga od poreznih obveznika bez sjedišta u RH po stopi 25%', true, true, false, 213),
  ('HR', 'II.14', 'payable', 'PDV-1', '14. Naknadno oslobođenje izvoza u okviru osobnog putničkog prometa', true, true, false, 214),
  ('HR', 'II.15', 'payable', 'PDV-1', '15. Obračunani PDV pri uvozu', false, true, false, 215),

  -- III. Obračunani pretporez (Levonható PDV)
  ('HR', 'III', 'deductible', 'PDV-1', 'III. OBRAČUNANI PRETPOREZ - UKUPNO', true, true, true, 300),
  ('HR', 'III.1', 'deductible', 'PDV-1', '1. Pretporez od primljenih isporuka u tuzemstvu po stopi od 5%', true, true, false, 301),
  ('HR', 'III.2', 'deductible', 'PDV-1', '2. Pretporez od primljenih isporuka u tuzemstvu po stopi od 13%', true, true, false, 302),
  ('HR', 'III.3', 'deductible', 'PDV-1', '3. Pretporez od primljenih isporuka u tuzemstvu po stopi od 25%', true, true, false, 303),
  ('HR', 'III.4', 'deductible', 'PDV-1', '4. Pretporez od primljenih isporuka u RH za koje PDV obračunava primatelj (tuzemni prijenos)', true, true, false, 304),
  ('HR', 'III.5', 'deductible', 'PDV-1', '5. Pretporez od stjecanja dobara unutar EU po stopi 5%', true, true, false, 305),
  ('HR', 'III.6', 'deductible', 'PDV-1', '6. Pretporez od stjecanja dobara unutar EU po stopi 13%', true, true, false, 306),
  ('HR', 'III.7', 'deductible', 'PDV-1', '7. Pretporez od stjecanja dobara unutar EU po stopi 25%', true, true, false, 307),
  ('HR', 'III.8', 'deductible', 'PDV-1', '8. Pretporez od primljenih usluga iz EU po stopi 5%', true, true, false, 308),
  ('HR', 'III.9', 'deductible', 'PDV-1', '9. Pretporez od primljenih usluga iz EU po stopi 13%', true, true, false, 309),
  ('HR', 'III.10', 'deductible', 'PDV-1', '10. Pretporez od primljenih usluga iz EU po stopi 25%', true, true, false, 310),
  ('HR', 'III.11', 'deductible', 'PDV-1', '11. Pretporez od primljenih isporuka dobara i usluga od poreznih obveznika bez sjedišta u RH po stopi 5%', true, true, false, 311),
  ('HR', 'III.12', 'deductible', 'PDV-1', '12. Pretporez od primljenih isporuka dobara i usluga od poreznih obveznika bez sjedišta u RH po stopi 13%', true, true, false, 312),
  ('HR', 'III.13', 'deductible', 'PDV-1', '13. Pretporez od primljenih isporuka dobara i usluga od poreznih obveznika bez sjedišta u RH po stopi 25%', true, true, false, 313),
  ('HR', 'III.14', 'deductible', 'PDV-1', '14. Pretporez pri uvozu', true, true, false, 314),
  ('HR', 'III.15', 'deductible', 'PDV-1', '15. Ispravci pretporeza', false, true, false, 315),

  -- IV. Obveza PDV-a u obračunskom razdoblju
  ('HR', 'IV', 'settlement', 'PDV-2', 'IV. OBVEZA PDV-a U OBRAČUNSKOM RAZDOBLJU: ZA UPLATU (II. - III.) ILI ZA POVRAT (III. - II.)', false, true, true, 400),

  -- V. Iznos godišnjeg razmjernog odbitka
  ('HR', 'V', 'settlement', 'PDV-2', 'V. IZNOS GODIŠNJEG RAZMJERNOG ODBITKA PRETPOREZA (%)', true, false, false, 500),

  -- VI. Ostali podaci
  ('HR', 'VI.1', 'other', 'PDV-2', '1. ZA ISPRAVAK PRETPOREZA (UKUPNO 1.1+1.2+1.3+1.4+1.5)', true, false, true, 600),
  ('HR', 'VI.1.1', 'other', 'PDV-2', '1.1 NABAVA NEKRETNINA', true, false, false, 601),
  ('HR', 'VI.1.2', 'other', 'PDV-2', '1.2 NABAVA OSOBNIH AUTOMOBILA I DRUGIH SREDSTAVA ZA OSOBNI PRIJEVOZ', true, false, false, 602),
  ('HR', 'VI.1.3', 'other', 'PDV-2', '1.3 PRODAJA OSOBNIH AUTOMOBILA I DRUGIH SREDSTAVA ZA OSOBNI PRIJEVOZ', true, false, false, 603),
  ('HR', 'VI.1.4', 'other', 'PDV-2', '1.4 NABAVA OSTALE DUGOTRAJNE IMOVINE', true, false, false, 604),
  ('HR', 'VI.1.5', 'other', 'PDV-2', '1.5 PRODAJA OSTALE DUGOTRAJNE IMOVINE', true, false, false, 605),
  ('HR', 'VI.2', 'other', 'PDV-2', '2. OTUĐENJE/STJECANJE GOSPODARSKE CJELINE ILI POGONA', true, false, false, 606),
  ('HR', 'VI.3', 'other', 'PDV-2', '3. UKUPNO PRIMLJENE USLUGE OD POREZNIH OBVEZNIKA BEZ SJEDIŠTA U RH (EU + TREĆE ZEMLJE)', true, false, false, 607),
  ('HR', 'VI.4', 'other', 'PDV-2', '4. UKUPNO OBAVLJENE USLUGE POREZNIM OBVEZNICIMA BEZ SJEDIŠTA U RH (EU + TREĆE ZEMLJE)', true, false, false, 608),
  ('HR', 'VI.5', 'other', 'PDV-2', '5. PRIMLJENA DOBRA IZ EU U OKVIRU TROSTRANOG POSLA', true, false, false, 609),
  ('HR', 'VI.6', 'other', 'PDV-2', '6. POSTUPAK OPOREZIVANJA PREMA NAPLAĆENIM NAKNADAMA', false, false, false, 610),

  -- VII. Podaci o donacijama hrane
  ('HR', 'VII', 'donations', 'PDV-2', 'VII. PODACI O OBAVLJENIM DONACIJAMA HRANE', true, true, true, 700),
  ('HR', 'VII.1', 'donations', 'PDV-2', '1. DONACIJE HRANE PO STOPI 5%', true, true, false, 701),
  ('HR', 'VII.2', 'donations', 'PDV-2', '2. DONACIJE HRANE PO STOPI 13%', true, true, false, 702),
  ('HR', 'VII.3', 'donations', 'PDV-2', '3. DONACIJE HRANE PO STOPI 15%', true, true, false, 703)
ON CONFLICT (country_code, row_number) DO UPDATE SET
  section = EXCLUDED.section,
  page = EXCLUDED.page,
  label = EXCLUDED.label,
  has_base = EXCLUDED.has_base,
  has_tax = EXCLUDED.has_tax,
  is_summary = EXCLUDED.is_summary,
  sort_order = EXCLUDED.sort_order;


-- 3. Update seed_default_vat_codes to be country_code aware
CREATE OR REPLACE FUNCTION public.seed_default_vat_codes(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_country_code TEXT := 'HU';
BEGIN
  IF p_company_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(country_code, 'HU') INTO v_country_code
  FROM public.companies
  WHERE id = p_company_id;

  IF v_country_code = 'HR' THEN
    -- Seed Croatian VAT (PDV) codes according to Obrazac PDV
    INSERT INTO vat_codes (company_id, code, label, vat_percent, direction, is_deductible, is_reverse_charge, is_eu, sort_order, target_rows)
    VALUES
      -- Izlazni računi (OUTBOUND)
      (p_company_id, 'HR_IZL_25',       'Isporuke dobara i usluga po stopi 25%', 25.00, 'OUTBOUND', false, false, false, 10,
       '[{"row": "II.3", "col": "base"}, {"row": "II.3", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_IZL_13',       'Isporuke dobara i usluga po stopi 13%', 13.00, 'OUTBOUND', false, false, false, 20,
       '[{"row": "II.2", "col": "base"}, {"row": "II.2", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_IZL_5',        'Isporuke dobara i usluga po stopi 5%', 5.00, 'OUTBOUND', false, false, false, 30,
       '[{"row": "II.1", "col": "base"}, {"row": "II.1", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_IZL_0',        'Isporuke po stopi 0%', 0.00, 'OUTBOUND', false, false, false, 40,
       '[{"row": "I.11", "col": "base"}]'::jsonb),
      (p_company_id, 'HR_IZL_TUZ_PRIJ', 'Tuzemni prijenos porezne obveze (isporuka)', 0.00, 'OUTBOUND', false, true, false, 50,
       '[{"row": "I.1", "col": "base"}]'::jsonb),
      (p_company_id, 'HR_IZL_EU_DOB',   'Isporuke dobara unutar EU', 0.00, 'OUTBOUND', false, false, true, 60,
       '[{"row": "I.3", "col": "base"}]'::jsonb),
      (p_company_id, 'HR_IZL_EU_USL',   'Obavljene usluge unutar EU', 0.00, 'OUTBOUND', false, false, true, 70,
       '[{"row": "I.4", "col": "base"}]'::jsonb),
      (p_company_id, 'HR_IZL_INO_USL',  'Obavljene usluge osobama bez sjedišta u RH', 0.00, 'OUTBOUND', false, false, false, 80,
       '[{"row": "I.5", "col": "base"}]'::jsonb),
      (p_company_id, 'HR_IZL_IZVOZ',    'Izvozne isporuke (treće zemlje)', 0.00, 'OUTBOUND', false, false, false, 90,
       '[{"row": "I.9", "col": "base"}]'::jsonb),
      (p_company_id, 'HR_IZL_TUZ_OSL',  'Tuzemne isporuke oslobođene PDV-a', 0.00, 'OUTBOUND', false, false, false, 100,
       '[{"row": "I.8", "col": "base"}]'::jsonb),
      (p_company_id, 'HR_IZL_OST_OSL',  'Ostala oslobođenja', 0.00, 'OUTBOUND', false, false, false, 110,
       '[{"row": "I.10", "col": "base"}]'::jsonb),

      -- Ulazni računi (INBOUND)
      (p_company_id, 'HR_UL_25_ODB',     'Pretporez od primljenih isporuka u tuzemstvu 25%', 25.00, 'INBOUND', true, false, false, 200,
       '[{"row": "III.3", "col": "base"}, {"row": "III.3", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_13_ODB',     'Pretporez od primljenih isporuka u tuzemstvu 13%', 13.00, 'INBOUND', true, false, false, 210,
       '[{"row": "III.2", "col": "base"}, {"row": "III.2", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_5_ODB',      'Pretporez od primljenih isporuka u tuzemstvu 5%', 5.00, 'INBOUND', true, false, false, 220,
       '[{"row": "III.1", "col": "base"}, {"row": "III.1", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_TUZ_PRIJ',   'Tuzemni prijenos porezne obveze (primljeno)', 25.00, 'INBOUND', true, true, false, 230,
       '[{"row": "II.4", "col": "base"}, {"row": "II.4", "col": "tax"}, {"row": "III.4", "col": "base"}, {"row": "III.4", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_EU_DOB_25',  'Stjecanje dobara unutar EU 25%', 25.00, 'INBOUND', true, false, true, 240,
       '[{"row": "II.7", "col": "base"}, {"row": "II.7", "col": "tax"}, {"row": "III.7", "col": "base"}, {"row": "III.7", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_EU_DOB_13',  'Stjecanje dobara unutar EU 13%', 13.00, 'INBOUND', true, false, true, 250,
       '[{"row": "II.6", "col": "base"}, {"row": "II.6", "col": "tax"}, {"row": "III.6", "col": "base"}, {"row": "III.6", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_EU_DOB_5',   'Stjecanje dobara unutar EU 5%', 5.00, 'INBOUND', true, false, true, 260,
       '[{"row": "II.5", "col": "base"}, {"row": "II.5", "col": "tax"}, {"row": "III.5", "col": "base"}, {"row": "III.5", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_EU_USL_25',  'Primljene usluge iz EU 25%', 25.00, 'INBOUND', true, false, true, 270,
       '[{"row": "II.10", "col": "base"}, {"row": "II.10", "col": "tax"}, {"row": "III.10", "col": "base"}, {"row": "III.10", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_EU_USL_13',  'Primljene usluge iz EU 13%', 13.00, 'INBOUND', true, false, true, 280,
       '[{"row": "II.9", "col": "base"}, {"row": "II.9", "col": "tax"}, {"row": "III.9", "col": "base"}, {"row": "III.9", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_EU_USL_5',   'Primljene usluge iz EU 5%', 5.00, 'INBOUND', true, false, true, 290,
       '[{"row": "II.8", "col": "base"}, {"row": "II.8", "col": "tax"}, {"row": "III.8", "col": "base"}, {"row": "III.8", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_INO_USL_25', 'Primljene isporuke od inozemnih obveznika 25%', 25.00, 'INBOUND', true, false, false, 300,
       '[{"row": "II.13", "col": "base"}, {"row": "II.13", "col": "tax"}, {"row": "III.13", "col": "base"}, {"row": "III.13", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_UVOZ_25',    'Pretporez pri uvozu 25%', 25.00, 'INBOUND', true, false, false, 310,
       '[{"row": "III.14", "col": "base"}, {"row": "III.14", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_NEODB',      'Primljene isporuke bez prava na odbitak', 25.00, 'INBOUND', false, false, false, 320,
       '[]'::jsonb),
      (p_company_id, 'HR_UL_IMOVINA',    'Nabava dugotrajne imovine 25%', 25.00, 'INBOUND', true, false, false, 330,
       '[{"row": "III.3", "col": "base"}, {"row": "III.3", "col": "tax"}, {"row": "VI.1.4", "col": "base"}]'::jsonb)
    ON CONFLICT (company_id, code) DO UPDATE SET
      label = EXCLUDED.label,
      target_rows = EXCLUDED.target_rows,
      vat_percent = EXCLUDED.vat_percent,
      direction = EXCLUDED.direction,
      is_deductible = EXCLUDED.is_deductible,
      is_reverse_charge = EXCLUDED.is_reverse_charge,
      is_eu = EXCLUDED.is_eu,
      sort_order = EXCLUDED.sort_order;

  ELSE
    -- Seed Hungarian (HU) NAV 2665 default codes
    INSERT INTO vat_codes (company_id, code, label, vat_percent, direction, is_deductible, is_reverse_charge, is_eu, sort_order, target_rows)
    VALUES
      (p_company_id, 'KIM_27',       'Belföldi 27% ÁFA', 27, 'OUTBOUND', false, false, false, 10,
       '[{"row": "07", "col": "tax"}, {"row": "07", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_18',       'Belföldi 18% ÁFA', 18, 'OUTBOUND', false, false, false, 20,
       '[{"row": "06", "col": "tax"}, {"row": "06", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_5',        'Belföldi 5% ÁFA', 5, 'OUTBOUND', false, false, false, 30,
       '[{"row": "05", "col": "tax"}, {"row": "05", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_FORD',     'Belföldi fordított értékesítés (mentes)', 0, 'OUTBOUND', false, true, false, 35,
       '[{"row": "04", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_EXPORT',   'Termékexport 3. országba (mentes)', 0, 'OUTBOUND', false, false, false, 40,
       '[{"row": "01", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_EU',       'Közösségen belüli adómentes termékértékesítés', 0, 'OUTBOUND', false, false, true, 42,
       '[{"row": "02", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_TAM',      'Közérdekű vagy speciális adómentes (TAM)', 0, 'OUTBOUND', false, false, false, 44,
       '[{"row": "08", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_ATHK',     'ÁFA területi hatályán kívüli SZOLGÁLTATÁSOK (3. ország)', 0, 'OUTBOUND', false, false, false, 48,
       '[{"row": "91", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_EU_SZOLG', 'ÁFA területi hatályán kívüli EU SZOLGÁLTATÁSOK (Áfa tv. 37.§)', 0, 'OUTBOUND', false, false, true, 50,
       '[{"row": "92", "col": "base"}]'::jsonb),
      (p_company_id, 'BE_27_LEV',    'Levonható 27% ÁFA', 27, 'INBOUND', true, false, false, 100,
       '[{"row": "66", "col": "tax"}, {"row": "66", "col": "base"}]'::jsonb),
      (p_company_id, 'BE_18_LEV',    'Levonható 18% ÁFA', 18, 'INBOUND', true, false, false, 110,
       '[{"row": "65", "col": "tax"}, {"row": "65", "col": "base"}]'::jsonb),
      (p_company_id, 'BE_5_LEV',     'Levonható 5% ÁFA', 5, 'INBOUND', true, false, false, 120,
       '[{"row": "64", "col": "tax"}, {"row": "64", "col": "base"}]'::jsonb),
      (p_company_id, 'BE_0_LEV',     'Adómentes belföldi beszerzés (mentes)', 0, 'INBOUND', true, false, false, 130,
       '[{"row": "63", "col": "base"}]'::jsonb),
      (p_company_id, 'BE_FORD_27',   'FAD Építőipari / fordított adózás 27%', 27, 'INBOUND', true, true, false, 200,
       '[{"row": "29", "col": "base"}, {"row": "29", "col": "tax"}, {"row": "66", "col": "base"}, {"row": "66", "col": "tax"}]'::jsonb),
      (p_company_id, 'EU_SZOLG_BE',  'EU szolgáltatás igénybevétel 27%', 27, 'INBOUND', true, false, true, 300,
       '[{"row": "18", "col": "base"}, {"row": "18", "col": "tax"}, {"row": "67", "col": "base"}, {"row": "67", "col": "tax"}]'::jsonb),
      (p_company_id, 'EU_TERM_27',   'EU termékbeszerzés 27%', 27, 'INBOUND', true, false, true, 310,
       '[{"row": "14", "col": "base"}, {"row": "14", "col": "tax"}, {"row": "69", "col": "base"}, {"row": "69", "col": "tax"}]'::jsonb),
      (p_company_id, 'EU_TERM_18',   'EU termékbeszerzés 18%', 18, 'INBOUND', true, false, true, 320,
       '[{"row": "13", "col": "base"}, {"row": "13", "col": "tax"}, {"row": "69", "col": "base"}, {"row": "69", "col": "tax"}]'::jsonb),
      (p_company_id, 'EU_TERM_5',    'EU termékbeszerzés 5%', 5, 'INBOUND', true, false, true, 330,
       '[{"row": "12", "col": "base"}, {"row": "12", "col": "tax"}, {"row": "69", "col": "base"}, {"row": "69", "col": "tax"}]'::jsonb),
      (p_company_id, 'HARM_SZOLG',   '3. ország szolgáltatás igénybevétel 27%', 27, 'INBOUND', true, false, false, 400,
       '[{"row": "27", "col": "base"}, {"row": "27", "col": "tax"}, {"row": "67", "col": "base"}, {"row": "67", "col": "tax"}]'::jsonb)
    ON CONFLICT (company_id, code) DO UPDATE SET
      label = EXCLUDED.label,
      target_rows = EXCLUDED.target_rows,
      vat_percent = EXCLUDED.vat_percent,
      direction = EXCLUDED.direction,
      is_deductible = EXCLUDED.is_deductible,
      is_reverse_charge = EXCLUDED.is_reverse_charge,
      is_eu = EXCLUDED.is_eu,
      sort_order = EXCLUDED.sort_order;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.seed_default_vat_codes(uuid) TO authenticated, service_role;

-- 4. Clean up and re-seed D-INVOICE D.O.O if needed
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies WHERE country_code = 'HR' LOOP
    -- Delete Hungarian default codes for HR company so it gets clean Croatian codes
    DELETE FROM public.vat_codes 
    WHERE company_id = r.id 
      AND code IN ('KIM_27', 'KIM_18', 'KIM_5', 'KIM_FORD', 'KIM_EXPORT', 'KIM_EU', 'KIM_TAM', 'KIM_ATHK', 'KIM_EU_SZOLG', 'BE_27_LEV', 'BE_18_LEV', 'BE_5_LEV', 'BE_0_LEV', 'BE_FORD_27', 'EU_SZOLG_BE', 'EU_TERM_27', 'EU_TERM_18', 'EU_TERM_5', 'HARM_SZOLG');
    
    PERFORM public.seed_default_vat_codes(r.id);
  END LOOP;
END $$;
