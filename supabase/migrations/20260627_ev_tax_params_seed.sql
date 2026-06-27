-- =============================================================================
-- EV adóévi konstansok — accounty_global_tax_params seed
-- =============================================================================
-- A meglévő accounty_global_tax_params tábla bővítése az egyéni vállalkozókra
-- vonatkozó adóévi paraméterekkel. Jogszabályi hivatkozások: Szja tv. 50-56. §,
-- 49/B-49/C. §, KATA tv. 7-8. §, Áfa tv. 188. §, HIPA tv.
--
-- NAMING: Minden eAisyBooks-specifikus tábla az "accounty_" prefixet kapja.
-- =============================================================================

-- Ellenőrizzük, hogy létezik-e a accounty_global_tax_params tábla
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounty_global_tax_params') THEN
    CREATE TABLE accounty_global_tax_params (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      param_key TEXT NOT NULL,
      tax_year INT NOT NULL,
      param_value NUMERIC NOT NULL,
      description TEXT,
      legal_reference TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(param_key, tax_year)
    );
  END IF;
END $$;

-- RLS mindig újra létrehozás (DROP IF EXISTS + CREATE)
ALTER TABLE accounty_global_tax_params ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounty_global_tax_params_read" ON accounty_global_tax_params;
DROP POLICY IF EXISTS "accounty_global_tax_params_select" ON accounty_global_tax_params;
DROP POLICY IF EXISTS "accounty_global_tax_params_insert" ON accounty_global_tax_params;
DROP POLICY IF EXISTS "accounty_global_tax_params_update" ON accounty_global_tax_params;

-- SELECT: bármely hozzárendelt könyvelő olvashatja
CREATE POLICY "accounty_global_tax_params_select" ON accounty_global_tax_params
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );
-- INSERT: csak iroda_admin
CREATE POLICY "accounty_global_tax_params_insert" ON accounty_global_tax_params
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'iroda_admin'
    )
  );
-- UPDATE: csak iroda_admin
CREATE POLICY "accounty_global_tax_params_update" ON accounty_global_tax_params
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'iroda_admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Átalányadózás — Szja tv. 50-53. §
-- ─────────────────────────────────────────────────────────────────────────────

-- Költséghányad kulcsok
INSERT INTO accounty_global_tax_params (param_key, tax_year, param_value, description, legal_reference) VALUES
  ('atalany_koltseghaanyad_45', 2025, 0.40, 'Átalány költséghányad általános (40%)', 'Szja tv. 53. § (1) a)'),
  ('atalany_koltseghaanyad_45', 2026, 0.45, 'Átalány költséghányad általános (45%)', 'Szja tv. 53. § (1) a)'),
  ('atalany_koltseghaanyad_45', 2027, 0.50, 'Átalány költséghányad általános (50%)', 'Szja tv. 53. § (1) a) — tervezet'),

  ('atalany_koltseghaanyad_80', 2025, 0.80, 'Átalány költséghányad magasabb (80%)', 'Szja tv. 53. § (1) b)'),
  ('atalany_koltseghaanyad_80', 2026, 0.80, 'Átalány költséghányad magasabb (80%)', 'Szja tv. 53. § (1) b)'),
  ('atalany_koltseghaanyad_80', 2027, 0.80, 'Átalány költséghányad magasabb (80%)', 'Szja tv. 53. § (1) b)'),

  ('atalany_koltseghaanyad_90', 2025, 0.90, 'Átalány költséghányad kiskereskedelmi (90%)', 'Szja tv. 53. § (1) c)'),
  ('atalany_koltseghaanyad_90', 2026, 0.90, 'Átalány költséghányad kiskereskedelmi (90%)', 'Szja tv. 53. § (1) c)'),
  ('atalany_koltseghaanyad_90', 2027, 0.90, 'Átalány költséghányad kiskereskedelmi (90%)', 'Szja tv. 53. § (1) c)')
ON CONFLICT (param_key, tax_year) DO UPDATE SET
  param_value = EXCLUDED.param_value,
  description = EXCLUDED.description,
  legal_reference = EXCLUDED.legal_reference;

