-- ============================================================================
-- ACCOUNTY PAYROLL MODULE - SEED DATA
-- ============================================================================
-- 2026-os jogszabályi paraméterek és jogviszonykódok
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  1. Jogviszonykódok master tábla (NAV)                            ║
-- ╚══════════════════════════════════════════════════════════════════════╝

INSERT INTO public.accounty_job_codes (code, name, is_insured, min_contribution_base_rule, valid_from, description) VALUES
  -- Munkaviszony
  ('1101', 'Munkaviszony (Mt.)', TRUE, 'minimum_wage_or_guaranteed', '1997-01-01', 'Teljes/részmunkaidős munkaviszony az Mt. alapján'),
  ('1102', 'Közszolgálati jogviszony', TRUE, 'minimum_wage_or_guaranteed', '1997-01-01', 'Ktv. szerinti jogviszony'),
  ('1103', 'Közalkalmazotti jogviszony', TRUE, 'minimum_wage_or_guaranteed', '1997-01-01', 'Kjt. szerinti jogviszony'),
  ('1104', 'Bírósági jogviszony', TRUE, 'minimum_wage_or_guaranteed', '1997-01-01', 'Bírák jogviszonyáról szóló tv.'),
  ('1105', 'Ügyészségi szolgálati jogviszony', TRUE, 'minimum_wage_or_guaranteed', '1997-01-01', NULL),
  ('1106', 'Igazságügyi alkalmazotti jogviszony', TRUE, 'minimum_wage_or_guaranteed', '1997-01-01', NULL),
  ('1107', 'Hivatásos szolgálati jogviszony', TRUE, 'minimum_wage_or_guaranteed', '1997-01-01', NULL),

  -- ÚJ 2026: Tartós megbízás
  ('1115', 'Tartós megbízási jogviszony (ÚJ 2026)', TRUE, 'minimum_wage_30pct', '2026-01-01', '2026.01.01-től bevezetett jogviszony. Előzetes bejelentés kötelező, biztosítás a bejelentéstől, min. járulékalap: minimálbér 30%.'),

  -- Szakképzés
  ('1131', 'Szakképzési munkaszerződés', TRUE, 'none', '2020-01-01', 'Szkt. szerinti szakképzési jogviszony, 168.000 Ft-ig SZJA-mentes munkabér'),

  -- Megbízás
  ('1300', 'Megbízási jogviszony (biztosított)', TRUE, 'minimum_wage_30pct', '1997-01-01', 'Ptk. szerinti megbízás, biztosított ha a díj eléri a minimálbér 30%-át (96.840 Ft)'),
  ('1301', 'Megbízási jogviszony (nem biztosított)', FALSE, 'none', '1997-01-01', 'Nem éri el a 30%-os küszöböt, csak SZJA-előleg'),

  -- Társas vállalkozó
  ('1452', 'Társas vállalkozó (személyesen közreműködő tag)', TRUE, 'minimum_wage_full', '1997-01-01', 'Kkt./Bt./Kft. személyesen közreműködő tagja. Min. járulékalap: minimálbér (ill. garantált bérminimum).'),
  ('1453', 'Társas vállalkozó (választott tisztségviselő)', TRUE, 'minimum_wage_full', '1997-01-01', NULL),

  -- Egyéni vállalkozó
  ('1470', 'Egyéni vállalkozó (főállás)', TRUE, 'minimum_wage_full', '1997-01-01', 'Főállású EV. Min. járulékalap: minimálbér / garantált bérminimum.'),
  ('1471', 'Egyéni vállalkozó (melléktevékenység)', FALSE, 'none', '1997-01-01', 'Heti 36 órás munkaviszony melletti EV, csak EHO'),

  -- Saját jogú nyugdíjas
  ('1500', 'Nyugdíjas munkaviszony', FALSE, 'none', '1997-01-01', 'Csak 15% SZJA, nincs TB/SZOCHO (speciális szabály 2026: nyugdíjas anyák SZOCHO)'),

  -- Közfoglalkoztatás
  ('1600', 'Közfoglalkoztatási jogviszony', TRUE, 'kozfogl_rule', '2011-01-01', 'Közfoglalkoztatási bér: minimálbér 50%, SZOCHO-kedvezmény')

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  is_insured = EXCLUDED.is_insured,
  min_contribution_base_rule = EXCLUDED.min_contribution_base_rule,
  valid_from = EXCLUDED.valid_from,
  description = EXCLUDED.description;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  2. 2026-os jogszabályi paramétertábla                            ║
