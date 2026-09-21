-- Migration: 20260921150000_add_vat_code_legacy_code_and_display_mode.sql
-- Description: Add legacy_code to vat_codes and vat_code_display_mode to company_settings

-- 1. Add legacy_code column to vat_codes table
ALTER TABLE public.vat_codes
ADD COLUMN IF NOT EXISTS legacy_code text DEFAULT NULL;

-- 2. Add vat_code_display_mode to company_settings table
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS vat_code_display_mode text NOT NULL DEFAULT 'legacy';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_settings_vat_code_display_mode_check'
  ) THEN
    ALTER TABLE public.company_settings
    ADD CONSTRAINT company_settings_vat_code_display_mode_check
    CHECK (vat_code_display_mode IN ('legacy', 'nav'));
  END IF;
END;
$$;

-- 3. Backfill legacy_code on existing vat_codes records
-- Outbound (Kimenő) codes
UPDATE public.vat_codes SET legacy_code = '25'   WHERE code = 'KIM_27' AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = '18'   WHERE code = 'KIM_18' AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = '05'   WHERE code = 'KIM_5' AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = 'FAD'  WHERE code = 'KIM_FORD' AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = 'EXP'  WHERE code = 'KIM_EXPORT' AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = 'EU'   WHERE code = 'KIM_EU' AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = 'TAM'  WHERE (code = 'KIM_TAM' OR code = 'KIM_0') AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = 'ATHK' WHERE code = 'KIM_ATHK' AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = 'EUK'  WHERE code = 'KIM_EU_SZOLG' AND (legacy_code IS NULL OR legacy_code = '');

-- Inbound (Bejövő) codes
UPDATE public.vat_codes SET legacy_code = '25'   WHERE code = 'BE_27_LEV' AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = '18'   WHERE code = 'BE_18_LEV' AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = '05'   WHERE code = 'BE_5_LEV' AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = 'TAM'  WHERE (code = 'BE_0_LEV' OR code = 'BE_0_NEM') AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = 'FAD'  WHERE (code = 'BE_FORD_27' OR code = 'BE_FORD_5' OR code LIKE 'FAD_%') AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = '18'   WHERE code = 'EU_SZOLG_BE' AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = '14'   WHERE code = 'EU_TERM_27' AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = '13'   WHERE code = 'EU_TERM_18' AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = '12'   WHERE code = 'EU_TERM_5' AND (legacy_code IS NULL OR legacy_code = '');
UPDATE public.vat_codes SET legacy_code = '27'   WHERE code = 'HARM_SZOLG' AND (legacy_code IS NULL OR legacy_code = '');

-- Fallback for any other custom vat_codes
UPDATE public.vat_codes SET legacy_code = 'FAD' WHERE is_reverse_charge IS TRUE AND legacy_code IS NULL;
UPDATE public.vat_codes SET legacy_code = '25'  WHERE vat_percent = 27.00 AND legacy_code IS NULL;
UPDATE public.vat_codes SET legacy_code = '18'  WHERE vat_percent = 18.00 AND legacy_code IS NULL;
UPDATE public.vat_codes SET legacy_code = '05'  WHERE vat_percent = 5.00 AND legacy_code IS NULL;
UPDATE public.vat_codes SET legacy_code = 'TAM' WHERE vat_percent = 0.00 AND legacy_code IS NULL;

