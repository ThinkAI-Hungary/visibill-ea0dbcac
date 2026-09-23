-- Migration: 20260924000000_gl_accounts_multicurrency.sql
-- Description: Add multicurrency and fixed currency support to gl_accounts

ALTER TABLE public.gl_accounts 
  ADD COLUMN IF NOT EXISTS currency text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_multicurrency boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.gl_accounts.currency IS 'Fix ISO devizanem (pl. EUR, USD, HUF). Ha NULL és is_multicurrency=true, bármilyen deviza könyvelhető rá.';
COMMENT ON COLUMN public.gl_accounts.is_multicurrency IS 'Igényel-e második / deviza értéket könyveléskor (pl. devizás bank, valuta pénztár, devizás vevő/szállító).';

-- Index to optimize filtering by currency and multicurrency flags
CREATE INDEX IF NOT EXISTS idx_gl_accounts_currency ON public.gl_accounts (currency) WHERE currency IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gl_accounts_multicurrency ON public.gl_accounts (is_multicurrency) WHERE is_multicurrency = true;

-- Heuristic data seeding for existing chart of accounts:
-- 1. Devizás bank (386) és valuta pénztár (382) -> is_multicurrency = true
UPDATE public.gl_accounts
SET is_multicurrency = true
WHERE (gl_number LIKE '386%' OR gl_number LIKE '382%' OR gl_number LIKE '316%' OR gl_number LIKE '4542%')
  AND is_multicurrency = false;

-- 2. Forintos bank (384) és forintos házipénztár (381) -> currency = 'HUF', is_multicurrency = false
UPDATE public.gl_accounts
SET currency = 'HUF', is_multicurrency = false
WHERE (gl_number LIKE '384%' OR gl_number LIKE '381%')
  AND currency IS NULL;
