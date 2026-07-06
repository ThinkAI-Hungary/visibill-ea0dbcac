-- ============================================================
-- Pénzforgalmi ÁFA (Cash-flow VAT) — Schema Changes
-- ============================================================
-- Áfa tv. XIII/A. fejezet: Pénzforgalmi elszámolás
-- ============================================================

-- 1. companies tábla: ÁFA rendszer típus
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS vat_regime TEXT NOT NULL DEFAULT 'normal';

-- Check constraint külön, mert az ADD COLUMN IF NOT EXISTS nem kezeli jól inline-ban
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_vat_regime_check'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_vat_regime_check
      CHECK (vat_regime IN ('normal', 'penzforgalmi', 'alanyi_mentes'));
  END IF;
END $$;

-- 2. companies tábla: mettől érvényes (adóévre)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS vat_regime_effective_from DATE;

COMMENT ON COLUMN public.companies.vat_regime IS
  'ÁFA rendszer: normal = általános, penzforgalmi = pénzforgalmi elszámolás (XIII/A), alanyi_mentes = alanyi adómentesség';
COMMENT ON COLUMN public.companies.vat_regime_effective_from IS
  'Mettől érvényes az aktuális vat_regime (adóév első napja)';

-- 3. nav_invoices: pénzforgalmi jelző a bejövő számlákra
ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS is_cash_accounting BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.nav_invoices.is_cash_accounting IS
  'True ha a számla kibocsátója pénzforgalmi ÁFA-s (a számlán "PÉNZFORGALMI ELSZÁMOLÁS" szerepel)';

-- 4. Indexek
CREATE INDEX IF NOT EXISTS idx_companies_vat_regime
  ON public.companies(vat_regime);
CREATE INDEX IF NOT EXISTS idx_nav_invoices_cash_accounting
  ON public.nav_invoices(company_id, is_cash_accounting)
  WHERE is_cash_accounting = true;
