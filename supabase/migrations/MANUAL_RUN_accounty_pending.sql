-- ═══════════════════════════════════════════════════════════════
-- Accounty – Pending SQL Migrations
-- Futtasd a Supabase Dashboard SQL Editor-ban
-- ═══════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- 1. accounty_v2: kanban_status + accountant access policies
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.accounty_assignments 
  ADD COLUMN IF NOT EXISTS kanban_status TEXT DEFAULT 'aktiv'
  CHECK (kanban_status IN ('aktiv', 'feldolgozando', 'kritikus'));

DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Accountants can view assigned company invoices" ON public.invoices;
CREATE POLICY "Accountants can view assigned company invoices"
  ON public.invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.accounty_assignments
    WHERE accounty_assignments.company_id = invoices.company_id
      AND accounty_assignments.accountant_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Accountants can view assigned companies" ON public.companies;
CREATE POLICY "Accountants can view assigned companies"
  ON public.companies FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.accounty_assignments
    WHERE accounty_assignments.company_id = companies.id
      AND accounty_assignments.accountant_user_id = auth.uid()
  ));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nav_invoices' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Accountants can view assigned NAV invoices" ON public.nav_invoices';
    EXECUTE 'CREATE POLICY "Accountants can view assigned NAV invoices"
      ON public.nav_invoices FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.accounty_assignments
        WHERE accounty_assignments.company_id = nav_invoices.company_id
          AND accounty_assignments.accountant_user_id = auth.uid()
      ))';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 2. accounty_audit_log tábla
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accounty_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  company_name TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.accounty_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_company_id ON public.accounty_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.accounty_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.accounty_audit_log(action);

ALTER TABLE public.accounty_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounty_audit_log_select"
  ON public.accounty_audit_log FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "accounty_audit_log_insert"
  ON public.accounty_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────
-- 3. Portal stats tracking oszlopok (D3)
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.accounty_portal_tokens
  ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════
-- Kész! A cron schedules-t külön kell kezelni
-- (pg_cron + service_role key szükséges)
-- ═══════════════════════════════════════════════════════════════
