-- Migration: Create auto_categorize_jobs table for persistent progress tracking and Realtime updates
CREATE TABLE IF NOT EXISTS public.auto_categorize_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'error'
  total_invoices integer NOT NULL DEFAULT 0,
  processed_invoices integer NOT NULL DEFAULT 0,
  categorized_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Comments
COMMENT ON TABLE public.auto_categorize_jobs IS 'Tracks automatic invoice categorization jobs with live progress.';

-- Enable RLS
ALTER TABLE public.auto_categorize_jobs ENABLE ROW LEVEL SECURITY;

-- Drop old policies if exist
DROP POLICY IF EXISTS "auto_categorize_jobs_select_company" ON public.auto_categorize_jobs;
DROP POLICY IF EXISTS "auto_categorize_jobs_insert_company" ON public.auto_categorize_jobs;
DROP POLICY IF EXISTS "auto_categorize_jobs_update_company" ON public.auto_categorize_jobs;
DROP POLICY IF EXISTS "auto_categorize_jobs_service_role" ON public.auto_categorize_jobs;

-- Select policy
CREATE POLICY "auto_categorize_jobs_select_company"
  ON public.auto_categorize_jobs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.user_company_access_cache WHERE user_id = auth.uid()
    )
  );

-- Insert policy
CREATE POLICY "auto_categorize_jobs_insert_company"
  ON public.auto_categorize_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.user_company_access_cache WHERE user_id = auth.uid()
    )
  );

-- Update policy
CREATE POLICY "auto_categorize_jobs_update_company"
  ON public.auto_categorize_jobs FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.user_company_access_cache WHERE user_id = auth.uid()
    )
  );

-- Service role policy
CREATE POLICY "auto_categorize_jobs_service_role"
  ON public.auto_categorize_jobs
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auto_categorize_jobs_company_status 
  ON public.auto_categorize_jobs(company_id, status);

CREATE INDEX IF NOT EXISTS idx_auto_categorize_jobs_created_at 
  ON public.auto_categorize_jobs(created_at DESC);

-- Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'auto_categorize_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auto_categorize_jobs;
  END IF;
END $$;
