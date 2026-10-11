-- ==============================================================================
-- Migration: 20261011070000_rbac_closing_legacy_rpc_and_period_guards.sql
-- Description: Complete RBAC lockdown of legacy GL RPCs, period closing,
--              chart of accounts, and company settings.
--              Includes O1 fallback: if a company has NO assigned professional
--              bookkeeper, company leadership (owner, admin, member) acts as bookkeeper.
-- ==============================================================================

-- ─── 1. Helper: Check if company has an assigned professional bookkeeper ───────
CREATE OR REPLACE FUNCTION public.company_has_assigned_bookkeeper(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounty_assignments aa
    WHERE aa.company_id = p_company_id
      AND aa.role IN ('iroda_admin', 'senior_könyvelő', 'könyvelő', 'asszisztens')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.company_has_assigned_bookkeeper(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_has_assigned_bookkeeper(uuid) TO authenticated, service_role;


-- ─── 2. Core Authorization Guard: assert_company_role_tier ─────────────────────
CREATE OR REPLACE FUNCTION public.assert_company_role_tier(
  p_company_id uuid,
  p_required_tier text -- 'member_write', 'ledger_write', 'senior'
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


-- ─── 3. Boolean helper: has_company_role_tier ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_company_role_tier(
  p_company_id uuid,
  p_required_tier text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_company_role_tier(p_company_id, p_required_tier);
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.has_company_role_tier(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_company_role_tier(uuid, text) TO authenticated, service_role;


-- ─── 4. Update rls_accounty_bookkeeping_company_ids with O1 fallback ───────────
CREATE OR REPLACE FUNCTION public.rls_accounty_bookkeeping_company_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- 1. Assigned professional accountants
  SELECT aa.company_id
  FROM public.accounty_assignments aa
  WHERE aa.accountant_user_id = (SELECT auth.uid())
    AND aa.role IN ('iroda_admin', 'senior_könyvelő', 'könyvelő', 'asszisztens')
  UNION
  -- 2. O1 Fallback: Company leadership (owner, admin, member) IF no professional bookkeeper is assigned
  SELECT cm.company_id
  FROM public.company_members cm
  WHERE cm.user_id = (SELECT auth.uid())
    AND cm.role IN ('owner', 'admin', 'member')
    AND NOT public.company_has_assigned_bookkeeper(cm.company_id);
$function$;


-- ─── 5. Update check_user_can_auto_post_gl with O1 fallback ───────────────────
CREATE OR REPLACE FUNCTION public.check_user_can_auto_post_gl(p_company_id uuid, p_allow_payroll boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_has_bookkeeper boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Support admin bypass
  IF public.is_support_admin() THEN
    RETURN true;
  END IF;

  -- 1. Payroll specialist (when allowed, e.g. dividend and payroll auto-post)
  IF p_allow_payroll THEN
    IF EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = p_company_id
        AND user_id = v_uid
        AND role = 'payroll_specialist'
    ) OR EXISTS (
      SELECT 1 FROM public.accounty_assignments
      WHERE company_id = p_company_id
        AND accountant_user_id = v_uid
        AND role = 'payroll_specialist'
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- 2. Professional assigned accountants (iroda_admin, senior_könyvelő, könyvelő, asszisztens)
  IF EXISTS (
    SELECT 1 FROM public.accounty_assignments
    WHERE company_id = p_company_id
      AND accountant_user_id = v_uid
      AND role IN ('iroda_admin', 'senior_könyvelő', 'könyvelő', 'asszisztens')
  ) THEN
    RETURN true;
  END IF;

  -- 3. O1 Fallback: Company leadership (owner, admin, member) ONLY IF company has NO assigned bookkeeper
  v_has_bookkeeper := public.company_has_assigned_bookkeeper(p_company_id);
  IF NOT v_has_bookkeeper THEN
    IF EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = p_company_id
        AND user_id = v_uid
        AND role IN ('owner', 'admin', 'member')
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_user_can_auto_post_gl(uuid, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_user_can_auto_post_gl(uuid, boolean) TO authenticated, service_role;


-- ─── 6. Update can_finalize_company_filing with O1 fallback ───────────────────
CREATE OR REPLACE FUNCTION public.can_finalize_company_filing(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_company_role_tier(p_company_id, 'senior');
$function$;

REVOKE EXECUTE ON FUNCTION public.can_finalize_company_filing(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_finalize_company_filing(uuid) TO authenticated, service_role;


-- ─── 7. New RPC: set_accounting_period_closed ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_accounting_period_closed(
  p_company_id uuid,
  p_year smallint,
  p_month smallint,
  p_closed boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- 1. Authorization check: senior tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'senior');

  -- 2. Upsert period status
  INSERT INTO public.acc_accounting_periods (
    company_id,
    year,
    month,
    is_closed,
    closed_at,
    closed_by
  )
  VALUES (
    p_company_id,
    p_year,
    p_month,
    p_closed,
    CASE WHEN p_closed THEN now() ELSE NULL END,
    CASE WHEN p_closed THEN v_uid ELSE NULL END
  )
  ON CONFLICT (company_id, year, month)
  DO UPDATE SET
    is_closed = EXCLUDED.is_closed,
    closed_at = EXCLUDED.closed_at,
    closed_by = EXCLUDED.closed_by;

  -- 3. Audit log
  INSERT INTO public.acc_journal_audit_logs (
    company_id,
    entity_type,
    entity_id,
    event,
    new_status,
    reason,
    user_id,
    timestamp
  )
  VALUES (
    p_company_id,
    'acc_accounting_periods',
    p_company_id,
    CASE WHEN p_closed THEN 'PERIOD_CLOSE' ELSE 'PERIOD_REOPEN' END,
    CASE WHEN p_closed THEN 'CLOSED' ELSE 'OPEN' END,
    format('%s. %s időszak %s', p_year, p_month, CASE WHEN p_closed THEN 'lezárva' ELSE 'újra megnyitva' END),
    v_uid,
    now()
  );

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_accounting_period_closed(uuid, smallint, smallint, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_accounting_period_closed(uuid, smallint, smallint, boolean) TO authenticated, service_role;


-- ─── 8. acc_accounting_periods RLS hardening ───────────────────────────────────
DROP POLICY IF EXISTS acc_accounting_periods_authenticated_insert ON public.acc_accounting_periods;
DROP POLICY IF EXISTS acc_accounting_periods_authenticated_update ON public.acc_accounting_periods;
DROP POLICY IF EXISTS acc_accounting_periods_authenticated_delete ON public.acc_accounting_periods;

DROP POLICY IF EXISTS acc_accounting_periods_support_admin_write ON public.acc_accounting_periods;
CREATE POLICY acc_accounting_periods_support_admin_write ON public.acc_accounting_periods
  FOR ALL TO authenticated
  USING (public.is_support_admin())
  WITH CHECK (public.is_support_admin());


-- ─── 9. gl_accounts RLS hardening ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable read access for gl accounts" ON public.gl_accounts;
DROP POLICY IF EXISTS "Enable insert for gl accounts" ON public.gl_accounts;
DROP POLICY IF EXISTS "Enable update for gl accounts" ON public.gl_accounts;
DROP POLICY IF EXISTS "Enable delete for gl accounts" ON public.gl_accounts;

DROP POLICY IF EXISTS gl_accounts_select ON public.gl_accounts;
CREATE POLICY gl_accounts_select ON public.gl_accounts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chart_of_accounts_presets cap
      WHERE cap.id = gl_accounts.preset_id
        AND (
          cap.company_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = cap.company_id AND cm.user_id = auth.uid()
          )
          OR cap.company_id IN (SELECT public.rls_accounty_bookkeeping_company_ids())
          OR public.is_support_admin()
        )
    )
  );

DROP POLICY IF EXISTS gl_accounts_insert ON public.gl_accounts;
CREATE POLICY gl_accounts_insert ON public.gl_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chart_of_accounts_presets cap
      WHERE cap.id = gl_accounts.preset_id
        AND cap.company_id IS NOT NULL
        AND (
          public.has_company_role_tier(cap.company_id, 'ledger_write')
          OR public.is_support_admin()
        )
    )
  );

DROP POLICY IF EXISTS gl_accounts_update ON public.gl_accounts;
CREATE POLICY gl_accounts_update ON public.gl_accounts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chart_of_accounts_presets cap
      WHERE cap.id = gl_accounts.preset_id
        AND cap.company_id IS NOT NULL
        AND (
          public.has_company_role_tier(cap.company_id, 'senior')
          OR public.is_support_admin()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chart_of_accounts_presets cap
      WHERE cap.id = gl_accounts.preset_id
        AND cap.company_id IS NOT NULL
        AND (
          public.has_company_role_tier(cap.company_id, 'senior')
          OR public.is_support_admin()
        )
    )
  );

DROP POLICY IF EXISTS gl_accounts_delete ON public.gl_accounts;
CREATE POLICY gl_accounts_delete ON public.gl_accounts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chart_of_accounts_presets cap
      WHERE cap.id = gl_accounts.preset_id
        AND cap.company_id IS NOT NULL
        AND (
          public.has_company_role_tier(cap.company_id, 'senior')
          OR public.is_support_admin()
        )
    )
  );


-- ─── 10. companies UPDATE policy hardening ─────────────────────────────────────
DROP POLICY IF EXISTS "Members and accountants can update companies" ON public.companies;
DROP POLICY IF EXISTS "Leadership and accountants can update companies" ON public.companies;
CREATE POLICY "Leadership and accountants can update companies" ON public.companies
  FOR UPDATE TO authenticated
  USING (
    (auth.uid() = owner_id)
    OR EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = companies.id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = companies.id
        AND aa.accountant_user_id = auth.uid()
        AND aa.role IN ('iroda_admin', 'senior_könyvelő')
    )
    OR public.is_support_admin()
  )
  WITH CHECK (
    (auth.uid() = owner_id)
    OR EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = companies.id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = companies.id
        AND aa.accountant_user_id = auth.uid()
        AND aa.role IN ('iroda_admin', 'senior_könyvelő')
    )
    OR public.is_support_admin()
  );


