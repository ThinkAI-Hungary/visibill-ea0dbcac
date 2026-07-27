-- ═══════════════════════════════════════════════════════════════
-- eaisyBooks (Accounty) Bérszámfejtési Modul - Másutt megfizetett minimum járulékalap
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS is_min_base_paid_elsewhere boolean DEFAULT false;
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS other_company_name text;
ALTER TABLE accounty_employments ADD COLUMN IF NOT EXISTS other_company_tax_number text;
