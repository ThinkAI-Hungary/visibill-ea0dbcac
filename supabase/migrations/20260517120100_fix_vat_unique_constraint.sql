-- ============================================================
-- FIX: ÁFA BEVALLÁS — Unique constraint + frequency szűrés
-- ============================================================
-- A vat_returns_monthly_uq index nem tartalmazta a frequency-t,
-- így havi és negyedéves bevallás ütközött egymással.

-- Drop old indexes
DROP INDEX IF EXISTS vat_returns_monthly_uq;
DROP INDEX IF EXISTS vat_returns_quarterly_uq;

-- Create new combined unique index that includes frequency
CREATE UNIQUE INDEX IF NOT EXISTS vat_returns_period_uq
  ON vat_returns(company_id, period_year, period_month, frequency)
  WHERE period_month IS NOT NULL;
