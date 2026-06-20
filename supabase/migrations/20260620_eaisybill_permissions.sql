-- ============================================================================
-- eaisybill_module_permissions — Per-user, per-company module access overrides
-- ============================================================================
-- Allows company admins to fine-tune which modules each member can access.
-- When a row exists for a (company_id, user_id, module_name) tuple, it
-- overrides the static role-based default from useEaisybillPermissions.
-- Admin users are never restricted by these overrides (enforced in the hook).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.eaisybill_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  can_read BOOLEAN NOT NULL DEFAULT true,
  can_write BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id, module_name)
);

-- Index for fast lookups by user + company
CREATE INDEX IF NOT EXISTS idx_eaisybill_module_perms_user_company
  ON public.eaisybill_module_permissions (user_id, company_id);

-- RLS
ALTER TABLE public.eaisybill_module_permissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own permission overrides
CREATE POLICY "Users can read own module perms"
  ON public.eaisybill_module_permissions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Company admins/owners can fully manage permission overrides for their company
CREATE POLICY "Admins manage company module perms"
  ON public.eaisybill_module_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = eaisybill_module_permissions.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'owner')
    )
  );

COMMENT ON TABLE public.eaisybill_module_permissions IS
  'Per-user, per-company module access overrides for eaisybill. '
  'Managed by company admins via the Permission Panel in Settings → Company tab.';
