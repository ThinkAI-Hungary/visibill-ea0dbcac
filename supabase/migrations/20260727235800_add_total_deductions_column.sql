-- ═══════════════════════════════════════════════════════════════
-- eaisyBooks (Accounty) Bérszámfejtési Modul - Levonások mező javítás
-- ═══════════════════════════════════════════════════════════════

-- 1. total_deductions oszlop hozzáadása
ALTER TABLE public.accounty_payroll_calculations 
ADD COLUMN IF NOT EXISTS total_deductions numeric DEFAULT 0;

-- 2. Meglévő adatok feltöltése a JSONB mezőből
UPDATE public.accounty_payroll_calculations 
SET total_deductions = COALESCE((deductions->>'total')::numeric, 0);

-- Komment az oszlophoz
COMMENT ON COLUMN public.accounty_payroll_calculations.total_deductions IS 'Összes levonás (letiltások és egyéb levonások összege)';
