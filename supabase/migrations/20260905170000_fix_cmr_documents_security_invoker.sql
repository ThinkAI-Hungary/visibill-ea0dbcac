-- ============================================================================
-- Migration: Fix cmr_documents Security Definer View & RLS bypass (CRIT-5)
-- Date: 2026-09-05
-- Reference: visibill-db-audit CRIT-5 / Supabase Linter 0010_security_definer_view
-- ADR: A-003 (Multi-tenancy RLS), A-017 (Security Architecture)
-- ============================================================================

-- 1. security_invoker = true beállítása a nézeten
-- Ezzel a nézet nem a nézet tulajdonosa (postgres - bypassrls), hanem a hívó
-- jogosultságaival és RLS szűrésével fut le.
ALTER VIEW public.cmr_documents SET (security_invoker = true);

-- 2. Explicit service_role policy a transport_documents alaptáblán
DROP POLICY IF EXISTS "transport_documents_service_role_all" ON public.transport_documents;
CREATE POLICY "transport_documents_service_role_all"
  ON public.transport_documents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Jogosultságok szigorítása a nézeten
REVOKE ALL ON public.cmr_documents FROM anon;
GRANT SELECT ON public.cmr_documents TO authenticated;
GRANT ALL ON public.cmr_documents TO service_role;
