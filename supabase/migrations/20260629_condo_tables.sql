-- ============================================================
-- Társasház (Condominium) modul — adatmodell
-- 3 tábla: albetétek, pénzalapok, karbantartás
-- ============================================================

-- 1. Albetétek (lakások, üzletek, garázsok)
CREATE TABLE IF NOT EXISTS accounty_condo_units (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  unit_type TEXT DEFAULT 'lakas' CHECK (unit_type IN ('lakas','uzlet','garazs','egyeb')),
  area_sqm NUMERIC(8,2),
  ownership_share NUMERIC(6,4),
  owner_name TEXT NOT NULL,
  owner_contact TEXT,
  monthly_common_fee BIGINT NOT NULL DEFAULT 0,
  last_payment_date DATE,
  arrears_amount BIGINT DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Pénzalapok
CREATE TABLE IF NOT EXISTS accounty_condo_funds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fund_name TEXT NOT NULL,
  fund_type TEXT NOT NULL CHECK (fund_type IN ('uzemeltetesi','felujitasi','tartalek','egyeb')),
  target_balance BIGINT DEFAULT 0,
  current_balance BIGINT DEFAULT 0,
  monthly_contribution BIGINT DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, fund_type)
);

-- 3. Karbantartási napló
CREATE TABLE IF NOT EXISTS accounty_condo_maintenance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'altalanos' CHECK (category IN ('altalanos','epuletgepeszet','felujitas','biztonsag','kozterulet')),
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  estimated_cost BIGINT DEFAULT 0,
  actual_cost BIGINT DEFAULT 0,
  vendor_name TEXT,
  planned_date DATE,
  completed_date DATE,
  fund_type TEXT DEFAULT 'felujitasi',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE accounty_condo_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_condo_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_condo_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage condo_units for their companies"
  ON accounty_condo_units FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );
CREATE POLICY "Users can manage condo_funds for their companies"
  ON accounty_condo_funds FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );
CREATE POLICY "Users can manage condo_maintenance for their companies"
  ON accounty_condo_maintenance FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE owner_id = auth.uid())
  );
