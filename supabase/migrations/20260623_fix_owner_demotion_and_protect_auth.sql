-- ============================================================================
-- PREVENT OWNER DEMOTION & SECURITY HARDENING
-- ============================================================================

-- 1. Trigger function to protect company owner from being demoted or removed,
-- and protect the companies.owner_id from pointing to non-members.
CREATE OR REPLACE FUNCTION public.protect_company_owner_demotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_owner_id UUID;
BEGIN
  -- Get the current owner of the company
  SELECT owner_id INTO v_company_owner_id
  FROM public.companies
  WHERE id = COALESCE(NEW.company_id, OLD.company_id);

  -- If the user being modified is the company owner
  IF (TG_OP = 'UPDATE' AND OLD.user_id = v_company_owner_id) THEN
    -- Prevent changing their role to anything other than owner
    IF NEW.role != 'owner' THEN
      RAISE EXCEPTION 'A cég tulajdonosának szerepköre nem módosítható alacsonyabb szintre!';
    END IF;
    -- Prevent changing the user_id of the owner row
    IF NEW.user_id != OLD.user_id THEN
      RAISE EXCEPTION 'A tulajdonosi tagsági bejegyzés felhasználója nem módosítható!';
    END IF;
  ELSIF (TG_OP = 'DELETE' AND OLD.user_id = v_company_owner_id) THEN
    -- Prevent deleting the owner's membership
    RAISE EXCEPTION 'A cég tulajdonosának tagsága nem törölhető!';
  END IF;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to company_members
DROP TRIGGER IF EXISTS trg_protect_company_owner ON public.company_members;
CREATE TRIGGER trg_protect_company_owner
  BEFORE UPDATE OR DELETE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_company_owner_demotion();

-- 2. Trigger on companies table to ensure owner_id can only be set to a user 
-- who is already a member with 'owner' role in company_members.
CREATE OR REPLACE FUNCTION public.validate_company_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only validate if owner_id changes
  IF (TG_OP = 'UPDATE' AND NEW.owner_id = OLD.owner_id) THEN
    RETURN NEW;
  END IF;

  -- Verify new owner is a member and has 'owner' role
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = NEW.id
      AND user_id = NEW.owner_id
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Az új tulajdonosnak a cég tagjának kell lennie "owner" szerepkörrel!';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_company_owner ON public.companies;
CREATE TRIGGER trg_validate_company_owner
  BEFORE UPDATE OF owner_id ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.validate_company_owner_change();
