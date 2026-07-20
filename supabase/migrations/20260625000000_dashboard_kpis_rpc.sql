-- ==================================================
-- MERGED FROM: 20260625_dashboard_kpis_rpc.sql
-- ==================================================
-- Drop and recreate the dashboard KPIs aggregation RPC function to avoid duplicate network roundtrips
DROP FUNCTION IF EXISTS public.get_accounty_dashboard_kpis(UUID[], DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_accounty_dashboard_kpis(
  p_company_ids UUID[],
  p_now_date DATE,
  p_week_date DATE
)
RETURNS TABLE(
  missing_items BIGINT,
  upcoming_deadlines BIGINT,
  critical_clients BIGINT,
  today_deadlines BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COALESCE(COUNT(*), 0)
     FROM public.accounty_missing_items
     WHERE company_id = ANY(p_company_ids)
       AND status IN ('open', 'notified'))::BIGINT AS missing_items,

    (SELECT COALESCE(COUNT(*), 0)
     FROM public.accounty_deadlines
     WHERE company_id = ANY(p_company_ids)
       AND status IN ('pending', 'in_progress')
       AND due_date >= p_now_date
       AND due_date <= p_week_date)::BIGINT AS upcoming_deadlines,

    (SELECT COALESCE(COUNT(*), 0)
     FROM public.accounty_missing_items
     WHERE company_id = ANY(p_company_ids)
       AND priority = 'urgent'
       AND status IN ('open', 'notified'))::BIGINT AS critical_clients,

    (SELECT COALESCE(COUNT(*), 0)
     FROM public.accounty_deadlines
     WHERE company_id = ANY(p_company_ids)
       AND status IN ('pending', 'in_progress')
       AND due_date = p_now_date)::BIGINT AS today_deadlines;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_accounty_dashboard_kpis(UUID[], DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accounty_dashboard_kpis(UUID[], DATE, DATE) TO anon;

-- Force PostgREST schema cache reload
SELECT pg_notify('pgrst', 'reload schema');


-- ==================================================
-- MERGED FROM: 20260625_harden_admin_module_rls.sql
-- ==================================================
-- ============================================================
-- Security Hardening: Admin Module RLS Policies
-- ============================================================
-- Fixes USING(true) / WITH CHECK(true) policies on admin module
-- tables from 20260608_admin_modules.sql
--
-- Fix #4: accounty_gdpr_requests — company_id scoped to assigned accountants
-- Fix #5: accounty_tax_params_global — INSERT/UPDATE restricted to seniors
-- Also hardens: audit_log, templates, job_codes, legal_updates
-- ============================================================


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  1. accounty_audit_log — restrict to assigned companies            ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Keep existing SELECT for own audit entries, but scope it
DROP POLICY IF EXISTS audit_log_select ON public.accounty_audit_log;
DROP POLICY IF EXISTS audit_log_insert ON public.accounty_audit_log;

-- SELECT: user can see audit entries for companies they are assigned to,
-- OR entries they created themselves (user_id match)
CREATE POLICY audit_log_select ON public.accounty_audit_log
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- INSERT: any authenticated user can write their own audit log entries
CREATE POLICY audit_log_insert ON public.accounty_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  2. accounty_gdpr_requests — company_id scoped (Fix #4)            ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS gdpr_select ON public.accounty_gdpr_requests;
DROP POLICY IF EXISTS gdpr_insert ON public.accounty_gdpr_requests;
DROP POLICY IF EXISTS gdpr_update ON public.accounty_gdpr_requests;
DROP POLICY IF EXISTS gdpr_delete ON public.accounty_gdpr_requests;

-- SELECT: only for companies assigned to the accountant
CREATE POLICY gdpr_select ON public.accounty_gdpr_requests
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- INSERT: only for companies assigned to the accountant
CREATE POLICY gdpr_insert ON public.accounty_gdpr_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- UPDATE: only for companies assigned to the accountant
CREATE POLICY gdpr_update ON public.accounty_gdpr_requests
  FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- DELETE: only seniors can delete GDPR requests
CREATE POLICY gdpr_delete ON public.accounty_gdpr_requests
  FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  3. accounty_templates — restrict writes to seniors                ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS templates_select ON public.accounty_templates;
DROP POLICY IF EXISTS templates_insert ON public.accounty_templates;
DROP POLICY IF EXISTS templates_update ON public.accounty_templates;
DROP POLICY IF EXISTS templates_delete ON public.accounty_templates;

-- SELECT: all authenticated accountants can read templates
CREATE POLICY templates_select ON public.accounty_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- INSERT: only seniors
CREATE POLICY templates_insert ON public.accounty_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

-- UPDATE: only seniors
CREATE POLICY templates_update ON public.accounty_templates
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

-- DELETE: only seniors
CREATE POLICY templates_delete ON public.accounty_templates
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

-- Template versions: read for all accountants, insert for seniors
DROP POLICY IF EXISTS template_ver_select ON public.accounty_template_versions;
DROP POLICY IF EXISTS template_ver_insert ON public.accounty_template_versions;

CREATE POLICY template_ver_select ON public.accounty_template_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

CREATE POLICY template_ver_insert ON public.accounty_template_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  4. accounty_job_codes — read for all, write for seniors           ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS job_codes_select ON public.accounty_job_codes;
DROP POLICY IF EXISTS job_codes_insert ON public.accounty_job_codes;
DROP POLICY IF EXISTS job_codes_update ON public.accounty_job_codes;
DROP POLICY IF EXISTS job_codes_delete ON public.accounty_job_codes;

-- SELECT: all authenticated accountants can read
CREATE POLICY job_codes_select ON public.accounty_job_codes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: seniors only
CREATE POLICY job_codes_insert ON public.accounty_job_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

CREATE POLICY job_codes_update ON public.accounty_job_codes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

CREATE POLICY job_codes_delete ON public.accounty_job_codes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  5. accounty_tax_params_global — read for all, write seniors (Fix #5)║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS tax_params_global_select ON public.accounty_tax_params_global;
DROP POLICY IF EXISTS tax_params_global_insert ON public.accounty_tax_params_global;
DROP POLICY IF EXISTS tax_params_global_update ON public.accounty_tax_params_global;

-- SELECT: all authenticated accountants can read global tax params
CREATE POLICY tax_params_global_select ON public.accounty_tax_params_global
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- INSERT: seniors only
CREATE POLICY tax_params_global_insert ON public.accounty_tax_params_global
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

-- UPDATE: seniors only
CREATE POLICY tax_params_global_update ON public.accounty_tax_params_global
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  6. accounty_legal_updates — read for all, write for seniors       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

DROP POLICY IF EXISTS legal_updates_select ON public.accounty_legal_updates;
DROP POLICY IF EXISTS legal_updates_insert ON public.accounty_legal_updates;
DROP POLICY IF EXISTS legal_updates_update ON public.accounty_legal_updates;
DROP POLICY IF EXISTS legal_updates_delete ON public.accounty_legal_updates;

-- SELECT: all authenticated accountants
CREATE POLICY legal_updates_select ON public.accounty_legal_updates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: seniors only
CREATE POLICY legal_updates_insert ON public.accounty_legal_updates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

CREATE POLICY legal_updates_update ON public.accounty_legal_updates
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

CREATE POLICY legal_updates_delete ON public.accounty_legal_updates
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );


-- ==================================================
-- MERGED FROM: 20260625_shipment_matches_pending_shipment.sql
-- ==================================================
-- Migration: shipment_matches — invoice-first lifecycle support
-- DR-031, DR-032, DR-033: sorrend-független futar-számla-CMR lánc
--
-- Változások:
-- 1. shipment_id → nullable (placeholder rekord ha shipment még nem érkezett)
-- 2. confidence_score → nullable (nincs score placeholder esetén)
-- 3. match_type → nullable (nincs type placeholder esetén)
-- 4. UNIQUE constraint update: (invoice_id, shipment_id) → NULL-safe (pg természetesen kezeli)
-- 5. status mező: 'pending_shipment' érték dokumentálva (nincs CHECK constraint, szabad szöveg)

-- ── 1. shipment_id nullable ────────────────────────────────────────────────────
-- Szükséges: placeholder rekord amikor a számla előbb érkezik mint a futárriport
ALTER TABLE public.shipment_matches
  ALTER COLUMN shipment_id DROP NOT NULL;

-- ── 2. confidence_score nullable ───────────────────────────────────────────────
-- Placeholder rekorodnál nincs matching score
ALTER TABLE public.shipment_matches
  ALTER COLUMN confidence_score DROP NOT NULL;

-- ── 3. match_type nullable ─────────────────────────────────────────────────────
-- Placeholder rekorodnál nincs match type
ALTER TABLE public.shipment_matches
  ALTER COLUMN match_type DROP NOT NULL;

-- ── 4. Megjegyzés a status értékekről ──────────────────────────────────────────
-- A status mező megengedett értékei (nincs CHECK constraint, konvenció alapján):
--   'pending'           → Feldolgozás alatt (eredeti)
--   'matched'           → Teljes automatikus egyezés
--   'escalated'         → Eltérés — emberi felülvizsgálat kell
--   'manually_resolved' → Kézi feloldás
--   'pending_shipment'  → ÚJ: Számla megvan, de a futárriport (shipment) még nem érkezett be
--                         Feltétel: shipment_id IS NULL
--   'rejected'          → Elutasítva

-- ── 5. Partial index: pending_shipment rekordok gyors kereséshez ───────────────
-- Az EF és a retroaktív matching-hez szükséges lekérdezések indexe
CREATE INDEX IF NOT EXISTS idx_shipment_matches_pending_shipment
  ON public.shipment_matches (company_id, invoice_id)
  WHERE status = 'pending_shipment';

-- ── Rollback terv (M-5 checklist) ─────────────────────────────────────────────
-- Ha visszaállítás szükséges:
--   ALTER TABLE public.shipment_matches ALTER COLUMN shipment_id SET NOT NULL;
--   ALTER TABLE public.shipment_matches ALTER COLUMN confidence_score SET NOT NULL;
--   ALTER TABLE public.shipment_matches ALTER COLUMN match_type SET NOT NULL;
--   DROP INDEX IF EXISTS idx_shipment_matches_pending_shipment;
-- FIGYELEM: csak ha nincs egyetlen pending_shipment rekord sem a táblában!
