-- =============================================
-- Migration: Support Advanced Depreciation Methods
-- =============================================

-- 1. Add new columns to public.fixed_assets table
ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS performance_unit TEXT,
  ADD COLUMN IF NOT EXISTS total_planned_performance NUMERIC,
  ADD COLUMN IF NOT EXISTS depreciation_schedule JSONB;

-- 2. Add comments on new columns
COMMENT ON COLUMN public.fixed_assets.performance_unit IS 'Mértékegység teljesítményarányos ÉCS-hez (pl. km, üzemóra)';
COMMENT ON COLUMN public.fixed_assets.total_planned_performance IS 'Tervezett teljes élettartam-teljesítmény';
COMMENT ON COLUMN public.fixed_assets.depreciation_schedule IS 'Egyedi értékcsökkenési leírás ütemterv (éves összegek vagy szorzószámok tömbje)';
