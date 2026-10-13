-- ============================================================================
-- Role & capability refactor (eaisyBill + eaisyBooks)
-- Spec: implementation-plans/eaisybill_szerepkorok_fejlesztes.md
-- ADR : docs/architecture/decisions/A-247-role-capability-matrix.md
--
--  D-1  Hybrid alias: company_members.role stays 'member' (UI: Pénzügyi Vezető) -> no change here.
--  D-3  New eaisyBill module keys 'subledger' + 'accounting_rules' (backfill existing overrides).
--  D-4  Backend guard: only company owner/admin/member (eaisyBill) or iroda_admin/senior_könyvelő
--       (eaisyBooks) may finalize / reopen a VAT return (vat_returns.status 'finalized').
--  D-5  New eaisyBooks role 'payroll_specialist' (Bérszámfejtő): payroll + 08 filing only,
--       permissions adjustable via accounty_module_permissions.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ─── 1. accounty_assignments.role: add payroll_specialist ───────────────────
ALTER TABLE public.accounty_assignments
  DROP CONSTRAINT IF EXISTS accounty_assignments_role_check;
ALTER TABLE public.accounty_assignments
  ADD CONSTRAINT accounty_assignments_role_check
  CHECK (role = ANY (ARRAY[
    'iroda_admin'::text,
    'senior_könyvelő'::text,
    'könyvelő'::text,
    'asszisztens'::text,
    'payroll_specialist'::text
  ]));

-- ─── 2. accounty_module_permissions.module_name: superset of the frontend module keys ─
-- Fixes a latent bug: the UI used 'tao' and the admin_* keys which the old CHECK rejected (23514).
ALTER TABLE public.accounty_module_permissions
  DROP CONSTRAINT IF EXISTS accounty_module_permissions_module_name_check;
ALTER TABLE public.accounty_module_permissions
  ADD CONSTRAINT accounty_module_permissions_module_name_check
  CHECK (module_name = ANY (ARRAY[
    'dashboard','invoices','transactions','salaries','payroll','general_ledger','vat_return',
    'profit_loss','balance_sheet','fixed_assets','petty_cash','partners','projects','categories',
    'hr','working_time','documents','integrations','settings','tao_kiva','filings','declarations',
    'reports','portfolio','missing_invoices','tax_calendar','approval_queue','alerts','nav_deadlines',
    'onboarding','tickets','ai_assistant','help','profile',
    -- new / previously missing keys
    'tao','client_bookkeeping',
    'admin_audit','admin_gdpr','admin_templates','admin_job_codes','admin_tax_params',
    'admin_legal','admin_office','admin_permissions','admin_accountants'
  ]::text[]));

-- ─── 3. eaisyBill: new module keys inherit the effective access of the module they were split from ─
-- /subledger used to be governed by 'general_ledger'; /accounting-rules etc. by 'journals'.
INSERT INTO public.eaisybill_module_permissions (company_id, user_id, module_name, can_read, can_write)
SELECT company_id, user_id, 'subledger', can_read, can_write
FROM public.eaisybill_module_permissions
WHERE module_name = 'general_ledger'
ON CONFLICT (company_id, user_id, module_name) DO NOTHING;

INSERT INTO public.eaisybill_module_permissions (company_id, user_id, module_name, can_read, can_write)
SELECT company_id, user_id, 'accounting_rules', can_read, can_write
FROM public.eaisybill_module_permissions
WHERE module_name = 'journals'
ON CONFLICT (company_id, user_id, module_name) DO NOTHING;

-- ─── 4. Access cache: payroll_specialist must not read invoices / transactions ───────────────
CREATE OR REPLACE FUNCTION public.sync_accounty_assignment_to_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_payroll_only boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM user_company_access_cache
    WHERE user_id = OLD.accountant_user_id
      AND company_id = OLD.company_id
      AND access_source = 'accounty';
    RETURN OLD;
  END IF;

  -- Bérszámfejtő: payroll / HR only — no invoices, no bank transactions (D-5)
  v_is_payroll_only := (NEW.role = 'payroll_specialist');

  INSERT INTO user_company_access_cache (
    user_id, company_id, access_source, role,
    can_read_invoices, can_write_invoices, can_read_transactions,
    can_read_salaries, can_read_hr, updated_at
  ) VALUES (
    NEW.accountant_user_id, NEW.company_id, 'accounty', NEW.role,
    NOT v_is_payroll_only, -- can read invoices
    NOT v_is_payroll_only, -- can write (manage) invoices
    NOT v_is_payroll_only, -- can read transactions
    true,                  -- salaries (payroll)
    true,                  -- HR (payroll)
    now()
  )
  ON CONFLICT (user_id, company_id, access_source) DO UPDATE SET
    role = EXCLUDED.role,
    can_read_invoices = EXCLUDED.can_read_invoices,
    can_write_invoices = EXCLUDED.can_write_invoices,
    can_read_transactions = EXCLUDED.can_read_transactions,
    can_read_salaries = EXCLUDED.can_read_salaries,
    can_read_hr = EXCLUDED.can_read_hr,
    updated_at = now();

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_accounty_assignment_to_cache() FROM PUBLIC, anon, authenticated;

-- ─── 5. VAT-return finalize guard (D-4) ──────────────────────────────────────────────────────
-- Who may finalize / reopen a VAT return of a company?
--   * system / service-role sessions (no end-user JWT)  -> yes
--   * support admins                                     -> yes
--   * eaisyBill company_members owner / admin / member (Pénzügyi Vezető) -> yes
--   * eaisyBooks assignment iroda_admin / senior_könyvelő (+ legacy senior/admin) -> yes
--   * everybody else (könyvelő, asszisztens, payroll_specialist, assistant, viewer, employee) -> NO
CREATE OR REPLACE FUNCTION public.can_finalize_company_filing(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (auth.uid() IS NULL AND COALESCE(auth.role(), 'service_role') <> 'anon')
    OR public.is_support_admin()
    OR EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = p_company_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.role IN ('owner', 'admin', 'member', 'support_admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = p_company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role IN ('iroda_admin', 'senior_könyvelő', 'senior', 'admin')
    );
$function$;

REVOKE ALL ON FUNCTION public.can_finalize_company_filing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_finalize_company_filing(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_vat_returns_finalize_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'finalized' AND NOT public.can_finalize_company_filing(NEW.company_id) THEN
      RAISE EXCEPTION 'ACCESS_DENIED: csak senior könyvelő, iroda admin vagy a cég vezetői véglegesíthetik az ÁFA bevallást'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND (NEW.status = 'finalized' OR OLD.status = 'finalized')
       AND NOT public.can_finalize_company_filing(NEW.company_id) THEN
      RAISE EXCEPTION 'ACCESS_DENIED: csak senior könyvelő, iroda admin vagy a cég vezetői véglegesíthetik / nyithatják vissza az ÁFA bevallást'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_vat_returns_finalize_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_vat_returns_finalize_guard ON public.vat_returns;
CREATE TRIGGER trg_vat_returns_finalize_guard
  BEFORE INSERT OR UPDATE OF status ON public.vat_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_vat_returns_finalize_guard();

COMMENT ON FUNCTION public.can_finalize_company_filing(uuid) IS
  'D-4: true if the current session may finalize/reopen a VAT return (owner/admin/member, senior_könyvelő, iroda_admin, support admin, system).';

NOTIFY pgrst, 'reload schema';
