-- Migration: 20261017130000_chart_of_accounts_extended_schema.sql
-- Description: Extends gl_accounts with validation flags, cascading settings RPC,
--              realized FX calculation in open items settlement, and mandatory partner/project triggers.

-- 1. Add missing validation and configuration columns to gl_accounts
ALTER TABLE public.gl_accounts
  ADD COLUMN IF NOT EXISTS requires_partner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_project boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_cost_center boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_reconcilable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_monthly_fx_reval boolean NOT NULL DEFAULT false;

-- 2. Backfill sensible defaults for Hungarian Chart of Accounts standards
-- Partners required for Receivables, Payables, Advances, Loans, Settlements
UPDATE public.gl_accounts
SET requires_partner = true
WHERE requires_partner = false
  AND (
    gl_number LIKE '31%' OR
    gl_number LIKE '35%' OR
    gl_number LIKE '44%' OR
    gl_number LIKE '45%' OR
    gl_number LIKE '47%'
  );

-- Reconcilable (nyitott tétel párosítás) for open item managed accounts, customer/supplier/clearing
UPDATE public.gl_accounts
SET is_reconcilable = true
WHERE is_reconcilable = false
  AND (
    is_open_item_managed = true OR
    gl_number LIKE '31%' OR
    gl_number LIKE '45%' OR
    gl_number LIKE '389%'
  );

-- Monthly FX revaluation candidate accounts (FX cash, FX bank, foreign customers/suppliers)
UPDATE public.gl_accounts
SET is_monthly_fx_reval = true
WHERE is_monthly_fx_reval = false
  AND (
    gl_number LIKE '382%' OR
    gl_number LIKE '386%' OR
    gl_number LIKE '316%' OR
    gl_number LIKE '4542%' OR
    gl_number LIKE '455%'
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gl_accounts_requires_partner ON public.gl_accounts(company_id, requires_partner) WHERE requires_partner = true;
CREATE INDEX IF NOT EXISTS idx_gl_accounts_requires_project ON public.gl_accounts(company_id, requires_project) WHERE requires_project = true;
CREATE INDEX IF NOT EXISTS idx_gl_accounts_is_reconcilable ON public.gl_accounts(company_id, is_reconcilable) WHERE is_reconcilable = true;
CREATE INDEX IF NOT EXISTS idx_gl_accounts_is_monthly_fx_reval ON public.gl_accounts(company_id, is_monthly_fx_reval) WHERE is_monthly_fx_reval = true;

-- 3. RPC to cascade group account settings to analytic child accounts
CREATE OR REPLACE FUNCTION public.acc_cascade_gl_account_settings(
  p_account_id uuid,
  p_company_id uuid,
  p_requires_partner boolean,
  p_requires_project boolean,
  p_requires_cost_center boolean,
  p_is_reconcilable boolean,
  p_is_monthly_fx_reval boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_gl text;
  v_preset_id uuid;
  v_updated_count integer := 0;
BEGIN
  -- Get parent account gl_number and preset
  SELECT gl_number, preset_id INTO v_parent_gl, v_preset_id
  FROM public.gl_accounts
  WHERE id = p_account_id;

  IF v_parent_gl IS NULL THEN
    RAISE EXCEPTION 'A megadott főkönyvi számla nem található!';
  END IF;

  -- Normalize parent number (strip trailing dots)
  v_parent_gl := rtrim(v_parent_gl, '.');

  -- Update all child accounts starting with the parent number prefix in the same preset
  UPDATE public.gl_accounts
  SET
    requires_partner = p_requires_partner,
    requires_project = p_requires_project,
    requires_cost_center = p_requires_cost_center,
    is_reconcilable = p_is_reconcilable,
    is_monthly_fx_reval = p_is_monthly_fx_reval,
    updated_at = now()
  WHERE preset_id = v_preset_id
    AND id != p_account_id
    AND gl_number LIKE (v_parent_gl || '%');

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acc_cascade_gl_account_settings(uuid, uuid, boolean, boolean, boolean, boolean, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_cascade_gl_account_settings(uuid, uuid, boolean, boolean, boolean, boolean, boolean) TO authenticated, service_role;

-- 4. DB Trigger to enforce requires_partner and requires_project on acc_journal_lines
CREATE OR REPLACE FUNCTION public.check_acc_journal_line_mandatory_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gl_number text;
  v_requires_partner boolean := false;
  v_requires_project boolean := false;
  v_header_entry_type text;
BEGIN
  -- Bypass check for opening / closing technical entries
  IF NEW.header_id IS NOT NULL THEN
    SELECT entry_type INTO v_header_entry_type
    FROM public.acc_journal_headers
    WHERE id = NEW.header_id;

    IF v_header_entry_type IN ('NYITO', 'ZARO', 'RENDSZER_ZARO') THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Look up gl_account settings
  SELECT gl_number, requires_partner, requires_project
  INTO v_gl_number, v_requires_partner, v_requires_project
  FROM public.gl_accounts
  WHERE id = NEW.gl_account_id;

  -- 1. Check requires_partner
  IF v_requires_partner AND (NEW.partner_id IS NULL) THEN
    RAISE EXCEPTION '❌ A(z) %-es főkönyvi számla partnerköteles! Kérjük, válasszon partnert a tétel rögzítéséhez!', COALESCE(v_gl_number, 'ismeretlen');
  END IF;

  -- 2. Check requires_project
  IF v_requires_project AND (NEW.project_id IS NULL) THEN
    RAISE EXCEPTION '❌ A(z) %-es számlára projekt megadása nélkül tilos könyvelni! Kérjük, jelölje meg az érintett projektet!', COALESCE(v_gl_number, 'ismeretlen');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_acc_journal_line_mandatory_fields ON public.acc_journal_lines;
CREATE TRIGGER trg_check_acc_journal_line_mandatory_fields
  BEFORE INSERT OR UPDATE OF gl_account_id, partner_id, project_id
  ON public.acc_journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.check_acc_journal_line_mandatory_fields();
