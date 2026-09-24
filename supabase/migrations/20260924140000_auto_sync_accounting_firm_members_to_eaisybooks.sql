-- Migration: 20260924140000_auto_sync_accounting_firm_members_to_eaisybooks.sql
-- Description: Automatically grant eaisybooks_access and link new members of accounting firms to eaisyBooks assignments

CREATE OR REPLACE FUNCTION public.sync_company_member_to_eaisybooks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_firm_id uuid;
  v_is_firm boolean := false;
BEGIN
  -- 1. Check if the target company is itself registered as an accounting firm (or acts as firm)
  SELECT aa.accounting_firm_id INTO v_firm_id
  FROM public.accounty_assignments aa
  WHERE aa.accounting_firm_id = NEW.company_id
  LIMIT 1;

  IF v_firm_id IS NOT NULL THEN
    v_is_firm := true;
  ELSE
    -- 2. Check if the company belongs to a firm whose owner is an iroda_admin of that firm
    SELECT aa.accounting_firm_id INTO v_firm_id
    FROM public.companies c
    JOIN public.accounty_assignments aa ON aa.accountant_user_id = c.owner_id
    WHERE c.id = NEW.company_id
      AND aa.role = 'iroda_admin'
      AND aa.accounting_firm_id IS NOT NULL
    LIMIT 1;
    
    IF v_firm_id IS NOT NULL THEN
      v_is_firm := true;
    END IF;
  END IF;

  -- If this company is an accounting firm or the central office company of a firm
  IF v_is_firm AND v_firm_id IS NOT NULL THEN
    -- A) Automatically grant eaisybooks_access in profiles if not already granted
    UPDATE public.profiles
    SET eaisybooks_access = true,
        updated_at = now()
    WHERE user_id = NEW.user_id
      AND (eaisybooks_access IS NOT TRUE);

    -- B) Automatically create accounty_assignment for this user and company
    INSERT INTO public.accounty_assignments (
      accountant_user_id,
      company_id,
      accounting_firm_id,
      role,
      is_primary,
      is_main_accountant,
      kanban_status,
      source
    ) VALUES (
      NEW.user_id,
      NEW.company_id,
      v_firm_id,
      CASE WHEN NEW.role = 'admin' THEN 'iroda_admin' ELSE 'könyvelő' END,
      true,
      false,
      'aktiv',
      'sync'
    )
    ON CONFLICT (accountant_user_id, company_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Drop existing trigger if any and recreate
DROP TRIGGER IF EXISTS trg_company_members_auto_eaisybooks_sync ON public.company_members;

CREATE TRIGGER trg_company_members_auto_eaisybooks_sync
  AFTER INSERT ON public.company_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_company_member_to_eaisybooks();

COMMENT ON FUNCTION public.sync_company_member_to_eaisybooks() IS 'Automatically grants eaisybooks_access and creates accounty_assignment when a user is added to an accounting firm company.';
