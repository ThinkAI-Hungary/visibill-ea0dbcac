-- Migration: Add created_at column to nav_sync_logs
-- Description: Standardizes nav_sync_logs to conform to Visibill DB rule T-3 (created_at timestamptz DEFAULT now())
-- and fixes PostgREST / Studio 42703 error when ordering by created_at.

-- 1. Add created_at column with default now()
ALTER TABLE public.nav_sync_logs 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 2. Backfill existing records using started_at
UPDATE public.nav_sync_logs 
  SET created_at = started_at 
  WHERE started_at IS NOT NULL;

-- 3. Add descending index for efficient sorting & PostgREST pagination
CREATE INDEX IF NOT EXISTS idx_nav_sync_logs_created_at 
  ON public.nav_sync_logs(created_at DESC);

-- 4. Document column
COMMENT ON COLUMN public.nav_sync_logs.created_at IS 'Létrehozás időbélyegzője (PostgREST alapértelmezett rendezés és audit céljából)';
