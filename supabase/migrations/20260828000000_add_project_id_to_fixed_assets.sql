-- =============================================
-- Migration: Add project_id to fixed_assets
-- =============================================

-- 1. Add project_id FK to public.fixed_assets
ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- 2. Index on project_id for performant lookups and joins
CREATE INDEX IF NOT EXISTS idx_fixed_assets_project_id ON public.fixed_assets(project_id);

-- 3. Comment on column
COMMENT ON COLUMN public.fixed_assets.project_id IS 'Hozzárendelt projekt azonosítója (projects tábla FK)';
