-- ═══════════════════════════════════════════════════════════════
-- eaisyBooks (Accounty) Bérszámfejtési Modul Továbbfejlesztése
-- ═══════════════════════════════════════════════════════════════

-- 1. accounty_employees bővítése
ALTER TABLE accounty_employees ADD COLUMN IF NOT EXISTS eu_tax_id text;
ALTER TABLE accounty_employees ADD COLUMN IF NOT EXISTS education_level text;
ALTER TABLE accounty_employees ADD COLUMN IF NOT EXISTS has_age_concession boolean DEFAULT false;
ALTER TABLE accounty_employees ADD COLUMN IF NOT EXISTS has_union_fee boolean DEFAULT false;
ALTER TABLE accounty_employees ADD COLUMN IF NOT EXISTS has_no_hungarian_address boolean DEFAULT false;

-- 2. Új tábla: accounty_dependents (Eltartottak)
CREATE TABLE IF NOT EXISTS accounty_dependents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES accounty_employees(id) ON DELETE CASCADE,
    birth_name text NOT NULL,
    tax_id text,
    taj_number text,
    birth_date date,
    mothers_birth_name text,
    address jsonb,
    is_fetus boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- RLS engedélyezése az eltartottakra
ALTER TABLE accounty_dependents ENABLE ROW LEVEL SECURITY;

-- Egyszerűsített hozzáférési szabályok (mint a többi accounty táblánál)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'accounty_dependents' AND policyname = 'accounty_dependents_all_policy'
    ) THEN
        CREATE POLICY accounty_dependents_all_policy ON accounty_dependents 
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3. accounty_employments bővítése
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS is_pensioner boolean DEFAULT false;
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS pension_type text;
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS is_ekho boolean DEFAULT false;
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS ekho_payer text; -- 'employee' | 'employer'
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS ekho_category text; -- 'normal' | 'athlete' | 'egt'
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS is_szocho_discount boolean DEFAULT false;
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS szocho_discount_type text; -- 'agriculture', 'market_entry', 'mother_market_entry', 'phd_researcher'
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS szocho_discount_start date;
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS szocho_discount_end date;
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS minimum_contribution_base_rule text; -- 'minimal_wage' | 'guaranteed_minimum' | 'none'
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS has_minimum_base boolean DEFAULT false;
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS is_min_base_exempt_gyes_gyed boolean DEFAULT false;
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS is_min_base_exempt_student boolean DEFAULT false;
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS is_unequal_work_schedule boolean DEFAULT false; -- egyenlőtlen munkarend (munkaidőkeret)
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS insurance_relationship_code text; -- 4 számjegyű TB kód
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS job_valid_from date;
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS feor_description text;

-- 4. accounty_cafeteria bővítése
ALTER TABLE accounty_cafeteria ADD COLUMN IF NOT EXISTS sub_type text; -- 'basic' | 'recreation'
ALTER TABLE accounty_cafeteria ADD COLUMN IF NOT EXISTS is_housing_allowance boolean DEFAULT false;
