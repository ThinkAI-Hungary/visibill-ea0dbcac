-- ============================================================================
-- SEED EV TAX PARAMETERS (2025 & 2026)
-- ============================================================================
-- Adóforma-összehasonlítás és egyéni vállalkozói kalkulációk paraméterei
-- ============================================================================

INSERT INTO public.accounty_tax_parameters (tax_year, parameter_key, parameter_value, description, legal_reference) VALUES
  -- 2025 ADÓÉV PARAMÉTEREI
  (2025, 'szja_rate', 0.15, 'Személyi jövedelemadó kulcs (15%)', 'Szja tv.'),
  (2025, 'vszja_rate', 0.09, 'Vállalkozói SZJA kulcs (9%)', 'Szja tv. 49/B. §'),
  (2025, 'tb_rate', 0.185, 'Társadalombiztosítási járulék (18.5%)', 'Tbj.'),
  (2025, 'szocho_rate', 0.13, 'Szociális hozzájárulási adó (13%)', 'Szocho tv.'),
  (2025, 'minimum_wage', 266800, 'Minimálbér (2025)', 'Korm. rendelet'),
  (2025, 'guaranteed_minimum', 326000, 'Garantált bérminimum (2025)', 'Korm. rendelet'),
  
  (2025, 'atalany_koltseghanyad_general', 0.40, 'Átalányadó általános költséghányad (40%)', 'Szja tv. 53. §'),
  (2025, 'atalany_koltseghanyad_high', 0.80, 'Átalányadó kiemelt költséghányad (80%)', 'Szja tv. 53. §'),
  (2025, 'atalany_koltseghanyad_retail', 0.90, 'Átalányadó kiskereskedelmi költséghányad (90%)', 'Szja tv. 53. §'),
  (2025, 'atalany_bevetel_hatar', 36000000, 'Átalányadó éves bevételi határ (2025)', 'Szja tv. 52. §'),
  (2025, 'atalany_kisker_hatar', 180000000, 'Átalányadó éves kisker. bevételi határ (2025)', 'Szja tv. 52. §'),
  (2025, 'atalany_adomentes_resz', 1600800, 'Átalányadó éves adómentes jövedelemrész (2025)', 'Szja tv. 51. §'),
  
  (2025, 'kata_monthly_tax', 50000, 'KATA havi tételes adó (2025)', 'KATA tv.'),
  (2025, 'kata_eves_keret', 18000000, 'KATA éves bevételi keret (2025)', 'KATA tv.'),
  (2025, 'kata_kulonado_kulcs', 0.40, 'KATA keret feletti adókulcs (40%)', 'KATA tv.'),
  (2025, 'afa_alanyi_hatar', 18000000, 'ÁFA alanyi mentesség felső határa (2025)', 'Áfa tv.'),
  
  (2025, 'hipa_sav_12m', 50000, 'HIPA sávos adó 12M HUF árbevételig', 'Helyi adókról szóló tv.'),
  (2025, 'hipa_sav_18m', 120000, 'HIPA sávos adó 18M HUF árbevételig', 'Helyi adókról szóló tv.'),
  (2025, 'hipa_sav_25m', 170000, 'HIPA sávos adó 25M HUF árbevételig', 'Helyi adókról szóló tv.'),
  (2025, 'chamber_contribution', 5000, 'Iparkamarai kötelező hozzájárulás (Ft/év)', 'Kamarai tv.'),

  -- 2026 ADÓÉV PARAMÉTEREI (kiegészítés az EV-specifikus és hiányzó kulcsokkal)
  (2026, 'vszja_rate', 0.09, 'Vállalkozói SZJA kulcs (9%)', 'Szja tv. 49/B. §'),
  (2026, 'atalany_koltseghanyad_general', 0.45, 'Átalányadó általános költséghányad (45%)', 'Szja tv. 53. §'),
  (2026, 'atalany_koltseghanyad_high', 0.80, 'Átalányadó kiemelt költséghányad (80%)', 'Szja tv. 53. §'),
  (2026, 'atalany_koltseghanyad_retail', 0.90, 'Átalányadó kiskereskedelmi költséghányad (90%)', 'Szja tv. 53. §'),
  (2026, 'atalany_bevetel_hatar', 38736000, 'Átalányadó éves bevételi határ (2026)', 'Szja tv. 52. §'),
  (2026, 'atalany_kisker_hatar', 193680000, 'Átalányadó éves kisker. bevételi határ (2026)', 'Szja tv. 52. §'),
  (2026, 'atalany_adomentes_resz', 1936800, 'Átalányadó éves adómentes jövedelemrész (2026)', 'Szja tv. 51. §'),
  (2026, 'afa_alanyi_hatar', 20000000, 'ÁFA alanyi mentesség felső határa (2026)', 'Áfa tv.'),
  
  (2026, 'hipa_sav_12m', 50000, 'HIPA sávos adó 12M HUF árbevételig (2026)', 'Helyi adókról szóló tv.'),
  (2026, 'hipa_sav_18m', 120000, 'HIPA sávos adó 18M HUF árbevételig (2026)', 'Helyi adókról szóló tv.'),
  (2026, 'hipa_sav_25m', 170000, 'HIPA sávos adó 25M HUF árbevételig (2026)', 'Helyi adókról szóló tv.'),
  
  -- Biztonsági szinonimák 2026-ra a meglévő bérszámfejtési kulcsok leképezéséhez
  (2026, 'kata_eves_keret', 18000000, 'KATA éves bevételi keret (2026)', 'KATA tv.'),
  (2026, 'kata_kulonado_kulcs', 0.40, 'KATA keret feletti adókulcs (40%)', 'KATA tv.')

ON CONFLICT (tax_year, parameter_key) DO UPDATE SET
  parameter_value = EXCLUDED.parameter_value,
  description = EXCLUDED.description,
  legal_reference = EXCLUDED.legal_reference;
