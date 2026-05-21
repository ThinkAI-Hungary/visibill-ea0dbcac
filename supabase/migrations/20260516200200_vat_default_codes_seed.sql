-- ============================================================
-- ÁFA BEVALLÁS — Seed: Alapértelmezett Áfakódok
-- ============================================================
-- Ezeket az áfakódokat automatikusan létrehozzuk minden új cégnek.
-- A könyvelő testreszabhatja a mapping UI-on.
-- 
-- A target_rows megmondja: melyik 2665-ös sorba kerül az adóalap ("base") és adó ("tax")

CREATE OR REPLACE FUNCTION seed_default_vat_codes(p_company_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO vat_codes (company_id, code, label, vat_percent, direction, is_deductible, is_reverse_charge, is_eu, target_rows, sort_order)
  VALUES
    -- KIMENŐ (értékesítés) — Fizetendő ÁFA
    (p_company_id, 'KIM_0',     'Kimenő adómentes',    0.00, 'OUTBOUND', false, false, false,
     '[{"row":"04","col":"base"}]'::jsonb, 10),
    (p_company_id, 'KIM_5',     'Kimenő 5%',          5.00, 'OUTBOUND', false, false, false,
     '[{"row":"05","col":"base"},{"row":"05","col":"tax"}]'::jsonb, 20),
    (p_company_id, 'KIM_18',    'Kimenő 18%',        18.00, 'OUTBOUND', false, false, false,
     '[{"row":"06","col":"base"},{"row":"06","col":"tax"}]'::jsonb, 30),
    (p_company_id, 'KIM_27',    'Kimenő 27%',        27.00, 'OUTBOUND', false, false, false,
     '[{"row":"07","col":"base"},{"row":"07","col":"tax"}]'::jsonb, 40),
    (p_company_id, 'KIM_EXPORT','Kimenő export (EU-n kívül)', 0.00, 'OUTBOUND', false, false, false,
     '[{"row":"01","col":"base"}]'::jsonb, 50),
    (p_company_id, 'KIM_EU',    'Kimenő EU közösségi', 0.00, 'OUTBOUND', false, false, true,
     '[{"row":"02","col":"base"}]'::jsonb, 60),

    -- BEJÖVŐ (beszerzés) — Levonható ÁFA
    (p_company_id, 'BE_0_LEV',  'Bejövő adómentes belföldi', 0.00, 'INBOUND', true, false, false,
     '[{"row":"63","col":"base"}]'::jsonb, 100),
    (p_company_id, 'BE_5_LEV',  'Bejövő 5% levonható', 5.00, 'INBOUND', true, false, false,
     '[{"row":"64","col":"base"},{"row":"64","col":"tax"}]'::jsonb, 110),
    (p_company_id, 'BE_18_LEV', 'Bejövő 18% levonható', 18.00, 'INBOUND', true, false, false,
     '[{"row":"65","col":"base"},{"row":"65","col":"tax"}]'::jsonb, 120),
    (p_company_id, 'BE_27_LEV', 'Bejövő 27% levonható', 27.00, 'INBOUND', true, false, false,
     '[{"row":"66","col":"base"},{"row":"66","col":"tax"}]'::jsonb, 130),
    (p_company_id, 'BE_0_NEM',  'Bejövő adómentes (nem levonható)', 0.00, 'INBOUND', false, false, false,
     '[{"row":"08","col":"base"}]'::jsonb, 140),

    -- FORDÍTOTT ADÓZÁS (bejövő, de fizetendő ÉS levonható)
    (p_company_id, 'BE_FORD_27','Bejövő fordított 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 200),
    (p_company_id, 'BE_FORD_5', 'Bejövő fordított 5%',  5.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 210),

    -- EU SZOLGÁLTATÁS IGÉNYBEVÉTEL (fizetendő ÉS levonható)
    (p_company_id, 'EU_SZOLG_BE','EU szolgáltatás igénybevétel 27%', 27.00, 'INBOUND', true, false, true,
     '[{"row":"18","col":"base"},{"row":"18","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 300),

    -- EU TERMÉKBESZERZÉS (fizetendő ÉS levonható)
    (p_company_id, 'EU_TERM_5', 'EU termékbeszerzés 5%', 5.00, 'INBOUND', true, false, true,
     '[{"row":"12","col":"base"},{"row":"12","col":"tax"},{"row":"69","col":"base"},{"row":"69","col":"tax"}]'::jsonb, 310),
    (p_company_id, 'EU_TERM_18','EU termékbeszerzés 18%', 18.00, 'INBOUND', true, false, true,
     '[{"row":"13","col":"base"},{"row":"13","col":"tax"},{"row":"69","col":"base"},{"row":"69","col":"tax"}]'::jsonb, 320),
    (p_company_id, 'EU_TERM_27','EU termékbeszerzés 27%', 27.00, 'INBOUND', true, false, true,
     '[{"row":"14","col":"base"},{"row":"14","col":"tax"},{"row":"69","col":"base"},{"row":"69","col":"tax"}]'::jsonb, 330),

    -- HARMADIK ORSZÁGBÓL (fizetendő ÉS levonható)
    (p_company_id, 'HARM_SZOLG','3. ország szolgáltatás 27%', 27.00, 'INBOUND', true, false, false,
     '[{"row":"27","col":"base"},{"row":"27","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 400)
  ON CONFLICT (company_id, code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