-- 4. Update seed_default_vat_codes function to include legacy_code
CREATE OR REPLACE FUNCTION public.seed_default_vat_codes(p_company_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.vat_codes (company_id, code, legacy_code, label, vat_percent, direction, is_deductible, is_reverse_charge, is_eu, target_rows, sort_order)
  VALUES
    -- KIMENŐ (értékesítés) — Fizetendő ÁFA
    (p_company_id, 'KIM_0',      'TAM',  'Kimenő adómentes',    0.00, 'OUTBOUND', false, false, false,
     '[{"row":"04","col":"base"}]'::jsonb, 10),
    (p_company_id, 'KIM_5',      '05',   'Kimenő 5%',          5.00, 'OUTBOUND', false, false, false,
     '[{"row":"05","col":"base"},{"row":"05","col":"tax"}]'::jsonb, 20),
    (p_company_id, 'KIM_18',     '18',   'Kimenő 18%',        18.00, 'OUTBOUND', false, false, false,
     '[{"row":"06","col":"base"},{"row":"06","col":"tax"}]'::jsonb, 30),
    (p_company_id, 'KIM_27',     '25',   'Kimenő 27%',        27.00, 'OUTBOUND', false, false, false,
     '[{"row":"07","col":"base"},{"row":"07","col":"tax"}]'::jsonb, 40),
    (p_company_id, 'KIM_EXPORT', 'EXP',  'Kimenő export (EU-n kívül)', 0.00, 'OUTBOUND', false, false, false,
     '[{"row":"01","col":"base"}]'::jsonb, 50),
    (p_company_id, 'KIM_EU',     'EU',   'Kimenő EU közösségi', 0.00, 'OUTBOUND', false, false, true,
     '[{"row":"02","col":"base"}]'::jsonb, 60),
    (p_company_id, 'KIM_FORD',   'FAD',  'Belföldi fordított értékesítés (mentes)', 0.00, 'OUTBOUND', false, true, false,
     '[{"row":"04","col":"base"}]'::jsonb, 70),
    (p_company_id, 'KIM_TAM',    'TAM',  'Közérdekű vagy speciális adómentes (TAM)', 0.00, 'OUTBOUND', false, false, false,
     '[{"row":"08","col":"base"}]'::jsonb, 80),
    (p_company_id, 'KIM_ATHK',   'ATHK', 'ÁFA területi hatályán kívüli SZOLGÁLTATÁSOK (3. ország)', 0.00, 'OUTBOUND', false, false, false,
     '[{"row":"91","col":"base"}]'::jsonb, 90),
    (p_company_id, 'KIM_EU_SZOLG','EUK', 'ÁFA területi hatályán kívüli EU SZOLGÁLTATÁSOK (Áfa tv. 37.§)', 0.00, 'OUTBOUND', false, false, true,
     '[{"row":"92","col":"base"}]'::jsonb, 95),

    -- BEJÖVŐ (beszerzés) — Levonható ÁFA
    (p_company_id, 'BE_0_LEV',   'TAM',  'Bejövő adómentes belföldi', 0.00, 'INBOUND', true, false, false,
     '[{"row":"63","col":"base"}]'::jsonb, 100),
    (p_company_id, 'BE_5_LEV',   '05',   'Bejövő 5% levonható', 5.00, 'INBOUND', true, false, false,
     '[{"row":"64","col":"base"},{"row":"64","col":"tax"}]'::jsonb, 110),
    (p_company_id, 'BE_18_LEV',  '18',   'Bejövő 18% levonható', 18.00, 'INBOUND', true, false, false,
     '[{"row":"65","col":"base"},{"row":"65","col":"tax"}]'::jsonb, 120),
    (p_company_id, 'BE_27_LEV',  '25',   'Bejövő 27% levonható', 27.00, 'INBOUND', true, false, false,
     '[{"row":"66","col":"base"},{"row":"66","col":"tax"}]'::jsonb, 130),
    (p_company_id, 'BE_0_NEM',   'TAM',  'Bejövő adómentes (nem levonható)', 0.00, 'INBOUND', false, false, false,
     '[{"row":"08","col":"base"}]'::jsonb, 140),

    -- FORDÍTOTT ADÓZÁS (bejövő, de fizetendő ÉS levonható)
    (p_company_id, 'BE_FORD_27', 'FAD',  'Bejövő fordított 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 200),
    (p_company_id, 'BE_FORD_5',  'FAD',  'Bejövő fordított 5%',  5.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 210),

    -- EU SZOLGÁLTATÁS IGÉNYBEVÉTEL (fizetendő ÉS levonható)
    (p_company_id, 'EU_SZOLG_BE', '18',  'EU szolgáltatás igénybevétel 27%', 27.00, 'INBOUND', true, false, true,
     '[{"row":"18","col":"base"},{"row":"18","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 300),

    -- EU TERMÉKBESZERZÉS (fizetendő ÉS levonható)
    (p_company_id, 'EU_TERM_5',  '12',   'EU termékbeszerzés 5%', 5.00, 'INBOUND', true, false, true,
     '[{"row":"12","col":"base"},{"row":"12","col":"tax"},{"row":"69","col":"base"},{"row":"69","col":"tax"}]'::jsonb, 310),
    (p_company_id, 'EU_TERM_18', '13',   'EU termékbeszerzés 18%', 18.00, 'INBOUND', true, false, true,
     '[{"row":"13","col":"base"},{"row":"13","col":"tax"},{"row":"69","col":"base"},{"row":"69","col":"tax"}]'::jsonb, 320),
    (p_company_id, 'EU_TERM_27', '14',   'EU termékbeszerzés 27%', 27.00, 'INBOUND', true, false, true,
     '[{"row":"14","col":"base"},{"row":"14","col":"tax"},{"row":"69","col":"base"},{"row":"69","col":"tax"}]'::jsonb, 330),

    -- HARMADIK ORSZÁGBÓL (fizetendő ÉS levonható)
    (p_company_id, 'HARM_SZOLG', '27',   '3. ország szolgáltatás 27%', 27.00, 'INBOUND', true, false, false,
     '[{"row":"27","col":"base"},{"row":"27","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 400)
  ON CONFLICT (company_id, code) DO UPDATE SET
    legacy_code = COALESCE(vat_codes.legacy_code, EXCLUDED.legacy_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.seed_default_vat_codes FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_default_vat_codes TO authenticated;


-- 5. Update seed_fad_vat_codes function to include legacy_code = 'FAD'
CREATE OR REPLACE FUNCTION public.seed_fad_vat_codes(p_company_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.vat_codes (company_id, code, legacy_code, label, vat_percent, direction, is_deductible, is_reverse_charge, is_eu, target_rows, sort_order, fad_category)
  VALUES
    -- Építőipari FAD (142.§ (1) a-b)
    (p_company_id, 'FAD_EPIT_27', 'FAD', 'FAD Építőipari 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 201, 'construction'),
    (p_company_id, 'FAD_EPIT_5',  'FAD', 'FAD Építőipari 5%',   5.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 202, 'construction'),

    -- Hulladék FAD (6. melléklet)
    (p_company_id, 'FAD_HULL_27', 'FAD', 'FAD Hulladék 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"30","col":"base"},{"row":"30","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 211, 'scrap_metal'),

    -- Mezőgazdasági FAD (6/A melléklet)
    (p_company_id, 'FAD_MEZO_27', 'FAD', 'FAD Mezőgazdaság 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"31","col":"base"},{"row":"31","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 221, 'agriculture'),
    (p_company_id, 'FAD_MEZO_5',  'FAD', 'FAD Mezőgazdaság 5%',   5.00, 'INBOUND', true, true, false,
     '[{"row":"31","col":"base"},{"row":"31","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 222, 'agriculture'),

    -- Acélipari FAD (6/B melléklet)
    (p_company_id, 'FAD_ACEL_27', 'FAD', 'FAD Acélipari 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"32","col":"base"},{"row":"32","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 231, 'steel'),

    -- Földgáz FAD
    (p_company_id, 'FAD_GAZ_27',  'FAD', 'FAD Földgáz 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"33","col":"base"},{"row":"33","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 241, 'natural_gas'),

    -- Munkaerő-kölcsönzés (építőipari)
    (p_company_id, 'FAD_MUNKA_27','FAD', 'FAD Munkaerő-kölcsönzés 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 251, 'labor_hire'),

    -- Üvegházhatású gáz kvóta
    (p_company_id, 'FAD_KVOTA_27','FAD', 'FAD Kibocsátási kvóta 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 261, 'emission_quota')
  ON CONFLICT (company_id, code) DO UPDATE SET
    legacy_code = COALESCE(vat_codes.legacy_code, EXCLUDED.legacy_code),
    fad_category = EXCLUDED.fad_category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.seed_fad_vat_codes FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_fad_vat_codes TO authenticated;


-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
