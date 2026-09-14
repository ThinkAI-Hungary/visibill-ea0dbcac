-- ==============================================================================
-- Migration: 20260914180000_expand_transaction_rules_scope_and_gl_number.sql
-- Description:
--   1. Expand public.transaction_rules with user_id, scope ('company', 'tenant', 'global')
--      and target_gl_number for cross-company accountant-level rules.
--   2. Make company_id nullable for tenant/global rules.
--   3. Update RLS policies to support tenant-wide and company-specific rules.
-- ==============================================================================

-- 1. Alter columns on public.transaction_rules
ALTER TABLE public.transaction_rules 
  ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE public.transaction_rules 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_gl_number VARCHAR(16),
  ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'company' CHECK (scope IN ('company', 'tenant', 'global'));

-- Ensure existing rows have scope set
UPDATE public.transaction_rules 
   SET scope = 'company' 
 WHERE scope IS NULL;

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_transaction_rules_scope_user 
  ON public.transaction_rules(scope, user_id);

CREATE INDEX IF NOT EXISTS idx_transaction_rules_target_gl_num 
  ON public.transaction_rules(target_gl_number);

-- 3. Update RLS policies
DROP POLICY IF EXISTS "Enable read access for transaction rules" ON public.transaction_rules;
DROP POLICY IF EXISTS "Enable insert for transaction rules" ON public.transaction_rules;
DROP POLICY IF EXISTS "Enable update for transaction rules" ON public.transaction_rules;
DROP POLICY IF EXISTS "Enable delete for transaction rules" ON public.transaction_rules;

CREATE POLICY "Enable read access for transaction rules"
  ON public.transaction_rules
  FOR SELECT
  TO authenticated
  USING (
    scope = 'global'
    OR (scope = 'tenant' AND user_id = (SELECT auth.uid()))
    OR (
      company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = transaction_rules.company_id
          AND cm.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Enable insert for transaction rules"
  ON public.transaction_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (scope = 'tenant' AND user_id = (SELECT auth.uid()))
    OR (
      (scope = 'company' OR scope IS NULL) AND company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = transaction_rules.company_id
          AND cm.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Enable update for transaction rules"
  ON public.transaction_rules
  FOR UPDATE
  TO authenticated
  USING (
    (scope = 'tenant' AND user_id = (SELECT auth.uid()))
    OR (
      company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = transaction_rules.company_id
          AND cm.user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    (scope = 'tenant' AND user_id = (SELECT auth.uid()))
    OR (
      company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = transaction_rules.company_id
          AND cm.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Enable delete for transaction rules"
  ON public.transaction_rules
  FOR DELETE
  TO authenticated
  USING (
    (scope = 'tenant' AND user_id = (SELECT auth.uid()))
    OR (
      company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = transaction_rules.company_id
          AND cm.user_id = (SELECT auth.uid())
      )
    )
  );
