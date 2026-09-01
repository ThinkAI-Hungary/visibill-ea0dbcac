-- =============================================================================
-- Migration: Auto-sync company to eaisyBooks (accounty) on company creation
-- Date: 2026-09-01
-- Description:
-- When a company is created by an accountant user (who belongs to an accounting firm),
-- automatically generate accounty_assignments, accounty_tax_profiles, and
-- accounty_communication_preferences records.
-- Also backfills existing orphaned companies owned by accountants.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.on_company_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_firm_id uuid;
  v_user_role text;
  v_has_main boolean;
BEGIN
  -- 1. Create company membership for the owner
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.company_members (user_id, company_id, role)
    VALUES (NEW.owner_id, NEW.id, 'owner')
    ON CONFLICT (user_id, company_id) DO NOTHING;

    -- 2. Check if the creator (owner) belongs to an accounting firm
    -- We query existing assignments of NEW.owner_id to find their accounting_firm_id
    -- Prioritize 'iroda_admin' > 'senior_könyvelő' > others, oldest assignment first
    SELECT accounting_firm_id, role
    INTO v_firm_id, v_user_role
    FROM public.accounty_assignments
    WHERE accountant_user_id = NEW.owner_id
      AND accounting_firm_id IS NOT NULL
    ORDER BY (
      CASE 
        WHEN role = 'iroda_admin' THEN 1 
        WHEN role = 'senior_könyvelő' THEN 2 
        WHEN role = 'könyvelő' THEN 3
        ELSE 4 
      END
    ), created_at ASC
    LIMIT 1;

    -- 3. If the user is part of an accounting firm, auto-link this new company to their firm in eaisyBooks
    IF v_firm_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.accounty_assignments 
        WHERE company_id = NEW.id AND is_main_accountant = true
      ) INTO v_has_main;

      -- Create accounty assignment
      INSERT INTO public.accounty_assignments (
        accountant_user_id,
        company_id,
        accounting_firm_id,
        role,
        is_primary,
        is_main_accountant,
        source
      ) VALUES (
        NEW.owner_id,
        NEW.id,
        v_firm_id,
        COALESCE(v_user_role, 'iroda_admin'),
        true,
        NOT v_has_main,
        'sync'
      )
      ON CONFLICT (accountant_user_id, company_id) DO UPDATE SET
        accounting_firm_id = EXCLUDED.accounting_firm_id,
        is_primary = true,
        updated_at = now();

      -- Create default tax profile
      INSERT INTO public.accounty_tax_profiles (
        company_id,
        vat_frequency,
        contribution_frequency,
        is_kata,
        is_kiva
      ) VALUES (
        NEW.id,
        'monthly',
        'monthly',
        false,
        false
      )
      ON CONFLICT (company_id) DO NOTHING;

      -- Create default communication preferences
      INSERT INTO public.accounty_communication_preferences (
        company_id,
        channel_email,
        auto_reminder
      ) VALUES (
        NEW.id,
        true,
        true
      )
      ON CONFLICT (company_id) DO NOTHING;
    END IF;
  END IF;

  -- 4. Create default Central Petty Cash Register
  INSERT INTO public.petty_cash_registers (company_id, name, is_default, currencies, created_by)
  VALUES (NEW.id, 'Központi pénztár', true, '{HUF}', NEW.owner_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Explicit permissions
REVOKE EXECUTE ON FUNCTION public.on_company_created() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.on_company_created() TO authenticated, service_role;

-- Recreate trigger to ensure it's active
DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.on_company_created();

-- =============================================================================
-- BACKFILL: Existing companies owned by accountants without accounty_assignments
-- =============================================================================

-- 1. Backfill accounty_assignments
INSERT INTO public.accounty_assignments (
  accountant_user_id,
  company_id,
  accounting_firm_id,
  role,
  is_primary,
  is_main_accountant,
  source
)
SELECT 
  cm.user_id AS accountant_user_id,
  c.id AS company_id,
  aa_firm.accounting_firm_id,
  COALESCE(aa_firm.role, 'iroda_admin') AS role,
  true AS is_primary,
  NOT EXISTS (
    SELECT 1 FROM public.accounty_assignments existing 
    WHERE existing.company_id = c.id AND existing.is_main_accountant = true
  ) AS is_main_accountant,
  'sync' AS source
FROM public.companies c
JOIN public.company_members cm ON cm.company_id = c.id AND cm.role = 'owner'
JOIN LATERAL (
  SELECT aa_sub.accounting_firm_id, aa_sub.role
  FROM public.accounty_assignments aa_sub
  WHERE aa_sub.accountant_user_id = cm.user_id
    AND aa_sub.accounting_firm_id IS NOT NULL
  ORDER BY (
    CASE 
      WHEN aa_sub.role = 'iroda_admin' THEN 1 
      WHEN aa_sub.role = 'senior_könyvelő' THEN 2 
      WHEN aa_sub.role = 'könyvelő' THEN 3
      ELSE 4 
    END
  ), aa_sub.created_at ASC
  LIMIT 1
) aa_firm ON true
LEFT JOIN public.accounty_assignments aa ON aa.company_id = c.id AND aa.accountant_user_id = cm.user_id
WHERE aa.id IS NULL
ON CONFLICT (accountant_user_id, company_id) DO NOTHING;

-- 2. Backfill accounty_tax_profiles for any missing companies with accounty_assignments
INSERT INTO public.accounty_tax_profiles (
  company_id,
  vat_frequency,
  contribution_frequency,
  is_kata,
  is_kiva
)
SELECT 
  DISTINCT aa.company_id,
  'monthly',
  'monthly',
  false,
  false
FROM public.accounty_assignments aa
LEFT JOIN public.accounty_tax_profiles tp ON tp.company_id = aa.company_id
WHERE tp.id IS NULL
ON CONFLICT (company_id) DO NOTHING;

-- 3. Backfill accounty_communication_preferences for any missing companies with accounty_assignments
INSERT INTO public.accounty_communication_preferences (
  company_id,
  channel_email,
  auto_reminder
)
SELECT 
  DISTINCT aa.company_id,
  true,
  true
FROM public.accounty_assignments aa
LEFT JOIN public.accounty_communication_preferences cp ON cp.company_id = aa.company_id
WHERE cp.id IS NULL
ON CONFLICT (company_id) DO NOTHING;
