-- Migration: 20260903170000_link_and_verify_submitted_invoice.sql
-- Description:
-- 1. link_and_verify_submitted_invoice RPC for single-click linking & approval of suggested/manual invoice matches.
-- 2. Bidirectional trigger sync:
--    - When invoices.bizonylatsorszam is set/updated, auto-verify nav_status and update nav_invoices.submitted = true.
--    - Whitespace and case-insensitive matching.

-- ============================================================================
-- 1. Accountant / User Linking & Approval RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.link_and_verify_submitted_invoice(
  p_submitted_invoice_id uuid,
  p_nav_invoice_id uuid,
  p_approval_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub_inv record;
  v_nav_inv record;
  v_user_id uuid;
  v_company_id uuid;
  v_note text;
BEGIN
  v_user_id := auth.uid();

  -- 1. Fetch submitted invoice
  SELECT id, company_id, bizonylatsorszam, statusz, nav_status, invoice_type, fizetesi_mod
  INTO v_sub_inv
  FROM public.invoices
  WHERE id = p_submitted_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A beküldött számla nem található (id: %)', p_submitted_invoice_id;
  END IF;

  v_company_id := v_sub_inv.company_id;

  -- 2. Fetch NAV invoice
  SELECT id, company_id, invoice_number, invoice_direction, submitted
  INTO v_nav_inv
  FROM public.nav_invoices
  WHERE id = p_nav_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A NAV számla nem található (id: %)', p_nav_invoice_id;
  END IF;

  -- Multi-tenancy guard: both must belong to the same company
  IF v_sub_inv.company_id IS DISTINCT FROM v_nav_inv.company_id THEN
    RAISE EXCEPTION 'A beküldött számla és a NAV számla különböző cégekhez tartozik! Művelet megtagadva.';
  END IF;

  -- Security check: user must be company member, assigned accountant in Accounty, or superadmin
  IF v_user_id IS NOT NULL AND NOT (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = v_company_id AND user_id = v_user_id
    )
    OR public.has_accounty_company_access(v_company_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = v_user_id AND role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég számláinak összerendeléséhez és jóváhagyásához';
  END IF;

  -- Duplicate check: ensure no other submitted invoice has this exact sorszam in this company
  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE company_id = v_company_id
      AND REPLACE(LOWER(bizonylatsorszam), ' ', '') = REPLACE(LOWER(v_nav_inv.invoice_number), ' ', '')
      AND id != p_submitted_invoice_id
  ) THEN
    RAISE EXCEPTION 'Már létezik számla ezzel a bizonylatsorszámmal (%) a cégnél!', v_nav_inv.invoice_number;
  END IF;

  v_note := COALESCE(
    NULLIF(TRIM(p_approval_note), ''),
    'Kézi / Javasolt összerendelés és jóváhagyás NAV számlával (' || v_nav_inv.invoice_number || ')'
  );

  -- 3. Update submitted invoice
  UPDATE public.invoices
  SET
    bizonylatsorszam = v_nav_inv.invoice_number,
    nav_status = 'verified',
    statusz = 'feldolgozott',
    approved_at = NOW(),
    approved_by = v_user_id,
    approval_note = v_note,
    frissitve = NOW()
  WHERE id = p_submitted_invoice_id;

  -- 4. Update NAV invoice submitted flag
  UPDATE public.nav_invoices
  SET
    submitted = true
  WHERE id = p_nav_invoice_id;

  -- 5. If petty cash invoice, trigger petty cash sync
  IF v_sub_inv.invoice_type = 'penztarbizonylat' OR (v_sub_inv.fizetesi_mod IS NOT NULL AND v_sub_inv.fizetesi_mod ILIKE '%készpénz%') THEN
    PERFORM public.sync_petty_cash_entries(v_company_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'submitted_invoice_id', p_submitted_invoice_id,
    'nav_invoice_id', p_nav_invoice_id,
    'invoice_number', v_nav_inv.invoice_number,
    'statusz', 'feldolgozott',
    'nav_status', 'verified',
    'approved_at', NOW(),
    'approved_by', v_user_id,
    'approval_note', v_note
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_and_verify_submitted_invoice FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_and_verify_submitted_invoice TO authenticated, service_role;

-- ============================================================================
-- 2. Enhanced Trigger: mark_nav_invoice_as_submitted (AFTER INSERT OR UPDATE)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_nav_invoice_as_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Mark target NAV invoice as submitted
  IF NEW.bizonylatsorszam IS NOT NULL THEN
    UPDATE public.nav_invoices
    SET submitted = true
    WHERE REPLACE(LOWER(invoice_number), ' ', '') = REPLACE(LOWER(NEW.bizonylatsorszam), ' ', '')
      AND (
        (company_id = NEW.company_id) 
        OR (company_id IS NULL AND NEW.company_id IS NULL)
      )
      AND (submitted IS NULL OR submitted = false);
  END IF;

  -- 2. If bizonylatsorszam changed on UPDATE, reset previous NAV invoice submitted flag if no other invoice uses it
  IF TG_OP = 'UPDATE' AND OLD.bizonylatsorszam IS NOT NULL AND (NEW.bizonylatsorszam IS NULL OR OLD.bizonylatsorszam != NEW.bizonylatsorszam) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices
      WHERE id != NEW.id
        AND company_id = OLD.company_id
        AND REPLACE(LOWER(bizonylatsorszam), ' ', '') = REPLACE(LOWER(OLD.bizonylatsorszam), ' ', '')
    ) THEN
      UPDATE public.nav_invoices
      SET submitted = false
      WHERE REPLACE(LOWER(invoice_number), ' ', '') = REPLACE(LOWER(OLD.bizonylatsorszam), ' ', '')
        AND (
          (company_id = OLD.company_id)
          OR (company_id IS NULL AND OLD.company_id IS NULL)
        )
        AND submitted = true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_mark_nav_invoice_submitted ON public.invoices;
CREATE TRIGGER trigger_mark_nav_invoice_submitted
  AFTER INSERT OR UPDATE OF bizonylatsorszam, company_id
  ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION mark_nav_invoice_as_submitted();

-- ============================================================================
-- 3. Auto-Verify trigger on invoices bizonylatsorszam change (BEFORE INSERT OR UPDATE)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_submitted_invoice_on_bizonylatsorszam_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.bizonylatsorszam IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.bizonylatsorszam IS NULL OR OLD.bizonylatsorszam != NEW.bizonylatsorszam) THEN
    -- Check if authoritative nav_invoices record exists for this company
    IF EXISTS (
      SELECT 1 FROM public.nav_invoices ni
      WHERE ni.company_id = NEW.company_id
        AND REPLACE(LOWER(ni.invoice_number), ' ', '') = REPLACE(LOWER(NEW.bizonylatsorszam), ' ', '')
    ) THEN
      NEW.nav_status := 'verified';
      IF NEW.statusz = 'jovahagyasra_var' AND NEW.approved_at IS NULL THEN
        NEW.statusz := 'feldolgozott';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_submitted_invoice_on_bizonylat_change ON public.invoices;
CREATE TRIGGER trg_sync_submitted_invoice_on_bizonylat_change
  BEFORE INSERT OR UPDATE OF bizonylatsorszam
  ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_submitted_invoice_on_bizonylatsorszam_change();
