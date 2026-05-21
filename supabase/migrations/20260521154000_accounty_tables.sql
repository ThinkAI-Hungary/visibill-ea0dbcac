-- ============================================================================
-- ACCOUNTY MODULE - DATABASE TABLES
-- ============================================================================
-- Migráció: Accounty könyvelőirodai menedzsment modul táblák
-- Dátum: 2026-05-21
-- Prefix: accounty_
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  1. accounty_assignments                                          ║
-- ║  Könyvelő ↔ Ügyfélcég hozzárendelés                              ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  accounting_firm_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'junior'
    CHECK (role IN ('senior', 'junior')),
  is_primary BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(accountant_user_id, company_id)
);

COMMENT ON TABLE public.accounty_assignments IS 'Könyvelő-felhasználó ↔ ügyfélcég hozzárendelés. Senior = teljes rálátás, Junior = csak saját ügyfelek.';
COMMENT ON COLUMN public.accounty_assignments.accountant_user_id IS 'A könyvelő auth.users ID-ja';
COMMENT ON COLUMN public.accounty_assignments.company_id IS 'Az ügyfélcég companies ID-ja';
COMMENT ON COLUMN public.accounty_assignments.accounting_firm_id IS 'A könyvelőiroda cég companies ID-ja (opcionális)';
COMMENT ON COLUMN public.accounty_assignments.role IS 'senior = irodavezető rálátás, junior = csak kiszignált cégek';
COMMENT ON COLUMN public.accounty_assignments.is_primary IS 'Elsődleges felelős könyvelő-e a cégért';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  2. accounty_tax_profiles                                         ║
-- ║  Cég adózási profil (ÁFA gyakoriság, KATA, stb.)                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_tax_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  vat_frequency TEXT DEFAULT 'monthly'
    CHECK (vat_frequency IN ('monthly', 'quarterly', 'yearly')),
  contribution_frequency TEXT DEFAULT 'monthly'
    CHECK (contribution_frequency IN ('monthly', 'quarterly', 'yearly')),
  is_kata BOOLEAN DEFAULT false,
  is_kiva BOOLEAN DEFAULT false,
  tax_group TEXT,
  nav_synced BOOLEAN DEFAULT false,
  last_nav_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_tax_profiles IS 'Cég adózási profil: ÁFA gyakoriság, járulék gyakoriság, KATA/KIVA státusz. 1:1 kapcsolat a companies táblával.';
COMMENT ON COLUMN public.accounty_tax_profiles.vat_frequency IS 'ÁFA bevallás gyakorisága: monthly/quarterly/yearly';
COMMENT ON COLUMN public.accounty_tax_profiles.nav_synced IS 'NAV-ból szinkronizálva lett-e az adóprofil';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  3. accounty_deadlines                                            ║
-- ║  Adóügyi és könyvelési határidők cégenként                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  deadline_type TEXT NOT NULL
    CHECK (deadline_type IN ('afa', 'jarulek', 'kata', 'ber', 'tao', 'ipa', 'egyeb')),
  title TEXT,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  is_manual_override BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_deadlines IS 'Könyvelési és adóügyi határidők cégenként. Automatikusan generálódnak az accounty_tax_profiles alapján, vagy manuálisan hozzáadhatóak.';