-- Átalány bevételi határok
INSERT INTO accounty_global_tax_params (param_key, tax_year, param_value, description, legal_reference) VALUES
  ('atalany_bevetel_hatar', 2025, 36000000, 'Átalányadó bevételi felső határ (36 M Ft)', 'Szja tv. 50. § (1)'),
  ('atalany_bevetel_hatar', 2026, 38736000, 'Átalányadó bevételi felső határ (38.736 M Ft)', 'Szja tv. 50. § (1)'),

  ('atalany_kisker_hatar', 2025, 180000000, 'Kiskereskedelmi átalány bevételi határ (180 M Ft)', 'Szja tv. 50. § (2)'),
  ('atalany_kisker_hatar', 2026, 193680000, 'Kiskereskedelmi átalány bevételi határ (193.68 M Ft)', 'Szja tv. 50. § (2)')
ON CONFLICT (param_key, tax_year) DO UPDATE SET
  param_value = EXCLUDED.param_value,
  description = EXCLUDED.description,
  legal_reference = EXCLUDED.legal_reference;

-- ─────────────────────────────────────────────────────────────────────────────
-- KATA — Kisadózó tételes adó (KATA tv. 7-8. §)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounty_global_tax_params (param_key, tax_year, param_value, description, legal_reference) VALUES
  ('kata_havi_tetel', 2025, 50000, 'KATA havi tételes adó (50.000 Ft)', 'KATA tv. 7. §'),
  ('kata_havi_tetel', 2026, 50000, 'KATA havi tételes adó (50.000 Ft)', 'KATA tv. 7. §'),

  ('kata_eves_keret', 2025, 18000000, 'KATA éves bevételi keret (18 M Ft)', 'KATA tv. 8. § (1)'),
  ('kata_eves_keret', 2026, 18000000, 'KATA éves bevételi keret (18 M Ft)', 'KATA tv. 8. § (1)'),

  ('kata_kulonado_kulcs', 2025, 0.40, 'KATA keret feletti különadó (40%)', 'KATA tv. 8. § (2)'),
  ('kata_kulonado_kulcs', 2026, 0.40, 'KATA keret feletti különadó (40%)', 'KATA tv. 8. § (2)')
ON CONFLICT (param_key, tax_year) DO UPDATE SET
  param_value = EXCLUDED.param_value,
  description = EXCLUDED.description,
  legal_reference = EXCLUDED.legal_reference;

-- ─────────────────────────────────────────────────────────────────────────────
-- Vállalkozói SZJA — Szja tv. 49/B-49/C. §
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounty_global_tax_params (param_key, tax_year, param_value, description, legal_reference) VALUES
  ('vszja_adokulcs', 2025, 0.09, 'Vállalkozói SZJA kulcs (9%)', 'Szja tv. 49/B. § (9)'),
  ('vszja_adokulcs', 2026, 0.09, 'Vállalkozói SZJA kulcs (9%)', 'Szja tv. 49/B. § (9)'),

  ('vszja_osztalekado', 2025, 0.15, 'Vállalkozói osztalékalap utáni SZJA (15%)', 'Szja tv. 49/C. § (3)'),
  ('vszja_osztalekado', 2026, 0.15, 'Vállalkozói osztalékalap utáni SZJA (15%)', 'Szja tv. 49/C. § (3)')
ON CONFLICT (param_key, tax_year) DO UPDATE SET
  param_value = EXCLUDED.param_value,
  description = EXCLUDED.description,
  legal_reference = EXCLUDED.legal_reference;

-- ─────────────────────────────────────────────────────────────────────────────
-- ÁFA határ — Áfa tv. 188. §
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounty_global_tax_params (param_key, tax_year, param_value, description, legal_reference) VALUES
  ('afa_alanyi_hatar', 2025, 18000000, 'ÁFA alanyi mentesség határ (18 M Ft)', 'Áfa tv. 188. § (1)'),
  ('afa_alanyi_hatar', 2026, 20000000, 'ÁFA alanyi mentesség határ (20 M Ft)', 'Áfa tv. 188. § (1)'),
  ('afa_alanyi_hatar', 2027, 22000000, 'ÁFA alanyi mentesség határ (22 M Ft) — tervezet', 'Áfa tv. 188. § (1)')
