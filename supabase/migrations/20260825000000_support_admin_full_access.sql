-- Migration: 20260825000000_support_admin_full_access.sql
-- Description: Grant support_admin complete administrative access across all Eaisybill & Eaisybooks modules.

-- ============================================================================
-- 1. Helper Functions Update
-- ============================================================================

-- Update is_company_member_or_above to include 'support_admin'
CREATE OR REPLACE FUNCTION public.is_company_member_or_above(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member', 'assistant', 'viewer', 'support_admin')
  );
$function$;

-- Update is_company_admin to include 'support_admin'
CREATE OR REPLACE FUNCTION public.is_company_admin(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'support_admin')
  );
$function$;

-- Update has_accounty_company_access to allow company admin / support_admin or assigned accountant
CREATE OR REPLACE FUNCTION public.has_accounty_company_access(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.accounty_assignments aa
    WHERE aa.company_id = p_company_id
      AND (
        aa.accountant_user_id = auth.uid()
        OR is_iroda_admin_for_firm(aa.accounting_firm_id)
      )
  ) OR EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = p_company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin', 'support_admin')
  );
$function$;

-- Update is_iroda_admin_for_firm to also recognize support_admin / management / thinkai
CREATE OR REPLACE FUNCTION public.is_iroda_admin_for_firm(p_firm_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM accounty_assignments
    WHERE accountant_user_id = auth.uid()
      AND (accounting_firm_id = p_firm_id OR company_id = p_firm_id)
      AND role = 'iroda_admin'
  ) OR EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_firm_id
      AND user_id = auth.uid()
      AND role = 'support_admin'
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND is_support_admin = true
      AND role IN ('management', 'thinkai')
  );
$function$;

-- Update is_member_of_firm to also recognize support_admin / management / thinkai
CREATE OR REPLACE FUNCTION public.is_member_of_firm(p_firm_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM accounty_assignments
    WHERE accountant_user_id = auth.uid()
      AND (accounting_firm_id = p_firm_id OR company_id = p_firm_id)
  ) OR EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_firm_id
      AND user_id = auth.uid()
      AND role = 'support_admin'
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND is_support_admin = true
      AND role IN ('management', 'thinkai')
  );
$function$;

-- ============================================================================
-- 2. API Key Management RPC Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_api_key(p_company_id uuid DEFAULT NULL::uuid, p_name text DEFAULT 'OpenClaw API Key'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_raw_key text;
  v_key_hash text;
  v_key_prefix text;
  v_key_id uuid;
BEGIN
  IF p_company_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = p_company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'support_admin')
    ) THEN
      RAISE EXCEPTION 'Nincs jogosultsag API kulcs generalasahoz ehhez a ceghez';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('thinkai', 'management')
    ) THEN
      RAISE EXCEPTION 'Projekt-szintu API kulcs generalasahoz thinkai jogosultsag szukseges';
    END IF;
  END IF;

  v_raw_key := 'vb_' || encode(gen_random_bytes(20), 'hex');
  v_key_hash := encode(digest(v_raw_key, 'sha256'), 'hex');
  v_key_prefix := left(v_raw_key, 11);

  INSERT INTO api_keys (company_id, created_by, key_hash, key_prefix, name)
  VALUES (p_company_id, auth.uid(), v_key_hash, v_key_prefix, p_name)
  RETURNING id INTO v_key_id;

  RETURN jsonb_build_object(
    'id', v_key_id,
    'api_key', v_raw_key,
    'prefix', v_key_prefix,
    'name', p_name,
    'company_id', p_company_id,
    'warning', 'Ez a kulcs CSAK MOST jelenik meg! Mentsd el biztonsagos helyre.'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_api_key(p_key_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE api_keys
  SET is_active = false, updated_at = now()
  WHERE id = p_key_id
  AND (
    (company_id IS NOT NULL AND company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin', 'support_admin')
    ))
    OR
    (company_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('thinkai', 'management')
    ))
  );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'API kulcs nem talalhato vagy nincs jogosultsag';
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'API kulcs visszavonva');
END;
$function$;

-- ============================================================================
-- 3. Explicit Table Policy Updates (where role was hardcoded without helper function)
-- ============================================================================

-- 3.1. salary policies
DROP POLICY IF EXISTS "Members can create salary" ON salary;
CREATE POLICY "Members can create salary" ON salary
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = salary.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.role = ANY (ARRAY['owner'::text, 'admin'::text, 'support_admin'::text])
    )
  );

DROP POLICY IF EXISTS "Members can update salary" ON salary;
CREATE POLICY "Members can update salary" ON salary
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = salary.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.role = ANY (ARRAY['owner'::text, 'admin'::text, 'support_admin'::text])
    )
  );

DROP POLICY IF EXISTS "Members can delete salary" ON salary;
CREATE POLICY "Members can delete salary" ON salary
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = salary.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.role = ANY (ARRAY['owner'::text, 'admin'::text, 'support_admin'::text])
    )
  );

-- 3.2. eaisybill_module_permissions policy
DROP POLICY IF EXISTS "Admins manage company module perms" ON eaisybill_module_permissions;
CREATE POLICY "Admins manage company module perms" ON eaisybill_module_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = eaisybill_module_permissions.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = ANY (ARRAY['admin'::text, 'owner'::text, 'support_admin'::text])
    )
  );

-- 3.3. company_members UPDATE policy
DROP POLICY IF EXISTS "Owner or admin can update members" ON company_members;
CREATE POLICY "Owner or admin can update members" ON company_members
  FOR UPDATE USING (
    (company_id IN (SELECT companies.id FROM companies WHERE companies.owner_id = auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM company_members cm2
      WHERE cm2.company_id = company_members.company_id
        AND cm2.user_id = auth.uid()
        AND cm2.role = ANY (ARRAY['admin'::text, 'owner'::text, 'support_admin'::text])
    ))
  ) WITH CHECK (
    (company_id IN (SELECT companies.id FROM companies WHERE companies.owner_id = auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM company_members cm2
      WHERE cm2.company_id = company_members.company_id
        AND cm2.user_id = auth.uid()
        AND cm2.role = ANY (ARRAY['admin'::text, 'owner'::text, 'support_admin'::text])
    ))
  );

-- 3.4. api_keys policy
DROP POLICY IF EXISTS "api_keys_company_admin" ON api_keys;
CREATE POLICY "api_keys_company_admin" ON api_keys
  FOR ALL USING (
    (company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'support_admin'::text])
    ))
    OR ((company_id IS NULL) AND (EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = ANY (ARRAY['thinkai'::text, 'management'::text])
    )))
  );
