-- ============================================================================
-- PERMISSION SYSTEM PHASE 1
-- ============================================================================
-- 1. accounty_assignments.role bővítés (senior/junior → iroda_admin/senior_könyvelő/könyvelő/asszisztens)
-- 2. source oszlop hozzáadása az accounty_assignments-hoz
-- 3. accounty_module_permissions tábla
-- 4. user_company_access_cache tábla + trigger függvények
-- 5. Szinkronizációs trigger: company_members DELETE → accounty_assignments törlés
-- 6. RLS policy frissítések az invoices/nav_invoices táblákon
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  1. accounty_assignments.role CHECK constraint bővítés             ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Drop old constraint FIRST (so the UPDATE below won't violate it)
ALTER TABLE public.accounty_assignments DROP CONSTRAINT IF EXISTS accounty_assignments_role_check;

-- Migrate existing data
UPDATE public.accounty_assignments SET role = 'iroda_admin' WHERE role = 'senior';
UPDATE public.accounty_assignments SET role = 'könyvelő' WHERE role = 'junior';

-- Add new constraint
ALTER TABLE public.accounty_assignments ADD CONSTRAINT accounty_assignments_role_check
  CHECK (role IN ('iroda_admin', 'senior_könyvelő', 'könyvelő', 'asszisztens'));

-- Update default
ALTER TABLE public.accounty_assignments ALTER COLUMN role SET DEFAULT 'könyvelő';

-- Update comments
COMMENT ON COLUMN public.accounty_assignments.role IS 'iroda_admin = irodavezető teljes rálátás, senior_könyvelő = saját + junior cégek, könyvelő = csak kiszignált cégek, asszisztens = korlátozott adatrögzítés';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  2. source oszlop hozzáadása                                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.accounty_assignments
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'sync'));

COMMENT ON COLUMN public.accounty_assignments.source IS 'manual = az iroda admin manuálisan rendelte hozzá, sync = eaisybill company_members-ből automatikusan szinkronizálva';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  3. accounty_module_permissions tábla                              ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_firm_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL CHECK (module_name IN (
    'dashboard', 'invoices', 'transactions', 'salaries', 'payroll',
    'general_ledger', 'vat_return', 'profit_loss', 'balance_sheet',
    'fixed_assets', 'petty_cash', 'partners', 'projects', 'categories',
    'hr', 'working_time', 'documents', 'integrations', 'settings',
    'tao_kiva', 'filings', 'declarations', 'reports'
  )),
  can_read BOOLEAN DEFAULT true,
  can_write BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (accounting_firm_id, user_id, module_name)
);

ALTER TABLE public.accounty_module_permissions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.accounty_module_permissions IS 'Modulonkénti testreszabható jogosultságok. Az iroda admin állítja be, hogy melyik könyvelő/asszisztens melyik modulhoz fér hozzá.';

-- RLS: Only iroda_admin of the accounting firm can manage, anyone in the firm can read own
CREATE POLICY "module_perms_select" ON public.accounty_module_permissions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "module_perms_manage" ON public.accounty_module_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM accounty_assignments aa
      WHERE aa.accounting_firm_id = accounty_module_permissions.accounting_firm_id
        AND aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'iroda_admin'
    )
  );

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  4. user_company_access_cache tábla                                ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.user_company_access_cache (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  access_source TEXT NOT NULL CHECK (access_source IN ('eaisybill', 'accounty')),
  role TEXT NOT NULL,
  can_read_invoices BOOLEAN DEFAULT true,
  can_write_invoices BOOLEAN DEFAULT false,
  can_read_transactions BOOLEAN DEFAULT true,
  can_read_salaries BOOLEAN DEFAULT false,
  can_read_hr BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, company_id, access_source)
);

CREATE INDEX IF NOT EXISTS idx_access_cache_user ON user_company_access_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_access_cache_company ON user_company_access_cache(company_id);
CREATE INDEX IF NOT EXISTS idx_access_cache_user_company ON user_company_access_cache(user_id, company_id);

ALTER TABLE public.user_company_access_cache ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.user_company_access_cache IS 'Unified access cache: combines company_members and accounty_assignments into one fast-lookup table for RLS policies.';

