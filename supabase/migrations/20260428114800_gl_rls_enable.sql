-- 1. Enable RLS on tables
ALTER TABLE public.chart_of_accounts_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_accounts ENABLE ROW LEVEL SECURITY;

-- 2. Clean up any existing policies to prevent conflicts
DROP POLICY IF EXISTS "Enable read access for presets" ON public.chart_of_accounts_presets;
DROP POLICY IF EXISTS "Enable insert for presets" ON public.chart_of_accounts_presets;
DROP POLICY IF EXISTS "Enable update for presets" ON public.chart_of_accounts_presets;
DROP POLICY IF EXISTS "Enable delete for presets" ON public.chart_of_accounts_presets;

DROP POLICY IF EXISTS "Enable read access for gl accounts" ON public.gl_accounts;
DROP POLICY IF EXISTS "Enable insert for gl accounts" ON public.gl_accounts;
DROP POLICY IF EXISTS "Enable update for gl accounts" ON public.gl_accounts;
DROP POLICY IF EXISTS "Enable delete for gl accounts" ON public.gl_accounts;

-- =======================================================================
-- POLICIES FOR chart_of_accounts_presets
-- =======================================================================

-- SELECT: Can view if the preset is global (company_id IS NULL) OR it belongs to user's company
CREATE POLICY "Enable read access for presets" 
  ON public.chart_of_accounts_presets 
  FOR SELECT 
  USING (
    company_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.company_members cm 
      WHERE cm.company_id = chart_of_accounts_presets.company_id 
      AND cm.user_id = auth.uid()
    )
  );

-- INSERT: Can only insert if assigning it to user's company
CREATE POLICY "Enable insert for presets" 
  ON public.chart_of_accounts_presets 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm 
      WHERE cm.company_id = chart_of_accounts_presets.company_id 
      AND cm.user_id = auth.uid()
    )
  );

-- UPDATE: Can only update if it belongs to user's company
CREATE POLICY "Enable update for presets" 
  ON public.chart_of_accounts_presets 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm 
      WHERE cm.company_id = chart_of_accounts_presets.company_id 
      AND cm.user_id = auth.uid()
    )
  );

-- DELETE: Can only delete if it belongs to user's company
CREATE POLICY "Enable delete for presets" 
  ON public.chart_of_accounts_presets 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm 
      WHERE cm.company_id = chart_of_accounts_presets.company_id 
      AND cm.user_id = auth.uid()
    )
  );


-- =======================================================================
-- POLICIES FOR gl_accounts
-- =======================================================================
-- Using JOIN via preset_id to access the parent chart_of_accounts_presets.company_id

-- SELECT: Can view if parent preset is global OR belongs to user's company
CREATE POLICY "Enable read access for gl accounts" 
  ON public.gl_accounts 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.chart_of_accounts_presets cap
      WHERE cap.id = gl_accounts.preset_id
      AND (
        cap.company_id IS NULL 
        OR EXISTS (
          SELECT 1 FROM public.company_members cm 
          WHERE cm.company_id = cap.company_id 
          AND cm.user_id = auth.uid()
        )
      )
    )
  );

-- INSERT: Can only insert into a preset that belongs to user's company
CREATE POLICY "Enable insert for gl accounts" 
  ON public.gl_accounts 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chart_of_accounts_presets cap
      WHERE cap.id = gl_accounts.preset_id
      AND EXISTS (
        SELECT 1 FROM public.company_members cm 
        WHERE cm.company_id = cap.company_id 
        AND cm.user_id = auth.uid()
      )
    )
  );

-- UPDATE: Can only update accounts in a preset that belongs to user's company
CREATE POLICY "Enable update for gl accounts" 
  ON public.gl_accounts 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.chart_of_accounts_presets cap
      WHERE cap.id = gl_accounts.preset_id
      AND EXISTS (
        SELECT 1 FROM public.company_members cm 
        WHERE cm.company_id = cap.company_id 
        AND cm.user_id = auth.uid()
      )
    )
  );

-- DELETE: Can only delete accounts in a preset that belongs to user's company
CREATE POLICY "Enable delete for gl accounts" 
  ON public.gl_accounts 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.chart_of_accounts_presets cap
      WHERE cap.id = gl_accounts.preset_id
      AND EXISTS (
        SELECT 1 FROM public.company_members cm 
        WHERE cm.company_id = cap.company_id 
        AND cm.user_id = auth.uid()
      )
    )
  );
