-- ══════════════════════════════════════════════════════════════════════════
-- Migráció: 20261016100000_teny_extended_fields.sql
-- Cél: Tárgyi eszközök kiterjesztett törzsadatai:
--      - Pályázatos ÉCS pálya és eltérő ÉCS alapok (tax_depreciation_base, grant_*)
--      - Nyitó kartonok átvételi adatai (opening_*_depreciation, last_depreciation_date)
--      - Kétirányú ÉCS kulcs mező (depreciation_rate_percent)
--      - Ingatlan és jármű azonosítók (property_registry_number, license_plate, vin_chassis_number)
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS tax_depreciation_base numeric(15, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS grant_depreciation_base numeric(15, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS grant_depreciation_rate numeric(5, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS grant_depreciation_method text DEFAULT 'linear',
  ADD COLUMN IF NOT EXISTS opening_accumulated_depreciation numeric(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_tax_depreciation numeric(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_depreciation_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS depreciation_rate_percent numeric(5, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS property_registry_number varchar(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS license_plate varchar(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vin_chassis_number varchar(30) DEFAULT NULL;

-- Indexek a gyors kereséshez rendszámra és helyrajzi számra cégen belül
CREATE INDEX IF NOT EXISTS idx_fixed_assets_license_plate 
  ON public.fixed_assets(company_id, license_plate) 
  WHERE license_plate IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fixed_assets_property_reg 
  ON public.fixed_assets(company_id, property_registry_number) 
  WHERE property_registry_number IS NOT NULL;

NOTIFY pgrst, 'reload schema';