COMMENT ON COLUMN public.accounty_deadlines.deadline_type IS 'Határidő típusa: afa/jarulek/kata/ber/tao/ipa/egyeb';
COMMENT ON COLUMN public.accounty_deadlines.is_manual_override IS 'Manuálisan felülbírált határidő (nem a rendszer generálta)';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  4. accounty_missing_items                                        ║
-- ║  Hiányzó dokumentumok / tételek (Okos Detektív)                  ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_missing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Kategorizálás
  category TEXT NOT NULL
    CHECK (category IN ('bejovo', 'kimeno', 'bank', 'ber')),
  title TEXT NOT NULL,
  subtitle TEXT,
  source TEXT NOT NULL
    CHECK (source IN ('nav_detektor', 'bank_detektor', 'ber_cron', 'manual')),
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('urgent', 'medium', 'low')),
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open', 'notified', 'resolved', 'ignored')),

  -- Részletek
  details TEXT,
  amount NUMERIC,
  invoice_number TEXT,
  item_date DATE,
  resolve_route TEXT,

  -- FK-k a forrás rekordokhoz (opcionális, traceability)
  nav_invoice_id UUID REFERENCES public.nav_invoices(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,

  -- Bekérés (eszkalációs) állapot
  notification_count INTEGER DEFAULT 0,
  last_notified_at TIMESTAMPTZ,
  escalation_level INTEGER DEFAULT 0,

  -- Lezárás
  is_ignored BOOLEAN DEFAULT false,
  ignored_at TIMESTAMPTZ,
  ignored_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_missing_items IS 'Az Accounty modul központi entitása: detektált hiányzó dokumentumok és tételek. Minden detektor (NAV, Bank, Bér) ide ír.';
COMMENT ON COLUMN public.accounty_missing_items.category IS 'Hiány kategória: bejovo/kimeno/bank/ber';
COMMENT ON COLUMN public.accounty_missing_items.source IS 'Honnan származik: nav_detektor/bank_detektor/ber_cron/manual';
COMMENT ON COLUMN public.accounty_missing_items.nav_invoice_id IS 'FK a NAV számlához, ha a NAV detektor találta';
COMMENT ON COLUMN public.accounty_missing_items.transaction_id IS 'FK a banki tranzakcióhoz, ha a Bank detektor találta';
COMMENT ON COLUMN public.accounty_missing_items.escalation_level IS '0=nincs, 1=email elküldve, 2=viber/sms, 3=telefon';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  5. accounty_communication_preferences                            ║
-- ║  Ügyfél értesítési csatorna beállítások                          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_communication_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,

  -- Kapcsolattartó
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,

  -- Csatornák
  channel_email BOOLEAN DEFAULT true,
  channel_viber BOOLEAN DEFAULT false,
  channel_sms BOOLEAN DEFAULT false,
  channel_phone BOOLEAN DEFAULT false,

  -- Preferenciák
  preferred_language TEXT DEFAULT 'hu',
  reminder_frequency TEXT DEFAULT 'normal'
    CHECK (reminder_frequency IN ('low', 'normal', 'high')),
  auto_reminder BOOLEAN DEFAULT true,

  -- GDPR
  gdpr_opted_in BOOLEAN DEFAULT false,
  gdpr_opted_in_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_communication_preferences IS 'Ügyfélcég kommunikációs beállításai: értesítési csatornák, gyakoriság, GDPR opt-in. 1:1 kapcsolat a companies táblával.';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  6. accounty_portal_tokens                                        ║
-- ║  Magic Link tokenek az ügyfélportálhoz                           ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_portal_tokens IS 'Magic Link tokenek az ügyfélportálhoz. Bejelentkezés nélküli hozzáférés a hiányzó dokumentumok feltöltéséhez.';
COMMENT ON COLUMN public.accounty_portal_tokens.token IS 'URL-ben használt egyedi token (pl. /portal/:token)';
COMMENT ON COLUMN public.accounty_portal_tokens.created_by IS 'Melyik könyvelő generálta a linket';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  INDEXES                                                          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- accounty_assignments
CREATE INDEX IF NOT EXISTS idx_accounty_assignments_accountant ON public.accounty_assignments(accountant_user_id);
CREATE INDEX IF NOT EXISTS idx_accounty_assignments_company ON public.accounty_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_assignments_firm ON public.accounty_assignments(accounting_firm_id);

-- accounty_deadlines
CREATE INDEX IF NOT EXISTS idx_accounty_deadlines_company ON public.accounty_deadlines(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_deadlines_due_date ON public.accounty_deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_accounty_deadlines_status ON public.accounty_deadlines(status);

-- accounty_missing_items
CREATE INDEX IF NOT EXISTS idx_accounty_missing_items_company ON public.accounty_missing_items(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_missing_items_status ON public.accounty_missing_items(status);
CREATE INDEX IF NOT EXISTS idx_accounty_missing_items_category ON public.accounty_missing_items(category);
CREATE INDEX IF NOT EXISTS idx_accounty_missing_items_source ON public.accounty_missing_items(source);
CREATE INDEX IF NOT EXISTS idx_accounty_missing_items_nav_invoice ON public.accounty_missing_items(nav_invoice_id);
CREATE INDEX IF NOT EXISTS idx_accounty_missing_items_transaction ON public.accounty_missing_items(transaction_id);

-- accounty_portal_tokens
CREATE INDEX IF NOT EXISTS idx_accounty_portal_tokens_company ON public.accounty_portal_tokens(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_portal_tokens_token ON public.accounty_portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_accounty_portal_tokens_active ON public.accounty_portal_tokens(is_active) WHERE is_active = true;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  ROW LEVEL SECURITY                                               ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Enable RLS on all accounty tables
ALTER TABLE public.accounty_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_tax_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_missing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_portal_tokens ENABLE ROW LEVEL SECURITY;

-- ── accounty_assignments policies ──

-- Könyvelők látják a saját hozzárendeléseiket
CREATE POLICY "accounty_assignments_select_own"
  ON public.accounty_assignments
  FOR SELECT
  USING (accountant_user_id = auth.uid());

-- Senior könyvelők látják az irodájuk összes hozzárendelését
CREATE POLICY "accounty_assignments_select_firm"
  ON public.accounty_assignments
  FOR SELECT
  USING (
    accounting_firm_id IN (
      SELECT aa.accounting_firm_id
      FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

-- Senior könyvelők hozhatnak létre új hozzárendeléseket
CREATE POLICY "accounty_assignments_insert_senior"
  ON public.accounty_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

-- Senior könyvelők frissíthetik a hozzárendeléseket
CREATE POLICY "accounty_assignments_update_senior"
  ON public.accounty_assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'senior'
    )
  );

-- ── Közös helper: „assigned accountant" check ──
-- A többi tábla policy-jei erre építenek: a user vagy közvetlen
-- hozzárendeléssel rendelkezik (junior), vagy senior a cég irodájában.

-- ── accounty_tax_profiles policies ──

CREATE POLICY "accounty_tax_profiles_select"
  ON public.accounty_tax_profiles
  FOR SELECT
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

CREATE POLICY "accounty_tax_profiles_modify"
  ON public.accounty_tax_profiles
  FOR ALL
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- ── accounty_deadlines policies ──

CREATE POLICY "accounty_deadlines_select"
  ON public.accounty_deadlines
  FOR SELECT
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

CREATE POLICY "accounty_deadlines_modify"
  ON public.accounty_deadlines
  FOR ALL
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- ── accounty_missing_items policies ──

CREATE POLICY "accounty_missing_items_select"
  ON public.accounty_missing_items
  FOR SELECT
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

CREATE POLICY "accounty_missing_items_modify"
  ON public.accounty_missing_items
  FOR ALL
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- ── accounty_communication_preferences policies ──

CREATE POLICY "accounty_communication_preferences_select"
  ON public.accounty_communication_preferences
  FOR SELECT
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

CREATE POLICY "accounty_communication_preferences_modify"
  ON public.accounty_communication_preferences
  FOR ALL
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- ── accounty_portal_tokens policies ──

CREATE POLICY "accounty_portal_tokens_select"
  ON public.accounty_portal_tokens
  FOR SELECT
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

CREATE POLICY "accounty_portal_tokens_insert"
  ON public.accounty_portal_tokens
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  UPDATED_AT TRIGGER                                               ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Reusable trigger function (may already exist in DB)
CREATE OR REPLACE FUNCTION public.accounty_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_accounty_assignments_updated_at
  BEFORE UPDATE ON public.accounty_assignments
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

CREATE TRIGGER trg_accounty_tax_profiles_updated_at
  BEFORE UPDATE ON public.accounty_tax_profiles
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

CREATE TRIGGER trg_accounty_deadlines_updated_at
  BEFORE UPDATE ON public.accounty_deadlines
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

CREATE TRIGGER trg_accounty_missing_items_updated_at
  BEFORE UPDATE ON public.accounty_missing_items
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

CREATE TRIGGER trg_accounty_communication_preferences_updated_at
  BEFORE UPDATE ON public.accounty_communication_preferences
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  DONE                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Összesítés:
-- ✅ accounty_assignments       - Könyvelő ↔ Cég hozzárendelés
-- ✅ accounty_tax_profiles      - Cég adózási profil (1:1)
-- ✅ accounty_deadlines         - Határidők cégenként
-- ✅ accounty_missing_items     - Hiányzó tételek (központi entitás)
-- ✅ accounty_communication_preferences - Értesítési csatornák (1:1)
-- ✅ accounty_portal_tokens     - Magic Link tokenek
-- ✅ RLS policy-k minden táblára
-- ✅ Indexek a gyakori query-khez
-- ✅ updated_at triggerek
