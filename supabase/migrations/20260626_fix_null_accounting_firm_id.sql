-- ============================================================================
-- FIX: Backfill NULL accounting_firm_id in accounty_assignments
-- ============================================================================
-- When users joined via share code (join-company-as-accountant),
-- accounting_firm_id was not set, causing RLS to block visibility
-- of these records to other firm members.
-- ============================================================================

-- 1. Backfill: set accounting_firm_id = company_id where it's NULL
UPDATE public.accounty_assignments
SET accounting_firm_id = company_id
WHERE accounting_firm_id IS NULL;

-- 2. Update the RLS helper functions to also check by company_id
-- This makes the system more resilient even if accounting_firm_id
-- is somehow NULL in the future.

CREATE OR REPLACE FUNCTION is_iroda_admin_for_firm(p_firm_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounty_assignments
    WHERE accountant_user_id = auth.uid()
      AND (accounting_firm_id = p_firm_id OR company_id = p_firm_id)
      AND role = 'iroda_admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_member_of_firm(p_firm_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounty_assignments
    WHERE accountant_user_id = auth.uid()
      AND (accounting_firm_id = p_firm_id OR company_id = p_firm_id)
  );
$$;
