-- Migration: 20261010200000_accounty_audit_exports_schema.sql
-- Description: Schema and RLS for Module 19 (Auditor Export & Data Provision)
-- Creates accounty_audit_exports and accounty_audit_export_diffs with SHA-256 snapshotting and staleness tracking.

-- 1. Create accounty_audit_exports
CREATE TABLE IF NOT EXISTS public.accounty_audit_exports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  fiscal_year INTEGER NOT NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  version_label VARCHAR(64) NOT NULL,
  export_format VARCHAR(16) NOT NULL, -- 'XLSX', 'CSV', 'XML', 'BUNDLE'
  package_type VARCHAR(64) DEFAULT 'ALL_MODULES' NOT NULL, -- 'GL_JOURNAL', 'ALL_MODULES', etc.
  file_name VARCHAR(255) NOT NULL,
  storage_url TEXT,
  file_hash_sha256 VARCHAR(64) NOT NULL,
  total_lines INTEGER DEFAULT 0 NOT NULL,
  total_debit NUMERIC(18,2) DEFAULT 0 NOT NULL,
  total_credit NUMERIC(18,2) DEFAULT 0 NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_stale BOOLEAN DEFAULT false NOT NULL,
  stale_detected_at TIMESTAMPTZ,
  exported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Create accounty_audit_export_diffs
CREATE TABLE IF NOT EXISTS public.accounty_audit_export_diffs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  export_id UUID REFERENCES public.accounty_audit_exports(id) ON DELETE CASCADE NOT NULL,
  previous_export_id UUID REFERENCES public.accounty_audit_exports(id) ON DELETE SET NULL,
  change_type VARCHAR(32) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE'
  entity_type VARCHAR(64) NOT NULL, -- 'JOURNAL_ENTRY', 'INVOICE', 'PARTNER'
  entity_id TEXT NOT NULL,
  document_number VARCHAR(128),
  diff_summary TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  detected_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Indexes for performance and multi-tenancy
CREATE INDEX IF NOT EXISTS idx_accounty_audit_exports_company_id 
  ON public.accounty_audit_exports(company_id);

CREATE INDEX IF NOT EXISTS idx_accounty_audit_exports_year 
  ON public.accounty_audit_exports(company_id, fiscal_year);

CREATE INDEX IF NOT EXISTS idx_accounty_audit_exports_stale 
  ON public.accounty_audit_exports(company_id, is_stale);

CREATE INDEX IF NOT EXISTS idx_accounty_audit_exports_created 
  ON public.accounty_audit_exports(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_accounty_audit_export_diffs_export_id 
  ON public.accounty_audit_export_diffs(export_id);

CREATE INDEX IF NOT EXISTS idx_accounty_audit_export_diffs_company_id 
  ON public.accounty_audit_export_diffs(company_id);

CREATE INDEX IF NOT EXISTS idx_accounty_audit_export_diffs_detected 
  ON public.accounty_audit_export_diffs(company_id, detected_at DESC);

-- 4. Enable RLS
ALTER TABLE public.accounty_audit_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_audit_export_diffs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: accounty_audit_exports
DROP POLICY IF EXISTS "accounty_audit_exports_select" ON public.accounty_audit_exports;
CREATE POLICY "accounty_audit_exports_select"
  ON public.accounty_audit_exports
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "accounty_audit_exports_modify" ON public.accounty_audit_exports;
CREATE POLICY "accounty_audit_exports_modify"
  ON public.accounty_audit_exports
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "accounty_audit_exports_service_role_all" ON public.accounty_audit_exports;
CREATE POLICY "accounty_audit_exports_service_role_all"
  ON public.accounty_audit_exports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. RLS Policies: accounty_audit_export_diffs
DROP POLICY IF EXISTS "accounty_audit_export_diffs_select" ON public.accounty_audit_export_diffs;
CREATE POLICY "accounty_audit_export_diffs_select"
  ON public.accounty_audit_export_diffs
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "accounty_audit_export_diffs_modify" ON public.accounty_audit_export_diffs;
CREATE POLICY "accounty_audit_export_diffs_modify"
  ON public.accounty_audit_export_diffs
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "accounty_audit_export_diffs_service_role_all" ON public.accounty_audit_export_diffs;
CREATE POLICY "accounty_audit_export_diffs_service_role_all"
  ON public.accounty_audit_export_diffs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7. Revoke from anon, grant explicit permissions
REVOKE ALL ON TABLE public.accounty_audit_exports FROM anon;
REVOKE ALL ON TABLE public.accounty_audit_export_diffs FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.accounty_audit_exports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.accounty_audit_export_diffs TO authenticated;

GRANT ALL ON TABLE public.accounty_audit_exports TO service_role;
GRANT ALL ON TABLE public.accounty_audit_export_diffs TO service_role;