-- RLS: Users can only see their own cache entries
CREATE POLICY "access_cache_select" ON public.user_company_access_cache
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  4b. Trigger functions to keep cache in sync                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Function: sync company_members → access cache
CREATE OR REPLACE FUNCTION sync_company_member_to_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM user_company_access_cache
    WHERE user_id = OLD.user_id
      AND company_id = OLD.company_id
      AND access_source = 'eaisybill';
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE
  INSERT INTO user_company_access_cache (
    user_id, company_id, access_source, role,
    can_read_invoices, can_write_invoices, can_read_transactions,
    can_read_salaries, can_read_hr, updated_at
  ) VALUES (
    NEW.user_id, NEW.company_id, 'eaisybill', NEW.role,
    true, -- all eaisybill members can read invoices
    NEW.role IN ('owner', 'admin'), -- only owner/admin can write
    true, -- all can read transactions
    NEW.role IN ('owner', 'admin'), -- salaries: owner/admin only
    NEW.role IN ('owner', 'admin'), -- HR: owner/admin only
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
$$;

-- Function: sync accounty_assignments → access cache
CREATE OR REPLACE FUNCTION sync_accounty_assignment_to_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM user_company_access_cache
    WHERE user_id = OLD.accountant_user_id
      AND company_id = OLD.company_id
      AND access_source = 'accounty';
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE: accounty users get full read access to accounting modules
  INSERT INTO user_company_access_cache (
    user_id, company_id, access_source, role,
    can_read_invoices, can_write_invoices, can_read_transactions,
    can_read_salaries, can_read_hr, updated_at
  ) VALUES (
    NEW.accountant_user_id, NEW.company_id, 'accounty', NEW.role,
    true, -- accountants can read invoices
    true, -- accountants can write (manage) invoices
    true, -- accountants can read transactions
    true, -- accountants have full accounting access
    true, -- accountants have full HR access (for payroll)
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
$$;

-- Attach triggers
DROP TRIGGER IF EXISTS trg_company_members_cache_sync ON public.company_members;
CREATE TRIGGER trg_company_members_cache_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION sync_company_member_to_cache();

DROP TRIGGER IF EXISTS trg_accounty_assignments_cache_sync ON public.accounty_assignments;
CREATE TRIGGER trg_accounty_assignments_cache_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.accounty_assignments
  FOR EACH ROW EXECUTE FUNCTION sync_accounty_assignment_to_cache();

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  4c. Backfill: populate cache from existing data                   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Backfill from company_members
INSERT INTO user_company_access_cache (user_id, company_id, access_source, role,
  can_read_invoices, can_write_invoices, can_read_transactions, can_read_salaries, can_read_hr)
SELECT
  cm.user_id, cm.company_id, 'eaisybill', cm.role,
  true,
  cm.role IN ('owner', 'admin'),
  true,
  cm.role IN ('owner', 'admin'),
  cm.role IN ('owner', 'admin')
FROM company_members cm
ON CONFLICT (user_id, company_id, access_source) DO NOTHING;

-- Backfill from accounty_assignments
INSERT INTO user_company_access_cache (user_id, company_id, access_source, role,
  can_read_invoices, can_write_invoices, can_read_transactions, can_read_salaries, can_read_hr)
SELECT
  aa.accountant_user_id, aa.company_id, 'accounty', aa.role,
  true, true, true, true, true
FROM accounty_assignments aa
ON CONFLICT (user_id, company_id, access_source) DO NOTHING;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  5. Szinkronizációs trigger: kirúgás eaisybill → accounty törlés   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION sync_eaisybill_accountant_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a company_member with role 'accountant' is deleted,
  -- also delete the corresponding accounty_assignment if it was auto-synced
  IF OLD.role = 'accountant' THEN
    DELETE FROM accounty_assignments
    WHERE accountant_user_id = OLD.user_id
      AND company_id = OLD.company_id
      AND source = 'sync';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_eaisybill_accountant_removal ON public.company_members;
CREATE TRIGGER trg_eaisybill_accountant_removal
  AFTER DELETE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION sync_eaisybill_accountant_removal();

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  6. RLS policy frissítés: invoices & nav_invoices                  ║
-- ║  Régi: közvetlen JOIN accounty_assignments-ra                      ║
-- ║  Új: user_company_access_cache-ből olvas (gyorsabb, egységes)      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  6a. SECURITY DEFINER helper function                              ║
-- ║  Needed because user_company_access_cache has its own RLS.         ║
-- ║  Without this, subqueries inside other table policies can't read   ║
-- ║  the cache table (RLS recursion).                                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION has_company_access_via_cache(p_company_id UUID, p_source TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_company_access_cache
    WHERE user_id = auth.uid()
      AND company_id = p_company_id
      AND (p_source IS NULL OR access_source = p_source)
  );
$$;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  6b. RLS policy frissítés: invoices, nav_invoices, companies       ║
-- ║  Uses the SECURITY DEFINER helper to avoid RLS recursion           ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- invoices
DROP POLICY IF EXISTS "Accountants can view assigned company invoices" ON public.invoices;
CREATE POLICY "Accountants can view assigned company invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (has_company_access_via_cache(company_id, 'accounty'));

-- nav_invoices
DROP POLICY IF EXISTS "Accountants can view assigned NAV invoices" ON public.nav_invoices;
CREATE POLICY "Accountants can view assigned NAV invoices" ON public.nav_invoices
  FOR SELECT TO authenticated
  USING (has_company_access_via_cache(company_id, 'accounty'));

-- companies
DROP POLICY IF EXISTS "Accountants can view assigned companies" ON public.companies;
CREATE POLICY "Accountants can view assigned companies" ON public.companies
  FOR SELECT TO authenticated
  USING (has_company_access_via_cache(id, 'accounty'));

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Update RLS on accounty_assignments for iroda_admin visibility     ║
-- ║  Uses SECURITY DEFINER to avoid infinite recursion                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION is_iroda_admin_for_firm(p_firm_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounty_assignments
    WHERE accountant_user_id = auth.uid()
      AND accounting_firm_id = p_firm_id
      AND role = 'iroda_admin'
  );
$$;

DROP POLICY IF EXISTS "assignments_select" ON public.accounty_assignments;
CREATE POLICY "assignments_select" ON public.accounty_assignments
  FOR SELECT TO authenticated
  USING (
    accountant_user_id = (SELECT auth.uid())
    OR is_iroda_admin_for_firm(accounting_firm_id)
  );
