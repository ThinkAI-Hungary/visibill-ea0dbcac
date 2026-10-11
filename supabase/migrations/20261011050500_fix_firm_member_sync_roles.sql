-- ============================================================================
-- Fix: accounting-firm member -> eaisyBooks assignment sync grants too much
-- ADR : docs/architecture/decisions/A-247-role-capability-matrix.md (addendum, discrepancy 1)
--
-- Problem (follow-up of 20260924140000_auto_sync_accounting_firm_members_to_eaisybooks.sql):
--   * Every NEW member of an accounting firm's own company became a 'könyvelő' assignment unless
--     eaisyBill role = admin. So a Megfigyelő (viewer), a Munkavállaló (employee) and an eaisyBill
--     assistant silently received bookkeeping WRITE rights via accounty_assignments.
--   * The sync only ran on INSERT: role downgrades did not follow, and the removal trigger
--     (trg_eaisybill_accountant_removal) only handled the legacy member role 'accountant', so a
--     removed firm member kept the synced assignment (orphan, access leak).
--
-- Fix (schema/logic only - NO data is touched here; see MANUAL_RUN_cleanup_firm_member_sync_assignments.sql):
--   * Explicit role mapping (firm_member_accounting_role):
--       owner, admin       -> iroda_admin
--       member, accountant -> könyvelő      (member = Pénzügyi Vezető, unchanged behaviour)
--       assistant          -> asszisztens
--       viewer, employee, support_admin, anything else -> NO assignment
--   * The sync trigger now also fires on UPDATE OF role (downgrade removes / re-maps the synced row).
--   * Removal trigger drops the synced assignment for EVERY role when a firm member is removed.
--   * Manual (source = 'manual') assignments are never touched.
--
-- Idempotent: safe to re-run.   Rollback: re-apply 20260924140000 + 20260617000000 function bodies
-- and drop the two helper functions (see ADR addendum).
-- ============================================================================

-- ─── 1. Role mapping (pure) ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.firm_member_accounting_role(p_member_role text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $function$
  SELECT CASE p_member_role
    WHEN 'owner'      THEN 'iroda_admin'
    WHEN 'admin'      THEN 'iroda_admin'
    WHEN 'member'     THEN 'könyvelő'
    WHEN 'accountant' THEN 'könyvelő'
    WHEN 'assistant'  THEN 'asszisztens'
    ELSE NULL
  END;
$function$;

REVOKE ALL ON FUNCTION public.firm_member_accounting_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.firm_member_accounting_role(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.firm_member_accounting_role(text) IS
  'A-247: eaisyBill company_members.role -> accounty_assignments.role for members of an accounting firm. NULL = no bookkeeping assignment (viewer, employee, ...).';

-- ─── 2. Firm detection (extracted verbatim from the old trigger body) ───────────────────
-- Returns the accounting_firm_id when p_company_id is an accounting firm's own/office company.
CREATE OR REPLACE FUNCTION public.resolve_accounting_firm_id_for_company(p_company_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    -- 1. the company itself is registered as an accounting firm
    (SELECT aa.accounting_firm_id
       FROM public.accounty_assignments aa
      WHERE aa.accounting_firm_id = p_company_id
      LIMIT 1),
    -- 2. the company belongs to a firm whose owner is an iroda_admin of that firm
    (SELECT aa.accounting_firm_id
       FROM public.companies c
       JOIN public.accounty_assignments aa ON aa.accountant_user_id = c.owner_id
      WHERE c.id = p_company_id
        AND aa.role = 'iroda_admin'
        AND aa.accounting_firm_id IS NOT NULL
      LIMIT 1)
  );
$function$;

-- internal helper for SECURITY DEFINER triggers / migrations only
REVOKE ALL ON FUNCTION public.resolve_accounting_firm_id_for_company(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_accounting_firm_id_for_company(uuid) TO service_role;

COMMENT ON FUNCTION public.resolve_accounting_firm_id_for_company(uuid) IS
  'A-247 internal: accounting_firm_id when the company is an accounting firm office company, else NULL. Used by the company_members -> accounty_assignments sync triggers.';

-- ─── 3. Sync trigger (INSERT + role UPDATE) ─────────────────────────────────────────────
-- CREATE OR REPLACE does not inherit attributes (A-020): SECURITY DEFINER + search_path re-stated.
CREATE OR REPLACE FUNCTION public.sync_company_member_to_eaisybooks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_firm_id  uuid;
  v_acc_role text;
BEGIN
  v_firm_id := public.resolve_accounting_firm_id_for_company(NEW.company_id);
  IF v_firm_id IS NULL THEN
    RETURN NEW;  -- not an accounting firm company
  END IF;

  v_acc_role := public.firm_member_accounting_role(NEW.role);

  IF v_acc_role IS NULL THEN
    -- viewer / employee / ...: never a bookkeeping role. On a downgrade also drop the synced row.
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.accounty_assignments
      WHERE accountant_user_id = NEW.user_id
        AND company_id = NEW.company_id
        AND source = 'sync';
    END IF;
    RETURN NEW;
  END IF;

  -- A) eaisybooks_access flag
  UPDATE public.profiles
  SET eaisybooks_access = true,
      updated_at = now()
  WHERE user_id = NEW.user_id
    AND (eaisybooks_access IS NOT TRUE);

  -- B) accounty assignment
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.accounty_assignments (
      accountant_user_id, company_id, accounting_firm_id, role,
      is_primary, is_main_accountant, kanban_status, source
    ) VALUES (
      NEW.user_id, NEW.company_id, v_firm_id, v_acc_role,
      true, false, 'aktiv', 'sync'
    )
    ON CONFLICT (accountant_user_id, company_id) DO NOTHING;
  ELSE
    -- role change: re-map the synced row only (a manual assignment is left alone)
    INSERT INTO public.accounty_assignments (
      accountant_user_id, company_id, accounting_firm_id, role,
      is_primary, is_main_accountant, kanban_status, source
    ) VALUES (
      NEW.user_id, NEW.company_id, v_firm_id, v_acc_role,
      true, false, 'aktiv', 'sync'
    )
    ON CONFLICT (accountant_user_id, company_id) DO UPDATE
      SET role = EXCLUDED.role,
          updated_at = now()
      WHERE public.accounty_assignments.source = 'sync';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_company_members_auto_eaisybooks_sync ON public.company_members;
CREATE TRIGGER trg_company_members_auto_eaisybooks_sync
  AFTER INSERT OR UPDATE OF role ON public.company_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_company_member_to_eaisybooks();

COMMENT ON FUNCTION public.sync_company_member_to_eaisybooks() IS
  'A-247: keeps the synced accounty_assignment of an accounting-firm member in line with company_members.role (owner/admin -> iroda_admin, member -> könyvelő, assistant -> asszisztens, viewer/employee -> none).';

-- ─── 4. Removal trigger: any firm member, not only the legacy "accountant" role ─────────
CREATE OR REPLACE FUNCTION public.sync_eaisybill_accountant_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- When a company member is removed, also delete the corresponding auto-synced accounty_assignment:
  --   * legacy: member role 'accountant'
  --   * accounting-firm office companies: every role (otherwise the bookkeeping right outlives the membership)
  IF OLD.role = 'accountant'
     OR public.resolve_accounting_firm_id_for_company(OLD.company_id) IS NOT NULL THEN
    DELETE FROM public.accounty_assignments
    WHERE accountant_user_id = OLD.user_id
      AND company_id = OLD.company_id
      AND source = 'sync';
  END IF;
  RETURN OLD;
END;
$function$;

NOTIFY pgrst, 'reload schema';
