-- ============================================================================
-- Migration: 20260905100000_add_accounty_uploads_updated_at.sql
-- Description: Add missing updated_at column and auto-update trigger to accounty_uploads
-- Follows: Visibill DB Checklist T-4 rule
-- ============================================================================

-- 1. Add updated_at column if not exists
ALTER TABLE public.accounty_uploads
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Backfill existing rows with completed_at if present
UPDATE public.accounty_uploads
  SET updated_at = completed_at
  WHERE completed_at IS NOT NULL;

-- 3. Create or replace trigger for automatic updated_at timestamp maintenance
DROP TRIGGER IF EXISTS trg_accounty_uploads_updated_at ON public.accounty_uploads;
CREATE TRIGGER trg_accounty_uploads_updated_at
  BEFORE UPDATE ON public.accounty_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Documentation comment
COMMENT ON COLUMN public.accounty_uploads.updated_at IS 'A feltöltési rekord utolsó módosításának időbélyege (trigger által karbantartott)';