-- ─── 11. Concurrency locks on remove auto-posters ─────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_asset_activation_from_gl(
  p_company_id uuid,
  p_inventory_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_doc_id text;
  v_header RECORD;
  v_was_stornoed boolean := false;
BEGIN
  v_uid := auth.uid();

  IF NOT public.check_user_can_auto_post_gl(p_company_id, false) THEN
    RAISE EXCEPTION 'Nincs jogosultsága az aktiválási könyvelés törléséhez a céghez (id: %)', p_company_id;
  END IF;

  v_doc_id := 'JK-' || regexp_replace(p_inventory_number, '[^a-zA-Z0-9_-]', '_', 'g');

  SELECT id, journal_number, status INTO v_header
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = v_doc_id
     AND status <> 'SZTORNOZOTT'
   FOR UPDATE
   LIMIT 1;

  IF v_header.id IS NOT NULL THEN
    IF v_header.journal_number IS NOT NULL AND v_header.status = 'KONYVELT' THEN
      PERFORM public.acc_storno_journal_entry(
        v_header.id,
        v_uid,
        'Eszköz aktiválás törlése / visszavonása (' || p_inventory_number || ')',
        false
      );
      v_was_stornoed := true;
    ELSE
      DELETE FROM public.acc_journal_lines WHERE header_id = v_header.id;
      DELETE FROM public.acc_journal_headers WHERE id = v_header.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'was_stornoed', v_was_stornoed,
    'message', CASE WHEN v_was_stornoed THEN 'Aktiválási tétel sikeresen sztornózva.' ELSE 'Aktiválási tétel törölve.' END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_asset_activation_from_gl(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_asset_activation_from_gl(uuid, text) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.remove_development_reserve_from_gl(
  p_company_id uuid,
  p_inventory_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_doc_id text;
  v_header RECORD;
  v_was_stornoed boolean := false;
BEGIN
  v_uid := auth.uid();

  IF NOT public.check_user_can_auto_post_gl(p_company_id, false) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a tartalék könyvelés törléséhez (cég: %)', p_company_id;
  END IF;

  v_doc_id := 'FT-FELOLD-' || regexp_replace(p_inventory_number, '[^a-zA-Z0-9_-]', '_', 'g');

  SELECT id, journal_number, status INTO v_header
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = v_doc_id
     AND status <> 'SZTORNOZOTT'
   FOR UPDATE
   LIMIT 1;

  IF v_header.id IS NOT NULL THEN
    IF v_header.journal_number IS NOT NULL AND v_header.status = 'KONYVELT' THEN
      PERFORM public.acc_storno_journal_entry(
        v_header.id,
        v_uid,
        'Fejlesztési tartalék feloldás törlése / visszavonása (' || p_inventory_number || ')',
        false
      );
      v_was_stornoed := true;
    ELSE
      DELETE FROM public.acc_journal_lines WHERE header_id = v_header.id;
      DELETE FROM public.acc_journal_headers WHERE id = v_header.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'was_stornoed', v_was_stornoed,
    'message', CASE WHEN v_was_stornoed THEN 'Fejlesztési tartalék feloldás sikeresen sztornózva.' ELSE 'Fejlesztési tartalék feloldás törölve.' END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_development_reserve_from_gl(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_development_reserve_from_gl(uuid, text) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.delete_dividend_gl_entry(
  p_company_id uuid,
  p_dividend_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_dividend RECORD;
  v_header RECORD;
  v_was_stornoed boolean := false;
BEGIN
  v_uid := auth.uid();

  IF NOT public.check_user_can_auto_post_gl(p_company_id, true) THEN
    RAISE EXCEPTION 'Nincs jogosultsága az osztalék törléséhez (cég: %)', p_company_id;
  END IF;

  SELECT * INTO v_dividend
    FROM public.accounty_dividends
   WHERE id = p_dividend_id
     AND company_id = p_company_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Az osztalék rekord nem található: %', p_dividend_id;
  END IF;

  IF v_dividend.journal_entry_id IS NOT NULL THEN
    SELECT id, journal_number, status INTO v_header
      FROM public.acc_journal_headers
     WHERE id = v_dividend.journal_entry_id
     FOR UPDATE;

    IF v_header.id IS NOT NULL THEN
      IF v_header.status = 'KONYVELT' THEN
        PERFORM public.acc_storno_journal_entry(
          v_header.id,
          v_uid,
          'Osztalék tétel törölve a bérszámfejtésből (' || COALESCE(v_dividend.member_name, '') || ')',
          false
        );
        v_was_stornoed := true;
      ELSE
        DELETE FROM public.acc_journal_lines WHERE header_id = v_header.id;
        DELETE FROM public.acc_journal_headers WHERE id = v_header.id;
      END IF;
    END IF;
  END IF;

  DELETE FROM public.accounty_dividends
   WHERE id = p_dividend_id
     AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'success', true,
    'was_stornoed', v_was_stornoed,
    'message', CASE WHEN v_was_stornoed THEN 'Osztalék tétel sikeresen sztornózva a főkönyvből.' ELSE 'Osztalék rekord törölve.' END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_dividend_gl_entry(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_dividend_gl_entry(uuid, uuid) TO authenticated, service_role;


-- ─── 12. Secured Legacy GL RPCs ────────────────────────────────────────────────

-- 12.1 acc_post_journal_entry
CREATE OR REPLACE FUNCTION public.acc_post_journal_entry(p_header_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_header RECORD;
  v_next_num INTEGER;
  v_balance NUMERIC;
  v_period_closed BOOLEAN;
  v_valid_user_id UUID;
  v_invalid_line RECORD;
BEGIN
  -- 1. Lock header for update
  SELECT * INTO v_header FROM public.acc_journal_headers WHERE id = p_header_id FOR UPDATE;
  
  IF v_header IS NULL THEN
    RAISE EXCEPTION 'Journal entry header not found: %', p_header_id;
  END IF;

  -- 1b. Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(v_header.company_id, 'ledger_write');
  
  IF v_header.status = 'KONYVELT' THEN
    RETURN TRUE; -- Already posted
  END IF;

  -- 2. Check if period is closed
  SELECT EXISTS (
    SELECT 1 FROM public.acc_accounting_periods
     WHERE company_id = v_header.company_id
       AND year = EXTRACT(YEAR FROM v_header.posting_date)::SMALLINT
       AND month = EXTRACT(MONTH FROM v_header.posting_date)::SMALLINT
       AND is_closed = TRUE
  ) INTO v_period_closed;

  IF v_period_closed THEN
    RAISE EXCEPTION 'Cannot post to a closed period.';
  END IF;

  -- 3. Verify balance (T = K)
  SELECT COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE -amount END), 0)
    INTO v_balance
    FROM public.acc_journal_lines
   WHERE header_id = p_header_id;

  IF ABS(v_balance) > 0.01 THEN
    RAISE EXCEPTION 'Kettős könyvviteli egyensúlytalanság! Imbalance: %', v_balance;
  END IF;

  -- 4. Ensure lines exist
  IF NOT EXISTS (SELECT 1 FROM public.acc_journal_lines WHERE header_id = p_header_id) THEN
    RAISE EXCEPTION 'Journal entry must contain at least one line to post.';
  END IF;

  -- 5. Subledger Partner Enforcement
  SELECT l.id, g.gl_number, g.short_name INTO v_invalid_line
  FROM public.acc_journal_lines l
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  WHERE l.header_id = p_header_id
    AND g.subledger_type = 'partner'
  LIMIT 1;

  IF FOUND AND v_header.partner_id IS NULL THEN
    RAISE EXCEPTION 'Könyvelési hiba: A(z) % (%) főkönyvi szám partnerhez kötött folyószámla, rögzítéskor a partner megadása kötelező!',
      v_invalid_line.gl_number, v_invalid_line.short_name;
  END IF;

  -- 6. Allocate sequential journal number if not already present
  IF v_header.journal_number IS NOT NULL THEN
    v_next_num := v_header.journal_number;
  ELSE
    v_next_num := public.acc_get_next_journal_number(v_header.journal_id, v_header.accounting_year);
  END IF;

  -- 7. Validate user_id against auth.users (prefer auth.uid())
  SELECT id INTO v_valid_user_id 
    FROM auth.users 
   WHERE id = COALESCE(auth.uid(), p_user_id);

  -- 8. Update header
  UPDATE public.acc_journal_headers
     SET status = 'KONYVELT',
         journal_number = v_next_num,
         posting_timestamp = now(),
         posted_by = COALESCE(auth.uid(), v_valid_user_id),
         posted_at = now()
   WHERE id = p_header_id;

  RETURN TRUE;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_post_journal_entry(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_post_journal_entry(uuid, uuid) TO authenticated, service_role;


-- 12.2 acc_unpost_journal_entry
CREATE OR REPLACE FUNCTION public.acc_unpost_journal_entry(p_header_id uuid, p_user_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_header RECORD;
  v_period_closed BOOLEAN;
  v_vat_locked BOOLEAN;
  v_valid_user_id UUID;
BEGIN
  -- Lock header
  SELECT * INTO v_header 
    FROM public.acc_journal_headers 
   WHERE id = p_header_id 
     FOR UPDATE;

  IF v_header IS NULL THEN
    RAISE EXCEPTION 'A könyvelési tétel nem található: %', p_header_id;
  END IF;

  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(v_header.company_id, 'ledger_write');

  IF v_header.status <> 'KONYVELT' THEN
    RAISE EXCEPTION 'Csak lekönyvelt (KONYVELT) tételt lehet visszanyitni. Jelenlegi állapot: %', v_header.status;
  END IF;

  -- 1. Check accounting period lock
  SELECT EXISTS (
    SELECT 1 FROM public.acc_accounting_periods
     WHERE company_id = v_header.company_id
       AND year = EXTRACT(YEAR FROM v_header.posting_date)::SMALLINT
       AND month = EXTRACT(MONTH FROM v_header.posting_date)::SMALLINT
       AND is_closed = TRUE
  ) INTO v_period_closed;

  IF v_period_closed THEN
    RAISE EXCEPTION 'A könyvelési időszak le van zárva. Lezárt időszakban lévő tétel kizárólag számviteli sztornózással helyesbíthető!';
  END IF;

  -- 2. Check VAT lock
  SELECT EXISTS (
    SELECT 1 FROM public.vat_returns vr
     WHERE vr.company_id = v_header.company_id
       AND vr.period_year = EXTRACT(YEAR FROM v_header.posting_date)::INTEGER
       AND (
         (vr.frequency = 'monthly' AND vr.period_month = EXTRACT(MONTH FROM v_header.posting_date)::INTEGER)
         OR (vr.frequency = 'quarterly' AND vr.period_quarter = EXTRACT(QUARTER FROM v_header.posting_date)::INTEGER)
         OR (vr.frequency = 'annual')
       )
       AND vr.status = 'finalized'
  ) INTO v_vat_locked;

  IF v_vat_locked THEN
    RAISE EXCEPTION 'Az időszak ÁFA bevallása már véglegesítve van. Véglegesített ÁFA időszakban a tétel kizárólag számviteli sztornózással helyesbíthető!';
  END IF;

  SELECT id INTO v_valid_user_id 
    FROM auth.users 
   WHERE id = COALESCE(auth.uid(), p_user_id);

  PERFORM set_config('visibill.allow_unpost', 'true', true);

  UPDATE public.acc_journal_headers
     SET status = 'KEZI_PISZKOZAT',
         justification = COALESCE(p_reason, justification),
         posted_at = NULL,
         posted_by = NULL
   WHERE id = p_header_id;

  INSERT INTO public.acc_journal_audit_logs (
    company_id, entity_type, entity_id, event, old_status, new_status, reason, user_id, timestamp
  ) VALUES (
    v_header.company_id, 'acc_journal_headers', p_header_id, 'UNPOST', 'KONYVELT', 'KEZI_PISZKOZAT', COALESCE(p_reason, 'Tétel visszanyitva piszkozattá módosítás céljából'), COALESCE(auth.uid(), v_valid_user_id), now()
  );

  RETURN TRUE;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_unpost_journal_entry(uuid, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_unpost_journal_entry(uuid, uuid, text) TO authenticated, service_role;


-- 12.3 acc_storno_journal_entry
CREATE OR REPLACE FUNCTION public.acc_storno_journal_entry(p_header_id uuid, p_user_id uuid, p_reason text, p_create_correction boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_orig_header RECORD;
  v_storno_header_id UUID;
  v_corr_header_id UUID := NULL;
  v_next_num INTEGER;
  v_period_closed BOOLEAN;
  v_storno_date DATE;
  v_storno_year SMALLINT;
  v_actor_user_id UUID;
BEGIN
  SELECT * INTO v_orig_header FROM public.acc_journal_headers WHERE id = p_header_id FOR UPDATE;
  
  IF v_orig_header IS NULL THEN
    RAISE EXCEPTION 'Original journal entry header not found: %', p_header_id;
  END IF;

  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(v_orig_header.company_id, 'ledger_write');

  IF v_orig_header.status <> 'KONYVELT' THEN
    RAISE EXCEPTION 'Only posted (KONYVELT) entries can be stornoed.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.acc_accounting_periods
     WHERE company_id = v_orig_header.company_id
       AND year = EXTRACT(YEAR FROM v_orig_header.posting_date)::SMALLINT
       AND month = EXTRACT(MONTH FROM v_orig_header.posting_date)::SMALLINT
       AND is_closed = TRUE
  ) INTO v_period_closed;

  IF v_period_closed THEN
    v_storno_date := CURRENT_DATE;
    v_storno_year := EXTRACT(YEAR FROM v_storno_date)::SMALLINT;
  ELSE
    v_storno_date := v_orig_header.posting_date;
    v_storno_year := v_orig_header.accounting_year;
  END IF;

  v_actor_user_id := COALESCE(auth.uid(), p_user_id);

  UPDATE public.acc_journal_headers
     SET status = 'SZTORNOZOTT'
   WHERE id = p_header_id;

  v_next_num := public.acc_get_next_journal_number(v_orig_header.journal_id, v_storno_year);

  INSERT INTO public.acc_journal_headers (
    company_id, journal_id, accounting_year, status, entry_type, source,
    posting_date, document_date, posting_timestamp, document_id, partner_id,
    description, justification, currency, exchange_rate, exchange_rate_date,
    stornoed_entry_id, original_entry_id, journal_number, created_by, posted_by, posted_at
  ) VALUES (
    v_orig_header.company_id, v_orig_header.journal_id, v_storno_year, 'KONYVELT', 'SZTORNO', 'KEZI_MODOSITAS',
    v_storno_date, v_orig_header.document_date, now(), v_orig_header.document_id, v_orig_header.partner_id,
    'Sztornó: ' || v_orig_header.description, p_reason, v_orig_header.currency, v_orig_header.exchange_rate, v_orig_header.exchange_rate_date,
    p_header_id, p_header_id, v_next_num, v_actor_user_id, v_actor_user_id, now()
  ) RETURNING id INTO v_storno_header_id;

  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount,
    vat_code, vat_role, project_id, cost_center_id, description
  )
  SELECT
    v_storno_header_id, sequence_number, gl_account_id,
    CASE WHEN dc_type = 'T' THEN 'K' ELSE 'T' END,
    amount, foreign_amount, vat_code, vat_role, project_id, cost_center_id,
    'Sztornó: ' || COALESCE(description, '')
  FROM public.acc_journal_lines
  WHERE header_id = p_header_id;

  IF p_create_correction THEN
    INSERT INTO public.acc_journal_headers (
      company_id, journal_id, accounting_year, status, entry_type, source,
      posting_date, document_date, document_id, partner_id,
      description, justification, currency, exchange_rate, exchange_rate_date,
      original_entry_id, import_key, created_by
    ) VALUES (
      v_orig_header.company_id, v_orig_header.journal_id, v_storno_year, 'KEZI_PISZKOZAT', 'NORMAL', 'KEZI_MODOSITAS',
      v_storno_date, v_orig_header.document_date, v_orig_header.document_id, v_orig_header.partner_id,
      v_orig_header.description || ' (Javítás)', 'Helyesbítés az eredeti ' || COALESCE(v_orig_header.description, '') || ' tétel helyett.',
      v_orig_header.currency, v_orig_header.exchange_rate, v_orig_header.exchange_rate_date,
      p_header_id, v_orig_header.import_key, v_actor_user_id
    ) RETURNING id INTO v_corr_header_id;

    INSERT INTO public.acc_journal_lines (
      header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount,
      vat_code, vat_role, project_id, cost_center_id, description
    )
    SELECT
      v_corr_header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount,
      vat_code, vat_role, project_id, cost_center_id, description
    FROM public.acc_journal_lines
    WHERE header_id = p_header_id;
  END IF;

  RETURN COALESCE(v_corr_header_id, v_storno_header_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_storno_journal_entry(uuid, uuid, text, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_storno_journal_entry(uuid, uuid, text, boolean) TO authenticated, service_role;


-- 12.4 acc_validate_and_post_opening_entry
CREATE OR REPLACE FUNCTION public.acc_validate_and_post_opening_entry(p_header_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_header RECORD;
  v_curr TEXT;
  v_balance NUMERIC;
  v_count INTEGER;
  v_next_num INTEGER;
  v_actor_user_id UUID;
BEGIN
  SELECT h.*, j.code AS journal_code 
    INTO v_header 
    FROM public.acc_journal_headers h
    JOIN public.acc_journals j ON h.journal_id = j.id
   WHERE h.id = p_header_id FOR UPDATE;
  
  IF v_header IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nyitó bizonylat nem található.');
  END IF;

  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(v_header.company_id, 'ledger_write');
  
  IF v_header.status = 'KONYVELT' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Már lekönyvelt bizonylat.');
  END IF;

  v_curr := COALESCE(v_header.currency, 'HUF');

  IF NOT EXISTS (SELECT 1 FROM public.acc_journal_lines WHERE header_id = p_header_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A bizonylathoz nem tartoznak tételsorok.');
  END IF;

  SELECT COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE -amount END), 0), COUNT(*)
    INTO v_balance, v_count
    FROM public.acc_journal_lines
   WHERE header_id = p_header_id;

  IF ABS(v_balance) > 0.01 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Kettős könyvviteli egyensúlytalanság! Különbözet: ' || v_balance::text || ' ' || v_curr
    );
  END IF;

  IF v_header.journal_number IS NOT NULL THEN
    v_next_num := v_header.journal_number;
  ELSE
    v_next_num := public.acc_get_next_journal_number(v_header.journal_id, v_header.accounting_year);
  END IF;

  v_actor_user_id := COALESCE(auth.uid(), p_user_id);

  UPDATE public.acc_journal_headers
     SET status = 'KONYVELT',
         journal_number = v_next_num,
         posting_timestamp = now(),
         posted_by = v_actor_user_id,
         posted_at = now()
   WHERE id = p_header_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Nyitó bizonylat sikeresen lekönyvelve.',
    'journal_number', v_next_num
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_validate_and_post_opening_entry(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_validate_and_post_opening_entry(uuid, uuid) TO authenticated, service_role;


-- 12.5 acc_generate_post_opening_reconciliations
CREATE OR REPLACE FUNCTION public.acc_generate_post_opening_reconciliations(p_company_id uuid, p_user_id uuid, p_year smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_posting_date DATE;
  v_ve_journal_id UUID;
  v_419_account_id UUID;
  v_413_account_id UUID;
  v_466_account_id UUID;
  v_467_account_id UUID;
  v_468_account_id UUID;
  v_open_ar_sum NUMERIC := 0;
  v_open_ap_sum NUMERIC := 0;
  v_gl_311_opening NUMERIC := 0;
  v_gl_454_opening NUMERIC := 0;
  v_ar_diff NUMERIC := 0;
  v_ap_diff NUMERIC := 0;
  v_vat_diff NUMERIC := 0;
  v_vat_466 NUMERIC := 0;
  v_vat_467 NUMERIC := 0;
  v_vat_468 NUMERIC := 0;
  v_posted_count INTEGER := 0;
  v_reconciliation_details JSONB := '[]'::jsonb;
  v_header_id UUID;
  v_next_num INTEGER;
  v_actor_user_id UUID;
BEGIN
  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  v_posting_date := MAKE_DATE(p_year, 1, 1);
  v_actor_user_id := COALESCE(auth.uid(), p_user_id);

  SELECT id INTO v_ve_journal_id
    FROM public.acc_journals
   WHERE company_id = p_company_id AND code = 'VE'
   LIMIT 1;

  IF v_ve_journal_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A VE (Vegyes) napló nem található a cégnél.');
  END IF;

  SELECT id INTO v_419_account_id FROM public.gl_accounts WHERE gl_number LIKE '419%' LIMIT 1;
  SELECT id INTO v_413_account_id FROM public.gl_accounts WHERE gl_number LIKE '413%' LIMIT 1;
  SELECT id INTO v_466_account_id FROM public.gl_accounts WHERE gl_number LIKE '466%' LIMIT 1;
  SELECT id INTO v_467_account_id FROM public.gl_accounts WHERE gl_number LIKE '467%' LIMIT 1;
  SELECT id INTO v_468_account_id FROM public.gl_accounts WHERE gl_number LIKE '468%' LIMIT 1;

  SELECT COALESCE(SUM(COALESCE(brutto_vegosszeg, adoalap_osszesen + afa_osszeg_osszesen, 0)), 0)
    INTO v_open_ar_sum
    FROM public.invoices
   WHERE company_id = p_company_id
     AND invoice_direction = 'OUTBOUND'
     AND COALESCE(kibocsatas_datuma, teljesites_datuma) < v_posting_date
     AND (fizetve IS FALSE OR fizetve IS NULL);

  SELECT COALESCE(SUM(COALESCE(brutto_vegosszeg, adoalap_osszesen + afa_osszeg_osszesen, 0)), 0)
    INTO v_open_ap_sum
    FROM public.invoices
   WHERE company_id = p_company_id
     AND invoice_direction = 'INBOUND'
     AND COALESCE(kibocsatas_datuma, teljesites_datuma) < v_posting_date
     AND (fizetve IS FALSE OR fizetve IS NULL);

  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END), 0)
    INTO v_gl_311_opening
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.acc_journals j ON h.journal_id = j.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
   WHERE h.company_id = p_company_id
     AND j.code = 'NY'
     AND h.accounting_year = p_year
     AND h.status = 'KONYVELT'
     AND REPLACE(split_part(g.gl_number, '-', 1), '.', '') LIKE '311%';

  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'K' THEN l.amount ELSE -l.amount END), 0)
    INTO v_gl_454_opening
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.acc_journals j ON h.journal_id = j.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
   WHERE h.company_id = p_company_id
     AND j.code = 'NY'
     AND h.accounting_year = p_year
     AND h.status = 'KONYVELT'
     AND REPLACE(split_part(g.gl_number, '-', 1), '.', '') LIKE '454%';

  v_ar_diff := v_gl_311_opening - v_open_ar_sum;
  v_ap_diff := v_gl_454_opening - v_open_ap_sum;

  IF ABS(v_ar_diff) > 0.01 AND v_419_account_id IS NOT NULL THEN
    v_next_num := public.acc_get_next_journal_number(v_ve_journal_id, p_year);
    INSERT INTO public.acc_journal_headers (
      company_id, journal_id, accounting_year, journal_number, status, entry_type, source,
      posting_date, document_date, description, justification, created_by, posted_by, posted_at
    ) VALUES (
      p_company_id, v_ve_journal_id, p_year, v_next_num, 'KONYVELT', 'NORMAL', 'NYITO_EGYEZTETES',
      v_posting_date, v_posting_date, 'Vevő analitika és főkönyvi nyitó egyeztetés',
      'Nyitó különbözet átvezetése technikai számlára', v_actor_user_id, v_actor_user_id, now()
    ) RETURNING id INTO v_header_id;

    IF v_ar_diff > 0 THEN
      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
      VALUES (v_header_id, 1, v_419_account_id, 'T', v_ar_diff, 'Nyitó vevő különbözet');
      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
      SELECT v_header_id, 2, id, 'K', v_ar_diff, 'Nyitó vevő különbözet ellenszámla'
      FROM public.gl_accounts WHERE gl_number LIKE '311%' LIMIT 1;
    ELSE
      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
      SELECT v_header_id, 1, id, 'T', ABS(v_ar_diff), 'Nyitó vevő különbözet ellenszámla'
      FROM public.gl_accounts WHERE gl_number LIKE '311%' LIMIT 1;
      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
      VALUES (v_header_id, 2, v_419_account_id, 'K', ABS(v_ar_diff), 'Nyitó vevő különbözet');
    END IF;

    v_posted_count := v_posted_count + 1;
    v_reconciliation_details := v_reconciliation_details || jsonb_build_object('type', 'AR_RECONCILIATION', 'amount', v_ar_diff, 'header_id', v_header_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'posted_count', v_posted_count,
    'ar_diff', v_ar_diff,
    'ap_diff', v_ap_diff,
    'details', v_reconciliation_details
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_generate_post_opening_reconciliations(uuid, uuid, smallint) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_generate_post_opening_reconciliations(uuid, uuid, smallint) TO authenticated, service_role;


-- 12.6 acc_generate_drafts_from_ledger
CREATE OR REPLACE FUNCTION public.acc_generate_drafts_from_ledger(p_company_id uuid, p_preset_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_company_vat_regime text;
  v_is_penzforgalmi boolean := false;
  v_journal_ve_id uuid;
BEGIN
  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  DELETE FROM public.acc_journal_headers 
   WHERE company_id = p_company_id 
     AND status = 'GEPI_JAVASLAT';

  PERFORM public.acc_seed_default_journals(p_company_id);

  SELECT COALESCE(c.vat_regime, 'normal') INTO v_company_vat_regime
  FROM public.companies c WHERE c.id = p_company_id;
  v_is_penzforgalmi := (v_company_vat_regime = 'penzforgalmi');

  SELECT fx_realized_journal_id INTO v_journal_ve_id
    FROM public.company_auto_accounting_rules
   WHERE company_id = p_company_id;

  IF v_journal_ve_id IS NULL THEN
    SELECT id INTO v_journal_ve_id
      FROM public.acc_journals
     WHERE company_id = p_company_id AND code = 'VE'
     LIMIT 1;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_generate_drafts_from_ledger(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_generate_drafts_from_ledger(uuid, uuid) TO authenticated, service_role;


-- 12.7 acc_seed_default_journals
CREATE OR REPLACE FUNCTION public.acc_seed_default_journals(p_company_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  INSERT INTO public.acc_journals (company_id, code, name, type, connected_gl_account, currency)
  VALUES
    (p_company_id, 'NY', 'Nyitó tételek', 'OPENING', '491', 'HUF'),
    (p_company_id, 'B1', 'K&H bank HUF', 'BANK', '3841', 'HUF'),
    (p_company_id, 'B2', 'K&H bank EUR', 'BANK', '3861', 'EUR'),
    (p_company_id, 'P1', 'Házipénztár HUF', 'PETTY_CASH', '3811', 'HUF'),
    (p_company_id, 'V', 'Vevő számlák', 'CUSTOMER', '311', 'HUF'),
    (p_company_id, 'SZ', 'Szállító számlák', 'SUPPLIER', '454', 'HUF'),
    (p_company_id, 'VE', 'Vegyes tételek', 'MIXED', NULL, 'HUF'),
    (p_company_id, 'BÉR', 'Bérfeladás', 'SYSTEM', NULL, 'HUF'),
    (p_company_id, 'Z', 'Záró tételek', 'CLOSING', '492', 'HUF')
  ON CONFLICT (company_id, code) DO NOTHING;
  
  RETURN TRUE;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_seed_default_journals(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_seed_default_journals(uuid) TO authenticated, service_role;


-- 12.8 acc_copy_chart_of_accounts
CREATE OR REPLACE FUNCTION public.acc_copy_chart_of_accounts(p_source_company_id uuid, p_target_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_source_company_name TEXT;
  v_target_company_name TEXT;
  v_source_preset_id UUID;
  v_target_preset_id UUID;
  v_copied_count INTEGER := 0;
BEGIN
  -- Authorization check: senior on target, member_write on source
  PERFORM public.assert_company_role_tier(p_target_company_id, 'senior');
  PERFORM public.assert_company_role_tier(p_source_company_id, 'member_write');

  SELECT name INTO v_source_company_name FROM public.companies WHERE id = p_source_company_id;
  IF v_source_company_name IS NULL THEN
    RAISE EXCEPTION 'Forrás cég nem található: %', p_source_company_id;
  END IF;

  SELECT name INTO v_target_company_name FROM public.companies WHERE id = p_target_company_id;
  IF v_target_company_name IS NULL THEN
    RAISE EXCEPTION 'Cél cég nem található: %', p_target_company_id;
  END IF;

  IF p_source_company_id = p_target_company_id THEN
    RAISE EXCEPTION 'A forrás és cél cég nem lehet azonos!';
  END IF;

  SELECT id INTO v_source_preset_id 
    FROM public.chart_of_accounts_presets 
   WHERE company_id = p_source_company_id
   ORDER BY created_at DESC LIMIT 1;

  IF v_source_preset_id IS NULL THEN
    RAISE EXCEPTION 'A forrás cégnek nincs másolható számlatükre.';
  END IF;

  SELECT id INTO v_target_preset_id 
    FROM public.chart_of_accounts_presets 
   WHERE company_id = p_target_company_id
   ORDER BY created_at DESC LIMIT 1;

  IF v_target_preset_id IS NULL THEN
    INSERT INTO public.chart_of_accounts_presets (company_id, name, type, is_active)
    VALUES (p_target_company_id, 'Másolt számlatükör - ' || v_source_company_name, 'custom', true)
    RETURNING id INTO v_target_preset_id;
  END IF;

  INSERT INTO public.gl_accounts (
    preset_id, gl_number, name, short_name, account_type, subledger_type, is_active, is_open_item_managed
  )
  SELECT 
    v_target_preset_id, s.gl_number, s.name, s.short_name, s.account_type, s.subledger_type, s.is_active, s.is_open_item_managed
  FROM public.gl_accounts s
  WHERE s.preset_id = v_source_preset_id
  ON CONFLICT (preset_id, gl_number) DO UPDATE
    SET name = EXCLUDED.name,
        short_name = EXCLUDED.short_name,
        account_type = EXCLUDED.account_type,
        subledger_type = EXCLUDED.subledger_type,
        is_open_item_managed = EXCLUDED.is_open_item_managed;

  GET DIAGNOSTICS v_copied_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'copied_count', v_copied_count,
    'source_company', v_source_company_name,
    'target_company', v_target_company_name
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_copy_chart_of_accounts(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_copy_chart_of_accounts(uuid, uuid) TO authenticated, service_role;


-- 12.9 delete_chart_of_accounts_preset
CREATE OR REPLACE FUNCTION public.delete_chart_of_accounts_preset(p_preset_id uuid, p_target_preset_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_source RECORD;
  v_target RECORD;
  v_migrated_accounts INTEGER := 0;
BEGIN
  SELECT * INTO v_source FROM public.chart_of_accounts_presets WHERE id = p_preset_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A törlendő számlatükör sablon nem található.' USING ERRCODE = 'P0002';
  END IF;

  IF v_source.company_id IS NULL OR v_source.type <> 'custom' THEN
    RAISE EXCEPTION 'Rendszerszintű vagy beépített számlatükör sablon nem törölhető.' USING ERRCODE = '42501';
  END IF;

  -- Authorization check: senior tier required on company
  PERFORM public.assert_company_role_tier(v_source.company_id, 'senior');

  SELECT * INTO v_target FROM public.chart_of_accounts_presets WHERE id = p_target_preset_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A célsablon nem található.' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.chart_of_accounts_presets WHERE id = p_preset_id;

  RETURN jsonb_build_object('success', true, 'deleted_preset_id', p_preset_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_chart_of_accounts_preset(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_chart_of_accounts_preset(uuid, uuid) TO authenticated, service_role;


-- 12.10 settle_open_items
CREATE OR REPLACE FUNCTION public.settle_open_items(p_company_id uuid, p_invoice_line_id uuid, p_settling_line_id uuid, p_amount_huf numeric, p_amount_foreign numeric DEFAULT NULL::numeric, p_match_type character varying DEFAULT 'MANUAL'::character varying, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match_id UUID;
BEGIN
  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  IF p_amount_huf <= 0 THEN
    RAISE EXCEPTION 'A rendezett összegnek pozitívnak kell lennie!';
  END IF;

  INSERT INTO public.acc_open_item_matches (
    company_id,
    invoice_line_id,
    settling_line_id,
    settled_amount_huf,
    settled_amount_foreign,
    settled_by,
    match_type,
    notes
  ) VALUES (
    p_company_id,
    p_invoice_line_id,
    p_settling_line_id,
    p_amount_huf,
    p_amount_foreign,
    auth.uid(),
    p_match_type,
    p_notes
  ) RETURNING id INTO v_match_id;

  RETURN v_match_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.settle_open_items(uuid, uuid, uuid, numeric, numeric, character varying, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_open_items(uuid, uuid, uuid, numeric, numeric, character varying, text) TO authenticated, service_role;


-- 12.11 unsettle_open_items
CREATE OR REPLACE FUNCTION public.unsettle_open_items(p_company_id uuid, p_match_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  DELETE FROM public.acc_open_item_matches
  WHERE id = p_match_id AND company_id = p_company_id;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.unsettle_open_items(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsettle_open_items(uuid, uuid) TO authenticated, service_role;


-- 12.12 write_off_subledger_difference
CREATE OR REPLACE FUNCTION public.write_off_subledger_difference(p_company_id uuid, p_line_id uuid, p_type character varying DEFAULT 'ROUNDING'::character varying, p_amount_huf numeric DEFAULT 0, p_target_gl_id uuid DEFAULT NULL::uuid, p_description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_line RECORD;
  v_header RECORD;
  v_auto_rules RECORD;
  v_journal_id UUID;
  v_new_header_id UUID;
  v_next_num INTEGER;
BEGIN
  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  SELECT * INTO v_line FROM public.acc_journal_lines WHERE id = p_line_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A könyvelési sor nem található!';
  END IF;

  SELECT * INTO v_header FROM public.acc_journal_headers WHERE id = v_line.header_id;
  IF v_header.company_id <> p_company_id THEN
    RAISE EXCEPTION 'Jogosulatlan hozzáférés!';
  END IF;

  SELECT * INTO v_auto_rules
    FROM public.company_auto_accounting_rules
   WHERE company_id = p_company_id;

  IF v_auto_rules.fx_realized_journal_id IS NOT NULL AND p_type IN ('FX_GAIN', 'FX_LOSS') THEN
    v_journal_id := v_auto_rules.fx_realized_journal_id;
  ELSE
    SELECT id INTO v_journal_id
      FROM public.acc_journals
     WHERE company_id = p_company_id AND code = 'VE'
     LIMIT 1;
  END IF;

  IF v_journal_id IS NULL THEN
    RAISE EXCEPTION 'A VE (Vegyes) napló nem található a cégnél!';
  END IF;

  v_next_num := public.acc_get_next_journal_number(v_journal_id, v_header.accounting_year);

  INSERT INTO public.acc_journal_headers (
    company_id, journal_id, accounting_year, journal_number, status, entry_type, source,
    posting_date, document_date, partner_id, description, justification, created_by, posted_by, posted_at
  ) VALUES (
    p_company_id, v_journal_id, v_header.accounting_year, v_next_num, 'KONYVELT', 'NORMAL', 'KULONBOZET_LEIRAS',
    CURRENT_DATE, CURRENT_DATE, v_header.partner_id,
    COALESCE(p_description, 'Folyószámla különbözet leírás'), 'Különbözet leírás',
    auth.uid(), auth.uid(), now()
  ) RETURNING id INTO v_new_header_id;

  INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
  VALUES (v_new_header_id, 1, p_target_gl_id, 'T', p_amount_huf, p_description);

  INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
  VALUES (v_new_header_id, 2, v_line.gl_account_id, 'K', p_amount_huf, p_description);

  RETURN jsonb_build_object('success', true, 'header_id', v_new_header_id, 'journal_number', v_next_num);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.write_off_subledger_difference(uuid, uuid, character varying, numeric, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_off_subledger_difference(uuid, uuid, character varying, numeric, uuid, text) TO authenticated, service_role;


-- 12.13 post_cash_report_to_gl
CREATE OR REPLACE FUNCTION public.post_cash_report_to_gl(p_company_id uuid, p_cash_report_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_user_id uuid;
  v_validation jsonb;
  v_report RECORD;
  v_cash_gl text;
  v_journal_id uuid;
  v_next_num integer;
  v_header_id uuid;
  v_petty_gl_id uuid;
  v_lines_count integer := 0;
  v_entry RECORD;
  v_seq integer := 0;
  v_contra_gl_id uuid;
  v_year smallint;
BEGIN
  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  v_user_id := (SELECT auth.uid());

  v_validation := public.validate_cash_report_for_posting(p_company_id, p_cash_report_id);
  IF NOT (v_validation->>'valid')::boolean THEN
    RAISE EXCEPTION 'A feladás sikertelen az alábbi hibák miatt: %', v_validation->>'errors';
  END IF;

  SELECT * INTO v_report
    FROM public.cash_reports
   WHERE id = p_cash_report_id
     AND company_id = p_company_id
   FOR UPDATE;

  SELECT COALESCE(gl_account, '381') INTO v_cash_gl
    FROM public.petty_cash_registers
   WHERE id = v_report.cash_register_id;

  SELECT id INTO v_journal_id
    FROM public.acc_journals
   WHERE company_id = p_company_id AND code = 'P1'
   LIMIT 1;

  IF v_journal_id IS NULL THEN
    PERFORM public.acc_seed_default_journals(p_company_id);
    SELECT id INTO v_journal_id
      FROM public.acc_journals
     WHERE company_id = p_company_id AND code = 'P1'
     LIMIT 1;
  END IF;

  v_year := EXTRACT(YEAR FROM COALESCE(v_report.period_to, v_report.created_at))::smallint;
  v_next_num := public.acc_get_next_journal_number(v_journal_id, v_year);

  SELECT id INTO v_petty_gl_id
    FROM public.gl_accounts
   WHERE gl_number LIKE (v_cash_gl || '%')
   ORDER BY length(gl_number) ASC LIMIT 1;

  INSERT INTO public.acc_journal_headers (
    company_id, journal_id, accounting_year, journal_number, status, entry_type, source,
    posting_date, document_date, document_id, description, currency, import_key,
    created_by, posted_by, posted_at
  ) VALUES (
    p_company_id, v_journal_id, v_year, v_next_num, 'KONYVELT', 'NORMAL', 'CASH_REPORT',
    COALESCE(v_report.period_to, CURRENT_DATE), COALESCE(v_report.period_to, CURRENT_DATE),
    v_report.report_number, 'Házipénztár feladás: ' || v_report.report_number, 'HUF',
    p_cash_report_id::text, v_user_id, v_user_id, now()
  ) RETURNING id INTO v_header_id;

  FOR v_entry IN
    SELECT * FROM public.petty_cash_entries
     WHERE cash_report_id = p_cash_report_id
       AND status <> 'cancelled'
     ORDER BY entry_date ASC, id ASC
  LOOP
    v_seq := v_seq + 1;
    SELECT id INTO v_contra_gl_id FROM public.gl_accounts WHERE gl_number LIKE (trim(v_entry.gl_contra_account) || '%') ORDER BY length(gl_number) ASC LIMIT 1;
    IF v_entry.entry_type = 'INCOME' THEN
      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
      VALUES (v_header_id, v_seq, v_petty_gl_id, 'T', v_entry.amount, v_entry.description);
      v_seq := v_seq + 1;
      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
      VALUES (v_header_id, v_seq, v_contra_gl_id, 'K', v_entry.amount, v_entry.description);
    ELSE
      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
      VALUES (v_header_id, v_seq, v_contra_gl_id, 'T', v_entry.amount, v_entry.description);
      v_seq := v_seq + 1;
      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
      VALUES (v_header_id, v_seq, v_petty_gl_id, 'K', v_entry.amount, v_entry.description);
    END IF;
    v_lines_count := v_lines_count + 1;
  END LOOP;

  UPDATE public.cash_reports
     SET status = 'posted',
         updated_at = now()
   WHERE id = p_cash_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'header_id', v_header_id,
    'journal_number', v_next_num,
    'lines_count', v_lines_count,
    'cash_report_id', p_cash_report_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.post_cash_report_to_gl(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_cash_report_to_gl(uuid, uuid) TO authenticated, service_role;


-- 12.14 unpost_cash_report_from_gl
CREATE OR REPLACE FUNCTION public.unpost_cash_report_from_gl(p_company_id uuid, p_cash_report_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_report RECORD;
  v_header_id uuid;
  v_user_id uuid;
  v_gl_table_exists boolean;
BEGIN
  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  v_user_id := (SELECT auth.uid());

  SELECT * INTO v_report
    FROM public.cash_reports
   WHERE id = p_cash_report_id
     AND company_id = p_company_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A pénztárjelentés nem található.';
  END IF;

  IF v_report.status <> 'posted' THEN
    RAISE EXCEPTION 'Csak feladott pénztárjelentés feladása vonható vissza (jelenlegi státusz: %).', v_report.status;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
     WHERE table_schema = 'public' 
       AND table_name = 'acc_journal_headers'
  ) INTO v_gl_table_exists;

  IF v_gl_table_exists THEN
    SELECT id INTO v_header_id
      FROM public.acc_journal_headers
     WHERE company_id = p_company_id
       AND source = 'CASH_REPORT'
       AND import_key = p_cash_report_id::text
     LIMIT 1;

    IF v_header_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'acc_unpost_journal_entry') THEN
        PERFORM public.acc_unpost_journal_entry(v_header_id, v_user_id, 'Pénztárjelentés feladás visszavonása');
      END IF;
    END IF;
  END IF;

  UPDATE public.cash_reports
     SET status = 'closed',
         notes = COALESCE(notes || E'\n', '') || '[Feladás visszavonva: ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ']',
         updated_at = now()
   WHERE id = p_cash_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'cash_report_id', p_cash_report_id,
    'status', 'closed'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.unpost_cash_report_from_gl(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.unpost_cash_report_from_gl(uuid, uuid) TO authenticated, service_role;


-- 12.15 validate_cash_report_for_posting
CREATE OR REPLACE FUNCTION public.validate_cash_report_for_posting(p_company_id uuid, p_cash_report_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_report RECORD;
  v_missing_contra integer := 0;
  v_pending_count integer := 0;
  v_items_count integer := 0;
  v_is_valid boolean := true;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  -- Authorization check: member_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'member_write');

  SELECT * INTO v_report
    FROM public.cash_reports
   WHERE id = p_cash_report_id
     AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'errors', jsonb_build_array('A pénztárjelentés nem található.'));
  END IF;

  IF v_report.status NOT IN ('closed', 'posted') THEN
    v_errors := v_errors || jsonb_build_array('Csak lezárt pénztárjelentés adható fel a főkönyvbe! (Jelenlegi státusz: ' || v_report.status || ')');
    v_is_valid := false;
  END IF;

  SELECT COUNT(*) INTO v_missing_contra
    FROM public.petty_cash_entries
   WHERE cash_report_id = p_cash_report_id
     AND status <> 'cancelled'
     AND (gl_contra_account IS NULL OR trim(gl_contra_account) = '');

  IF v_missing_contra > 0 THEN
    v_errors := v_errors || jsonb_build_array(v_missing_contra::text || ' db tételhez hiányzik a főkönyvi ellenszámla!');
    v_is_valid := false;
  END IF;

  SELECT COUNT(*) INTO v_pending_count
    FROM public.petty_cash_entries
   WHERE cash_report_id = p_cash_report_id
     AND status = 'pending_approval';

  IF v_pending_count > 0 THEN
    v_errors := v_errors || jsonb_build_array(v_pending_count::text || ' db tétel még jóváhagyásra vár!');
    v_is_valid := false;
  END IF;

  SELECT COUNT(*) INTO v_items_count
    FROM public.petty_cash_entries
   WHERE cash_report_id = p_cash_report_id
     AND status <> 'cancelled';

  RETURN jsonb_build_object(
    'valid', v_is_valid,
    'errors', v_errors,
    'report_number', v_report.report_number,
    'status', v_report.status,
    'items_count', v_items_count,
    'missing_contra_count', v_missing_contra,
    'closing_balance', COALESCE(v_report.closing_balance_actual, v_report.closing_balance_book)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.validate_cash_report_for_posting(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_cash_report_for_posting(uuid, uuid) TO authenticated, service_role;


-- 12.16 batch_post_subledger_items
CREATE OR REPLACE FUNCTION public.batch_post_subledger_items(p_company_id uuid, p_header_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hid UUID;
  v_count INTEGER := 0;
BEGIN
  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  FOREACH v_hid IN ARRAY p_header_ids
  LOOP
    BEGIN
      PERFORM public.acc_post_journal_entry(v_hid, auth.uid());
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to post header %: %', v_hid, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.batch_post_subledger_items(uuid, uuid[]) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.batch_post_subledger_items(uuid, uuid[]) TO authenticated, service_role;


-- 12.17 auto_settle_subledger_items
CREATE OR REPLACE FUNCTION public.auto_settle_subledger_items(p_company_id uuid, p_gl_account_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rec RECORD;
  v_matched_count INTEGER := 0;
  v_total_amount NUMERIC(18,2) := 0;
  v_pair_amount NUMERIC(18,2);
BEGIN
  -- Authorization check: ledger_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  FOR v_rec IN
    SELECT 
      t_line.id as t_id,
      k_line.id as k_id,
      t_line.amount as t_amount,
      k_line.amount as k_amount,
      t_head.document_id as doc_id
    FROM public.acc_journal_lines t_line
    JOIN public.acc_journal_headers t_head ON t_head.id = t_line.header_id
    JOIN public.gl_accounts t_gl ON t_gl.id = t_line.gl_account_id
    JOIN public.acc_journal_headers k_head 
      ON k_head.company_id = p_company_id 
      AND k_head.partner_id = t_head.partner_id
      AND UPPER(TRIM(k_head.document_id)) = UPPER(TRIM(t_head.document_id))
    JOIN public.acc_journal_lines k_line ON k_line.header_id = k_head.id AND k_line.gl_account_id = t_line.gl_account_id
    WHERE t_head.company_id = p_company_id
      AND t_line.dc_type = 'T'
      AND k_line.dc_type = 'K'
      AND (t_gl.is_open_item_managed = true OR t_gl.subledger_type IN ('partner', 'detail'))
      AND (p_gl_account_id IS NULL OR t_line.gl_account_id = p_gl_account_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_open_item_matches m 
        WHERE m.company_id = p_company_id AND (m.invoice_line_id = t_line.id OR m.settling_line_id = t_line.id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_open_item_matches m 
        WHERE m.company_id = p_company_id AND (m.invoice_line_id = k_line.id OR m.settling_line_id = k_line.id)
      )
  LOOP
    v_pair_amount := LEAST(v_rec.t_amount, v_rec.k_amount);
    IF v_pair_amount > 0.01 THEN
      PERFORM public.settle_open_items(
        p_company_id,
        v_rec.t_id,
        v_rec.k_id,
        v_pair_amount,
        NULL,
        'AUTO_REF',
        'Automatikus párosítás azonos hivatkozás alapján (' || v_rec.doc_id || ')'
      );
      v_matched_count := v_matched_count + 1;
      v_total_amount := v_total_amount + v_pair_amount;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'matched_count', v_matched_count,
    'total_amount', v_total_amount
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.auto_settle_subledger_items(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_settle_subledger_items(uuid, uuid) TO authenticated, service_role;


-- 12.18 override_gl_classification
CREATE OR REPLACE FUNCTION public.override_gl_classification(p_item_id uuid, p_source_table text, p_new_gl_account_id uuid, p_original_gl_account_id uuid, p_company_id uuid, p_user_id uuid, p_preset_id uuid, p_new_gl_number text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_user_id UUID;
BEGIN
  -- Authorization check: member_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'member_write');

  v_actor_user_id := COALESCE(auth.uid(), p_user_id);

  IF p_new_gl_account_id IS NULL THEN
    DELETE FROM public.gl_overrides_log WHERE item_id = p_item_id;

    IF p_source_table = 'transactions' THEN
      UPDATE public.transactions 
      SET gl_classifications = gl_classifications - p_preset_id::text 
      WHERE id = p_item_id;
    ELSIF p_source_table = 'invoices' THEN
      UPDATE public.invoices 
      SET gl_classifications = gl_classifications - p_preset_id::text 
      WHERE id = p_item_id;
    ELSIF p_source_table = 'invoice_items' THEN
      UPDATE public.invoice_items 
      SET gl_classifications = gl_classifications - p_preset_id::text 
      WHERE id = p_item_id;
    ELSIF p_source_table = 'nav_invoice_items' THEN
      UPDATE public.nav_invoice_items 
      SET gl_classifications = gl_classifications - p_preset_id::text 
      WHERE id = p_item_id;
    END IF;

  ELSE
    INSERT INTO public.gl_overrides_log (
      item_id, source_table, original_gl_account_id, new_gl_account_id, company_id, user_id, created_at
    ) VALUES (
      p_item_id, p_source_table, p_original_gl_account_id, p_new_gl_account_id, p_company_id, v_actor_user_id, now()
    );

    IF p_source_table = 'transactions' THEN
      UPDATE public.transactions
      SET gl_classifications = jsonb_set(
        COALESCE(gl_classifications, '{}'::jsonb), 
        array[p_preset_id::text], 
        jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')
      )
      WHERE id = p_item_id;
    ELSIF p_source_table = 'invoices' THEN
      UPDATE public.invoices
      SET gl_classifications = jsonb_set(
        COALESCE(gl_classifications, '{}'::jsonb), 
        array[p_preset_id::text], 
        jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')
      )
      WHERE id = p_item_id;
    ELSIF p_source_table = 'invoice_items' THEN
      UPDATE public.invoice_items
      SET gl_classifications = jsonb_set(
        COALESCE(gl_classifications, '{}'::jsonb), 
        array[p_preset_id::text], 
        jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')
      )
      WHERE id = p_item_id;
    ELSIF p_source_table = 'nav_invoice_items' THEN
      UPDATE public.nav_invoice_items
      SET gl_classifications = jsonb_set(
        COALESCE(gl_classifications, '{}'::jsonb), 
        array[p_preset_id::text], 
        jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')
      )
      WHERE id = p_item_id;
    END IF;

    PERFORM set_config('visibill.allow_gl_remap', 'true', true);

    UPDATE public.acc_journal_lines ajl
    SET gl_account_id = p_new_gl_account_id
    FROM public.acc_journal_headers ajh
    WHERE ajl.header_id = ajh.id
      AND ajh.import_key = p_item_id::text
      AND ajh.status <> 'SZTORNOZOTT'
      AND (
        (p_original_gl_account_id IS NOT NULL AND ajl.gl_account_id = p_original_gl_account_id)
        OR (p_original_gl_account_id IS NULL AND NOT EXISTS (
          SELECT 1 FROM public.gl_accounts ga 
          WHERE ga.id = ajl.gl_account_id 
            AND (ga.gl_number LIKE '311%' OR ga.gl_number LIKE '454%' OR ga.gl_number LIKE '38%' OR ga.gl_number LIKE '466%' OR ga.gl_number LIKE '467%')
        ))
      );
  END IF;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.override_gl_classification(uuid, text, uuid, uuid, uuid, uuid, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.override_gl_classification(uuid, text, uuid, uuid, uuid, uuid, uuid, text) TO authenticated, service_role;


-- 12.19 override_gl_classifications_batch
CREATE OR REPLACE FUNCTION public.override_gl_classifications_batch(p_items jsonb, p_new_gl_account_id uuid, p_company_id uuid, p_user_id uuid, p_preset_id uuid, p_new_gl_number text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
BEGIN
  -- Authorization check: member_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'member_write');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    PERFORM public.override_gl_classification(
      (v_item->>'item_id')::uuid,
      v_item->>'source_table',
      p_new_gl_account_id,
      (v_item->>'original_gl_account_id')::uuid,
      p_company_id,
      p_user_id,
      p_preset_id,
      p_new_gl_number
    );
  END LOOP;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.override_gl_classifications_batch(jsonb, uuid, uuid, uuid, uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.override_gl_classifications_batch(jsonb, uuid, uuid, uuid, uuid, text) TO authenticated, service_role;


-- 12.20 set_invoice_accounting_exclusion
CREATE OR REPLACE FUNCTION public.set_invoice_accounting_exclusion(p_company_id uuid, p_invoice_id uuid, p_is_submitted boolean, p_exclusion_type text, p_reason text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  -- Authorization check: member_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'member_write');

  v_user_id := COALESCE(auth.uid(), p_user_id);

  IF p_is_submitted THEN
    UPDATE public.submitted_invoices
       SET is_excluded_from_accounting = (p_exclusion_type IS NOT NULL),
           accounting_exclusion_type = p_exclusion_type,
           accounting_exclusion_reason = p_reason,
           accounting_excluded_by = CASE WHEN p_exclusion_type IS NOT NULL THEN v_user_id ELSE NULL END,
           accounting_excluded_at = CASE WHEN p_exclusion_type IS NOT NULL THEN now() ELSE NULL END
     WHERE id = p_invoice_id AND company_id = p_company_id;
  ELSE
    UPDATE public.invoices
       SET is_excluded_from_accounting = (p_exclusion_type IS NOT NULL),
           accounting_exclusion_type = p_exclusion_type,
           accounting_exclusion_reason = p_reason,
           accounting_excluded_by = CASE WHEN p_exclusion_type IS NOT NULL THEN v_user_id ELSE NULL END,
           accounting_excluded_at = CASE WHEN p_exclusion_type IS NOT NULL THEN now() ELSE NULL END
     WHERE id = p_invoice_id AND company_id = p_company_id;
  END IF;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_invoice_accounting_exclusion(uuid, uuid, boolean, text, text, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_invoice_accounting_exclusion(uuid, uuid, boolean, text, text, uuid) TO authenticated, service_role;


-- 12.21 toggle_invoice_item_exclude_from_accounting
CREATE OR REPLACE FUNCTION public.toggle_invoice_item_exclude_from_accounting(p_company_id uuid, p_item_id uuid, p_is_submitted boolean, p_exclude boolean, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  -- Authorization check: member_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'member_write');

  v_user_id := COALESCE(auth.uid(), p_user_id);

  IF p_is_submitted THEN
    UPDATE public.submitted_invoice_items
       SET is_excluded_from_accounting = p_exclude,
           excluded_by = CASE WHEN p_exclude THEN v_user_id ELSE NULL END,
           excluded_at = CASE WHEN p_exclude THEN now() ELSE NULL END
     WHERE id = p_item_id;
  ELSE
    UPDATE public.invoice_items
       SET is_excluded_from_accounting = p_exclude,
           excluded_by = CASE WHEN p_exclude THEN v_user_id ELSE NULL END,
           excluded_at = CASE WHEN p_exclude THEN now() ELSE NULL END
     WHERE id = p_item_id;
  END IF;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.toggle_invoice_item_exclude_from_accounting(uuid, uuid, boolean, boolean, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_invoice_item_exclude_from_accounting(uuid, uuid, boolean, boolean, uuid) TO authenticated, service_role;


-- 12.22 toggle_invoice_exclude_from_accounting
CREATE OR REPLACE FUNCTION public.toggle_invoice_exclude_from_accounting(p_company_id uuid, p_invoice_id uuid, p_is_submitted boolean, p_exclude boolean, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization check: member_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'member_write');

  RETURN public.set_invoice_accounting_exclusion(
    p_company_id,
    p_invoice_id,
    p_is_submitted,
    CASE WHEN p_exclude THEN 'PERMANENT' ELSE NULL END,
    NULL,
    p_user_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.toggle_invoice_exclude_from_accounting(uuid, uuid, boolean, boolean, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_invoice_exclude_from_accounting(uuid, uuid, boolean, boolean, uuid) TO authenticated, service_role;


-- 12.23 calculate_vat_return
CREATE OR REPLACE FUNCTION public.calculate_vat_return(p_company_id uuid, p_year integer, p_month integer, p_frequency text DEFAULT 'H'::text, p_scope text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_country_code TEXT := 'HU';
BEGIN
  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hiányzó company_id');
  END IF;

  -- Authorization check: member_write tier required (can calculate and view return)
  PERFORM public.assert_company_role_tier(p_company_id, 'member_write');

  SELECT COALESCE(country_code, 'HU') INTO v_country_code
  FROM public.companies WHERE id = p_company_id;

  IF v_country_code = 'HR' THEN
    RETURN public.calculate_croatian_vat_return(p_company_id, p_year, p_month, p_frequency);
  ELSE
    RETURN public.calculate_hungarian_vat_return(p_company_id, p_year, p_month, p_frequency);
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_vat_return(uuid, integer, integer, text, text) TO authenticated, service_role;


-- 12.24 get_mkvk_audit_xml_data
CREATE OR REPLACE FUNCTION public.get_mkvk_audit_xml_data(p_company_id uuid, p_date_from date, p_date_to date, p_include_opening boolean DEFAULT true, p_include_closing boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company record;
  v_result jsonb;
BEGIN
  -- Authorization check: senior tier required for official audit XML export
  PERFORM public.assert_company_role_tier(p_company_id, 'senior');

  SELECT * INTO v_company FROM public.companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found: %', p_company_id;
  END IF;

  v_result := jsonb_build_object(
    'company', jsonb_build_object('id', v_company.id, 'name', v_company.name, 'tax_number', v_company.tax_number),
    'export_date', now(),
    'period_from', p_date_from,
    'period_to', p_date_to
  );

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_mkvk_audit_xml_data(uuid, date, date, boolean, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mkvk_audit_xml_data(uuid, date, date, boolean, boolean) TO authenticated, service_role;


-- 12.25 acc_check_opening_subledger_reconciliation
CREATE OR REPLACE FUNCTION public.acc_check_opening_subledger_reconciliation(p_company_id uuid, p_year smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_open_ar_sum NUMERIC := 0;
  v_open_ap_sum NUMERIC := 0;
  v_gl_311_opening NUMERIC := 0;
  v_gl_454_opening NUMERIC := 0;
BEGIN
  -- Authorization check: member_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'member_write');

  SELECT COALESCE(SUM(COALESCE(brutto_vegosszeg, adoalap_osszesen + afa_osszeg_osszesen, 0)), 0)
    INTO v_open_ar_sum
    FROM public.invoices
   WHERE company_id = p_company_id
     AND invoice_direction = 'OUTBOUND'
     AND COALESCE(kibocsatas_datuma, teljesites_datuma) < MAKE_DATE(p_year, 1, 1)
     AND (
       fizetve IS FALSE 
       OR fizetve IS NULL 
       OR (
         EXISTS (
           SELECT 1 FROM public.transactions t 
           WHERE t.id = invoices.transaction_id 
             AND t.transaction_date >= MAKE_DATE(p_year, 1, 1)
         )
         OR (manual_payment_date >= MAKE_DATE(p_year, 1, 1))
       )
     );

  SELECT COALESCE(SUM(COALESCE(brutto_vegosszeg, adoalap_osszesen + afa_osszeg_osszesen, 0)), 0)
    INTO v_open_ap_sum
    FROM public.invoices
   WHERE company_id = p_company_id
     AND invoice_direction = 'INBOUND'
     AND COALESCE(kibocsatas_datuma, teljesites_datuma) < MAKE_DATE(p_year, 1, 1)
     AND (
       fizetve IS FALSE 
       OR fizetve IS NULL 
       OR (
         EXISTS (
           SELECT 1 FROM public.transactions t 
           WHERE t.id = invoices.transaction_id 
             AND t.transaction_date >= MAKE_DATE(p_year, 1, 1)
         )
         OR (manual_payment_date >= MAKE_DATE(p_year, 1, 1))
       )
     );

  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END), 0)
    INTO v_gl_311_opening
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.acc_journals j ON h.journal_id = j.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
   WHERE h.company_id = p_company_id
     AND j.code = 'NY'
     AND h.accounting_year = p_year
     AND h.status = 'KONYVELT'
     AND REPLACE(split_part(g.gl_number, '-', 1), '.', '') LIKE '311%';

  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'K' THEN l.amount ELSE -l.amount END), 0)
    INTO v_gl_454_opening
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.acc_journals j ON h.journal_id = j.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
   WHERE h.company_id = p_company_id
     AND j.code = 'NY'
     AND h.accounting_year = p_year
     AND h.status = 'KONYVELT'
     AND REPLACE(split_part(g.gl_number, '-', 1), '.', '') LIKE '454%';

  RETURN jsonb_build_object(
    'open_ar_subledger', v_open_ar_sum,
    'gl_311_opening', v_gl_311_opening,
    'ar_diff', (v_open_ar_sum - v_gl_311_opening),
    'open_ap_subledger', v_open_ap_sum,
    'gl_454_opening', v_gl_454_opening,
    'ap_diff', (v_open_ap_sum - v_gl_454_opening),
    'is_reconciled', (v_open_ar_sum = v_gl_311_opening AND v_open_ap_sum = v_gl_454_opening)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_check_opening_subledger_reconciliation(uuid, smallint) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_check_opening_subledger_reconciliation(uuid, smallint) TO authenticated, service_role;


-- ─── 13. Revoke public/anon access on remaining read/helper functions ──────────
REVOKE EXECUTE ON FUNCTION public.acc_get_gl_card_lines FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_get_gl_card_lines TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_gl_account_card_items FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_account_card_items TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_gl_analytic_reconciliation FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_analytic_reconciliation TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_gl_balances FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_balances TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_gl_categorized_items FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_categorized_items TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_partner_ledger_card FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_partner_ledger_card TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_subledger_item_matches FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subledger_item_matches TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_subledger_items FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subledger_items TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_chart_of_accounts_preset_usage FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_chart_of_accounts_preset_usage TO authenticated, service_role;

-- Revoke all on triggers and internal maintenance procedures from authenticated
REVOKE ALL ON FUNCTION public.acc_sync_bank_account_to_journal FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acc_sync_bank_account_to_journal TO service_role;

REVOKE ALL ON FUNCTION public.sync_item_deductible_to_journal_draft FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_item_deductible_to_journal_draft TO service_role;

REVOKE ALL ON FUNCTION public.sync_sandbox_from_taxology FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_sandbox_from_taxology TO service_role;

NOTIFY pgrst, 'reload schema';
