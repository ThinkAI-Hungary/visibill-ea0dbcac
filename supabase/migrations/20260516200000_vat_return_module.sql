-- ============================================================
-- ÁFA BEVALLÁS (2665) MODUL — Adatbázis séma
-- ============================================================

-- 1. ÁFA KÓD DEFINÍCIÓK
-- Minden áfakód egy logikai csoportosítás, ami megmondja:
-- - Milyen irányú a számla (ki/be)
-- - Milyen áfakulccsal dolgozik
-- - Melyik 2665 sorokba kell az adóalapot/adót beírni
CREATE TABLE IF NOT EXISTS vat_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  vat_percent NUMERIC(5,2) NOT NULL DEFAULT 27.00,
  direction TEXT NOT NULL CHECK (direction IN ('OUTBOUND','INBOUND')),
  is_deductible BOOLEAN NOT NULL DEFAULT true,
  is_reverse_charge BOOLEAN NOT NULL DEFAULT false,
  is_eu BOOLEAN NOT NULL DEFAULT false,
  -- Which rows on the 2665 form this code maps to
  -- e.g. [{"row":"07","col":"base"},{"row":"07","col":"tax"}]
  target_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

ALTER TABLE vat_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vat_codes_company" ON vat_codes
  USING (company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid()));


-- 2. BEVALLÁS FEJLÉC
CREATE TABLE IF NOT EXISTS vat_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_year INT NOT NULL,
  period_month INT,             -- 1-12 for monthly, NULL for quarterly
  period_quarter INT,           -- 1-4 for quarterly, NULL for monthly
  frequency TEXT NOT NULL DEFAULT 'H' CHECK (frequency IN ('H','N')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validated','finalized')),
  -- Cached totals (fillér precision)
  total_payable_base NUMERIC DEFAULT 0,
  total_payable_tax NUMERIC DEFAULT 0,
  total_deductible_base NUMERIC DEFAULT 0,
  total_deductible_tax NUMERIC DEFAULT 0,
  net_result NUMERIC DEFAULT 0,            -- row 83
  amount_to_pay NUMERIC DEFAULT 0,         -- row 84 (positive)
  amount_reclaimable NUMERIC DEFAULT 0,    -- row 85 (negative)
  amount_carryforward NUMERIC DEFAULT 0,   -- row 86
  prev_period_carryforward NUMERIC DEFAULT 0, -- row 82 (manual or auto)
  -- All row data in one JSONB for flexible access
  row_data JSONB DEFAULT '{}'::jsonb,
  m_sheet_summary JSONB DEFAULT '{}'::jsonb,
  validated_at TIMESTAMPTZ,
  validation_errors JSONB DEFAULT '[]'::jsonb,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

-- Unique constraint: one return per period
CREATE UNIQUE INDEX IF NOT EXISTS vat_returns_monthly_uq
  ON vat_returns(company_id, period_year, period_month) WHERE period_month IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vat_returns_quarterly_uq
  ON vat_returns(company_id, period_year, period_quarter) WHERE period_quarter IS NOT NULL;

ALTER TABLE vat_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vat_returns_company" ON vat_returns
  USING (company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid()));


-- 3. BEVALLÁS SORADATOK
CREATE TABLE IF NOT EXISTS vat_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vat_return_id UUID NOT NULL REFERENCES vat_returns(id) ON DELETE CASCADE,
  row_number TEXT NOT NULL,           -- '01','07','18','36','64','66','76','82','83','84'...
  base_amount NUMERIC DEFAULT 0,     -- fillér precision
  tax_amount NUMERIC DEFAULT 0,      -- fillér precision
  base_amount_rounded INT DEFAULT 0, -- eFt (ezer forint)
  tax_amount_rounded INT DEFAULT 0,  -- eFt (ezer forint)
  is_calculated BOOLEAN DEFAULT false,
  source_vat_codes TEXT[],            -- which vat codes contribute
  UNIQUE(vat_return_id, row_number)
);

ALTER TABLE vat_return_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vat_return_lines_via_return" ON vat_return_lines
  USING (vat_return_id IN (SELECT id FROM vat_returns WHERE company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())));


-- 4. M-LAP TÉTELEK (partnerenkénti bontás)
CREATE TABLE IF NOT EXISTS vat_return_m_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vat_return_id UUID NOT NULL REFERENCES vat_returns(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES partners(id),
  partner_name TEXT NOT NULL,
  partner_tax_number TEXT NOT NULL,
  invoice_count INT NOT NULL DEFAULT 0,
  base_amount NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  base_amount_rounded INT DEFAULT 0,
  tax_amount_rounded INT DEFAULT 0,
  -- VAT rate breakdown
  tax_5_amount NUMERIC DEFAULT 0,
  tax_18_amount NUMERIC DEFAULT 0,
  tax_27_amount NUMERIC DEFAULT 0,
  tax_prorated NUMERIC DEFAULT 0,
  -- Invoice-level detail (for drill-down)
  invoice_details JSONB DEFAULT '[]'::jsonb,
  UNIQUE(vat_return_id, partner_tax_number)
);

ALTER TABLE vat_return_m_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vat_return_m_lines_via_return" ON vat_return_m_lines
  USING (vat_return_id IN (SELECT id FROM vat_returns WHERE company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())));


-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_vat_codes_company ON vat_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_vat_returns_company ON vat_returns(company_id);
CREATE INDEX IF NOT EXISTS idx_vat_returns_period ON vat_returns(company_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_vat_return_lines_return ON vat_return_lines(vat_return_id);
CREATE INDEX IF NOT EXISTS idx_vat_return_m_lines_return ON vat_return_m_lines(vat_return_id);


-- 6. UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_vat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vat_codes_updated
  BEFORE UPDATE ON vat_codes
  FOR EACH ROW EXECUTE FUNCTION update_vat_updated_at();

CREATE TRIGGER trg_vat_returns_updated
  BEFORE UPDATE ON vat_returns
  FOR EACH ROW EXECUTE FUNCTION update_vat_updated_at();
