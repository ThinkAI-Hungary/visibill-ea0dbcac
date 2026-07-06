-- =============================================================================
-- Kiegészítő táblák: ÁFA bevallás, kamarai befizetések, szervezeti beszámoló
-- =============================================================================
-- Ezek a táblák a már létező EV sémát egészítik ki (20260627_ev_single_entry_schema.sql)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ÁFA BEVALLÁS TÁBLA (EvVatPage számára)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounty_ev_vat_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  period_key TEXT NOT NULL,        -- pl. 'Q1', 'Q2', 'M01', 'M02'
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'draft', 'submitted', 'accepted')),

  -- ÁFA összegek
  input_vat BIGINT DEFAULT 0,      -- Előzetesen felszámított ÁFA (levonható)
  output_vat BIGINT DEFAULT 0,     -- Fizetendő ÁFA
  payable BIGINT DEFAULT 0,        -- Egyenleg (output - input)

  -- Határidő
  deadline DATE,
  submitted_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(company_id, tax_year, period_key)
);

CREATE INDEX idx_accounty_ev_vat_returns_company ON accounty_ev_vat_returns(company_id, tax_year);

ALTER TABLE accounty_ev_vat_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounty_ev_vat_returns_select"
  ON accounty_ev_vat_returns FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_vat_returns_modify"
  ON accounty_ev_vat_returns FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. KAMARAI BEFIZETÉSEK (EvChamberPage számára)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounty_ev_chamber_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  amount BIGINT NOT NULL,          -- Kamarai hozzájárulás összege
  deadline DATE,                    -- Befizetési határidő
  paid_date DATE,                   -- Befizetés dátuma (NULL = nem fizetve)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),

  -- Kamara adatok
  chamber_name TEXT,               -- Kamara neve
  membership_number TEXT,           -- Tagsági szám

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(company_id, tax_year)
);

CREATE INDEX idx_accounty_ev_chamber_company ON accounty_ev_chamber_payments(company_id, tax_year);

ALTER TABLE accounty_ev_chamber_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounty_ev_chamber_payments_select"
  ON accounty_ev_chamber_payments FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_chamber_payments_modify"
  ON accounty_ev_chamber_payments FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SZERVEZETI BESZÁMOLÓ (OrgSimplifiedReportPage számára)
-- ─────────────────────────────────────────────────────────────────────────────
-- Egyszerűsített éves beszámoló sorok (Szt. 96-98. §)
-- Egy tábla mind a mérleg és eredménykimutatás soroknak.

CREATE TABLE IF NOT EXISTS accounty_org_report_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('balance_asset', 'balance_liability', 'income_statement')),

  -- Sor adatok
  line_code TEXT NOT NULL,         -- pl. 'A', 'A.I', 'B.IV', '1', '2'
  line_name TEXT NOT NULL,         -- pl. 'Befektetett eszközök', 'Értékesítés nettó árbevétele'
  indent_level INT DEFAULT 0,      -- 0 = fősor, 1 = alsor
  is_total_line BOOLEAN DEFAULT FALSE, -- Összesítő sor
  is_bold BOOLEAN DEFAULT FALSE,   -- Eredménykimutatásnál
  sort_order INT NOT NULL,         -- Megjelenítési sorrend

  -- Értékek
  current_year_amount BIGINT DEFAULT 0,
  previous_year_amount BIGINT DEFAULT 0,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_accounty_org_report_company ON accounty_org_report_lines(company_id, tax_year, report_type);

ALTER TABLE accounty_org_report_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounty_org_report_lines_select"
  ON accounty_org_report_lines FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_org_report_lines_modify"
  ON accounty_org_report_lines FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));