-- ║  Forrás: 14. fejezet (Rendszerspecifikáció) + v2 Screens          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

INSERT INTO public.accounty_tax_parameters (tax_year, parameter_key, parameter_value, description, legal_reference) VALUES
  -- Alapbérek
  (2026, 'minimum_wage', 322800, 'Minimálbér (Ft/hó)', '426/2025. Korm. rendelet'),
  (2026, 'guaranteed_minimum', 373200, 'Garantált bérminimum (Ft/hó)', '426/2025. Korm. rendelet'),
  (2026, 'minimum_wage_annual', 3873600, 'Minimálbér éves (Ft/év)', '426/2025. Korm. rendelet'),

  -- Adókulcsok
  (2026, 'szja_rate', 0.15, 'Személyi jövedelemadó kulcs (15%)', 'Szja tv.'),
  (2026, 'tb_rate', 0.185, 'Társadalombiztosítási járulék (18.5%)', 'Tbj.'),
  (2026, 'szocho_rate', 0.13, 'Szociális hozzájárulási adó (13%)', 'Szocho tv.'),

  -- Családi kedvezmény (2026 duplázás)
  (2026, 'family_1_child', 133340, 'Családi kedv. 1 gyermek: adóalap-csökkentés (Ft/hó)', 'Szja tv. (2026 duplázás)'),
  (2026, 'family_1_child_saving', 20000, 'Családi kedv. 1 gyermek: megtakarítás (Ft/hó)', 'Szja tv.'),
  (2026, 'family_2_children', 266660, 'Családi kedv. 2 gyermek: adóalap-csökkentés/gyermek (Ft/hó)', 'Szja tv. (2026 duplázás)'),
  (2026, 'family_2_children_saving', 40000, 'Családi kedv. 2 gyermek: megtakarítás/gyermek (Ft/hó)', 'Szja tv.'),
  (2026, 'family_3plus_children', 440000, 'Családi kedv. 3+ gyermek: adóalap-csökkentés/gyermek (Ft/hó)', 'Szja tv. (2026 duplázás)'),
  (2026, 'family_3plus_children_saving', 66000, 'Családi kedv. 3+ gyermek: megtakarítás/gyermek (Ft/hó)', 'Szja tv.'),
  (2026, 'family_disabled_extra', 10000, 'Tartósan beteg/fogyatékos gyermek extra (Ft/hó/gyermek)', 'Szja tv.'),

  -- 25 év alatti kedvezmény
  (2026, 'young_25_cap', 715765, '25 év alatti fiatalok havi adóalap-csökkentés plafon (Ft)', 'Szja tv. 29/F. §'),
  (2026, 'young_25_annual_cap', 8589180, '25 év alattiak éves plafon (Ft)', 'Szja tv. 29/F. §'),

  -- Személyi kedvezmény
  (2026, 'personal_disability', 107600, 'Személyi kedv. havi adóalap-csökkentés (Ft)', 'Szja tv. 29/E. §'),
  (2026, 'personal_disability_saving', 16140, 'Személyi kedv. havi megtakarítás (Ft)', 'Szja tv. 29/E. §'),

  -- Első házasok
  (2026, 'first_marriage', 33335, 'Első házasok havi adóalap-csökkentés (Ft)', 'Szja tv. 29/C. §'),
  (2026, 'first_marriage_saving', 5000, 'Első házasok havi megtakarítás (Ft)', 'Szja tv. 29/C. §'),
  (2026, 'first_marriage_months', 24, 'Első házasok kedvezmény időtartam (hónap)', 'Szja tv. 29/C. §'),

  -- Egészségügyi szolgáltatási járulék
  (2026, 'health_service_monthly', 12300, 'Egészségügyi szolgáltatási járulék (Ft/hó)', 'Tbj.'),
  (2026, 'health_service_daily', 410, 'Egészségügyi szolgáltatási járulék (Ft/nap)', 'Tbj.'),

  -- EFO
  (2026, 'efo_daily_tax', 4800, 'EFO napi munkáltatói közteher (Ft)', 'Efo tv.'),
  (2026, 'efo_min_hourly_unskilled', 1578, 'EFO min. órabér szakképzettség nélkül (Ft)', 'Efo tv.'),
  (2026, 'efo_min_hourly_skilled', 1866, 'EFO min. órabér szakképzett (Ft)', 'Efo tv.'),
  (2026, 'efo_max_daily_wage', 29700, 'EFO max. napi bér (Ft)', 'Efo tv.'),
  (2026, 'efo_exempt_daily_unskilled', 19305, 'EFO SZJA-mentes napi keret (Ft)', 'Efo tv.'),
  (2026, 'efo_exempt_daily_skilled', 22308, 'EFO SZJA-mentes napi keret szakképzett (Ft)', 'Efo tv.'),
  (2026, 'efo_max_days_same_parties', 120, 'EFO max. munkanapok azonos felek között (nap/év)', 'Efo tv.'),
  (2026, 'efo_mezo_sav1_days', 120, 'EFO mezőgazdasági 1. sáv napok (2400 Ft)', 'Efo tv.'),
  (2026, 'efo_mezo_sav1_rate', 2400, 'EFO mezőgazdasági 1. sáv közteher (Ft/nap)', 'Efo tv.'),
  (2026, 'efo_mezo_sav2_rate', 3600, 'EFO mezőgazdasági 2. sáv közteher (Ft/nap)', 'Efo tv.'),
  (2026, 'efo_mezo_max_days', 210, 'EFO mezőgazdasági max. napok (2026 bővítés)', 'Efo tv.'),
  (2026, 'efo_film_daily_tax', 9700, 'EFO filmipari statiszta napi közteher (Ft)', 'Efo tv.'),
  (2026, 'efo_film_max_daily_wage', 38700, 'EFO filmipari max. napi bér (Ft)', 'Efo tv.'),

  -- Távmunka
  (2026, 'remote_work_allowance', 32280, 'Távmunka adómentes átalány (Ft/hó, minimálbér 10%-a)', 'Szja tv. 3. sz. melléklet'),

  -- SZÉP-kártya & cafeteria
  (2026, 'szep_recreation_annual', 450000, 'SZÉP-kártya rekreációs éves keret (Ft)', 'Szja tv.'),
  (2026, 'szep_active_annual', 120000, 'SZÉP-kártya Aktív Magyarok éves keret (Ft)', 'Szja tv. 2025 kiegészítés'),
  (2026, 'szep_total_annual_max', 570000, 'SZÉP-kártya összesített éves max. (Ft)', 'Szja tv.'),
  (2026, 'szep_fringe_tax_rate', 0.28, 'Béren kívüli SZÉP-kártya közteher kulcs', 'Szja tv.'),
  (2026, 'specified_benefit_tax_rate', 0.3304, 'Egyes meghatározott juttatás közteher kulcs', 'Szja tv.'),

  -- Lakhatás
  (2026, 'housing_support_monthly', 150000, 'Lakhatási támogatás 35 év alatt max. (Ft/hó)', 'Szja tv.'),
  (2026, 'housing_support_annual', 1800000, 'Lakhatási támogatás 35 év alatt max. (Ft/év)', 'Szja tv.'),
  (2026, 'housing_support_tax_rate', 0.28, 'Lakhatási támogatás közteher kulcs', 'Szja tv.'),

  -- Csekély értékű ajándék
  (2026, 'small_gift_per_occasion', 32280, 'Csekély értékű ajándék alkalmanként max. (Ft)', 'Szja tv.'),
  (2026, 'small_gift_max_occasions', 3, 'Csekély értékű ajándék max. alkalom/év', 'Szja tv.'),

  -- Munkába járás
  (2026, 'commuting_per_km', 30, 'Munkába járás térítés (Ft/km)', '39/2010. Korm. r.'),
  (2026, 'commuting_monthly_max', 60886, 'Munkába járás havi max. (Ft)', '39/2010. Korm. r.'),

  -- Túlóra
  (2026, 'overtime_annual_limit_mt', 250, 'Túlóra éves keret Mt. (óra)', 'Mt.'),
  (2026, 'overtime_annual_limit_ksz', 400, 'Túlóra éves keret KSZ (óra)', 'KSZ'),

  -- Rehabilitáció
  (2026, 'rehab_penalty_per_person', 2905200, 'Rehabilitációs hozzájárulás büntetés (Ft/fő/év, minimálbér 9×)', 'Szocho és Rehab tv.'),
  (2026, 'rehab_threshold_employees', 25, 'Rehabilitáció kötelező felett (fő)', 'Rehab tv.'),
  (2026, 'rehab_quota_pct', 0.05, 'Rehabilitáció kvóta (5%)', 'Rehab tv.'),

  -- SZOCHO felső határ
  (2026, 'szocho_capital_cap', 7747200, 'SZOCHO felső határ tőkejövedelem (Ft/év, minimálbér 24×)', 'Szocho tv.'),

  -- Biztosítási küszöb
  (2026, 'insurance_threshold_pct', 0.30, 'Megbízás biztosítási küszöb (minimálbér 30%-a)', 'Tbj. 6. § (1) f)'),
  (2026, 'insurance_threshold_amount', 96840, 'Megbízás biztosítási küszöb (Ft/hó)', 'Tbj. 6. § (1) f)'),

  -- Nyugdíjas anya 2026
  (2026, 'netak_annual_avg_4x', 34356720, 'Nyugdíjas anya SZOCHO küszöb (éves átlagkereset 4×)', 'NAV közlemény'),

  -- Szakképzés
  (2026, 'szakkep_szja_exempt_limit', 168000, 'Szakképzési munkabér SZJA-mentes határ (Ft)', 'Szkt.'),
  (2026, 'szakkep_base_cost', 1200000, 'Szakképzési önköltség SZOCHO-kedv. alap (Ft)', 'Szkt.'),

  -- Közfoglalkoztatás
  (2026, 'kozfogl_wage', 161400, 'Közfoglalkoztatási bér (minimálbér 50%)', 'Közfogl. tv.'),

  -- EKHO
  (2026, 'ekho_upper_limit', 60000000, 'EKHO felső határ (Ft/év)', 'Ekho tv.'),
  (2026, 'ekho_rate_employee', 0.15, 'EKHO magánszemély kulcs', 'Ekho tv.'),
  (2026, 'ekho_rate_employer', 0.13, 'EKHO kifizető kulcs', 'Ekho tv.'),

  -- Betegszabadság
  (2026, 'sick_leave_days', 15, 'Betegszabadság napok (év)', 'Mt.'),
  (2026, 'sick_leave_pct', 0.70, 'Betegszabadság díj % (távolléti díj)', 'Mt.'),

  -- Kamarai hozzájárulás
  (2026, 'chamber_contribution', 5000, 'Iparkamarai kötelező hozzájárulás (Ft/év)', 'Kamarai tv.'),

  -- Vállalkozói minimumalap (2026: 112.5% megszűnt)
  (2026, 'ev_minimum_multiplier', 1.00, 'EV/társas vállalkozó minimumalap szorzó (112.5% megszűnt)', 'Szocho tv. 2026 módosítás'),

  -- Átalányadó
  (2026, 'atalanyadó_exempt_limit', 1936800, 'Átalányadó adómentes határ (éves minimálbér fele)', 'Szja tv.'),

  -- KATA
  (2026, 'kata_monthly_tax', 50000, 'KATA havi tételes adó (Ft)', 'KATA tv.'),
  (2026, 'kata_annual_revenue_cap', 18000000, 'KATA éves bevételi plafon (Ft)', 'KATA tv.'),
  (2026, 'kata_excess_tax_rate', 0.40, 'KATA túllépési különadó kulcs', 'KATA tv.'),

  -- KIVA
  (2026, 'kiva_rate', 0.10, 'KIVA adókulcs (10%)', 'KIVA tv.')

ON CONFLICT (tax_year, parameter_key) DO UPDATE SET
  parameter_value = EXCLUDED.parameter_value,
  description = EXCLUDED.description,
  legal_reference = EXCLUDED.legal_reference;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  DONE                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- ✅ 17 jogviszonykód (1101, 1115 ÚJ, 1131, 1300, 1452, stb.)
-- ✅ 70+ paraméter a 2026-os jogszabályi állapot alapján
