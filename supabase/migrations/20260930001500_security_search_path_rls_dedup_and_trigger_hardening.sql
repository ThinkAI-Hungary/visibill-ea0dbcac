-- Migration: 20260930001500_security_search_path_rls_dedup_and_trigger_hardening.sql
-- Description: Comprehensive Supabase audit hardening:
--   1. Fix mutable search_path on SECURITY DEFINER & trigger functions.
--   2. Recreate auto_detect_reverse_charge() as SECURITY DEFINER with fixed search_path.
--   3. Drop duplicate/redundant RLS policies and consolidate multiple permissive policies.
--   4. Add missing primary key and explicit RLS policies to internal/backup tables.
--   5. Revoke EXECUTE from PUBLIC and anon on sensitive SECURITY DEFINER functions, granting only to authenticated and service_role.

-- ============================================================================
-- 1. Fix Mutable search_path on Functions
-- ============================================================================
ALTER FUNCTION public.override_gl_classification(uuid, uuid, text, text, numeric, text, uuid, text) 
  SET search_path TO 'public';

ALTER FUNCTION public.acc_enforce_header_immutability() 
  SET search_path TO 'public';

-- ============================================================================
-- 2. Harden Cross-Table Trigger: auto_detect_reverse_charge
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_detect_reverse_charge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_reverse boolean := false;
  v_has_foreign_currency boolean := false;
  v_currency text;
  v_vat_rate numeric;
  v_vat_code_val text;
BEGIN
  -- Read line data
  v_currency := coalesce(NEW.penznem, 'HUF');
  v_vat_rate := coalesce(NEW.afa_szazalek, 0);

  -- Retrieve vat code if present
  IF NEW.vat_code_id IS NOT NULL THEN
    SELECT code INTO v_vat_code_val FROM vat_codes WHERE id = NEW.vat_code_id;
  END IF;

  -- Reverse charge criteria:
  -- 1) Explicit 0% or FAD / fordított ÁFA vat code
  -- 2) Foreign currency and 0% vat rate with specific keywords
  IF v_vat_code_val IN ('FAD', 'EUFAD', 'EU_SERVICES', 'IMPORT_SERVICES') 
     OR (v_vat_rate = 0 AND lower(coalesce(NEW.termek_nev, '')) LIKE '%fordított%') THEN
    v_is_reverse := true;
  END IF;

  IF v_is_reverse THEN
    -- Update parent invoice header safely under SECURITY DEFINER
    UPDATE nav_invoices
    SET is_reverse_charge = true
    WHERE id = NEW.nav_invoice_id
      AND coalesce(is_reverse_charge, false) = false;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 3. Drop Redundant Duplicate RLS Policies (ALL already covered SELECT)
-- ============================================================================
DROP POLICY IF EXISTS "accounty_dividends_tenant_select" ON public.accounty_dividends;
DROP POLICY IF EXISTS "accounty_upo_credentials_select" ON public.accounty_upo_credentials;
DROP POLICY IF EXISTS "accounty_efo_entries_select" ON public.accounty_efo_entries;
DROP POLICY IF EXISTS "Members can view company Minimax credentials" ON public.company_minimax_credentials;

-- ============================================================================
-- 4. Consolidate Multiple Permissive Policies to Boost RLS Query Performance
-- ============================================================================

-- aggreg8_accounts: Separate manager write policies from member select policy
DROP POLICY IF EXISTS "Company managers can manage aggreg8 accounts" ON public.aggreg8_accounts;

CREATE POLICY "Company managers can insert aggreg8 accounts"
ON public.aggreg8_accounts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = aggreg8_accounts.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role NOT IN ('employee', 'viewer')
  )
);

CREATE POLICY "Company managers can update aggreg8 accounts"
ON public.aggreg8_accounts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = aggreg8_accounts.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role NOT IN ('employee', 'viewer')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = aggreg8_accounts.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role NOT IN ('employee', 'viewer')
  )
);

CREATE POLICY "Company managers can delete aggreg8 accounts"
ON public.aggreg8_accounts FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = aggreg8_accounts.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role NOT IN ('employee', 'viewer')
  )
);

-- aggreg8_consents: Separate manager write policies from member select policy
DROP POLICY IF EXISTS "Company managers can manage aggreg8 consents" ON public.aggreg8_consents;

CREATE POLICY "Company managers can insert aggreg8 consents"
ON public.aggreg8_consents FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = aggreg8_consents.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role NOT IN ('employee', 'viewer')
  )
);

CREATE POLICY "Company managers can update aggreg8 consents"
ON public.aggreg8_consents FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = aggreg8_consents.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role NOT IN ('employee', 'viewer')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = aggreg8_consents.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role NOT IN ('employee', 'viewer')
  )
);

CREATE POLICY "Company managers can delete aggreg8 consents"
ON public.aggreg8_consents FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = aggreg8_consents.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role NOT IN ('employee', 'viewer')
  )
);

-- bank_transactions: Consolidate dual SELECT policies into a single short-circuiting policy
DROP POLICY IF EXISTS "Company members can view company bank_transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can view transactions from their bank statements" ON public.bank_transactions;

CREATE POLICY "Users can view bank_transactions"
ON public.bank_transactions FOR SELECT
TO authenticated
USING (
  (company_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = bank_transactions.company_id
      AND company_members.user_id = (SELECT auth.uid())
  ))
  OR
  (bank_statement_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM bank_statements
    WHERE bank_statements.id = bank_transactions.bank_statement_id
      AND bank_statements.user_id = (SELECT auth.uid())
  ))
);

-- ============================================================================
-- 5. Primary Key and RLS on Unprotected / Backup Tables
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices_vat_audit_backup_20260907') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'invoices_vat_audit_backup_20260907' AND constraint_type = 'PRIMARY KEY'
    ) THEN
      ALTER TABLE public.invoices_vat_audit_backup_20260907 ADD PRIMARY KEY (id);
    END IF;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role has full access to api_idempotency_keys" ON public.api_idempotency_keys;
CREATE POLICY "Service role has full access to api_idempotency_keys"
ON public.api_idempotency_keys FOR ALL TO service_role
USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.instance_forward_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role has full access to instance_forward_routes" ON public.instance_forward_routes;
CREATE POLICY "Service role has full access to instance_forward_routes"
ON public.instance_forward_routes FOR ALL TO service_role
USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.invoices_vat_audit_backup_20260907 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role has full access to invoices_vat_audit_backup_20260907" ON public.invoices_vat_audit_backup_20260907;
CREATE POLICY "Service role has full access to invoices_vat_audit_backup_20260907"
ON public.invoices_vat_audit_backup_20260907 FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. Revoke Anon Execution from All Sensitive SECURITY DEFINER Functions
--    (Preserving check_request() for PostgREST hook)
-- ============================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT p.oid::regprocedure::text AS func_sig
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prosecdef = true
          AND p.proname <> 'check_request'
          AND has_function_privilege('anon', p.oid, 'EXECUTE')
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.func_sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.func_sig);
    END LOOP;
END $$;
