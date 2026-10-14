-- ==============================================================================
-- Migration: 20261014124000_add_member_read_tier_to_rbac.sql
-- Description: Add 'member_read' tier to public.assert_company_role_tier.
--              Allows read-only access (dashboard, summaries, analytics)
--              to company members (including viewers) and assigned accountants.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.assert_company_role_tier(
  p_company_id uuid,
  p_required_tier text -- 'member_read', 'member_write', 'ledger_write', 'senior'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := auth.role();
  v_has_bookkeeper boolean;
BEGIN
  -- Service role and system session bypass (cron, background tasks without end-user JWT)
  IF v_role = 'service_role' OR (v_uid IS NULL AND COALESCE(v_role, 'service_role') <> 'anon') THEN
    RETURN true;
  END IF;

  -- Reject unauthenticated or anon callers
  IF v_uid IS NULL OR v_role = 'anon' THEN
    RAISE EXCEPTION 'Hozzáférés megtagadva: Bejelentkezés szükséges!' USING ERRCODE = '42501';
  END IF;

  -- Support admin bypass
  IF public.is_support_admin() THEN
    RETURN true;
  END IF;

  -- Check if company has an assigned professional bookkeeper
  v_has_bookkeeper := public.company_has_assigned_bookkeeper(p_company_id);

  -- Tier 0: member_read (read-only summaries, analytics, pending pools)
  IF p_required_tier = 'member_read' THEN
    IF EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = p_company_id
        AND cm.user_id = v_uid
        AND cm.role IN ('owner', 'admin', 'member', 'assistant', 'viewer')
    ) OR EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = p_company_id
        AND aa.accountant_user_id = v_uid
        AND aa.role IN ('iroda_admin', 'senior_könyvelő', 'könyvelő', 'asszisztens')
    ) OR public.has_company_access_via_cache(p_company_id, 'accounty'::text) THEN
      RETURN true;
    END IF;

    RAISE EXCEPTION 'Hozzáférés megtagadva: Nincs megtekintési jogosultsága a céghez!' USING ERRCODE = '42501';
  END IF;

  -- Tier 1: member_write (invoices, classifications, exclusions, transactions)
  IF p_required_tier = 'member_write' THEN
    IF EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = p_company_id
        AND cm.user_id = v_uid
        AND cm.role IN ('owner', 'admin', 'member', 'assistant')
    ) OR EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = p_company_id
        AND aa.accountant_user_id = v_uid
        AND aa.role IN ('iroda_admin', 'senior_könyvelő', 'könyvelő', 'asszisztens')
    ) THEN
      RETURN true;
    END IF;

    RAISE EXCEPTION 'Hozzáférés megtagadva: Nincs szerkesztési jogosultsága a céghez!' USING ERRCODE = '42501';
  END IF;

  -- Tier 2: ledger_write (daily posting, journal modifications, storno, settle)
  IF p_required_tier = 'ledger_write' THEN
    IF EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = p_company_id
        AND aa.accountant_user_id = v_uid
        AND aa.role IN ('iroda_admin', 'senior_könyvelő', 'könyvelő', 'asszisztens')
    ) THEN
      RETURN true;
    END IF;

    -- O1 Fallback: if company has NO assigned bookkeeper, owner/admin/member can post
    IF NOT v_has_bookkeeper AND EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = p_company_id
        AND cm.user_id = v_uid
        AND cm.role IN ('owner', 'admin', 'member')
    ) THEN
      RETURN true;
    END IF;

    IF v_has_bookkeeper THEN
      RAISE EXCEPTION 'Hozzáférés megtagadva: A céghez könyvelő van rendelve, főkönyvi műveletet csak a kijelölt könyvelő végezhet!' USING ERRCODE = '42501';
    ELSE
      RAISE EXCEPTION 'Hozzáférés megtagadva: Főkönyvi könyvelési jogosultság szükséges!' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Tier 3: senior (period closing, VAT finalize, official XML, chart edit/delete)
  IF p_required_tier = 'senior' THEN
    IF EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = p_company_id
        AND aa.accountant_user_id = v_uid
        AND aa.role IN ('iroda_admin', 'senior_könyvelő')
    ) THEN
      RETURN true;
    END IF;

    -- O1 Fallback: if company has NO assigned bookkeeper, owner/admin/member can close/finalize
    IF NOT v_has_bookkeeper AND EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = p_company_id
        AND cm.user_id = v_uid
        AND cm.role IN ('owner', 'admin', 'member')
    ) THEN
      RETURN true;
    END IF;

    IF v_has_bookkeeper THEN
      RAISE EXCEPTION 'Hozzáférés megtagadva: Időszakzárást és kiemelt számviteli műveleteket csak Senior könyvelő végezhet!' USING ERRCODE = '42501';
    ELSE
      RAISE EXCEPTION 'Hozzáférés megtagadva: Kiemelt számviteli jogosultság szükséges!' USING ERRCODE = '42501';
    END IF;
  END IF;

  RAISE EXCEPTION 'Ismeretlen jogosultsági szint: %', p_required_tier USING ERRCODE = '42501';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.assert_company_role_tier(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_company_role_tier(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.assert_company_role_tier(uuid, text) IS 'Visibill core RBAC guard: member_read, member_write, ledger_write, senior.';

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
