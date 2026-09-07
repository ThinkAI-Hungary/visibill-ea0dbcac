-- -----------------------------------------------------------------------------
-- Migration: 20260907120000_vat_pro_rata_schema.sql
-- Description: ÁFA Arányosítás (Pro-rata VAT allocation) adatbázis séma (Áfa tv. 123. § & 5. sz. melléklet)
-- -----------------------------------------------------------------------------

-- 1. Create VAT Deductibility Enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vat_deductibility_enum') THEN
        CREATE TYPE vat_deductibility_enum AS ENUM ('FULL', 'NONE', 'PRO_RATA');
    END IF;
END $$;

-- 2. Add vat_deductibility_type column to acc_journal_lines if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'acc_journal_lines' AND column_name = 'vat_deductibility_type'
    ) THEN
        ALTER TABLE acc_journal_lines 
        ADD COLUMN vat_deductibility_type vat_deductibility_enum DEFAULT 'FULL';
    END IF;
END $$;

-- 3. vat_pro_rata_settings table (Cégenkénti és évenkénti arányosítási beállítások)
CREATE TABLE IF NOT EXISTS vat_pro_rata_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    accounting_year INTEGER NOT NULL,
    method TEXT NOT NULL DEFAULT 'CUMULATIVE_9B' CHECK (method IN ('PREVIOUS_YEAR_9A', 'CUMULATIVE_9B')),
    prev_year_ratio NUMERIC(5,4) DEFAULT 1.0000 CHECK (prev_year_ratio >= 0 AND prev_year_ratio <= 1),
    current_final_ratio NUMERIC(5,4) CHECK (current_final_ratio >= 0 AND current_final_ratio <= 1),
    is_finalized BOOLEAN DEFAULT FALSE,
    non_deductible_gl_account_id UUID REFERENCES gl_accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT vat_pro_rata_settings_company_year_key UNIQUE (company_id, accounting_year)
);

-- 4. vat_pro_rata_periods table (Havi/időszaki göngyölített bevételek és kiszámított levonási hányadosok)
CREATE TABLE IF NOT EXISTS vat_pro_rata_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    accounting_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    taxable_revenue NUMERIC NOT NULL DEFAULT 0,
    exempt_revenue NUMERIC NOT NULL DEFAULT 0,
    non_taxable_subsidies NUMERIC NOT NULL DEFAULT 0,
    raw_ratio NUMERIC(7,6) NOT NULL DEFAULT 1.000000,
    rounded_ratio NUMERIC(5,4) NOT NULL DEFAULT 1.0000 CHECK (rounded_ratio >= 0 AND rounded_ratio <= 1),
    pro_rata_base_amount NUMERIC NOT NULL DEFAULT 0,
    pro_rata_input_vat NUMERIC NOT NULL DEFAULT 0,
    deductible_vat NUMERIC NOT NULL DEFAULT 0,
    non_deductible_vat NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT vat_pro_rata_periods_company_year_month_key UNIQUE (company_id, accounting_year, period_month)
);

-- Indexek
CREATE INDEX IF NOT EXISTS idx_vat_pro_rata_settings_company_year ON vat_pro_rata_settings(company_id, accounting_year);
CREATE INDEX IF NOT EXISTS idx_vat_pro_rata_periods_company_year_month ON vat_pro_rata_periods(company_id, accounting_year, period_month);

-- 5. RLS politikák
ALTER TABLE vat_pro_rata_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_pro_rata_periods ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view pro rata settings of their company" ON vat_pro_rata_settings;
    CREATE POLICY "Users can view pro rata settings of their company" ON vat_pro_rata_settings
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM company_members cm
                WHERE cm.company_id = vat_pro_rata_settings.company_id
                AND cm.user_id = auth.uid()
            )
        );

    DROP POLICY IF EXISTS "Users can manage pro rata settings of their company" ON vat_pro_rata_settings;
    CREATE POLICY "Users can manage pro rata settings of their company" ON vat_pro_rata_settings
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM company_members cm
                WHERE cm.company_id = vat_pro_rata_settings.company_id
                AND cm.user_id = auth.uid()
            )
        );

    DROP POLICY IF EXISTS "Users can view pro rata periods of their company" ON vat_pro_rata_periods;
    CREATE POLICY "Users can view pro rata periods of their company" ON vat_pro_rata_periods
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM company_members cm
                WHERE cm.company_id = vat_pro_rata_periods.company_id
                AND cm.user_id = auth.uid()
            )
        );

    DROP POLICY IF EXISTS "Users can manage pro rata periods of their company" ON vat_pro_rata_periods;
    CREATE POLICY "Users can manage pro rata periods of their company" ON vat_pro_rata_periods
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM company_members cm
                WHERE cm.company_id = vat_pro_rata_periods.company_id
                AND cm.user_id = auth.uid()
            )
        );
END $$;
