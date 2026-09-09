-- Migration: Add commute travel reimbursement fields to accounty_employments and accounty_tax_profiles
-- Legal basis: 39/2010. (II. 26.) Korm. rendelet & Szja tv. 25. § (2)

-- 1. Extend accounty_employments with employee commute settings
ALTER TABLE public.accounty_employments
  ADD COLUMN IF NOT EXISTS commute_type text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS commute_distance_km numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commute_monthly_pass_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commute_reimbursement_pct numeric DEFAULT 86;

-- Validation constraint for commute_type
ALTER TABLE public.accounty_employments
  DROP CONSTRAINT IF EXISTS accounty_employments_commute_type_check;

ALTER TABLE public.accounty_employments
  ADD CONSTRAINT accounty_employments_commute_type_check
  CHECK (commute_type IN ('none', 'car', 'public_transit'));

-- Index on commute_type for filtering
CREATE INDEX IF NOT EXISTS idx_accounty_employments_commute_type
  ON public.accounty_employments(commute_type)
  WHERE commute_type != 'none';

-- 2. Extend accounty_tax_profiles with company default car rate (default: 30 Ft/km)
ALTER TABLE public.accounty_tax_profiles
  ADD COLUMN IF NOT EXISTS commute_car_rate_per_km numeric DEFAULT 30;

-- Comments
COMMENT ON COLUMN public.accounty_employments.commute_type IS 'Munkába járás módja: none (nincs), car (saját gépkocsi), public_transit (közösségi közlekedés bérlet/jegy)';
COMMENT ON COLUMN public.accounty_employments.commute_distance_km IS 'Napi oda-vissza távolság km-ben gépkocsi esetén';
COMMENT ON COLUMN public.accounty_employments.commute_monthly_pass_cost IS 'Havi helyközi bérlet vagy menetjegy bruttó költsége Ft-ban';
COMMENT ON COLUMN public.accounty_employments.commute_reimbursement_pct IS 'Közösségi közlekedés térítési százaléka (törvényi minimum 86%, vagy 100%)';
COMMENT ON COLUMN public.accounty_tax_profiles.commute_car_rate_per_km IS 'Céges szintű gépkocsi költségtérítés Ft/km (18-30 Ft/km, default: 30)';
