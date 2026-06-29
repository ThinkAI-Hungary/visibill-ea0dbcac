-- =============================================================================
-- TÉNY ↔ ÉCS integráció
-- =============================================================================
-- Az accounty_ev_records_fixed_assets (ÉCS) tábla összekapcsolása
-- a fixed_assets (TÉNY) táblával.
-- =============================================================================

-- 1. Új FK oszlop: visszamutat a TÉNY forrás-eszközre
ALTER TABLE accounty_ev_records_fixed_assets
  ADD COLUMN IF NOT EXISTS source_fixed_asset_id UUID REFERENCES fixed_assets(id) ON DELETE SET NULL;

-- 2. Index a gyors join-hoz
CREATE INDEX IF NOT EXISTS idx_ev_fa_source_link
  ON accounty_ev_records_fixed_assets(source_fixed_asset_id)
  WHERE source_fixed_asset_id IS NOT NULL;

-- 3. Unique constraint: egy TÉNY eszköz egy adóévben csak egyszer importálható
CREATE UNIQUE INDEX IF NOT EXISTS idx_ev_fa_source_unique
  ON accounty_ev_records_fixed_assets(company_id, tax_year, source_fixed_asset_id)
  WHERE source_fixed_asset_id IS NOT NULL;