ON CONFLICT (param_key, tax_year) DO UPDATE SET
  param_value = EXCLUDED.param_value,
  description = EXCLUDED.description,
  legal_reference = EXCLUDED.legal_reference;

-- ─────────────────────────────────────────────────────────────────────────────
-- SZJA adómentes rész — Szja tv. 1. számú melléklet
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounty_global_tax_params (param_key, tax_year, param_value, description, legal_reference) VALUES
  ('adomentes_resz', 2025, 1600800, 'Átalány adómentes jövedelemrész (éves minimálbér fele: 266800 × 12 / 2 = 1.600.800 Ft)', 'Szja tv. 50. § (4)'),
  ('adomentes_resz', 2026, 1936800, 'Átalány adómentes jövedelemrész (éves minimálbér fele: 322800 × 12 / 2 = 1.936.800 Ft)', 'Szja tv. 50. § (4)')
ON CONFLICT (param_key, tax_year) DO UPDATE SET
  param_value = EXCLUDED.param_value,
  description = EXCLUDED.description,
  legal_reference = EXCLUDED.legal_reference;

-- ─────────────────────────────────────────────────────────────────────────────
-- HIPA egyszerűsített sávok — 2022. évi XLV. tv.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounty_global_tax_params (param_key, tax_year, param_value, description, legal_reference) VALUES
  -- 12 M Ft árbevétel alatti sáv
  ('hipa_sav_12m', 2025, 50000, 'HIPA egyszerűsített - 12M alatti sáv (50.000 Ft)', '2022. évi XLV. tv.'),
  ('hipa_sav_12m', 2026, 50000, 'HIPA egyszerűsített - 12M alatti sáv (50.000 Ft)', '2022. évi XLV. tv.'),

  -- 12-18 M Ft árbevétel sáv
  ('hipa_sav_18m', 2025, 120000, 'HIPA egyszerűsített - 12-18M sáv (120.000 Ft)', '2022. évi XLV. tv.'),
  ('hipa_sav_18m', 2026, 120000, 'HIPA egyszerűsített - 12-18M sáv (120.000 Ft)', '2022. évi XLV. tv.'),

  -- 18-25 M Ft árbevétel sáv
  ('hipa_sav_25m', 2025, 170000, 'HIPA egyszerűsített - 18-25M sáv (170.000 Ft)', '2022. évi XLV. tv.'),
  ('hipa_sav_25m', 2026, 170000, 'HIPA egyszerűsített - 18-25M sáv (170.000 Ft)', '2022. évi XLV. tv.')
ON CONFLICT (param_key, tax_year) DO UPDATE SET
  param_value = EXCLUDED.param_value,
  description = EXCLUDED.description,
  legal_reference = EXCLUDED.legal_reference;

-- ─────────────────────────────────────────────────────────────────────────────
-- Kamarai hozzájárulás — 2011. évi CLXVI. tv.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounty_global_tax_params (param_key, tax_year, param_value, description, legal_reference) VALUES
  ('kamarai_hozzajarulas', 2025, 5000, 'Kamarai hozzájárulás (5.000 Ft/év)', '2011. évi CLXVI. tv.'),
  ('kamarai_hozzajarulas', 2026, 5000, 'Kamarai hozzájárulás (5.000 Ft/év)', '2011. évi CLXVI. tv.')
ON CONFLICT (param_key, tax_year) DO UPDATE SET
  param_value = EXCLUDED.param_value,
  description = EXCLUDED.description,
  legal_reference = EXCLUDED.legal_reference;

