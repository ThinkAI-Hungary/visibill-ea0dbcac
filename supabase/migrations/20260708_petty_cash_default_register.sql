-- ============================================================
-- Auto-create default Central Cash Register for new companies
-- ============================================================

CREATE OR REPLACE FUNCTION public.on_company_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 1. Create company membership for the owner
  INSERT INTO public.company_members (user_id, company_id)
  VALUES (NEW.owner_id, NEW.id)
  ON CONFLICT (user_id, company_id) DO NOTHING;
  
  -- 2. Create default Central Petty Cash Register
  INSERT INTO public.petty_cash_registers (company_id, name, is_default, currencies, created_by)
  VALUES (NEW.id, 'Központi pénztár', true, '{HUF}', NEW.owner_id)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Backfill existing companies that do not have a default register yet
INSERT INTO public.petty_cash_registers (company_id, name, is_default, currencies, created_by)
SELECT c.id, 'Központi pénztár', true, '{HUF}', c.owner_id
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.petty_cash_registers r WHERE r.company_id = c.id AND r.is_default = true
)
ON CONFLICT DO NOTHING;