-- ─────────────────────────────────────────────────────────────────────────────
-- TB-járulék & Szocho paraméterek — Tbj. tv. + Szocho tv.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounty_global_tax_params (param_key, tax_year, param_value, description, legal_reference) VALUES
  ('tb_jarulekkulcs', 2025, 0.185, 'TB-járulék kulcs (18,5%)', 'Tbj. tv. 27. § (1)'),
  ('tb_jarulekkulcs', 2026, 0.185, 'TB-járulék kulcs (18,5%)', 'Tbj. tv. 27. § (1)'),

  ('szocho_kulcs', 2025, 0.13, 'Szociális hozzájárulási adó (13%)', '2018. évi LII. tv. 2. §'),
  ('szocho_kulcs', 2026, 0.13, 'Szociális hozzájárulási adó (13%)', '2018. évi LII. tv. 2. §'),

  ('minimalber_havi', 2025, 266800, 'Minimálbér (havi, 2025)', '2024. évi kormányrendelet'),
  ('minimalber_havi', 2026, 322800, 'Minimálbér (havi, 2026)', '2025. évi kormányrendelet'),

  ('garantalt_berminimum_havi', 2025, 326000, 'Garantált bérminimum (havi, 2025)', '2024. évi kormányrendelet'),
  ('garantalt_berminimum_havi', 2026, 373200, 'Garantált bérminimum (havi, 2026)', '2025. évi kormányrendelet'),

  -- 2026-tól a szocho minimum 100% (korábban 112.5%)
  ('szocho_minimum_szorzo', 2025, 1.125, 'Szocho minimum szorzó (112,5%)', '2018. évi LII. tv.'),
  ('szocho_minimum_szorzo', 2026, 1.00, 'Szocho minimum szorzó (100%) — 2026-tól', '2018. évi LII. tv.')
ON CONFLICT (param_key, tax_year) DO UPDATE SET
  param_value = EXCLUDED.param_value,
  description = EXCLUDED.description,
  legal_reference = EXCLUDED.legal_reference;

-- ─────────────────────────────────────────────────────────────────────────────
-- Személyi jövedelemadó — Szja tv.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounty_global_tax_params (param_key, tax_year, param_value, description, legal_reference) VALUES
  ('szja_kulcs', 2025, 0.15, 'Személyi jövedelemadó kulcs (15%)', 'Szja tv. 8. § (1)'),
  ('szja_kulcs', 2026, 0.15, 'Személyi jövedelemadó kulcs (15%)', 'Szja tv. 8. § (1)')
ON CONFLICT (param_key, tax_year) DO UPDATE SET
  param_value = EXCLUDED.param_value,
  description = EXCLUDED.description,
  legal_reference = EXCLUDED.legal_reference;

-- ─────────────────────────────────────────────────────────────────────────────
-- Szocho-plafon & éves minimálbér — kiegészítő konstansok
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounty_global_tax_params (param_key, tax_year, param_value, description, legal_reference) VALUES
  -- Szocho-plafon (minimálbér 24-szerese) — osztalékalapnál releváns
  ('szocho_plafon', 2025, 6403200, 'Szocho-plafon (minimálbér 24× = 266800 × 24 = 6.403.200 Ft)', 'Szocho tv. 2. § (4)'),
  ('szocho_plafon', 2026, 7747200, 'Szocho-plafon (minimálbér 24× = 322800 × 24 = 7.747.200 Ft)', 'Szocho tv. 2. § (4)'),

  -- Éves minimálbér (számítási alap átalány-határokhoz)
  ('minimalber_eves', 2025, 3201600, 'Éves minimálbér (266800 × 12 = 3.201.600 Ft)', '2024. évi kormányrendelet'),
  ('minimalber_eves', 2026, 3873600, 'Éves minimálbér (322800 × 12 = 3.873.600 Ft)', '426/2025. (XII. 23.) Korm. rendelet'),

  -- Éves garantált bérminimum
  ('garantalt_berminimum_eves', 2025, 3912000, 'Éves garantált bérminimum (326000 × 12 = 3.912.000 Ft)', '2024. évi kormányrendelet'),
  ('garantalt_berminimum_eves', 2026, 4478400, 'Éves garantált bérminimum (373200 × 12 = 4.478.400 Ft)', '426/2025. (XII. 23.) Korm. rendelet')
ON CONFLICT (param_key, tax_year) DO UPDATE SET
  param_value = EXCLUDED.param_value,
  description = EXCLUDED.description,
  legal_reference = EXCLUDED.legal_reference;
